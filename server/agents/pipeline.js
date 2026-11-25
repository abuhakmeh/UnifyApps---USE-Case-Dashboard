// Orchestrator: runs the agents in order and records each step on the use case so the UI can
// show the workflow live. A failure in an optional step never blocks the profile.
import { db, newId } from "../db.js";
import { scout, detectEmbeddable } from "./scout.js";
import { analyse } from "./analyst.js";
import { estimateRoi } from "./roi.js";
import { findLogo } from "./brand.js";

export const STEPS = [
  { key: "scout", label: "Scout · reading the link" },
  { key: "analyst", label: "Analyst · type, summary & verticals" },
  { key: "roi", label: "ROI agent · value estimate" },
  { key: "brand", label: "Brand agent · customer logo" },
  { key: "graph", label: "Graph indexer · linking context" },
];

export const freshPipeline = () => STEPS.map((s) => ({ ...s, status: "pending", detail: "" }));

function step(id, key, patch) {
  db.update(id, (uc) => {
    const s = uc.pipeline.find((p) => p.key === key);
    Object.assign(s, patch, patch.status === "running" ? { startedAt: new Date().toISOString() } : {},
      ["done", "failed", "skipped"].includes(patch.status) ? { finishedAt: new Date().toISOString() } : {});
  });
}

async function run(id, key, fn) {
  step(id, key, { status: "running" });
  try {
    const r = await fn();
    step(id, key, { status: r?.status || "done", detail: r?.detail || "" });
    return r;
  } catch (e) {
    console.error(`[pipeline:${key}]`, e);
    step(id, key, { status: "failed", detail: e.message });
    throw e;
  }
}

const running = new Set();

export async function runPipeline(id, { force = false } = {}) {
  if (running.has(id)) return;
  running.add(id);
  const uc = db.get(id);
  const hints = { customer: uc.customerHint || "", notes: uc.ownerNotes || "" };
  db.update(id, { status: "processing", pipeline: freshPipeline(), error: "" });

  try {
    const scouted = await run(id, "scout", async () => {
      const s = await scout(uc.url);
      db.update(id, { source: { title: s.title, description: s.description, image: s.image, favicon: s.favicon, host: s.host, notes: s.notes }, screenshot: s.screenshot || uc.screenshot || s.image || "" });
      return { ...s, detail: `${s.text.length.toLocaleString()} chars read${s.screenshot ? " · screenshot captured" : ""}` };
    });

    const profile = await run(id, "analyst", async () => {
      const p = await analyse(scouted, hints);
      const cur = db.get(id);
      const keep = (field, val) => (cur.locked?.includes(field) ? cur[field] : val);
      db.update(id, {
        title: keep("title", p.title), titleAr: keep("titleAr", p.title_ar),
        summary: keep("summary", p.summary), summaryAr: keep("summaryAr", p.summary_ar),
        problem: p.problem, type: keep("type", p.type), secondaryTypes: p.secondary_types,
        verticals: keep("verticals", p.verticals), stage: keep("stage", p.stage),
        capabilities: p.capabilities, integrations: p.integrations, personas: p.personas, tags: p.tags,
        analyzer: p.analyzer,
      });
      return { ...p, detail: `${p.type} · ${p.verticals.join(", ")}${p.analyzer === "heuristic" ? " (keyword mode)" : ""}` };
    });

    await run(id, "roi", async () => {
      const roi = await estimateRoi({ ...profile, type: db.get(id).type, verticals: db.get(id).verticals });
      db.update(id, { roi });
      return { detail: roi.headline };
    }).catch(() => {});

    await run(id, "brand", async () => {
      const cur = db.get(id);
      const name = cur.customerHint || cur.customer?.name || profile.customer?.name;
      if (!name && !profile.customer?.domain) return { status: "skipped", detail: "No customer identified" };
      if (cur.customer?.logo && cur.customer?.manualLogo && !force) return { detail: "Kept uploaded logo" };
      const found = await findLogo({ name, domain: cur.customer?.domain || profile.customer?.domain });
      db.update(id, { customer: { ...(cur.customer || {}), name, domain: found?.domain || null, logo: found?.logo || cur.customer?.logo || null } });
      return { detail: found?.logo ? `${name} · logo found` : `${name} · no logo found` };
    }).catch(() => {});

    await run(id, "graph", async () => {
      const kind = detectEmbeddable(uc.url);
      const cur = db.get(id);
      if (kind && !cur.assets.some((a) => a.url === uc.url)) {
        db.update(id, { assets: [...cur.assets, { id: newId(), kind, title: "Source link", url: uc.url, createdAt: new Date().toISOString() }] });
      }
      const links = (cur.verticals?.length || 0) + (cur.integrations?.length || 0) + (cur.customer?.name ? 1 : 0) + 1;
      return { detail: `${links} relationships indexed` };
    });

    db.update(id, { status: "ready" });
    db.log({ type: "profiled", useCaseId: id, title: db.get(id).title });
  } catch (e) {
    db.update(id, { status: "failed", error: e.message, title: db.get(id).title || uc.url });
    db.log({ type: "failed", useCaseId: id, title: uc.url, detail: e.message });
  } finally {
    running.delete(id);
  }
}

export function createUseCase({ url, customer, notes, confidential }) {
  const now = new Date().toISOString();
  const uc = {
    id: newId(), url, createdAt: now, updatedAt: now, status: "queued",
    title: "", titleAr: "", summary: "", summaryAr: "", problem: "",
    type: "", secondaryTypes: [], verticals: [], stage: "Prototype",
    capabilities: [], integrations: [], personas: [], tags: [],
    customer: customer ? { name: customer, domain: null, logo: null } : null,
    customerHint: customer || "", ownerNotes: notes || "",
    confidential: Boolean(confidential), featured: false,
    roi: null, assets: [], screenshot: "", source: {}, locked: [],
    pipeline: freshPipeline(), analyzer: "",
  };
  if (notes) uc.assets.push({ id: newId(), kind: "note", title: "Owner notes", text: notes, createdAt: now });
  db.insert(uc);
  db.log({ type: "added", useCaseId: uc.id, title: url });
  return uc;
}

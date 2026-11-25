// Data layer for the private Artifact: claude.ai's shared store (db), uploads (assets),
// Claude (sample), viewer identity (user) and file saving (downloads). Same surface as the
// server version's api.js so the screens are unchanged.
import { VERTICALS, USE_CASE_TYPES, STAGES } from "./lib/taxonomy.js";
import { redact, stats, graph } from "./lib/core.js";
import { analyse, estimateRoi, ask, freshPipeline } from "./lib/agents.js";

const use = (name) => (window.claude?.use ? window.claude.use(name).catch(() => null) : Promise.resolve(null));
const caps = {};
const cap = (name) => (caps[name] ||= use(name));

let items = [];
let settings = { hideCustomers: false };
let activity = [];
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());
let started = null;

const newId = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(16).padStart(2, "0")).join("");
const now = () => new Date().toISOString();

function start() {
  if (started) return started;
  started = (async () => {
    const db = await cap("db");
    if (!db) return false;
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 10000);
      db.collection("usecases").onSnapshot((snap) => {
        items = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
        clearTimeout(timer); resolve(); emit();
      }, () => { clearTimeout(timer); resolve(); });
      db.doc("meta/settings").onSnapshot((d) => { settings = { hideCustomers: false, ...(d.data() || {}) }; emit(); });
      db.collection("activity").orderBy("at", "desc").limit(60).onSnapshot((s) => { activity = s.docs.map((d) => ({ id: d.id, ...d.data() })); emit(); });
    });
    // A run interrupted by closing the tab stays "processing"; flag it so it can be re-run.
    for (const u of items) if (["processing", "queued"].includes(u.status) && Date.now() - Date.parse(u.updatedAt || u.createdAt) > 5 * 60000) {
      db.doc(`usecases/${u.id}`).update({ status: "failed", error: "Interrupted before the agents finished. Use Re-run agents." });
    }
    return true;
  })();
  return started;
}

async function save(id, patch) {
  const db = await cap("db");
  const cur = items.find((u) => u.id === id);
  const next = { ...(cur || {}), ...patch, updatedAt: now() };
  delete next.id;
  if (cur) Object.assign(cur, patch);
  await db.doc(`usecases/${id}`).set(next);
  return { id, ...next };
}

async function log(type, title, useCaseId, detail) {
  const db = await cap("db");
  db?.collection("activity").doc(newId()).set({ type, title: title || "", useCaseId: useCaseId || "", detail: detail || "", at: now() }).catch(() => {});
}

let viewLang = "en";
export const setViewLang = (l) => { viewLang = l; };
const view = (reveal) => (u) => redact(u, settings, reveal);

// ---------- agent workflow ----------
const running = new Set();
async function runPipeline(id, screenshotBlob) {
  if (running.has(id)) return;
  running.add(id);
  const sample = await cap("sample");
  const pipeline = freshPipeline();
  const step = async (key, patch) => { Object.assign(pipeline.find((p) => p.key === key), patch, patch.status !== "running" ? { finishedAt: now() } : {}); await save(id, { pipeline: [...pipeline.map((p) => ({ ...p }))] }); };
  const uc = items.find((u) => u.id === id);
  try {
    await save(id, { status: "processing", pipeline, error: "" });
    await step("scout", { status: "running" });
    let shot = screenshotBlob || null;
    if (!shot && uc.screenshot) { try { shot = await (await fetch(uc.screenshot)).blob(); } catch { shot = null; } }
    await step("scout", { status: "done", detail: shot ? "Link + screenshot" : "Link and notes (no screenshot)" });

    await step("analyst", { status: "running" });
    const p = await analyse(sample, { url: uc.url, customer: uc.customerHint, notes: uc.ownerNotes, screenshot: shot });
    const cur = items.find((u) => u.id === id);
    const keep = (f, v) => (cur.locked?.includes(f) ? cur[f] : v);
    await save(id, {
      title: keep("title", p.title), titleAr: keep("titleAr", p.title_ar), summary: keep("summary", p.summary), summaryAr: keep("summaryAr", p.summary_ar),
      problem: p.problem, type: keep("type", p.type), secondaryTypes: p.secondary_types, verticals: keep("verticals", p.verticals.length ? p.verticals : ["Cross-industry"]),
      stage: keep("stage", p.stage), capabilities: p.capabilities, integrations: p.integrations, personas: p.personas, tags: p.tags, analyzer: p.analyzer,
    });
    await step("analyst", { status: "done", detail: `${p.type} · ${p.verticals.join(", ")}` });

    await step("roi", { status: "running" });
    try {
      const c = items.find((u) => u.id === id);
      const roi = await estimateRoi(sample, { ...p, type: c.type, verticals: c.verticals });
      await save(id, { roi });
      await step("roi", { status: "done", detail: roi.headline });
    } catch (e) { await step("roi", { status: "failed", detail: e.message || String(e.code) }); }

    const c2 = items.find((u) => u.id === id);
    const name = c2.customerHint || c2.customer?.name || p.customer?.name;
    if (name) {
      await save(id, { customer: { ...(c2.customer || {}), name } });
      await step("brand", { status: "done", detail: c2.customer?.logo ? `${name} · logo on file` : `${name} · upload a logo on the profile` });
    } else await step("brand", { status: "skipped", detail: "No customer identified" });

    const c3 = items.find((u) => u.id === id);
    await step("graph", { status: "done", detail: `${(c3.verticals?.length || 0) + (c3.integrations?.length || 0) + (name ? 1 : 0) + 1} relationships indexed` });
    await save(id, { status: "ready" });
    log("profiled", items.find((u) => u.id === id).title, id);
  } catch (e) {
    const msg = e?.code === "not_granted" ? "Claude access was declined. Allow it in the page's Permissions, then Re-run agents." : e?.code === "rate_limited" ? "Claude is busy right now. Try Re-run agents in a minute." : (e?.message || "The agents could not finish.");
    await save(id, { status: "failed", error: msg });
    log("failed", uc.url, id, msg);
  } finally { running.delete(id); }
}

// ---------- public API ----------
export const api = {
  subscribe: (fn) => { listeners.add(fn); start(); return () => listeners.delete(fn); },
  config: async () => {
    const ok = await start();
    const [sample, user] = await Promise.all([cap("sample"), cap("user")]);
    const canEdit = user ? (await user.canEdit().catch(() => false)) || (await user.isOwner().catch(() => false)) : false;
    return { ready: ok, aiEnabled: Boolean(sample), model: sample ? "Claude" : null, adminRequired: false, isAdmin: canEdit, settings, taxonomy: { verticals: VERTICALS, types: USE_CASE_TYPES, stages: STAGES } };
  },
  list: async (reveal) => { await start(); return items.map(view(reveal)); },
  get: async (id, reveal) => { await start(); const u = items.find((x) => x.id === id); if (!u) throw new Error("Not found"); return view(reveal)(u); },
  create: async ({ url, customer, notes, confidential, screenshot }) => {
    await start();
    let u; try { u = new URL(url); } catch { throw new Error("That does not look like a valid link"); }
    if (!/^https?:$/.test(u.protocol)) throw new Error("Only http(s) links are supported");
    const dupe = items.find((x) => x.url === u.href);
    if (dupe) throw new Error("This link is already in your catalogue");
    let shotUrl = "", shotId = "";
    if (screenshot) {
      const assets = await cap("assets");
      if (assets) { const r = await assets.upload(screenshot); shotUrl = r.url; shotId = r.id; }
    }
    const id = newId();
    const uc = {
      url: u.href, createdAt: now(), updatedAt: now(), status: "queued", title: "", titleAr: "", summary: "", summaryAr: "", problem: "",
      type: "", secondaryTypes: [], verticals: [], stage: "Prototype", capabilities: [], integrations: [], personas: [], tags: [],
      customer: customer ? { name: customer, logo: null } : null, customerHint: customer || "", ownerNotes: notes || "",
      confidential: Boolean(confidential), featured: false, roi: null, screenshot: shotUrl, screenshotId: shotId, locked: [],
      assets: notes ? [{ id: newId(), kind: "note", title: "Owner notes", text: notes, createdAt: now() }] : [], pipeline: freshPipeline(), analyzer: "",
    };
    items.unshift({ id, ...uc });
    await (await cap("db")).doc(`usecases/${id}`).set(uc);
    log("added", u.href, id);
    runPipeline(id, screenshot);
    return { id, ...uc };
  },
  update: async (id, body) => {
    const uc = items.find((x) => x.id === id); if (!uc) throw new Error("Not found");
    const patch = {};
    for (const k of ["title", "titleAr", "summary", "summaryAr", "type", "verticals", "stage", "capabilities", "integrations", "confidential", "featured"]) if (k in body) patch[k] = body[k];
    patch.locked = [...new Set([...(uc.locked || []), ...Object.keys(patch).filter((k) => ["title", "titleAr", "summary", "summaryAr", "type", "verticals", "stage"].includes(k))])];
    if (body.customer !== undefined) { patch.customer = body.customer?.name ? { ...(uc.customer || {}), ...body.customer } : null; patch.customerHint = body.customer?.name || ""; }
    if (body.roi) patch.roi = { ...(uc.roi || {}), ...body.roi, estimatedBy: "owner" };
    return save(id, patch);
  },
  remove: async (id) => {
    const uc = items.find((x) => x.id === id); if (!uc) return;
    const assets = await cap("assets");
    const ids = [uc.screenshotId, uc.customer?.logoId, ...(uc.assets || []).map((a) => a.assetId)].filter(Boolean);
    if (assets) for (const a of ids) await assets.delete(a).catch(() => {});
    await (await cap("db")).doc(`usecases/${id}`).delete();
    items = items.filter((x) => x.id !== id); emit();
    log("deleted", uc.title || uc.url);
  },
  reanalyze: async (id, unlock) => { if (unlock) await save(id, { locked: [] }); runPipeline(id); },
  addAsset: async (id, data) => {
    const uc = items.find((x) => x.id === id); if (!uc) throw new Error("Not found");
    const asset = { id: newId(), createdAt: now(), title: (data.title || data.file?.name || "").slice(0, 140) };
    if (data.file) {
      const assets = await cap("assets");
      if (!assets) throw new Error("Uploads are not available here");
      const r = await assets.upload(data.file);
      Object.assign(asset, { url: r.url, assetId: r.id, mime: r.contentType, size: r.sizeBytes, kind: data.kind || (r.contentType.startsWith("video/") ? "video" : r.contentType.startsWith("image/") ? "image" : "deck") });
    } else if (data.url) {
      if (!/^https:\/\//i.test(data.url)) throw new Error("Links must start with https://");
      Object.assign(asset, { url: data.url, kind: data.kind || "link" });
    } else if (data.text) Object.assign(asset, { kind: "note", text: String(data.text).slice(0, 20000) });
    else throw new Error("Add a file, a link or a note");
    if (!asset.title) asset.title = asset.kind === "note" ? "Note" : asset.url;
    await save(id, { assets: [...(uc.assets || []), asset] });
    log("asset", uc.title, id, asset.kind);
    return asset;
  },
  removeAsset: async (id, assetId) => {
    const uc = items.find((x) => x.id === id); if (!uc) return;
    const a = (uc.assets || []).find((x) => x.id === assetId);
    if (a?.assetId) (await cap("assets"))?.delete(a.assetId).catch(() => {});
    await save(id, { assets: uc.assets.filter((x) => x.id !== assetId) });
  },
  uploadLogo: async (id, file) => {
    const uc = items.find((x) => x.id === id);
    const assets = await cap("assets"); if (!assets) throw new Error("Uploads are not available here");
    const r = await assets.upload(file);
    if (uc.customer?.logoId) assets.delete(uc.customer.logoId).catch(() => {});
    return save(id, { customer: { ...(uc.customer || { name: "Customer" }), logo: r.url, logoId: r.id } });
  },
  stats: async () => { await start(); return stats(items.map(view(false)), settings.hideCustomers ? activity.map((e) => ({ ...e, title: items.find((u) => u.id === e.useCaseId) ? view(false)(items.find((u) => u.id === e.useCaseId)).title : e.title, detail: "" })) : activity); },
  graph: async () => { await start(); return graph(items.map(view(false))); },
  ask: async (question, lang, history, onText) => ask(await cap("sample"), question, { list: items.map(view(false)), lang, history, onText }),
  settings: async (patch) => { const db = await cap("db"); settings = { ...settings, ...patch }; await db.doc("meta/settings").set(settings); emit(); return settings; },
  exportCsv: async () => {
    const rows = items.filter((u) => u.status === "ready").map(view(false));
    const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [["title", "type", "verticals", "stage", "customer", "annual_value_usd", "payback_months", "url", "added"].join(","),
      ...rows.map((u) => [u.title, u.type, (u.verticals || []).join("; "), u.stage, u.customer?.name, u.roi?.annual_value_usd, u.roi?.payback_months, u.url, u.createdAt].map(cell).join(","))].join("\n");
    const d = await cap("downloads");
    if (!d) throw new Error("Downloads are not available here");
    return d.save({ filename: "use-cases.csv", data: csv });
  },
  removeExamples: async () => { const db = await cap("db"); for (const u of items.filter((x) => x.example)) await db.doc(`usecases/${u.id}`).delete(); },
  hasExamples: () => items.some((x) => x.example),
};

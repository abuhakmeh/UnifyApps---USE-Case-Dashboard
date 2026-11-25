import express from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { db, newId, UPLOAD_DIR } from "./db.js";
import { createUseCase, runPipeline } from "./agents/pipeline.js";
import { assertPublicUrl, detectEmbeddable } from "./agents/scout.js";
import { ask } from "./agents/ask.js";
import { aiEnabled, MODEL } from "./agents/claude.js";
import { redact } from "./redact.js";
import { stats, graph } from "./search.js";
import { VERTICALS, USE_CASE_TYPES, STAGES } from "./taxonomy.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "2mb" }));

// ---------- auth: viewers can browse, only admins change data ----------
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
const isAdmin = (req) => {
  if (!ADMIN_TOKEN) return true; // local / single-user mode
  const t = String(req.get("x-admin-token") || "");
  return t.length === ADMIN_TOKEN.length && crypto.timingSafeEqual(Buffer.from(t), Buffer.from(ADMIN_TOKEN));
};
const admin = (req, res, next) => (isAdmin(req) ? next() : res.status(401).json({ error: "Admin access required" }));
const reveal = (req) => isAdmin(req) && req.get("x-reveal") === "1";
const view = (req) => (uc) => redact(uc, db.settings, reveal(req));
const visible = (req) => db.list().filter((u) => isAdmin(req) || u.status === "ready");

// ---------- API ----------
app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.get("/api/config", (req, res) => res.json({
  aiEnabled: aiEnabled(), model: aiEnabled() ? MODEL : null, adminRequired: Boolean(ADMIN_TOKEN), isAdmin: isAdmin(req),
  settings: db.settings, taxonomy: { verticals: VERTICALS, types: USE_CASE_TYPES, stages: STAGES },
}));

app.put("/api/settings", admin, (req, res) => {
  const { hideCustomers, brandTitle } = req.body || {};
  const patch = {};
  if (typeof hideCustomers === "boolean") patch.hideCustomers = hideCustomers;
  if (typeof brandTitle === "string") patch.brandTitle = brandTitle.slice(0, 80);
  res.json(db.updateSettings(patch));
});

app.get("/api/usecases", (req, res) => res.json(visible(req).map(view(req))));

app.get("/api/usecases/:id", (req, res) => {
  const uc = db.get(req.params.id);
  if (!uc || (!isAdmin(req) && uc.status !== "ready")) return res.status(404).json({ error: "Not found" });
  res.json(view(req)(uc));
});

app.post("/api/usecases", admin, async (req, res) => {
  const { url, customer, notes, confidential } = req.body || {};
  try {
    const u = await assertPublicUrl(String(url || "").trim());
    const dupe = db.list().find((x) => x.url === u.href);
    if (dupe) return res.status(409).json({ error: "This link is already in the catalogue", id: dupe.id });
    const uc = createUseCase({ url: u.href, customer: customer?.trim(), notes: notes?.trim(), confidential });
    res.status(201).json(uc);
    runPipeline(uc.id);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

const EDITABLE = ["title", "titleAr", "summary", "summaryAr", "type", "verticals", "stage", "capabilities", "integrations", "confidential", "featured", "url"];
app.patch("/api/usecases/:id", admin, (req, res) => {
  const uc = db.get(req.params.id);
  if (!uc) return res.status(404).json({ error: "Not found" });
  const patch = {};
  for (const k of EDITABLE) if (k in req.body) patch[k] = req.body[k];
  // manual edits are "locked" so a re-run of the agents does not overwrite them
  const locked = [...new Set([...(uc.locked || []), ...Object.keys(patch).filter((k) => ["title", "titleAr", "summary", "summaryAr", "type", "verticals", "stage"].includes(k))])];
  if (req.body.customer !== undefined) {
    const c = req.body.customer;
    patch.customer = c?.name ? { ...(uc.customer || {}), ...c } : null;
    patch.customerHint = c?.name || "";
  }
  if (req.body.roi) patch.roi = { ...(uc.roi || {}), ...req.body.roi, estimatedBy: "owner" };
  res.json(db.update(uc.id, { ...patch, locked }));
});

app.delete("/api/usecases/:id", admin, (req, res) => {
  const uc = db.get(req.params.id);
  if (!uc) return res.status(404).json({ error: "Not found" });
  db.remove(uc.id);
  db.log({ type: "deleted", title: uc.title || uc.url });
  res.json({ ok: true });
});

app.post("/api/usecases/:id/reanalyze", admin, (req, res) => {
  const uc = db.get(req.params.id);
  if (!uc) return res.status(404).json({ error: "Not found" });
  if (req.body?.unlock) db.update(uc.id, { locked: [] });
  runPipeline(uc.id, { force: true });
  res.json({ ok: true });
});

// ---------- assets: video, deck, notes, logo ----------
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, f, cb) => cb(null, `${newId()}${path.extname(f.originalname).toLowerCase().replace(/[^.a-z0-9]/g, "")}`),
  }),
  limits: { fileSize: Number(process.env.MAX_UPLOAD_MB || 200) * 1024 * 1024 },
  fileFilter: (_req, f, cb) => cb(null, /^(video|image|audio)\/|pdf|presentation|powerpoint|msword|officedocument|text\//.test(f.mimetype)),
});

app.post("/api/usecases/:id/assets", admin, upload.single("file"), (req, res) => {
  const uc = db.get(req.params.id);
  if (!uc) return res.status(404).json({ error: "Not found" });
  const { kind, title, url, text } = req.body || {};
  const asset = { id: newId(), createdAt: new Date().toISOString(), title: (title || req.file?.originalname || "").slice(0, 140) };
  if (req.file) {
    asset.url = `/uploads/${req.file.filename}`;
    asset.mime = req.file.mimetype;
    asset.size = req.file.size;
    asset.kind = kind || (req.file.mimetype.startsWith("video/") ? "video" : req.file.mimetype.startsWith("image/") ? "image" : "deck");
  } else if (url) {
    asset.url = String(url);
    asset.kind = kind || detectEmbeddable(url) || "link";
  } else if (text) {
    asset.kind = "note";
    asset.text = String(text).slice(0, 20000);
  } else {
    return res.status(400).json({ error: "Provide a file, a link or note text" });
  }
  if (!asset.title) asset.title = asset.kind === "note" ? "Note" : asset.url;
  db.update(uc.id, { assets: [...uc.assets, asset] });
  db.log({ type: "asset", useCaseId: uc.id, title: uc.title, detail: asset.kind });
  res.status(201).json(asset);
});

app.delete("/api/usecases/:id/assets/:assetId", admin, (req, res) => {
  const uc = db.get(req.params.id);
  if (!uc) return res.status(404).json({ error: "Not found" });
  db.update(uc.id, { assets: uc.assets.filter((a) => a.id !== req.params.assetId) });
  res.json({ ok: true });
});

app.post("/api/usecases/:id/logo", admin, upload.single("file"), (req, res) => {
  const uc = db.get(req.params.id);
  if (!uc || !req.file) return res.status(400).json({ error: "Upload an image" });
  db.update(uc.id, { customer: { ...(uc.customer || { name: "Customer" }), logo: `/uploads/${req.file.filename}`, manualLogo: true } });
  res.json(db.get(uc.id));
});

// ---------- control tower, graph, ask ----------
const activityFor = (req) => {
  if (!isAdmin(req)) return [];
  if (!db.settings.hideCustomers || reveal(req)) return db.activity;
  const byId = new Map(db.list().map((u) => [u.id, redact(u, db.settings)]));
  return db.activity.map((e) => (byId.has(e.useCaseId) ? { ...e, title: byId.get(e.useCaseId).title, detail: e.detail && redact({ ...db.get(e.useCaseId), summary: e.detail }, db.settings).summary } : e));
};
app.get("/api/stats", (req, res) => res.json(stats(visible(req).map(view(req)), activityFor(req))));
app.get("/api/graph", (req, res) => res.json(graph(visible(req).map(view(req)))));

app.post("/api/ask", async (req, res) => {
  const { question, lang, history } = req.body || {};
  if (!question?.trim()) return res.status(400).json({ error: "Ask a question" });
  try {
    const list = db.list().filter((u) => u.status === "ready").map((u) => redact(u, db.settings, false));
    res.json(await ask(question.slice(0, 2000), { list, lang, history: Array.isArray(history) ? history : [] }));
  } catch (e) {
    console.error("[ask]", e);
    res.status(502).json({ error: "The Ask agent is unavailable right now" });
  }
});

app.get("/api/export.csv", (req, res) => {
  const rows = visible(req).map(view(req));
  const cols = ["title", "type", "verticals", "stage", "customer", "annual_value_usd", "payback_months", "url", "createdAt"];
  const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [cols.join(","), ...rows.map((u) => [u.title, u.type, (u.verticals || []).join("; "), u.stage, u.customer?.name, u.roi?.annual_value_usd, u.roi?.payback_months, u.url, u.createdAt].map(cell).join(","))].join("\n");
  res.type("text/csv").attachment("use-cases.csv").send(csv);
});

app.use("/api", (_req, res) => res.status(404).json({ error: "Unknown endpoint" }));

// ---------- static ----------
app.use("/uploads", express.static(UPLOAD_DIR, { maxAge: "7d", fallthrough: false }));
const dist = path.resolve(here, "../dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist, { index: false, maxAge: "1h" }));
  app.get(/^\/(?!api|uploads).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

// Resume anything interrupted by a restart.
for (const uc of db.list()) if (["queued", "processing"].includes(uc.status)) runPipeline(uc.id);

const PORT = Number(process.env.PORT || 8787);
app.listen(PORT, () => console.log(`Use Case platform on http://localhost:${PORT}  · AI ${aiEnabled() ? `on (${MODEL})` : "off – keyword mode"}`));

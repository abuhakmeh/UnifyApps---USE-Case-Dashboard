// The agent workflow, run in the page with Claude through the artifact's built-in `sample`
// capability (no API key). Each step is recorded on the use case so the UI shows it live.
import { VERTICALS, USE_CASE_TYPES, STAGES, ROI_BENCHMARKS, guessType, guessVerticals } from "./taxonomy.js";
import { search, stats, graph } from "./core.js";
import { parseLink } from "./url.js";

export const STEPS = [
  { key: "scout", label: "Scout · reading the link" },
  { key: "analyst", label: "Analyst · type, summary & verticals" },
  { key: "roi", label: "ROI agent · value estimate" },
  { key: "brand", label: "Brand agent · customer" },
  { key: "graph", label: "Graph indexer · linking context" },
];
export const freshPipeline = () => STEPS.map((s) => ({ ...s, status: "pending", detail: "" }));

const str = (v, max = 400) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const strs = (v, n = 8) => (Array.isArray(v) ? v.map((x) => str(x, 80)).filter(Boolean).slice(0, n) : []);
const num = (v) => (Number.isFinite(+v) && +v >= 0 ? +v : 0);
const pick = (v, list, d) => (list.includes(v) ? v : d);

export async function analyse(sample, { url, customer, customerDetected, notes, screenshot }) {
  const link = parseLink(url) || {};
  const host = (() => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; } })();
  const corpus = `${url} ${customer || ""} ${notes || ""}`;
  if (!sample) {
    const type = guessType(corpus), verticals = guessVerticals(corpus);
    return { title: notes ? notes.split(/[.\n]/)[0].slice(0, 70) : link.screen ? link.screen.replace(" · ", " – ") : host, title_ar: "", summary: notes || `A ${type.toLowerCase()} prototype.`, summary_ar: "", problem: "", type, secondary_types: [], verticals, stage: "Prototype", capabilities: [], integrations: [], personas: [], tags: [], customer: { name: customer || null }, analyzer: "keyword" };
  }
  const prompt = `You are the Analyst agent of UnifyApps' private use-case catalogue. UnifyApps is an enterprise AI, agents and integration platform; it is never the customer.
Build an executive-ready profile of a prototype from its link${screenshot ? ", the attached screenshot of it" : ""} and the owner's notes. You cannot open the link: infer from the URL words, the screenshot and the notes, and keep claims modest when evidence is thin.
Write plain, confident business English. Arabic must be natural Modern Standard Arabic.

<link>${url}</link>
<what_the_link_says>tenant subdomain: ${link.tenant || "(none)"}; environment: ${link.env || "(none)"}; screen: ${link.screen || "(none)"}</what_the_link_says>
<owner_customer>${customer ? (customerDetected ? `${customer} (read automatically from the link's tenant name, so it may need proper spelling)` : `${customer} (typed by the owner, keep exactly)`) : "(not given)"}</owner_customer>
In UnifyApps links the tenant subdomain (e.g. emiratesnbd in emiratesnbd.uat.unifyapps.com) is normally the customer; write the organisation's proper name (Emirates NBD). The screen path tells you which part of the product the prototype shows.
<owner_notes>${notes || "(none)"}</owner_notes>

Reply with only one JSON object with exactly these keys:
{"title": "short product-style name, max 8 words", "title_ar": "...", "summary": "one or two sentences: what it does and for whom", "summary_ar": "...", "problem": "the business problem in one sentence",
 "type": one of ${JSON.stringify(USE_CASE_TYPES)}, "secondary_types": [0-2 of the same list],
 "verticals": [1-4 of ${JSON.stringify(VERTICALS)}, most relevant first], "stage": one of ${JSON.stringify(STAGES)} (a clickable demo is usually "Prototype"),
 "capabilities": [3-6 short phrases], "integrations": [named systems such as Salesforce or SAP, empty if none are evident], "personas": [1-3], "tags": [3-6 lowercase],
 "customer": {"name": the end-customer organisation if clearly identifiable, else null}}`;
  const r = await sample.json(prompt, { images: screenshot ? [screenshot] : undefined, modelTier: "default" });
  return {
    title: str(r.title, 90) || host, title_ar: str(r.title_ar, 120), summary: str(r.summary), summary_ar: str(r.summary_ar), problem: str(r.problem),
    type: pick(r.type, USE_CASE_TYPES, guessType(corpus)), secondary_types: strs(r.secondary_types, 2).filter((t) => USE_CASE_TYPES.includes(t)),
    verticals: strs(r.verticals, 4).filter((v) => VERTICALS.includes(v)).concat([]).slice(0, 4), stage: pick(r.stage, STAGES, "Prototype"),
    capabilities: strs(r.capabilities, 6), integrations: strs(r.integrations, 8), personas: strs(r.personas, 3), tags: strs(r.tags, 6),
    customer: { name: (customerDetected ? str(r.customer?.name, 80) || customer : customer || str(r.customer?.name, 80)) || null }, analyzer: "claude",
  };
}

export async function estimateRoi(sample, p) {
  const b = ROI_BENCHMARKS[p.type] || { hours: 5000, efficiency: 30, payback: 6 };
  if (!sample) {
    return { headline: `~${b.efficiency}% faster ${p.type.toLowerCase()} processes`, headline_ar: `تسريع العمليات بنحو ${b.efficiency}٪`, annual_value_usd: Math.round(b.hours * 38 / 1000) * 1000, payback_months: b.payback, hours_saved_per_year: b.hours, efficiency_gain_pct: b.efficiency, metrics: [{ label: "Efficiency gain", label_ar: "رفع الكفاءة", value: `${b.efficiency}%` }, { label: "Payback", label_ar: "فترة الاسترداد", value: `${b.payback} mo` }], assumptions: ["Industry benchmark for this use-case type", "Loaded cost of $38 per hour"], confidence: "low", estimatedBy: "benchmark" };
  }
  const r = await sample.json(`You are the ROI agent of an enterprise use-case catalogue. Estimate the value a typical mid-to-large customer in the stated verticals could expect from this use case.
Be conservative and defensible: realistic volumes, loaded labour costs for the GCC/MENA region unless the content implies otherwise, explicit assumptions. These are estimates, never guarantees.

<profile>${JSON.stringify({ title: p.title, summary: p.summary, problem: p.problem, type: p.type, verticals: p.verticals, capabilities: p.capabilities, personas: p.personas })}</profile>

Reply with only one JSON object:
{"headline": "one punchy line, e.g. Cuts onboarding time by 70%", "headline_ar": "...", "annual_value_usd": number, "payback_months": number, "hours_saved_per_year": number, "efficiency_gain_pct": number 0-100,
 "metrics": [3-4 of {"label": "...", "label_ar": "...", "value": "e.g. -65%"}], "assumptions": [2-4 short strings], "confidence": "low" | "medium" | "high"}`, { modelTier: "default" });
  return {
    headline: str(r.headline, 120), headline_ar: str(r.headline_ar, 160), annual_value_usd: num(r.annual_value_usd), payback_months: num(r.payback_months),
    hours_saved_per_year: num(r.hours_saved_per_year), efficiency_gain_pct: Math.min(100, num(r.efficiency_gain_pct)),
    metrics: (Array.isArray(r.metrics) ? r.metrics : []).slice(0, 4).map((m) => ({ label: str(m?.label, 40), label_ar: str(m?.label_ar, 60), value: str(m?.value, 20) })).filter((m) => m.label && m.value),
    assumptions: strs(r.assumptions, 4), confidence: pick(r.confidence, ["low", "medium", "high"], "low"), estimatedBy: "claude",
  };
}

const brief = (u) => ({
  id: u.id, title: u.title, type: u.type, verticals: u.verticals, stage: u.stage, customer: u.customer?.name || null, summary: u.summary,
  roi: u.roi ? { headline: u.roi.headline, annual_value_usd: u.roi.annual_value_usd, payback_months: u.roi.payback_months } : null,
  assets: (u.assets || []).map((a) => a.kind),
});

export async function ask(sample, question, { list, lang, history, onText }) {
  const ready = list.filter((u) => u.status === "ready");
  if (!sample) {
    const hits = search(ready, { q: question, limit: 6 });
    return { answer: hits.length ? (lang === "ar" ? `وجدت ${hits.length} حالات ذات صلة:` : `I found ${hits.length} relevant use case${hits.length > 1 ? "s" : ""}:`) + "\n" + hits.map((u) => `- **${u.title}** — ${u.summary} [[${u.id}]]`).join("\n") : (lang === "ar" ? "لم أجد نتائج مطابقة." : "No matching use cases yet. Try different keywords."), mode: "keyword" };
  }
  const tools = [
    { name: "search_use_cases", description: "Keyword search over the catalogue with optional exact filters (vertical, type, stage, customer). Returns brief records. Search again with synonyms when needed; an empty query returns everything matching the filters.",
      inputSchema: { type: "object", properties: { query: { type: "string" }, vertical: { type: "string" }, type: { type: "string" }, stage: { type: "string" }, customer: { type: "string" } }, required: ["query"] },
      execute: (i) => search(ready, { q: String(i.query || ""), vertical: i.vertical, type: i.type, stage: i.stage, customer: i.customer, limit: 15 }).map(brief) },
    { name: "get_use_case", description: "Full record of one use case by id: capabilities, integrations, ROI assumptions, notes.",
      inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
      execute: (i) => { const u = ready.find((x) => x.id === i.id); if (!u) throw new Error("Not found"); const { pipeline, screenshot, ...rest } = u; return rest; } },
    { name: "portfolio_stats", description: "Portfolio aggregates: counts by vertical, type, stage and system, total estimated value, coverage gaps.",
      execute: () => { const s = stats(ready); delete s.activity; return s; } },
    { name: "graph_neighbors", description: "Context graph: entities connected to a vertical, type, customer, system or use-case title.",
      inputSchema: { type: "object", properties: { label: { type: "string" } }, required: ["label"] },
      execute: (i) => {
        const g = graph(ready), l = String(i.label || "").toLowerCase();
        const hit = g.nodes.find((n) => n.label.toLowerCase() === l) || g.nodes.find((n) => n.label.toLowerCase().includes(l));
        if (!hit) throw new Error("No such entity");
        const ids = g.links.flatMap((x) => (x.source === hit.id ? [x.target] : x.target === hit.id ? [x.source] : []));
        return { entity: hit, neighbors: g.nodes.filter((n) => ids.includes(n.id)).map((n) => ({ label: n.label, kind: n.kind, useCaseId: n.useCaseId })) };
      } },
  ];
  const guide = `You are the Ask agent of the UnifyApps use-case catalogue. Answer using the tools; never invent use cases, customers or numbers they did not return. Cite each use case you mention inline as [[id]]. Keep answers short and scannable, bullets welcome. ROI figures are estimates; say so when you quote them. Keep anonymous labels such as "Banking client" anonymous. Reply in ${lang === "ar" ? "Modern Standard Arabic" : "English"}.`;
  const msgs = [...history.slice(-6), { role: "user", content: `${guide}\n\nQuestion: ${question}` }];
  const r = await sample(msgs, { tools, modelTier: "default", cache: false, onText: onText ? ({ text }) => onText(text) : undefined });
  return { answer: r.text.trim(), mode: "ai" };
}

// Lightweight enterprise search + aggregates + context graph over the catalogue.
import { VERTICALS } from "./taxonomy.js";

const norm = (s) => String(s || "").toLowerCase();

export function docText(uc) {
  return [uc.title, uc.titleAr, uc.summary, uc.summaryAr, uc.problem, uc.type, ...(uc.secondaryTypes || []), ...(uc.verticals || []),
    uc.stage, ...(uc.capabilities || []), ...(uc.integrations || []), ...(uc.personas || []), ...(uc.tags || []),
    uc.customer?.name, uc.roi?.headline, ...(uc.assets || []).map((a) => `${a.title} ${a.text || ""}`)].join(" ");
}

export function search(list, { q = "", vertical, type, stage, customer, limit = 50 } = {}) {
  const terms = norm(q).split(/\s+/).filter((t) => t.length > 1);
  return list
    .filter((u) => (!vertical || u.verticals?.includes(vertical)) && (!type || u.type === type) && (!stage || u.stage === stage)
      && (!customer || norm(u.customer?.name).includes(norm(customer))))
    .map((u) => {
      const t = norm(docText(u));
      const title = norm(u.title);
      const score = terms.length ? terms.reduce((s, w) => s + (t.includes(w) ? 1 : 0) + (title.includes(w) ? 2 : 0), 0) : 1;
      return { u, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.u);
}

export function stats(list, activity = []) {
  const ready = list.filter((u) => u.status === "ready");
  const tally = (fn) => {
    const m = {};
    for (const u of ready) for (const k of [].concat(fn(u) || [])) if (k) m[k] = (m[k] || 0) + 1;
    return Object.entries(m).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  };
  const valueBy = {};
  for (const u of ready) for (const v of u.verticals || []) valueBy[v] = (valueBy[v] || 0) + (u.roi?.annual_value_usd || 0) / (u.verticals.length || 1);
  return {
    total: list.length,
    ready: ready.length,
    processing: list.filter((u) => ["processing", "queued"].includes(u.status)).length,
    failed: list.filter((u) => u.status === "failed").length,
    customers: new Set(ready.map((u) => u.customer?.name).filter(Boolean)).size,
    verticalsCovered: new Set(ready.flatMap((u) => u.verticals || [])).size,
    verticalsTotal: VERTICALS.length,
    totalValue: ready.reduce((s, u) => s + (u.roi?.annual_value_usd || 0), 0),
    avgPayback: ready.length ? ready.reduce((s, u) => s + (u.roi?.payback_months || 0), 0) / ready.length : 0,
    hoursSaved: ready.reduce((s, u) => s + (u.roi?.hours_saved_per_year || 0), 0),
    byVertical: tally((u) => u.verticals),
    byType: tally((u) => u.type),
    byStage: tally((u) => u.stage),
    byIntegration: tally((u) => u.integrations).slice(0, 12),
    valueByVertical: Object.entries(valueBy).map(([name, value]) => ({ name, value: Math.round(value) })).sort((a, b) => b.value - a.value),
    assets: { videos: ready.reduce((s, u) => s + u.assets.filter((a) => a.kind === "video").length, 0), decks: ready.reduce((s, u) => s + u.assets.filter((a) => a.kind === "deck").length, 0), notes: ready.reduce((s, u) => s + u.assets.filter((a) => a.kind === "note").length, 0) },
    gaps: { noAssets: ready.filter((u) => !u.assets.some((a) => a.kind !== "note")).length, noCustomer: ready.filter((u) => !u.customer?.name).length },
    activity: activity.slice(0, 25),
  };
}

export function graph(list) {
  const nodes = new Map();
  const links = [];
  const add = (id, label, kind, extra = {}) => { if (!nodes.has(id)) nodes.set(id, { id, label, kind, weight: 0, ...extra }); nodes.get(id).weight++; return id; };
  for (const u of list.filter((x) => x.status === "ready")) {
    const uid = add(`uc:${u.id}`, u.title, "usecase", { useCaseId: u.id });
    for (const v of u.verticals || []) links.push({ source: uid, target: add(`v:${v}`, v, "vertical") });
    if (u.type) links.push({ source: uid, target: add(`t:${u.type}`, u.type, "type") });
    if (u.customer?.name) links.push({ source: uid, target: add(`c:${u.customer.name}`, u.customer.name, "customer", { logo: u.customer.logo }) });
    for (const i of (u.integrations || []).slice(0, 5)) links.push({ source: uid, target: add(`i:${norm(i)}`, i, "integration") });
  }
  return { nodes: [...nodes.values()], links };
}

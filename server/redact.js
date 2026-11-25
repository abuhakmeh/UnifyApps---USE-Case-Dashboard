// Customer-facing privacy: when "hide customer names" is on (or a use case is marked
// confidential) every API response replaces the customer with an anonymous label and scrubs
// the name from free text. Admins can ask to see the real data while editing.
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function shouldHide(uc, settings, reveal) {
  return !reveal && (settings.hideCustomers || uc.confidential);
}

export function redact(uc, settings, reveal = false) {
  if (!uc.customer?.name || !shouldHide(uc, settings, reveal)) return uc;
  const name = uc.customer.name;
  const words = [name, uc.customer.domain, ...name.split(/\s+/).filter((w) => w.length > 4 && /^[A-Z]/.test(w))].filter(Boolean);
  const re = new RegExp(words.map(escape).join("|"), "gi");
  const scrub = (v) => (typeof v === "string" ? v.replace(re, "the client") : Array.isArray(v) ? v.map(scrub) : v);
  const label = `${uc.verticals?.[0] || "Enterprise"} client`;
  return {
    ...uc,
    title: scrub(uc.title), summary: scrub(uc.summary), problem: scrub(uc.problem),
    capabilities: scrub(uc.capabilities), tags: scrub(uc.tags),
    customer: { name: label, hidden: true, logo: null, domain: null },
    customerHint: "", ownerNotes: "",
    roi: uc.roi && { ...uc.roi, headline: scrub(uc.roi.headline), headline_ar: scrub(uc.roi.headline_ar), assumptions: scrub(uc.roi.assumptions) },
    assets: uc.assets.map((a) => ({ ...a, title: scrub(a.title), text: scrub(a.text) })),
    source: { ...uc.source, title: scrub(uc.source?.title || ""), description: scrub(uc.source?.description || ""), notes: [] },
    titleAr: scrub(uc.titleAr), summaryAr: scrub(uc.summaryAr), personas: scrub(uc.personas), error: scrub(uc.error || ""),
    pipeline: (uc.pipeline || []).map((p) => ({ ...p, detail: scrub(p.detail || "") })),
    locked: uc.locked,
  };
}

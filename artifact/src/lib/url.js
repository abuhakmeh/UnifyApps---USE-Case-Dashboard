// Reads what a prototype link itself says: the customer tenant, the environment and the screen.
// UnifyApps links look like https://<tenant>.<env>.unifyapps.com/p/<n>/<section>/<sub>.
const ENVS = { uat: "UAT", dev: "Dev", qa: "QA", staging: "Staging", stage: "Staging", sandbox: "Sandbox", demo: "Demo", preprod: "Pre-prod", prod: "Production", test: "Test" };
const GENERIC = new Set(["www", "app", "apps", "api", "auth", "login", "portal", "console", "admin", "platform", "cloud", "my", "web", "static", "cdn", "docs", "help", "go", "studio", "dashboard", "builder", "example", "localhost", "test", "sample", ...Object.keys(ENVS)]);
const HOSTING = /(vercel\.app|netlify\.app|herokuapp\.com|github\.io|pages\.dev|web\.app|firebaseapp\.com|azurewebsites\.net|onrender\.com|replit\.app|lovable\.app|bolt\.new)$/i;
const SKIP_PATH = /^(p|app|apps|v\d+|\d+|[a-f0-9-]{16,}|en|ar|home|index(\.html)?|#)$/i;

const SMALL = new Set(["and", "of", "for", "to", "the", "in"]);
const ACRONYM = /^(mcp|ai|api|crm|erp|hr|it|kyc|aml|sla|kpi|ocr|sso|qa|uat|ui|ux|faq|rpa|llm|sap|ivr|nbd|adnoc|dewa|sabic|stc)$/i;
export const titleCase = (s) => s.replace(/[-_+.]+/g, " ").replace(/\s+/g, " ").trim().split(" ")
  .map((w, i) => (ACRONYM.test(w) ? w.toUpperCase() : i && SMALL.has(w.toLowerCase()) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())).join(" ");

export function parseLink(raw) {
  let u;
  try { u = new URL(/^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`); } catch { return null; }
  if (!u.hostname.includes(".")) return null;
  const host = u.hostname.replace(/^www\./, "").toLowerCase();
  const labels = host.split(".");
  const isUnify = /(^|\.)unifyapps\.com$/.test(host);
  let tenant = "", env = "";
  if (isUnify) {
    const sub = labels.slice(0, -2);
    for (const l of sub) if (ENVS[l]) env = ENVS[l];
    tenant = sub.find((l) => !GENERIC.has(l)) || "";
  } else if (HOSTING.test(host)) {
    tenant = labels[0].split(/--|-(?=demo|poc|prototype)/)[0];
  } else {
    const base = labels.length > 2 && labels[labels.length - 2].length <= 3 ? labels[labels.length - 3] : labels[labels.length - 2];
    tenant = GENERIC.has(base) ? "" : base;
    for (const l of labels) if (ENVS[l]) env = ENVS[l];
  }
  const fromQuery = u.searchParams.get("customer") || u.searchParams.get("client") || u.searchParams.get("tenant") || "";
  const parts = u.pathname.split("/").filter((s) => s && !SKIP_PATH.test(s)).map(decodeURIComponent);
  const section = parts[0] ? titleCase(parts[0]) : "";
  const sub = parts[1] ? titleCase(parts[1]) : "";
  const customer = fromQuery ? titleCase(fromQuery) : tenant.length > 1 && !/^\d+$/.test(tenant) ? titleCase(tenant) : "";
  return {
    href: u.href, host, isUnify, env, tenant, customer,
    section, sub, screen: [section, sub].filter(Boolean).join(" · "),
    crumbs: parts.slice(0, 3).map(titleCase),
  };
}

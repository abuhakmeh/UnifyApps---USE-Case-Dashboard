import { memo } from "react";
import { parseLink } from "../lib/url.js";

// A generated "screenshot" of the use case's dashboard, drawn from its own data.
const PALETTE = {
  "Agentic AI": ["#7c5cff", "#22d3ee"], "Conversational AI": ["#5b8cff", "#a78bfa"], "Workflow Automation": ["#0ea5e9", "#34d399"],
  "Document Intelligence": ["#f59e0b", "#f472b6"], "Data Integration": ["#14b8a6", "#5b8cff"], "Analytics & Insights": ["#e9c46a", "#7c5cff"],
  "Customer Experience": ["#f472b6", "#8b7cff"], "Employee Experience": ["#22d3ee", "#a3e635"], "IT Operations": ["#64748b", "#22d3ee"],
  "Compliance & Risk": ["#ef4444", "#f59e0b"], "Knowledge & Search": ["#8b5cf6", "#22d3ee"], "App Modernization": ["#06b6d4", "#e9c46a"],
};
function rng(seed) { let h = 2166136261; for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507), h = Math.imul(h ^ (h >>> 13), 3266489909), (h ^= h >>> 16) >>> 0) / 4294967296); }
const clip = (s, n) => (s && s.length > n ? s.slice(0, n - 1) + "…" : s || "");

function DashboardArt({ uc, hidden, building }) {
  const link = parseLink(uc.url || "") || {};
  const [a, b] = PALETTE[uc.type] || ["#7c5cff", "#22d3ee"];
  const r = rng(uc.id || uc.url || "x");
  const id = `da${String(uc.id || uc.url || "x").replace(/[^a-z0-9]/gi, "").slice(-10)}`;
  const host = hidden ? "•••••.unifyapps.com" : link.host || "prototype";
  const crumbs = link.crumbs?.length ? link.crumbs : ["Home"];
  const screen = link.section || uc.type || "Overview";
  const title = clip(link.section ? [link.section, link.sub].filter(Boolean).join(" / ") : uc.title || "Overview", 34);
  const tenant = hidden ? "" : uc.customer?.name || link.customer || "";
  const initials = (tenant || "UA").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const nav = [screen, ...(uc.capabilities || []).slice(0, 4), "Settings"].slice(0, 6);
  const metrics = (uc.roi?.metrics?.length ? uc.roi.metrics : [
    { label: "Requests today", value: String(Math.round(800 + r() * 4000)) },
    { label: "Automated", value: `${Math.round(55 + r() * 40)}%` },
    { label: "Avg. handling", value: `${(1 + r() * 4).toFixed(1)} min` },
  ]).slice(0, 3);
  const rows = (uc.capabilities?.length ? uc.capabilities : uc.integrations?.length ? uc.integrations : ["Intake", "Validation", "Approval", "Notification"]).slice(0, 4);
  const pts = Array.from({ length: 12 }, (_, i) => [600 + i * 76, 610 - (40 + r() * 60 + i * 10 + Math.sin(i + r()) * 25)]);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(0)},${y.toFixed(0)}`).join(" ");
  const bars = Array.from({ length: 7 }, () => 30 + r() * 110);

  return (
    <svg className={`dash-art ${building ? "building" : ""}`} viewBox="0 0 1600 900" preserveAspectRatio="xMidYMin slice" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}bg`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={a} stopOpacity=".55" /><stop offset="1" stopColor={b} stopOpacity=".35" /></linearGradient>
        <linearGradient id={`${id}area`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={b} stopOpacity=".45" /><stop offset="1" stopColor={b} stopOpacity="0" /></linearGradient>
        <linearGradient id={`${id}acc`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor={a} /><stop offset="1" stopColor={b} /></linearGradient>
      </defs>
      <rect width="1600" height="900" fill="#0a0d24" />
      <rect width="1600" height="900" fill={`url(#${id}bg)`} />
      <circle cx="1350" cy="120" r="320" fill={b} opacity=".18" />
      <g transform="translate(90 70) rotate(-1.2)">
        <rect width="1420" height="900" rx="22" fill="#0e1230" stroke="rgba(255,255,255,.14)" />
        <rect width="1420" height="64" rx="22" fill="#141938" />
        <rect y="40" width="1420" height="24" fill="#141938" />
        {["#ff5f57", "#febc2e", "#28c840"].map((c, i) => <circle key={c} cx={34 + i * 26} cy="32" r="8" fill={c} />)}
        <rect x="140" y="16" width="620" height="32" rx="16" fill="#0a0d24" />
        <text x="164" y="38" fill="#9aa3d6" fontSize="17" fontFamily="Inter, sans-serif">{clip(host, 30)}{link.section ? ` / ${clip(crumbs.join(" / "), 28)}` : ""}</text>
        {link.env && <><rect x="790" y="18" width={link.env.length * 11 + 28} height="28" rx="14" fill={a} opacity=".9" /><text x="804" y="38" fill="#fff" fontSize="15" fontWeight="600" fontFamily="Inter, sans-serif">{link.env}</text></>}
        <circle cx="1380" cy="32" r="16" fill={`url(#${id}acc)`} />

        <rect x="0" y="64" width="260" height="836" fill="#0b0f2a" />
        <rect x="24" y="92" width="44" height="44" rx="12" fill={`url(#${id}acc)`} />
        <text x="46" y="121" textAnchor="middle" fill="#fff" fontSize="18" fontWeight="700" fontFamily="Inter, sans-serif">{initials}</text>
        <text x="82" y="112" fill="#eef0ff" fontSize="17" fontWeight="600" fontFamily="Inter, sans-serif">{clip(tenant || "Workspace", 14)}</text>
        <text x="82" y="132" fill="#6f75a3" fontSize="13" fontFamily="Inter, sans-serif">UnifyApps</text>
        {nav.map((n, i) => (
          <g key={i} transform={`translate(16 ${170 + i * 52})`}>
            {i === 0 && <rect width="228" height="40" rx="10" fill={a} opacity=".22" />}
            <rect x="14" y="12" width="16" height="16" rx="4" fill={i === 0 ? b : "#3a4170"} />
            <text x="44" y="26" fill={i === 0 ? "#fff" : "#a9aed6"} fontSize="15" fontFamily="Inter, sans-serif">{clip(n, 22)}</text>
          </g>
        ))}

        <text x="300" y="124" fill="#6f75a3" fontSize="15" fontFamily="Inter, sans-serif">{clip(crumbs.join("  ›  "), 60)}</text>
        <text x="300" y="168" fill="#fff" fontSize="34" fontWeight="700" fontFamily="Space Grotesk, Inter, sans-serif">{title}</text>
        <rect x="1200" y="134" width="180" height="44" rx="12" fill={`url(#${id}acc)`} />
        <text x="1290" y="162" textAnchor="middle" fill="#fff" fontSize="16" fontWeight="600" fontFamily="Inter, sans-serif">+ New</text>

        {metrics.map((m, i) => (
          <g key={i} transform={`translate(${300 + i * 365} 210)`}>
            <rect width="345" height="120" rx="16" fill="#141938" stroke="rgba(255,255,255,.08)" />
            <text x="22" y="40" fill="#8f95c7" fontSize="15" fontFamily="Inter, sans-serif">{clip(m.label, 28)}</text>
            <text x="22" y="90" fill="#fff" fontSize="38" fontWeight="700" fontFamily="Space Grotesk, Inter, sans-serif">{clip(m.value, 12)}</text>
            <rect x="0" y="116" width="345" height="4" rx="2" fill={i === 0 ? a : i === 1 ? b : "#e9c46a"} opacity=".8" />
          </g>
        ))}

        <rect x="300" y="352" width="760" height="300" rx="16" fill="#141938" stroke="rgba(255,255,255,.08)" />
        <text x="324" y="390" fill="#eef0ff" fontSize="17" fontWeight="600" fontFamily="Inter, sans-serif">Activity</text>
        {[0, 1, 2, 3].map((g) => <line key={g} x1="324" x2="1036" y1={440 + g * 50} y2={440 + g * 50} stroke="rgba(255,255,255,.06)" />)}
        <path d={`${line} L1436,630 L600,630 Z`} transform="translate(-270 0)" fill={`url(#${id}area)`} />
        <path d={line} transform="translate(-270 0)" fill="none" stroke={b} strokeWidth="4" strokeLinejoin="round" />
        <circle cx={pts[11][0] - 270} cy={pts[11][1]} r="8" fill="#fff" stroke={b} strokeWidth="4" />

        <rect x="1080" y="352" width="300" height="300" rx="16" fill="#141938" stroke="rgba(255,255,255,.08)" />
        <text x="1104" y="390" fill="#eef0ff" fontSize="17" fontWeight="600" fontFamily="Inter, sans-serif">By channel</text>
        {bars.map((h, i) => <rect key={i} x={1108 + i * 38} y={620 - h} width="24" height={h} rx="6" fill={i % 2 ? b : a} opacity={0.55 + (i % 3) * 0.15} />)}

        <rect x="300" y="674" width="1080" height="210" rx="16" fill="#141938" stroke="rgba(255,255,255,.08)" />
        {rows.map((row, i) => (
          <g key={i} transform={`translate(324 ${706 + i * 44})`}>
            <circle cx="10" cy="0" r="10" fill={i % 2 ? a : b} opacity=".8" />
            <text x="34" y="6" fill="#dfe2ff" fontSize="16" fontFamily="Inter, sans-serif">{clip(row, 40)}</text>
            <rect x="760" y="-14" width="110" height="28" rx="14" fill={i === 2 ? "#e9c46a" : "#34d399"} opacity=".18" />
            <text x="815" y="6" textAnchor="middle" fill={i === 2 ? "#e9c46a" : "#34d399"} fontSize="14" fontWeight="600" fontFamily="Inter, sans-serif">{i === 2 ? "In review" : "Active"}</text>
            <rect x="900" y="-6" width={80 + ((i * 37) % 60)} height="12" rx="6" fill="#2a2f63" />
          </g>
        ))}
      </g>
      {building && <rect className="dash-scan" width="1600" height="160" fill={`url(#${id}area)`} />}
    </svg>
  );
}
export default memo(DashboardArt);

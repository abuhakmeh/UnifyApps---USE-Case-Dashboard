import { useEffect, useState } from "react";
import { useI18n } from "../i18n.js";
import { api } from "../api.js";
import Icon from "./Icon.jsx";
import { CountUp, LogoTile, localized, useCustomerName } from "./common.jsx";

const PALETTE = ["#8b7cff", "#22d3ee", "#e9c46a", "#f472b6", "#34d399", "#5b8cff", "#fb923c", "#a3e635", "#c084fc", "#2dd4bf", "#fbbf24", "#94a3b8"];

function Bars({ data, gold, format = (n) => n }) {
  const { tx } = useI18n();
  const max = Math.max(1, ...data.map((d) => d.count ?? d.value));
  if (!data.length) return <p className="muted">—</p>;
  return (
    <div className="bars">
      {data.map((d, i) => {
        const v = d.count ?? d.value;
        return (
          <div className="bar-row" key={d.name}>
            <span className="name" title={d.name}>{tx(d.name)}</span>
            <div className="bar-track"><div className={`bar-fill ${gold ? "gold" : ""}`} style={{ width: `${(v / max) * 100}%`, animationDelay: `${i * 50}ms` }} /></div>
            <span className="val">{format(v)}</span>
          </div>
        );
      })}
    </div>
  );
}

function Donut({ data }) {
  const { t, tx, num } = useI18n();
  const total = data.reduce((s, d) => s + d.count, 0) || 1;
  let acc = 0;
  const R = 70, C = 2 * Math.PI * R;
  return (
    <div className="donut-wrap">
      <svg width="180" height="180" viewBox="0 0 180 180" role="img" aria-label="Use cases by type">
        <circle cx="90" cy="90" r={R} fill="none" stroke="var(--surface-2)" strokeWidth="22" />
        {data.map((d, i) => {
          const len = (d.count / total) * C;
          const el = <circle key={d.name} cx="90" cy="90" r={R} fill="none" stroke={PALETTE[i % PALETTE.length]} strokeWidth="22" strokeDasharray={`${Math.max(0, len - 2)} ${C}`} strokeDashoffset={-acc} transform="rotate(-90 90 90)"><title>{`${d.name}: ${d.count}`}</title></circle>;
          acc += len;
          return el;
        })}
        <text x="90" y="86" textAnchor="middle" fill="var(--text)" style={{ font: "700 30px var(--display)" }}>{num(total === 1 && !data.length ? 0 : total)}</text>
        <text x="90" y="108" textAnchor="middle" fill="var(--text-3)" style={{ font: "12px var(--font)" }}>{t("kpi_usecases")}</text>
      </svg>
      <div className="legend">{data.map((d, i) => <div key={d.name}><i style={{ background: PALETTE[i % PALETTE.length] }} />{tx(d.name)}<b>{num(d.count)}</b></div>)}</div>
    </div>
  );
}

export default function Tower({ items, onOpen, canEdit, config, toast }) {
  const { t, tx, lang, money, num, date } = useI18n();
  const custName = useCustomerName();
  const [s, setS] = useState(null);
  useEffect(() => { api.stats().then(setS).catch(() => {}); }, [items, config]);
  if (!s) return <div className="container page"><div className="spinner" /></div>;

  const stageOrder = config?.taxonomy?.stages || [];
  const stageMax = Math.max(1, ...s.byStage.map((x) => x.count));
  const agentStats = ["scout", "analyst", "roi", "brand", "graph"].map((k) => {
    const runs = items.flatMap((u) => u.pipeline || []).filter((p) => p.key === k);
    return { k, ok: runs.filter((p) => p.status === "done").length, fail: runs.filter((p) => p.status === "failed").length, running: runs.filter((p) => p.status === "running").length };
  });
  const ready = items.filter((u) => u.status === "ready");

  return (
    <div className="container page">
      <div className="page-head row" style={{ justifyContent: "space-between", alignItems: "end" }}>
        <div><h1>{t("tower_title")}</h1><p>{t("tower_sub")}</p></div>
        <button className="btn" onClick={() => api.exportCsv().then(() => toast(t("toast_exported"))).catch((e) => e.code !== "declined" && toast(e.message || String(e.code)))}><Icon name="download" size={16} /> {t("export")}</button>
      </div>

      <div className="kpis" style={{ marginTop: 0 }}>
        <div className="kpi"><div className="kpi-label">{t("kpi_usecases")}</div><div className="kpi-value"><CountUp value={s.ready} format={(n) => num(Math.round(n))} /></div><div className="kpi-sub">{s.processing ? `+${s.processing} ${t("processing").toLowerCase()}` : ""}</div></div>
        <div className="kpi"><div className="kpi-label">{t("kpi_verticals")}</div><div className="kpi-value">{num(s.verticalsCovered)}<span style={{ fontSize: 16, color: "var(--text-3)" }}> / {num(s.verticalsTotal)}</span></div></div>
        <div className="kpi"><div className="kpi-label">{t("kpi_customers")}</div><div className="kpi-value">{num(s.customers)}</div></div>
        <div className="kpi"><div className="kpi-label">{t("kpi_value")}</div><div className="kpi-value"><CountUp value={s.totalValue} format={money} /></div><div className="kpi-sub">{t("est")}</div></div>
        <div className="kpi"><div className="kpi-label">{t("kpi_hours")}</div><div className="kpi-value">{num(s.hoursSaved, { notation: "compact" })}</div></div>
        <div className="kpi"><div className="kpi-label">{t("kpi_payback")}</div><div className="kpi-value">{num(s.avgPayback, { maximumFractionDigits: 1 })} <span style={{ fontSize: 16, color: "var(--text-3)" }}>{t("months")}</span></div></div>
      </div>

      <div className="tower">
        <div className="panel span-7"><h3>{t("by_vertical")}</h3><Bars data={s.byVertical} /></div>
        <div className="panel span-5"><h3>{t("by_type")}</h3><Donut data={s.byType} /></div>
        <div className="panel span-4">
          <h3>{t("by_stage")}</h3>
          <div className="funnel">
            {stageOrder.map((st) => { const c = s.byStage.find((x) => x.name === st)?.count || 0; return (
              <div key={st} className="funnel-step" style={{ width: `${55 + (c / stageMax) * 45}%` }}><span>{tx(st)}</span><b>{num(c)}</b></div>
            ); })}
          </div>
        </div>
        <div className="panel span-8"><h3>{t("value_by_vertical")}</h3><Bars data={s.valueByVertical} gold format={money} /></div>
        <div className="panel span-4"><h3>{t("top_systems")}</h3><Bars data={s.byIntegration} /></div>
        <div className="panel span-4">
          <h3>{t("gaps")}</h3>
          <div className="form-grid">
            <div className="metric"><b>{num(s.verticalsTotal - s.verticalsCovered)}</b><span>{t("gap_verticals")}</span></div>
            <div className="metric"><b>{num(s.gaps.noAssets)}</b><span>{t("gap_assets")}</span></div>
            <div className="metric"><b>{num(s.gaps.noCustomer)}</b><span>{t("gap_customer")}</span></div>
          </div>
        </div>
        <div className="panel span-4">
          <h3>{t("agents_health")} <span className="pill pill-green"><span className="dot" /> {config?.aiEnabled ? "Claude" : t("keyword")}</span></h3>
          <div className="agents">
            {agentStats.map((a) => (
              <div className="agent" key={a.k}>
                <div className="name"><span className={`dot ${a.running ? "dot-pulse" : ""}`} style={{ color: a.fail ? "var(--amber)" : "var(--green)" }} />{t(`agent_${a.k}`)}</div>
                <small>{num(a.ok)} {t("ok")}{a.fail ? ` · ${num(a.fail)} ${t("failed_n")}` : ""}{a.running ? ` · ${num(a.running)} ${t("live")}` : ""}</small>
              </div>
            ))}
          </div>
        </div>

        {canEdit && s.activity.length > 0 && (
          <div className="panel span-12">
            <h3>{t("activity")}</h3>
            <div className="feed">
              {s.activity.map((e) => (
                <div className="feed-item" key={e.id}>
                  <Icon name={e.type === "failed" ? "x" : e.type === "asset" ? "file" : e.type === "deleted" ? "trash" : "spark"} size={14} />
                  <span><b>{t(`act_${e.type}`)}</b> · {e.title}{e.detail ? ` · ${e.detail}` : ""}</span>
                  <time>{date(e.at)}</time>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="panel span-12">
          <h3>{t("all_items")}</h3>
          <div className="table-wrap">
            <table>
              <thead><tr><th>{t("title")}</th><th>{t("customer")}</th><th>{t("type")}</th><th>{t("verticals")}</th><th>{t("stage")}</th><th>{t("kpi_value")}</th><th>{t("assets")}</th></tr></thead>
              <tbody>
                {ready.map((u) => (
                  <tr key={u.id} className="click" onClick={() => onOpen(u.id)}>
                    <td className="strong">{localized(u, lang, "title")}</td>
                    <td><div className="row" style={{ gap: 8, flexWrap: "nowrap" }}>{u.customer?.name && <LogoTile customer={u.customer} size={26} />}{custName(u.customer) || "—"}</div></td>
                    <td>{tx(u.type)}</td>
                    <td>{u.verticals?.map(tx).join(", ")}</td>
                    <td>{tx(u.stage)}</td>
                    <td className="strong">{u.roi ? money(u.roi.annual_value_usd) : "—"}</td>
                    <td>{num(u.assets?.length || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

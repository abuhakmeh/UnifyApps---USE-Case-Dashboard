import { useMemo, useState } from "react";
import { useI18n } from "../i18n.js";
import Hero3D from "./Hero3D.jsx";
import LinkDrop from "./LinkDrop.jsx";
import UseCaseCard from "./UseCaseCard.jsx";
import Icon from "./Icon.jsx";
import { CountUp, Steps, localized } from "./common.jsx";

export default function Dashboard({ items, config, onOpen, onCreated, canEdit }) {
  const { t, tx, lang, dir, money, num } = useI18n();
  const [q, setQ] = useState("");
  const [vertical, setVertical] = useState("");
  const [type, setType] = useState("");
  const [stage, setStage] = useState("");
  const [customer, setCustomer] = useState("");
  const [sort, setSort] = useState("new");

  const ready = items.filter((u) => u.status === "ready");
  const live = items.filter((u) => ["queued", "processing"].includes(u.status));
  const customers = [...new Set(ready.map((u) => u.customer?.name).filter(Boolean))].sort();
  const verticalCounts = useMemo(() => {
    const m = {}; for (const u of ready) for (const v of u.verticals || []) m[v] = (m[v] || 0) + 1;
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [items]);

  const filtered = useMemo(() => {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    let list = items.filter((u) => {
      if (vertical && !u.verticals?.includes(vertical)) return false;
      if (type && u.type !== type) return false;
      if (stage && u.stage !== stage) return false;
      if (customer && u.customer?.name !== customer) return false;
      if (!terms.length) return true;
      const hay = [u.title, u.titleAr, u.summary, u.summaryAr, u.type, ...(u.verticals || []), ...(u.capabilities || []), ...(u.integrations || []), ...(u.tags || []), u.customer?.name, u.url].join(" ").toLowerCase();
      return terms.every((w) => hay.includes(w));
    });
    if (sort === "value") list = [...list].sort((a, b) => (b.roi?.annual_value_usd || 0) - (a.roi?.annual_value_usd || 0));
    if (sort === "az") list = [...list].sort((a, b) => (localized(a, lang, "title") || "").localeCompare(localized(b, lang, "title") || ""));
    return [...list].sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
  }, [items, q, vertical, type, stage, customer, sort, lang]);

  const totalValue = ready.reduce((s, u) => s + (u.roi?.annual_value_usd || 0), 0);
  const hours = ready.reduce((s, u) => s + (u.roi?.hours_saved_per_year || 0), 0);
  const payback = ready.length ? ready.reduce((s, u) => s + (u.roi?.payback_months || 0), 0) / ready.length : 0;
  const anyFilter = q || vertical || type || stage || customer;
  const tax = config?.taxonomy || { verticals: [], types: [], stages: [] };

  return (
    <>
      <section className="hero">
        <Hero3D dir={dir} nodes={Math.max(9, ready.length)} />
        <div className="container">
          <div className="hero-content">
            <span className="kicker"><b>AI</b> {t("hero_kicker")}</span>
            <h1>{t("hero_title_1")}<br /><span className="grad-text">{t("hero_title_2")}</span></h1>
            <p className="lead">{t("hero_sub")}</p>
            <LinkDrop onCreated={onCreated} canEdit={canEdit} />
            {live.length > 0 && (
              <div className="live">
                {live.map((u) => (
                  <div key={u.id} className="live-card">
                    <span className="dot dot-pulse" style={{ color: "var(--cyan)" }} />
                    <span className="live-url">{u.url}</span>
                    <Steps pipeline={u.pipeline} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="container">
        <div className="kpis">
          <div className="kpi"><div className="kpi-label">{t("kpi_usecases")}</div><div className="kpi-value"><CountUp value={ready.length} format={(n) => num(Math.round(n))} /></div></div>
          <div className="kpi"><div className="kpi-label">{t("kpi_verticals")}</div><div className="kpi-value"><CountUp value={verticalCounts.length} format={(n) => num(Math.round(n))} /></div><div className="kpi-sub">/ {num(tax.verticals.length)}</div></div>
          <div className="kpi"><div className="kpi-label">{t("kpi_customers")}</div><div className="kpi-value"><CountUp value={customers.length} format={(n) => num(Math.round(n))} /></div></div>
          <div className="kpi"><div className="kpi-label">{t("kpi_value")}</div><div className="kpi-value"><CountUp value={totalValue} format={money} /></div><div className="kpi-sub">{t("est")}</div></div>
          <div className="kpi"><div className="kpi-label">{t("kpi_hours")}</div><div className="kpi-value"><CountUp value={hours} format={(n) => num(n, { notation: "compact", maximumFractionDigits: 1 })} /></div></div>
          <div className="kpi"><div className="kpi-label">{t("kpi_payback")}</div><div className="kpi-value"><CountUp value={payback} format={(n) => num(n, { maximumFractionDigits: 1 })} /> <span style={{ fontSize: 16, color: "var(--text-3)" }}>{t("months")}</span></div></div>
        </div>

        <div className="filters">
          <div className="search">
            <Icon name="search" />
            <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} aria-label={t("search")} />
          </div>
          <select className="select" value={type} onChange={(e) => setType(e.target.value)} aria-label={t("type")}><option value="">{t("all_types")}</option>{tax.types.map((x) => <option key={x} value={x}>{tx(x)}</option>)}</select>
          <select className="select" value={stage} onChange={(e) => setStage(e.target.value)} aria-label={t("stage")}><option value="">{t("all_stages")}</option>{tax.stages.map((x) => <option key={x} value={x}>{tx(x)}</option>)}</select>
          <select className="select" value={customer} onChange={(e) => setCustomer(e.target.value)} aria-label={t("customer")}><option value="">{t("all_customers")}</option>{customers.map((x) => <option key={x} value={x}>{x}</option>)}</select>
          <select className="select" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort"><option value="new">{t("sort_new")}</option><option value="value">{t("sort_value")}</option><option value="az">{t("sort_az")}</option></select>
          <button className="btn" onClick={() => { setQ(""); setVertical(""); setType(""); setStage(""); setCustomer(""); }} disabled={!anyFilter}>{t("clear")}</button>
        </div>

        <div className="chips">
          <button className={`chip ${!vertical ? "on" : ""}`} onClick={() => setVertical("")}>{t("all_verticals")}</button>
          {verticalCounts.map(([v, n]) => (
            <button key={v} className={`chip ${vertical === v ? "on" : ""}`} onClick={() => setVertical(vertical === v ? "" : v)}>{tx(v)}<span className="n">{num(n)}</span></button>
          ))}
          <span style={{ marginInlineStart: "auto", color: "var(--text-3)", fontSize: 13 }}>{num(filtered.length)} {t("results")}</span>
        </div>

        {items.length === 0 ? (
          <div className="empty"><div className="orb" /><h3>{t("empty_title")}</h3><p>{t("empty_sub")}</p></div>
        ) : (
          <div className="grid">{filtered.map((u) => <UseCaseCard key={u.id} uc={u} onOpen={onOpen} />)}</div>
        )}
      </div>
    </>
  );
}

import { useEffect, useState } from "react";
import { useI18n } from "../i18n.js";
import { api } from "../api.js";
import Icon from "./Icon.jsx";
import Cover from "./Cover.jsx";
import { LogoTile, localized, STEP_LABEL, useCustomerName } from "./common.jsx";

const safeHref = (u) => (typeof u === "string" && (/^https:\/\//i.test(u) || u.startsWith("/_blob/")) ? u : undefined);
function source(url = "") {
  if (/youtube\.com|youtu\.be/i.test(url)) return "YouTube";
  if (/loom\.com/i.test(url)) return "Loom";
  if (/vimeo\.com/i.test(url)) return "Vimeo";
  if (/docs\.google\.com\/presentation/i.test(url)) return "Google Slides";
  if (/\.pdf($|\?)/i.test(url)) return "PDF";
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

function Asset({ a, canEdit, onRemove }) {
  const { t } = useI18n();
  const [sure, setSure] = useState(false);
  const icon = a.kind === "video" ? "video" : a.kind === "deck" ? "deck" : a.kind === "note" ? "note" : a.kind === "image" ? "file" : "link";
  const uploaded = Boolean(a.assetId);
  const href = safeHref(a.url);
  return (
    <div className="asset">
      <div className="asset-head">
        <Icon name={icon} size={16} />
        <span className="grow">{a.title}{!uploaded && a.url && <small className="asset-src">{source(a.url)}</small>}</span>
        {href && <a className="btn btn-sm" href={href} target="_blank" rel="noreferrer"><Icon name="ext" size={14} /> {a.kind === "video" ? t("watch") : t("open")}</a>}
        {canEdit && (sure
          ? <><button className="btn btn-sm btn-danger" onClick={onRemove}>{t("confirm_remove")}</button><button className="btn btn-sm btn-ghost" onClick={() => setSure(false)}>{t("cancel")}</button></>
          : <button className="btn btn-sm btn-ghost btn-danger" onClick={() => setSure(true)} aria-label={t("delete")}><Icon name="trash" size={14} /></button>)}
      </div>
      {a.kind === "note" && <div className="note">{a.text}</div>}
      {uploaded && a.mime?.startsWith("video/") && <video src={href} controls preload="metadata" />}
      {uploaded && a.mime?.startsWith("image/") && <img src={href} alt={a.title} style={{ display: "block", width: "100%" }} />}
    </div>
  );
}

function AssetAdder({ id }) {
  const { t } = useI18n();
  const [mode, setMode] = useState("");
  const [val, setVal] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const save = async (data) => {
    setBusy(true); setErr("");
    try { await api.addAsset(id, data); setMode(""); setVal(""); setTitle(""); }
    catch (e) { setErr(e.code === "too_large" ? t("file_too_large") : e.message || String(e.code)); }
    finally { setBusy(false); }
  };
  return (
    <div className="form-grid">
      <div className="asset-add">
        {["video", "deck", "note"].map((k) => (
          <button key={k} className={`btn btn-sm ${mode === k ? "btn-primary" : ""}`} onClick={() => { setMode(mode === k ? "" : k); setErr(""); }}><Icon name={k} size={14} /> {t(`add_${k}`)}</button>
        ))}
      </div>
      {mode === "note" && (
        <><textarea id="asset-note" className="textarea" value={val} onChange={(e) => setVal(e.target.value)} placeholder={t("note_placeholder")} />
        <div className="row"><button className="btn btn-sm btn-primary" disabled={!val.trim() || busy} onClick={() => save({ text: val, title: t("add_note") })}>{t("save")}</button></div></>
      )}
      {(mode === "video" || mode === "deck") && (
        <>
          <input id="asset-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("title")} />
          <div className="row">
            <input id="asset-link" className="input" style={{ flex: 1, minWidth: 0 }} value={val} onChange={(e) => setVal(e.target.value)} placeholder={t("link_placeholder")} />
            <button className="btn btn-sm btn-primary" disabled={!val.trim() || busy} onClick={() => save({ url: val.trim(), kind: mode, title })}>{t("add_link")}</button>
          </div>
          <label className="btn btn-sm" style={{ justifySelf: "start" }}>
            {busy ? <span className="spinner" /> : <Icon name="upload" size={14} />} {t("upload")} <span className="muted" style={{ fontSize: 12 }}>· {t("max_20mb")}</span>
            <input type="file" hidden accept={mode === "video" ? "video/mp4,video/webm,video/quicktime" : "application/pdf,image/*"} onChange={(e) => e.target.files[0] && save({ file: e.target.files[0], kind: mode, title })} />
          </label>
        </>
      )}
      {err && <div className="drop-error" role="alert">{err}</div>}
    </div>
  );
}

function Editor({ uc, config, onDone }) {
  const { t, tx } = useI18n();
  const [f, setF] = useState({
    title: uc.title, titleAr: uc.titleAr, summary: uc.summary, summaryAr: uc.summaryAr, type: uc.type || config.taxonomy.types[0], stage: uc.stage,
    verticals: uc.verticals || [], customer: uc.customer?.name || "",
    annual: uc.roi?.annual_value_usd || 0, payback: uc.roi?.payback_months || 0, headline: uc.roi?.headline || "",
    confidential: !!uc.confidential, featured: !!uc.featured,
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const toggleV = (v) => setF({ ...f, verticals: f.verticals.includes(v) ? f.verticals.filter((x) => x !== v) : [...f.verticals, v] });
  const save = async () => {
    await api.update(uc.id, {
      title: f.title, titleAr: f.titleAr, summary: f.summary, summaryAr: f.summaryAr, type: f.type, stage: f.stage, verticals: f.verticals,
      confidential: f.confidential, featured: f.featured, customer: f.customer.trim() ? { name: f.customer.trim() } : null,
      roi: { annual_value_usd: Number(f.annual) || 0, payback_months: Number(f.payback) || 0, headline: f.headline },
    });
    onDone(true);
  };
  return (
    <div className="panel form-grid">
      <div><label className="label" htmlFor="ed-title">{t("title")}</label><input id="ed-title" className="input" value={f.title} onChange={set("title")} /></div>
      <div><label className="label" htmlFor="ed-title-ar">{t("title")} · العربية</label><input id="ed-title-ar" className="input" dir="rtl" value={f.titleAr} onChange={set("titleAr")} /></div>
      <div><label className="label" htmlFor="ed-sum">{t("summary")}</label><textarea id="ed-sum" className="textarea" value={f.summary} onChange={set("summary")} /></div>
      <div><label className="label" htmlFor="ed-sum-ar">{t("summary")} · العربية</label><textarea id="ed-sum-ar" className="textarea" dir="rtl" value={f.summaryAr} onChange={set("summaryAr")} /></div>
      <div className="row">
        <div style={{ flex: 1, minWidth: 160 }}><label className="label" htmlFor="ed-type">{t("type")}</label><select id="ed-type" className="select" value={f.type} onChange={set("type")}>{config.taxonomy.types.map((x) => <option key={x} value={x}>{tx(x)}</option>)}</select></div>
        <div style={{ flex: 1, minWidth: 160 }}><label className="label" htmlFor="ed-stage">{t("stage")}</label><select id="ed-stage" className="select" value={f.stage} onChange={set("stage")}>{config.taxonomy.stages.map((x) => <option key={x} value={x}>{tx(x)}</option>)}</select></div>
      </div>
      <div><span className="label">{t("verticals")}</span><div className="multi">{config.taxonomy.verticals.map((v) => <button type="button" key={v} className={`chip ${f.verticals.includes(v) ? "on" : ""}`} aria-pressed={f.verticals.includes(v)} onClick={() => toggleV(v)}>{tx(v)}</button>)}</div></div>
      <div><label className="label" htmlFor="ed-cust">{t("customer")}</label><input id="ed-cust" className="input" value={f.customer} onChange={set("customer")} /></div>
      <div className="row">
        <div style={{ flex: 2, minWidth: 180 }}><label className="label" htmlFor="ed-head">{t("roi_headline")}</label><input id="ed-head" className="input" value={f.headline} onChange={set("headline")} /></div>
        <div style={{ flex: 1, minWidth: 110 }}><label className="label" htmlFor="ed-val">{t("usd_year")}</label><input id="ed-val" className="input" type="number" min="0" value={f.annual} onChange={set("annual")} /></div>
        <div style={{ flex: 1, minWidth: 100 }}><label className="label" htmlFor="ed-pay">{t("payback_months")}</label><input id="ed-pay" className="input" type="number" min="0" value={f.payback} onChange={set("payback")} /></div>
      </div>
      <div className="row">
        <label className="check"><input id="ed-conf" type="checkbox" checked={f.confidential} onChange={set("confidential")} /> {t("confidential")}</label>
        <label className="check"><input id="ed-feat" type="checkbox" checked={f.featured} onChange={set("featured")} /> {t("featured")}</label>
      </div>
      <div className="row"><button className="btn btn-primary" onClick={save}>{t("save")}</button><button className="btn" onClick={() => onDone(false)}>{t("cancel")}</button></div>
    </div>
  );
}

export default function Detail({ id, items, config, canEdit, onClose, toast }) {
  const { t, tx, lang, money, num, date } = useI18n();
  const custName = useCustomerName();
  const [uc, setUc] = useState(null);
  const [editing, setEditing] = useState(false);
  const [sureDelete, setSureDelete] = useState(false);

  useEffect(() => { api.get(id, editing).then(setUc).catch(() => onClose()); }, [id, editing, items]);
  useEffect(() => { const k = (e) => e.key === "Escape" && onClose(); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, []);

  if (!uc) return <><div className="overlay" onClick={onClose} /><aside className="drawer" /></>;
  const roi = uc.roi;
  const processing = ["queued", "processing"].includes(uc.status);

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={uc.title || uc.url}>
        <div className="detail-hero">
          {uc.screenshot ? <img src={uc.screenshot} alt="" /> : <Cover type={uc.type} big />}
          <button className="btn btn-icon detail-close" onClick={onClose} aria-label={t("close")}><Icon name="close" /></button>
        </div>
        <div className="detail-head">
          <div className="card-tags">
            {uc.example && <span className="pill">{t("example")}</span>}
            {uc.type && <span className="pill pill-violet">{tx(uc.type)}</span>}
            {uc.verticals?.map((v) => <span key={v} className="pill pill-cyan">{tx(v)}</span>)}
            <span className="pill">{tx(uc.stage)}</span>
            {uc.confidential && <span className="pill pill-gold"><Icon name="lock" size={12} /> {t("confidential")}</span>}
          </div>
          <h1>{localized(uc, lang, "title") || uc.url}</h1>
          <p className="lead-text">{localized(uc, lang, "summary")}</p>
          <div className="detail-actions">
            {safeHref(uc.url) && <a className="btn btn-primary" href={uc.url} target="_blank" rel="noreferrer"><Icon name="ext" size={16} /> {t("open_prototype")}</a>}
            {canEdit && <>
              <button className="btn" onClick={() => setEditing(!editing)} aria-pressed={editing}><Icon name="edit" size={16} /> {t("edit")}</button>
              <button className="btn" disabled={processing} onClick={() => { api.reanalyze(uc.id); toast(t("toast_rerun")); }}><Icon name="refresh" size={16} /> {t("rerun")}</button>
              {sureDelete
                ? <><button className="btn btn-danger" onClick={async () => { await api.remove(uc.id); toast(t("toast_deleted")); onClose(); }}><Icon name="trash" size={16} /> {t("confirm_delete")}</button><button className="btn btn-ghost" onClick={() => setSureDelete(false)}>{t("cancel")}</button></>
                : <button className="btn btn-danger" onClick={() => setSureDelete(true)}><Icon name="trash" size={16} /> {t("delete")}</button>}
            </>}
          </div>
        </div>

        <div className="detail-body">
          <div className="stack">
            {editing && <Editor uc={uc} config={config} onDone={(saved) => { setEditing(false); if (saved) toast(t("toast_saved")); }} />}
            {uc.status === "failed" && <div className="panel notice-error">{uc.error}</div>}
            {uc.problem && <div className="panel"><h3>{t("detail_problem")}</h3><p className="muted" style={{ margin: 0 }}>{uc.problem}</p></div>}
            {uc.capabilities?.length > 0 && <div className="panel"><h3>{t("detail_capabilities")}</h3><div className="multi">{uc.capabilities.map((c) => <span key={c} className="pill">{c}</span>)}</div></div>}
            {(uc.integrations?.length > 0 || uc.personas?.length > 0) && (
              <div className="panel">
                {uc.integrations?.length > 0 && <><h3>{t("detail_integrations")}</h3><div className="multi" style={{ marginBottom: 16 }}>{uc.integrations.map((c) => <span key={c} className="pill pill-cyan">{c}</span>)}</div></>}
                {uc.personas?.length > 0 && <><h3>{t("detail_personas")}</h3><div className="multi">{uc.personas.map((c) => <span key={c} className="pill">{c}</span>)}</div></>}
              </div>
            )}
            <div className="panel">
              <h3>{t("detail_assets")}</h3>
              <div className="assets">
                {uc.assets?.map((a) => <Asset key={a.id} a={a} canEdit={canEdit} onRemove={() => api.removeAsset(uc.id, a.id)} />)}
                {!uc.assets?.length && !canEdit && <p className="muted" style={{ margin: 0 }}>—</p>}
                {canEdit && <AssetAdder id={uc.id} />}
              </div>
            </div>
          </div>

          <div className="stack">
            {uc.customer?.name && (
              <div className="panel">
                <h3>{t("customer")}</h3>
                <div className="customer-row">
                  <LogoTile customer={uc.customer} />
                  <div style={{ flex: 1, minWidth: 0 }}><b>{custName(uc.customer)}</b></div>
                  {canEdit && !uc.customer.hidden && <label className="btn btn-sm"><Icon name="upload" size={14} /> {t("upload_logo")}<input type="file" hidden accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={async (e) => { if (e.target.files[0]) { try { await api.uploadLogo(uc.id, e.target.files[0]); toast(t("toast_saved")); } catch (er) { toast(er.message || String(er.code)); } } }} /></label>}
                </div>
              </div>
            )}
            {roi && (
              <div className="panel roi-panel">
                <h3>{t("detail_roi")} <span className="pill pill-gold">{t("confidence")}: {t(roi.confidence || "low")}</span></h3>
                <div className="roi-headline">{(lang === "ar" && roi.headline_ar) || roi.headline}</div>
                <div className="roi-big">{money(roi.annual_value_usd)}</div>
                <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>{t("per_year")} · {t("est")} · {t("payback")} {num(roi.payback_months, { maximumFractionDigits: 1 })} {t("months")}</div>
                {roi.metrics?.length > 0 && <div className="metrics">{roi.metrics.map((m) => <div className="metric" key={m.label}><b>{m.value}</b><span>{(lang === "ar" && m.label_ar) || m.label}</span></div>)}</div>}
                {roi.assumptions?.length > 0 && <><h3 style={{ marginTop: 18 }}>{t("detail_assumptions")}</h3><ul className="list">{roi.assumptions.map((a) => <li key={a}>{a}</li>)}</ul></>}
              </div>
            )}
            {canEdit && (
              <div className="panel">
                <h3>{t("detail_pipeline")} {uc.analyzer && <span className="pill">{uc.analyzer === "claude" ? "Claude" : t("keyword")}</span>}</h3>
                <div className="timeline">
                  {uc.pipeline?.map((s) => (
                    <div key={s.key} className={`tl ${s.status}`}>
                      <div className="tl-icon">{s.status === "running" ? <span className="spinner" /> : s.status === "done" ? <Icon name="check" size={14} stroke={3} /> : s.status === "failed" ? <Icon name="x" size={14} stroke={3} /> : <Icon name="bot" size={14} />}</div>
                      <div style={{ minWidth: 0 }}><b style={{ fontWeight: 500 }}>{t(STEP_LABEL[s.key])}</b> <span className="muted" style={{ fontSize: 13 }}>· {t(`step_${s.key}`)}</span><small>{s.detail}{s.finishedAt ? ` · ${date(s.finishedAt)}` : ""}</small></div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

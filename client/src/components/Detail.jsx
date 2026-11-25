import { useEffect, useState } from "react";
import { useI18n } from "../i18n.js";
import { api } from "../api.js";
import Icon from "./Icon.jsx";
import { LogoTile, localized, STEP_LABEL } from "./common.jsx";

function embedUrl(url = "") {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const loom = url.match(/loom\.com\/share\/([\w]+)/);
  if (loom) return `https://www.loom.com/embed/${loom[1]}`;
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  const slides = url.match(/docs\.google\.com\/presentation\/d\/([\w-]+)/);
  if (slides) return `https://docs.google.com/presentation/d/${slides[1]}/embed`;
  if (/\.pdf($|\?)/i.test(url)) return url;
  return null;
}

function Asset({ a, canEdit, onRemove }) {
  const { t } = useI18n();
  const icon = a.kind === "video" ? "video" : a.kind === "deck" ? "deck" : a.kind === "note" ? "note" : a.kind === "image" ? "file" : "link";
  const isFile = a.url?.startsWith("/uploads/");
  const embed = !isFile && embedUrl(a.url);
  return (
    <div className="asset">
      <div className="asset-head">
        <Icon name={icon} size={16} />
        <span className="grow">{a.title}</span>
        {a.url && <a className="btn btn-sm btn-ghost" href={a.url} target="_blank" rel="noreferrer"><Icon name="ext" size={14} /></a>}
        {canEdit && <button className="btn btn-sm btn-ghost btn-danger" onClick={onRemove} aria-label={t("delete")}><Icon name="trash" size={14} /></button>}
      </div>
      {a.kind === "note" && <div className="note">{a.text}</div>}
      {isFile && a.mime?.startsWith("video/") && <video src={a.url} controls preload="metadata" />}
      {isFile && a.mime?.startsWith("image/") && <img src={a.url} alt={a.title} style={{ display: "block", width: "100%" }} />}
      {isFile && a.mime === "application/pdf" && <iframe src={a.url} title={a.title} />}
      {embed && <iframe src={embed} title={a.title} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen loading="lazy" />}
    </div>
  );
}

function AssetAdder({ id, onDone }) {
  const { t } = useI18n();
  const [mode, setMode] = useState("");
  const [val, setVal] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async (data) => { setBusy(true); try { await api.addAsset(id, data); setMode(""); setVal(""); setTitle(""); onDone(); } catch (e) { alert(e.message); } finally { setBusy(false); } };
  return (
    <div className="form-grid">
      <div className="asset-add">
        {["video", "deck", "note"].map((k) => (
          <button key={k} className={`btn btn-sm ${mode === k ? "btn-primary" : ""}`} onClick={() => setMode(mode === k ? "" : k)}><Icon name={k} size={14} /> {t(`add_${k}`)}</button>
        ))}
      </div>
      {mode === "note" && (
        <><textarea className="textarea" value={val} onChange={(e) => setVal(e.target.value)} placeholder={t("note_placeholder")} />
        <div className="row"><button className="btn btn-sm btn-primary" disabled={!val.trim() || busy} onClick={() => save({ text: val, title: title || t("add_note") })}>{t("save")}</button></div></>
      )}
      {(mode === "video" || mode === "deck") && (
        <>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("title")} />
          <div className="row">
            <input className="input" style={{ flex: 1 }} value={val} onChange={(e) => setVal(e.target.value)} placeholder={t("link_placeholder")} />
            <button className="btn btn-sm btn-primary" disabled={!val.trim() || busy} onClick={() => save({ url: val, kind: mode, title })}>{t("add_link")}</button>
          </div>
          <label className="btn btn-sm" style={{ justifySelf: "start" }}>
            {busy ? <span className="spinner" /> : <Icon name="upload" size={14} />} {t("upload")}
            <input type="file" hidden accept={mode === "video" ? "video/*" : ".pdf,.ppt,.pptx,.key,image/*"} onChange={(e) => e.target.files[0] && save({ file: e.target.files[0], kind: mode, title })} />
          </label>
        </>
      )}
    </div>
  );
}

function Editor({ uc, config, onSaved, onCancel }) {
  const { t, tx } = useI18n();
  const [f, setF] = useState({
    title: uc.title, titleAr: uc.titleAr, summary: uc.summary, summaryAr: uc.summaryAr, type: uc.type, stage: uc.stage,
    verticals: uc.verticals || [], customer: uc.customer?.name || "", domain: uc.customer?.domain || "",
    annual: uc.roi?.annual_value_usd || 0, payback: uc.roi?.payback_months || 0, headline: uc.roi?.headline || "",
    confidential: uc.confidential, featured: uc.featured,
  });
  const set = (k) => (e) => setF({ ...f, [k]: e?.target ? (e.target.type === "checkbox" ? e.target.checked : e.target.value) : e });
  const toggleV = (v) => setF({ ...f, verticals: f.verticals.includes(v) ? f.verticals.filter((x) => x !== v) : [...f.verticals, v] });
  const save = async () => {
    await api.update(uc.id, {
      title: f.title, titleAr: f.titleAr, summary: f.summary, summaryAr: f.summaryAr, type: f.type, stage: f.stage, verticals: f.verticals,
      confidential: f.confidential, featured: f.featured,
      customer: f.customer ? { name: f.customer, domain: f.domain || null } : null,
      roi: { annual_value_usd: Number(f.annual) || 0, payback_months: Number(f.payback) || 0, headline: f.headline },
    });
    onSaved();
  };
  return (
    <div className="panel form-grid">
      <div><label className="label">{t("title")}</label><input className="input" value={f.title} onChange={set("title")} /></div>
      <div><label className="label">{t("title")} (AR)</label><input className="input" dir="rtl" value={f.titleAr} onChange={set("titleAr")} /></div>
      <div><label className="label">{t("summary")}</label><textarea className="textarea" value={f.summary} onChange={set("summary")} /></div>
      <div><label className="label">{t("summary")} (AR)</label><textarea className="textarea" dir="rtl" value={f.summaryAr} onChange={set("summaryAr")} /></div>
      <div className="row">
        <div style={{ flex: 1, minWidth: 180 }}><label className="label">{t("type")}</label><select className="select" value={f.type} onChange={set("type")}>{config.taxonomy.types.map((x) => <option key={x} value={x}>{tx(x)}</option>)}</select></div>
        <div style={{ flex: 1, minWidth: 180 }}><label className="label">{t("stage")}</label><select className="select" value={f.stage} onChange={set("stage")}>{config.taxonomy.stages.map((x) => <option key={x} value={x}>{tx(x)}</option>)}</select></div>
      </div>
      <div><label className="label">{t("verticals")}</label><div className="multi">{config.taxonomy.verticals.map((v) => <button type="button" key={v} className={`chip ${f.verticals.includes(v) ? "on" : ""}`} onClick={() => toggleV(v)}>{tx(v)}</button>)}</div></div>
      <div className="row">
        <div style={{ flex: 1, minWidth: 180 }}><label className="label">{t("customer")}</label><input className="input" value={f.customer} onChange={set("customer")} /></div>
        <div style={{ flex: 1, minWidth: 180 }}><label className="label">Domain</label><input className="input" value={f.domain} onChange={set("domain")} placeholder="customer.com" /></div>
      </div>
      <div className="row">
        <div style={{ flex: 2, minWidth: 200 }}><label className="label">ROI headline</label><input className="input" value={f.headline} onChange={set("headline")} /></div>
        <div style={{ flex: 1, minWidth: 120 }}><label className="label">USD / yr</label><input className="input" type="number" value={f.annual} onChange={set("annual")} /></div>
        <div style={{ flex: 1, minWidth: 100 }}><label className="label">Payback ({t("months")})</label><input className="input" type="number" value={f.payback} onChange={set("payback")} /></div>
      </div>
      <div className="row">
        <label className="check"><input type="checkbox" checked={f.confidential} onChange={set("confidential")} /> {t("confidential")}</label>
        <label className="check"><input type="checkbox" checked={f.featured} onChange={set("featured")} /> {t("featured")}</label>
      </div>
      <div className="row"><button className="btn btn-primary" onClick={save}>{t("save")}</button><button className="btn" onClick={onCancel}>{t("cancel")}</button></div>
    </div>
  );
}

export default function Detail({ id, config, canEdit, onClose, onChanged, toast }) {
  const { t, tx, lang, money, num, date } = useI18n();
  const [uc, setUc] = useState(null);
  const [editing, setEditing] = useState(false);
  const load = () => api.get(id, editing).then(setUc).catch(() => onClose());

  useEffect(() => { load(); }, [id, editing]);
  useEffect(() => {
    if (!uc || !["queued", "processing"].includes(uc.status)) return;
    const h = setInterval(load, 1500); return () => clearInterval(h);
  }, [uc?.status]);
  useEffect(() => { const k = (e) => e.key === "Escape" && onClose(); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, []);

  const refresh = () => { load(); onChanged(); };
  if (!uc) return <><div className="overlay" onClick={onClose} /><aside className="drawer" /></>;
  const roi = uc.roi;
  const processing = ["queued", "processing"].includes(uc.status);

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={uc.title}>
        <div className="detail-hero">
          {uc.screenshot && <img src={uc.screenshot} alt="" />}
          <button className="btn btn-icon detail-close" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
        </div>
        <div className="detail-head">
          <div className="card-tags">
            {uc.type && <span className="pill pill-violet">{tx(uc.type)}</span>}
            {uc.verticals?.map((v) => <span key={v} className="pill pill-cyan">{tx(v)}</span>)}
            <span className="pill">{tx(uc.stage)}</span>
            {uc.confidential && <span className="pill pill-gold"><Icon name="lock" size={12} /> {t("confidential")}</span>}
          </div>
          <h1>{localized(uc, lang, "title") || uc.url}</h1>
          <p className="lead-text">{localized(uc, lang, "summary")}</p>
          <div className="detail-actions">
            <a className="btn btn-primary" href={uc.url} target="_blank" rel="noreferrer"><Icon name="ext" size={16} /> {t("open_prototype")}</a>
            {canEdit && <>
              <button className="btn" onClick={() => setEditing(!editing)}><Icon name="edit" size={16} /> {t("edit")}</button>
              <button className="btn" disabled={processing} onClick={async () => { await api.reanalyze(uc.id); toast("Agents re-running…"); setTimeout(refresh, 300); }}><Icon name="refresh" size={16} /> {t("rerun")}</button>
              <button className="btn btn-danger" onClick={async () => { if (confirm(t("confirm_delete"))) { await api.remove(uc.id); onChanged(); onClose(); } }}><Icon name="trash" size={16} /> {t("delete")}</button>
            </>}
          </div>
        </div>

        <div className="detail-body">
          <div className="stack">
            {editing && <Editor uc={uc} config={config} onSaved={() => { setEditing(false); refresh(); toast("Saved"); }} onCancel={() => setEditing(false)} />}
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
                {uc.assets?.map((a) => <Asset key={a.id} a={a} canEdit={canEdit} onRemove={async () => { await api.removeAsset(uc.id, a.id); refresh(); }} />)}
                {canEdit && <AssetAdder id={uc.id} onDone={refresh} />}
              </div>
            </div>
          </div>

          <div className="stack">
            {uc.customer?.name && (
              <div className="panel">
                <h3>{t("customer")}</h3>
                <div className="customer-row">
                  <LogoTile customer={uc.customer} />
                  <div style={{ flex: 1 }}><b>{uc.customer.name}</b>{uc.customer.domain && <div className="muted" style={{ fontSize: 13 }}>{uc.customer.domain}</div>}</div>
                  {canEdit && !uc.customer.hidden && <label className="btn btn-sm"><Icon name="upload" size={14} /> {t("upload_logo")}<input type="file" hidden accept="image/*" onChange={async (e) => { if (e.target.files[0]) { await api.uploadLogo(uc.id, e.target.files[0]); refresh(); } }} /></label>}
                </div>
              </div>
            )}
            {roi && (
              <div className="panel roi-panel">
                <h3>{t("detail_roi")} <span className="pill pill-gold">{t("confidence")}: {t(roi.confidence || "low")}</span></h3>
                <div className="roi-headline">{(lang === "ar" && roi.headline_ar) || roi.headline}</div>
                <div className="roi-big">{money(roi.annual_value_usd)}</div>
                <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>{t("per_year")} · {t("est")} · {num(roi.payback_months, { maximumFractionDigits: 1 })} {t("months")} payback</div>
                {roi.metrics?.length > 0 && <div className="metrics">{roi.metrics.map((m) => <div className="metric" key={m.label}><b>{m.value}</b><span>{(lang === "ar" && m.label_ar) || m.label}</span></div>)}</div>}
                {roi.assumptions?.length > 0 && <><h3 style={{ marginTop: 18 }}>{t("detail_assumptions")}</h3><ul className="list">{roi.assumptions.map((a) => <li key={a}>{a}</li>)}</ul></>}
              </div>
            )}
            {canEdit && (
              <div className="panel">
                <h3>{t("detail_pipeline")} {uc.analyzer && <span className="pill">{uc.analyzer === "claude" ? "Claude" : "keyword"}</span>}</h3>
                <div className="timeline">
                  {uc.pipeline?.map((s) => (
                    <div key={s.key} className={`tl ${s.status}`}>
                      <div className="tl-icon">{s.status === "running" ? <span className="spinner" /> : s.status === "done" ? <Icon name="check" size={14} stroke={3} /> : s.status === "failed" ? <Icon name="x" size={14} stroke={3} /> : <Icon name="bot" size={14} />}</div>
                      <div><b style={{ fontWeight: 500 }}>{t(STEP_LABEL[s.key])}</b> <span className="muted" style={{ fontSize: 13 }}>· {s.label.split("·")[1]}</span><small>{s.detail}{s.finishedAt ? ` · ${date(s.finishedAt)}` : ""}</small></div>
                    </div>
                  ))}
                </div>
                {uc.error && <p style={{ color: "var(--red)", fontSize: 14 }}>{uc.error}</p>}
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

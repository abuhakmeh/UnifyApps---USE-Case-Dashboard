import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n.js";
import { api } from "../api.js";
import Icon from "./Icon.jsx";

export default function LinkDrop({ onCreated, canEdit }) {
  const { t } = useI18n();
  const [url, setUrl] = useState("");
  const [more, setMore] = useState(false);
  const [customer, setCustomer] = useState("");
  const [notes, setNotes] = useState("");
  const [confidential, setConfidential] = useState(false);
  const [shot, setShot] = useState(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef(null);

  useEffect(() => { if (!shot) { setPreview(""); return; } const u = URL.createObjectURL(shot); setPreview(u); return () => URL.revokeObjectURL(u); }, [shot]);
  useEffect(() => {
    const onPaste = (e) => {
      const f = [...(e.clipboardData?.files || [])].find((x) => x.type.startsWith("image/"));
      if (f) { setShot(f); setMore(true); e.preventDefault(); }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  const takeFile = (f) => { if (f && f.type.startsWith("image/")) { setShot(f); setErr(""); } else if (f) setErr(t("shot_wrong_type")); };

  const submit = async (e) => {
    e.preventDefault();
    if (!url.trim()) return;
    setBusy(true); setErr("");
    try {
      const withProto = /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
      await api.create({ url: withProto, customer: customer.trim(), notes: notes.trim(), confidential, screenshot: shot });
      setUrl(""); setCustomer(""); setNotes(""); setConfidential(false); setShot(null); setMore(false);
      onCreated();
    } catch (e2) {
      setErr(e2.code === "too_large" ? t("shot_too_large") : e2.message || String(e2.code));
    } finally { setBusy(false); }
  };

  if (!canEdit) return null;
  return (
    <form onSubmit={submit}>
      <div className="drop">
        <div className="drop-inner">
          <div className="drop-icon"><Icon name="link" /></div>
          <label className="sr" htmlFor="drop-url">{t("drop_placeholder")}</label>
          <input id="drop-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder={t("drop_placeholder")} autoComplete="off" inputMode="url" />
          <button className="btn btn-primary" disabled={busy || !url.trim()}>
            {busy ? <span className="spinner" /> : <Icon name="spark" />} {t("drop_cta")}
          </button>
        </div>
      </div>
      <button type="button" className="drop-toggle" onClick={() => setMore(!more)} aria-expanded={more}>{more ? "−" : "+"} {t("drop_more")}</button>
      {more && (
        <div className="drop-extra">
          <input id="drop-customer" className="input" value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder={t("customer_hint")} />
          <label className="check"><input id="drop-confidential" type="checkbox" checked={confidential} onChange={(e) => setConfidential(e.target.checked)} /> {t("confidential")}</label>
          <div className="shot-drop full" role="button" tabIndex={0}
            onClick={() => fileRef.current?.click()} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); takeFile(e.dataTransfer.files?.[0]); }}>
            {preview ? <img src={preview} alt="" className="shot-thumb" /> : <Icon name="upload" size={18} />}
            <span>{shot ? <><b>{shot.name || t("shot_pasted")}</b> · {t("shot_change")}</> : <><b>{t("shot_title")}</b> {t("shot_sub")}</>}</span>
            {shot && <button type="button" className="btn btn-sm btn-ghost" style={{ marginInlineStart: "auto" }} onClick={(e) => { e.stopPropagation(); setShot(null); }}>{t("remove")}</button>}
            <input ref={fileRef} id="drop-shot" type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(e) => takeFile(e.target.files?.[0])} />
          </div>
          <textarea id="drop-notes" className="textarea full" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("notes_hint")} />
        </div>
      )}
      {err && <div className="drop-error" role="alert">{err}</div>}
    </form>
  );
}

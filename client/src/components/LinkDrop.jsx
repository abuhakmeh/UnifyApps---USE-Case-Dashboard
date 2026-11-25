import { useState } from "react";
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
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (!url.trim()) return;
    setBusy(true); setErr("");
    try {
      const withProto = /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
      const uc = await api.create({ url: withProto, customer, notes, confidential });
      setUrl(""); setCustomer(""); setNotes(""); setConfidential(false); setMore(false);
      onCreated(uc);
    } catch (e2) {
      setErr(e2.status === 401 ? "Admin key required — add it in Settings." : e2.message);
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
      <button type="button" className="drop-toggle" onClick={() => setMore(!more)}>{more ? "−" : "+"} {t("drop_more")}</button>
      {more && (
        <div className="drop-extra">
          <input className="input" value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder={t("customer_hint")} />
          <label className="check"><input type="checkbox" checked={confidential} onChange={(e) => setConfidential(e.target.checked)} /> {t("confidential")}</label>
          <textarea className="textarea full" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("notes_hint")} />
        </div>
      )}
      {err && <div className="drop-error">{err}</div>}
    </form>
  );
}

import { useState } from "react";
import { useI18n } from "../i18n.js";
import { api, getToken, setToken } from "../api.js";

export default function Settings({ config, reload, toast }) {
  const { t } = useI18n();
  const [token, setTok] = useState(getToken());
  const s = config?.settings || {};
  const toggleHide = async () => {
    try { await api.settings({ hideCustomers: !s.hideCustomers }); reload(); } catch (e) { toast(e.message); }
  };
  return (
    <div className="container page">
      <div className="page-head"><h1>{t("settings_title")}</h1></div>
      <div className="settings">
        <div className="panel setting">
          <div><h4>{t("hide_customers")}</h4><p>{t("hide_customers_sub")}</p></div>
          <button className={`switch ${s.hideCustomers ? "on" : ""}`} onClick={toggleHide} disabled={!config?.isAdmin} aria-pressed={!!s.hideCustomers} aria-label={t("hide_customers")} />
        </div>
        {config?.adminRequired && (
          <div className="panel">
            <h4 style={{ margin: "0 0 4px" }}>{t("admin_token")}</h4>
            <p className="muted" style={{ margin: "0 0 12px", fontSize: 14 }}>{t("admin_token_sub")} {config.isAdmin ? <span className="pill pill-green">admin</span> : <span className="pill">{t("viewer_mode")}</span>}</p>
            <div className="row">
              <input className="input" style={{ flex: 1 }} type="password" value={token} onChange={(e) => setTok(e.target.value)} placeholder="••••••••" />
              <button className="btn btn-primary" onClick={() => { setToken(token); reload(); toast(t("save")); }}>{t("save")}</button>
            </div>
          </div>
        )}
        <div className="panel setting">
          <div><h4>{t("ai_status")}</h4><p>{config?.aiEnabled ? `${t("ai_on")} · ${config.model}` : t("ai_off")}</p></div>
          <span className={`pill ${config?.aiEnabled ? "pill-green" : "pill-gold"}`}><span className="dot" /> {config?.aiEnabled ? "Claude" : "keyword"}</span>
        </div>
      </div>
    </div>
  );
}

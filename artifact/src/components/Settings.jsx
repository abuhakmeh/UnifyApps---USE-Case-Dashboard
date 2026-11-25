import { useState } from "react";
import { useI18n } from "../i18n.js";
import { api } from "../api.js";

export default function Settings({ config, items, toast }) {
  const { t } = useI18n();
  const [sure, setSure] = useState(false);
  const s = config?.settings || {};
  const examples = items.filter((u) => u.example).length;
  return (
    <div className="container page">
      <div className="page-head"><h1>{t("settings_title")}</h1></div>
      <div className="settings">
        <div className="panel setting">
          <div><h4>{t("hide_customers")}</h4><p>{t("hide_customers_sub")}</p></div>
          <button className={`switch ${s.hideCustomers ? "on" : ""}`} onClick={() => api.settings({ hideCustomers: !s.hideCustomers }).catch((e) => toast(e.message))} disabled={!config?.isAdmin} aria-pressed={!!s.hideCustomers} aria-label={t("hide_customers")} />
        </div>
        <div className="panel setting">
          <div><h4>{t("privacy_title")}</h4><p>{t("privacy_sub")}</p></div>
          <span className="pill pill-gold">{t("private_badge")}</span>
        </div>
        <div className="panel setting">
          <div><h4>{t("ai_status")}</h4><p>{config?.aiEnabled ? t("ai_on_artifact") : t("ai_off_artifact")}</p></div>
          <span className={`pill ${config?.aiEnabled ? "pill-green" : "pill-gold"}`}><span className="dot" /> {config?.aiEnabled ? "Claude" : t("keyword")}</span>
        </div>
        {config?.isAdmin && examples > 0 && (
          <div className="panel setting">
            <div><h4>{t("examples_title")}</h4><p>{t("examples_sub").replace("{n}", examples)}</p></div>
            {sure
              ? <div className="row"><button className="btn btn-danger" onClick={async () => { await api.removeExamples(); setSure(false); toast(t("toast_examples_removed")); }}>{t("confirm_remove")}</button><button className="btn btn-ghost" onClick={() => setSure(false)}>{t("cancel")}</button></div>
              : <button className="btn" onClick={() => setSure(true)}>{t("remove_examples")}</button>}
          </div>
        )}
      </div>
    </div>
  );
}

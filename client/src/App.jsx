import { useCallback, useEffect, useMemo, useState } from "react";
import { I18n, makeI18n } from "./i18n.js";
import { api } from "./api.js";
import Icon from "./components/Icon.jsx";
import Dashboard from "./components/Dashboard.jsx";
import Detail from "./components/Detail.jsx";
import Tower from "./components/Tower.jsx";
import Graph3D from "./components/Graph3D.jsx";
import Ask from "./components/Ask.jsx";
import Settings from "./components/Settings.jsx";
import { useToast } from "./components/common.jsx";

const pref = (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

function useHash() {
  const [hash, setHash] = useState(window.location.hash || "#/");
  useEffect(() => { const h = () => setHash(window.location.hash || "#/"); window.addEventListener("hashchange", h); return () => window.removeEventListener("hashchange", h); }, []);
  return hash;
}

export default function App() {
  const [lang, setLang] = useState(pref("ua-lang", "en"));
  const [theme, setTheme] = useState(pref("ua-theme", "dark"));
  const [config, setConfig] = useState(null);
  const [items, setItems] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [toastEl, toast] = useToast();
  const hash = useHash();
  const route = hash.replace(/^#\/?/, "").split("/")[0] || "";
  const i18n = useMemo(() => makeI18n(lang), [lang]);

  useEffect(() => { document.documentElement.lang = lang; document.documentElement.dir = i18n.dir; save("ua-lang", lang); }, [lang]);
  useEffect(() => { document.documentElement.dataset.theme = theme; save("ua-theme", theme); }, [theme]);

  const loadConfig = useCallback(() => api.config().then(setConfig).catch(() => {}), []);
  const loadItems = useCallback(() => api.list().then(setItems).catch(() => {}), []);
  const reload = () => { loadConfig(); loadItems(); };
  useEffect(() => { reload(); }, []);

  const busy = items.some((u) => ["queued", "processing"].includes(u.status));
  useEffect(() => { const h = setInterval(loadItems, busy ? 1500 : 20000); return () => clearInterval(h); }, [busy]);

  const canEdit = Boolean(config?.isAdmin);
  const hide = config?.settings?.hideCustomers;
  const nav = [["", "nav_dashboard"], ["tower", "nav_tower"], ["graph", "nav_graph"], ["ask", "nav_ask"], ["settings", "nav_settings"]];

  return (
    <I18n.Provider value={i18n}>
      <div className="app">
        <header className="header">
          <div className="container header-inner">
            <a className="brand" href="#/" aria-label="UnifyApps home">
              <img className="brand-logo" src="/brand/unifyapps-logo.svg" alt="UnifyApps" />
              <span className="brand-divider" />
              <span className="brand-name">{lang === "ar" || !config?.settings?.brandTitle ? i18n.t("brand_title") : config.settings.brandTitle}</span>
            </a>
            <nav className="nav">{nav.map(([r, k]) => <a key={r} href={`#/${r}`} className={route === r ? "active" : ""}>{i18n.t(k)}</a>)}</nav>
            <div className="header-actions">
              {canEdit ? (
                <button className={`btn btn-sm ${hide ? "btn-primary" : ""}`} title={i18n.t("hide_customers")} onClick={async () => { await api.settings({ hideCustomers: !hide }); reload(); }}>
                  <Icon name={hide ? "eyeOff" : "eye"} size={15} /> <span className="hide-sm">{hide ? i18n.t("hidden_badge") : i18n.t("customer")}</span>
                </button>
              ) : hide ? <span className="pill pill-gold"><Icon name="lock" size={12} /> {i18n.t("hidden_badge")}</span> : null}
              <button className="btn btn-sm" onClick={() => setLang(lang === "en" ? "ar" : "en")}><Icon name="globe" size={15} /> {i18n.t("lang")}</button>
              <button className="btn btn-sm btn-icon" style={{ width: 32 }} onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label={i18n.t("theme")}><Icon name={theme === "dark" ? "sun" : "moon"} size={15} /></button>
            </div>
          </div>
        </header>

        <main>
          {route === "" && <Dashboard items={items} config={config} canEdit={canEdit} onOpen={setOpenId} onCreated={(uc) => { setItems((x) => [uc, ...x]); toast("Agents are building the profile…"); }} />}
          {route === "tower" && <Tower items={items} config={config} canEdit={canEdit} onOpen={setOpenId} />}
          {route === "graph" && <Graph3D onOpen={setOpenId} />}
          {route === "ask" && <Ask items={items} config={config} onOpen={setOpenId} />}
          {route === "settings" && <Settings config={config} reload={reload} toast={toast} />}
        </main>

        {route !== "ask" && <button className="fab" onClick={() => (window.location.hash = "#/ask")}><Icon name="spark" /> {i18n.t("nav_ask")}</button>}
        {openId && <Detail key={openId} id={openId} config={config} canEdit={canEdit} toast={toast} onClose={() => setOpenId(null)} onChanged={loadItems} />}
        {toastEl}

        <footer className="footer">
          <div className="container">
            <img className="brand-logo" src="/brand/unifyapps-logo.svg" alt="UnifyApps" style={{ height: 20 }} />
            <span>{config?.aiEnabled ? `AI agents online · ${config.model}` : "Keyword mode"} · {i18n.num(items.length)} {i18n.t("kpi_usecases").toLowerCase()}</span>
          </div>
        </footer>
      </div>
    </I18n.Provider>
  );
}

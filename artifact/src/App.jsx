import { useCallback, useEffect, useMemo, useState } from "react";
import { I18n, makeI18n } from "./i18n.js";
import { api, setViewLang } from "./api.js";
import Icon from "./components/Icon.jsx";
import Dashboard from "./components/Dashboard.jsx";
import Detail from "./components/Detail.jsx";
import Tower from "./components/Tower.jsx";
import Graph3D from "./components/Graph3D.jsx";
import Ask from "./components/Ask.jsx";
import Settings from "./components/Settings.jsx";
import { useToast } from "./components/common.jsx";
import logoUrl from "./unifyapps-logo.svg";

const pref = (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
const ROUTES = ["", "tower", "graph", "ask", "options"];

function useRoute() {
  const read = () => { const h = window.location.hash.replace(/^#/, ""); return ROUTES.includes(h) ? h : ""; };
  const [route, setRoute] = useState(read);
  useEffect(() => { const h = () => setRoute(read()); window.addEventListener("hashchange", h); return () => window.removeEventListener("hashchange", h); }, []);
  return route;
}

export default function App() {
  const [lang, setLang] = useState(pref("ua-lang", "en"));
  const [config, setConfig] = useState(null);
  const [items, setItems] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [toastEl, toast] = useToast();
  const route = useRoute();
  const i18n = useMemo(() => makeI18n(lang), [lang]);

  useEffect(() => { document.documentElement.lang = lang; document.documentElement.dir = i18n.dir; setViewLang(lang); save("ua-lang", lang); }, [lang]);

  const loadConfig = useCallback(() => api.config().then((c) => { setConfig(c); setLoaded(true); }).catch(() => setLoaded(true)), []);
  const loadItems = useCallback(() => api.list().then(setItems).catch(() => {}), []);
  useEffect(() => {
    loadConfig(); loadItems();
    return api.subscribe(() => { loadItems(); api.config().then(setConfig); });
  }, []);

  const canEdit = Boolean(config?.isAdmin);
  const hide = config?.settings?.hideCustomers;
  const nav = [["", "nav_dashboard"], ["tower", "nav_tower"], ["graph", "nav_graph"], ["ask", "nav_ask"], ["options", "nav_settings"]];
  const go = (r) => { window.location.hash = r ? r : ""; };

  return (
    <I18n.Provider value={i18n}>
      <div className="app">
        <header className="header">
          <div className="container header-inner">
            <a className="brand" href="#" onClick={(e) => { e.preventDefault(); go(""); }} aria-label="UnifyApps home">
              <img className="brand-logo" src={logoUrl} alt="UnifyApps" />
              <span className="brand-divider" />
              <span className="brand-name">{i18n.t("brand_title")}</span>
            </a>
            <nav className="nav">{nav.map(([r, k]) => <a key={k} href={`#${r}`} onClick={(e) => { e.preventDefault(); go(r); }} className={route === r ? "active" : ""}>{i18n.t(k)}</a>)}</nav>
            <div className="header-actions">
              <span className="pill pill-gold hide-sm" title={i18n.t("private_tip")}><Icon name="lock" size={12} /> {i18n.t("private_badge")}</span>
              {canEdit && (
                <button className={`btn btn-sm ${hide ? "btn-primary" : ""}`} title={i18n.t("hide_customers")} aria-pressed={!!hide} onClick={() => api.settings({ hideCustomers: !hide }).catch((e) => toast(e.message))}>
                  <Icon name={hide ? "eyeOff" : "eye"} size={15} /> <span className="hide-sm">{hide ? i18n.t("hidden_badge") : i18n.t("names_shown")}</span>
                </button>
              )}
              <button className="btn btn-sm" onClick={() => setLang(lang === "en" ? "ar" : "en")}><Icon name="globe" size={15} /> {i18n.t("lang")}</button>
            </div>
          </div>
        </header>

        <main>
          {loaded && config && !config.ready && (
            <div className="container"><div className="panel notice">{i18n.t("store_unavailable")}</div></div>
          )}
          {route === "" && <Dashboard items={items} config={config} canEdit={canEdit} onOpen={setOpenId} onCreated={() => toast(i18n.t("toast_building"))} />}
          {route === "tower" && <Tower items={items} config={config} canEdit={canEdit} onOpen={setOpenId} toast={toast} />}
          {route === "graph" && <Graph3D items={items} onOpen={setOpenId} />}
          {route === "ask" && <Ask items={items} config={config} onOpen={setOpenId} />}
          {route === "options" && <Settings config={config} items={items} toast={toast} />}
        </main>

        {route !== "ask" && <button className="fab" onClick={() => go("ask")}><Icon name="spark" /> <span>{i18n.t("nav_ask")}</span></button>}
        {openId && <Detail key={openId} id={openId} items={items} config={config} canEdit={canEdit} toast={toast} onClose={() => setOpenId(null)} />}
        {toastEl}

        <footer className="footer">
          <div className="container">
            <img className="brand-logo" src={logoUrl} alt="UnifyApps" style={{ height: 20 }} />
            <span>{config?.aiEnabled ? i18n.t("footer_ai") : i18n.t("footer_keyword")} · {i18n.num(items.filter((u) => u.status === "ready").length)} {i18n.t("kpi_usecases").toLowerCase()}</span>
          </div>
        </footer>
      </div>
    </I18n.Provider>
  );
}

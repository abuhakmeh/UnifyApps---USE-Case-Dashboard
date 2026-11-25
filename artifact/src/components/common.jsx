import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n.js";
import Icon from "./Icon.jsx";

export function CountUp({ value, format = (n) => Math.round(n).toLocaleString() }) {
  const [n, setN] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const start = performance.now(), a = from.current, b = value || 0;
    let raf;
    const step = (now) => {
      const p = Math.min(1, (now - start) / 900), e = 1 - Math.pow(1 - p, 3);
      setN(a + (b - a) * e);
      if (p < 1) raf = requestAnimationFrame(step); else from.current = b;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{format(n)}</>;
}

export function LogoTile({ customer, size }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [customer?.logo]);
  const initials = (customer?.name || "?").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const style = size ? { width: size, height: size } : undefined;
  if (customer?.hidden || !customer?.logo || broken) {
    return <div className="logo-tile anon" style={style}>{customer?.hidden ? <Icon name="lock" size={16} /> : <b style={{ fontSize: 13 }}>{initials}</b>}</div>;
  }
  return <div className="logo-tile" style={style}><img src={customer.logo} alt={`${customer.name} logo`} onError={() => setBroken(true)} /></div>;
}

export const STEP_LABEL = { scout: "agent_scout", analyst: "agent_analyst", roi: "agent_roi", brand: "agent_brand", graph: "agent_graph" };

export function Steps({ pipeline = [] }) {
  const { t } = useI18n();
  return (
    <div className="steps">
      {pipeline.map((s) => (
        <span key={s.key} className={`step ${s.status}`} title={s.detail || s.label}>
          {s.status === "running" ? <span className="spinner" /> : s.status === "done" ? <Icon name="check" size={12} stroke={3} /> : s.status === "failed" ? <Icon name="x" size={12} stroke={3} /> : <span className="dot" style={{ width: 6, height: 6 }} />}
          {t(STEP_LABEL[s.key])}
        </span>
      ))}
    </div>
  );
}

export function useToast() {
  const [msg, setMsg] = useState("");
  useEffect(() => { if (!msg) return; const id = setTimeout(() => setMsg(""), 3200); return () => clearTimeout(id); }, [msg]);
  return [msg ? <div className="toast" role="status">{msg}</div> : null, setMsg];
}

export const localized = (uc, lang, field) => (lang === "ar" && uc[field + "Ar"]) || uc[field];

// Display name for a customer; anonymous labels are rebuilt in the viewer's language.
export function useCustomerName() {
  const { t, tx } = useI18n();
  return (c) => (!c?.name ? "" : c.hidden ? t("anon_client").replace("{v}", tx(c.vertical || "Enterprise")) : c.name);
}

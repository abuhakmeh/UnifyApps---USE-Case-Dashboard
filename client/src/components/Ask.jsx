import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n.js";
import { api } from "../api.js";
import Icon from "./Icon.jsx";
import { localized } from "./common.jsx";

// Minimal, safe markdown: escapes HTML, then renders bullets, bold and [[id]] citations.
function Rich({ text, items, onOpen }) {
  const lines = text.split("\n");
  const blocks = []; let list = null;
  const inline = (s, k) => s.split(/(\*\*[^*]+\*\*|\[\[[a-f0-9]{12}\]\])/g).map((part, i) => {
    if (/^\*\*.+\*\*$/.test(part)) return <b key={`${k}-${i}`}>{part.slice(2, -2)}</b>;
    const m = part.match(/^\[\[([a-f0-9]{12})\]\]$/);
    if (m) { const u = items.find((x) => x.id === m[1]); return <button key={`${k}-${i}`} className="cite" onClick={() => onOpen(m[1])}>{u ? (u.title.length > 26 ? u.title.slice(0, 25) + "…" : u.title) : "source"}</button>; }
    return part.replace(/^#+\s*/, "");
  });
  lines.forEach((l, i) => {
    const b = l.match(/^\s*(?:[-*•]|\d+\.)\s+(.*)/);
    if (b) { (list ||= []).push(<li key={i}>{inline(b[1], i)}</li>); return; }
    if (list) { blocks.push(<ul key={`u${i}`}>{list}</ul>); list = null; }
    if (l.trim()) blocks.push(<p key={i}>{inline(l, i)}</p>);
  });
  if (list) blocks.push(<ul key="last">{list}</ul>);
  return <>{blocks}</>;
}

export default function Ask({ items, onOpen, config }) {
  const { t, lang } = useI18n();
  const [q, setQ] = useState("");
  const [msgs, setMsgs] = useState([]);
  const [busy, setBusy] = useState(false);
  const end = useRef(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs, busy]);

  const send = async (question) => {
    const text = (question ?? q).trim(); if (!text || busy) return;
    setQ(""); setBusy(true);
    const history = msgs.map((m) => ({ role: m.role, content: m.content }));
    setMsgs((m) => [...m, { role: "user", content: text }]);
    try {
      const r = await api.ask(text, lang, history);
      setMsgs((m) => [...m, { role: "assistant", content: r.answer, citations: r.citations, mode: r.mode }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", content: e.message, citations: [] }]);
    } finally { setBusy(false); }
  };

  return (
    <div className="container page">
      <div className="ask">
        <div className="page-head" style={{ textAlign: "center" }}>
          <div className="orb" style={{ width: 64, height: 64, marginBottom: 18 }} />
          <h1>{t("ask_title")}</h1><p>{t("ask_sub")}</p>
          {!config?.aiEnabled && <p style={{ marginTop: 10 }}><span className="pill pill-gold">{t("ask_keyword")}</span></p>}
        </div>
        <form className="ask-box" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("ask_placeholder")} aria-label={t("ask_placeholder")} autoFocus />
          <button className="btn btn-primary" disabled={busy || !q.trim()}>{busy ? <span className="spinner" /> : <Icon name="send" size={16} />} {t("ask_send")}</button>
        </form>
        {msgs.length === 0 && <div className="examples">{t("ask_examples").map((x) => <button key={x} className="chip" onClick={() => send(x)}>{x}</button>)}</div>}
        <div className="msgs" style={{ marginTop: 24 }}>
          {msgs.map((m, i) => (
            <div key={i} className={`msg ${m.role}`}>
              {m.role === "user" ? m.content : <Rich text={m.content} items={items} onOpen={onOpen} />}
              {m.citations?.length > 0 && (
                <div className="cite-cards">
                  {m.citations.map((id) => { const u = items.find((x) => x.id === id); if (!u) return null; return (
                    <div key={id} className="cite-card" onClick={() => onOpen(id)}>
                      {u.screenshot ? <img src={u.screenshot} alt="" /> : <span className="pill pill-violet">UC</span>}
                      <span>{localized(u, lang, "title")}</span>
                    </div>
                  ); })}
                </div>
              )}
            </div>
          ))}
          {busy && <div className="msg assistant"><span className="spinner" style={{ color: "var(--violet)" }} /></div>}
          <div ref={end} />
        </div>
      </div>
    </div>
  );
}

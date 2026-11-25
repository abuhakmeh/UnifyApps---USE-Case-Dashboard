import Icon from "./Icon.jsx";
import { useI18n } from "../i18n.js";
const MAP = {
  "Agentic AI": ["bot", "#7c5cff", "#22d3ee"], "Conversational AI": ["chat", "#5b8cff", "#a78bfa"],
  "Workflow Automation": ["refresh", "#0ea5e9", "#34d399"], "Document Intelligence": ["file", "#f59e0b", "#f472b6"],
  "Data Integration": ["link", "#14b8a6", "#5b8cff"], "Analytics & Insights": ["chart", "#e9c46a", "#7c5cff"],
  "Customer Experience": ["users", "#f472b6", "#8b7cff"], "Employee Experience": ["users", "#22d3ee", "#a3e635"],
  "IT Operations": ["layers", "#64748b", "#22d3ee"], "Compliance & Risk": ["shield", "#ef4444", "#f59e0b"],
  "Knowledge & Search": ["search", "#8b5cf6", "#22d3ee"], "App Modernization": ["layers", "#06b6d4", "#e9c46a"],
};
// Generated cover art, used when there is no screenshot.
export default function Cover({ type, big }) {
  const { tx } = useI18n();
  const [icon, a, b] = MAP[type] || ["spark", "#7c5cff", "#22d3ee"];
  return (
    <div className={`cover ${big ? "big" : ""}`} style={{ "--ca": a, "--cb": b }} aria-hidden="true">
      <div className="cover-grid" />
      <div className="cover-orb" />
      <div className="cover-icon"><Icon name={icon} size={big ? 64 : 44} stroke={1.6} /></div>
      <div className="cover-word">{type ? tx(type) : ""}</div>
    </div>
  );
}

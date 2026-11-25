import { useRef } from "react";
import { useI18n } from "../i18n.js";
import Icon from "./Icon.jsx";
import { LogoTile, Steps, localized } from "./common.jsx";

export default function UseCaseCard({ uc, onOpen }) {
  const { t, tx, lang, money } = useI18n();
  const ref = useRef(null);
  const processing = ["queued", "processing"].includes(uc.status);

  const onMove = (e) => {
    const el = ref.current; if (!el || window.matchMedia("(hover: none)").matches) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    el.style.transform = `rotateX(${(0.5 - y) * 8}deg) rotateY(${(x - 0.5) * 10}deg) translateY(-4px)`;
    el.style.setProperty("--gx", `${x * 100}%`); el.style.setProperty("--gy", `${y * 100}%`);
  };
  const onLeave = () => { if (ref.current) ref.current.style.transform = ""; };
  const count = (k) => uc.assets?.filter((a) => a.kind === k).length || 0;
  const title = localized(uc, lang, "title") || uc.source?.title || uc.url;

  return (
    <article ref={ref} className={`card ${processing ? "processing" : ""}`} onMouseMove={onMove} onMouseLeave={onLeave} onClick={() => onOpen(uc.id)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && onOpen(uc.id)}>
      <div className="card-glare" />
      <div className="card-media">
        {uc.screenshot ? <img className="shot" src={uc.screenshot} alt="" loading="lazy" /> : <div className="placeholder">{(title || "U")[0]}</div>}
        <div className="card-top">
          <span className="pill">{processing ? <><span className="dot dot-pulse" style={{ color: "var(--cyan)" }} /> {t("processing")}</> : uc.status === "failed" ? <><span className="dot" style={{ color: "var(--red)" }} /> {t("failed")}</> : tx(uc.stage)}</span>
          {uc.featured && <span className="pill"><Icon name="star" size={12} /> {t("featured")}</span>}
        </div>
        {uc.customer?.name && (
          <div className="card-customer"><LogoTile customer={uc.customer} /> <span>{uc.customer.name}</span></div>
        )}
      </div>
      <div className="card-body">
        {processing ? (
          <>
            <h3 className="card-title" style={{ wordBreak: "break-all", fontSize: 15, color: "var(--text-2)" }}>{uc.url}</h3>
            <Steps pipeline={uc.pipeline} />
          </>
        ) : (
          <>
            <div className="card-tags">
              {uc.type && <span className="pill pill-violet">{tx(uc.type)}</span>}
              {uc.verticals?.slice(0, 2).map((v) => <span key={v} className="pill pill-cyan">{tx(v)}</span>)}
              {uc.verticals?.length > 2 && <span className="pill">+{uc.verticals.length - 2}</span>}
            </div>
            <h3 className="card-title">{title}</h3>
            <p className="card-summary">{localized(uc, lang, "summary") || uc.error}</p>
            <div className="card-foot">
              {uc.roi ? (
                <div className="roi-mini"><b>{money(uc.roi.annual_value_usd)}</b><span>{(lang === "ar" && uc.roi.headline_ar) || uc.roi.headline}</span></div>
              ) : <span />}
              <div className="card-assets">
                {count("video") > 0 && <Icon name="video" size={16} />}
                {count("deck") > 0 && <Icon name="deck" size={16} />}
                {count("note") > 0 && <Icon name="note" size={16} />}
              </div>
            </div>
          </>
        )}
      </div>
    </article>
  );
}

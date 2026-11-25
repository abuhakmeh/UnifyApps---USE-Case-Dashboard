import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSS2DRenderer, CSS2DObject } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { useI18n } from "../i18n.js";
import { api } from "../api.js";

const COLORS = { usecase: 0x8b7cff, vertical: 0x22d3ee, type: 0xf472b6, customer: 0xe9c46a, integration: 0x34d399 };
const SIZE = { usecase: 0.55, vertical: 0.9, type: 0.75, customer: 0.8, integration: 0.5 };

// Simple 3D force layout (repulsion + springs + centering), run ahead of time and then eased.
function layout(nodes, links) {
  const idx = new Map(nodes.map((n, i) => [n.id, i]));
  const P = nodes.map(() => new THREE.Vector3((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30));
  const V = nodes.map(() => new THREE.Vector3());
  const tmp = new THREE.Vector3();
  for (let it = 0; it < 260; it++) {
    const alpha = 1 - it / 260;
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
      tmp.subVectors(P[i], P[j]); const d2 = Math.max(tmp.lengthSq(), 0.5);
      tmp.multiplyScalar((60 / d2) * alpha); V[i].add(tmp); V[j].sub(tmp);
    }
    for (const l of links) {
      const a = idx.get(l.source), b = idx.get(l.target);
      tmp.subVectors(P[b], P[a]); const d = tmp.length() || 1;
      tmp.multiplyScalar(((d - 7) / d) * 0.06 * alpha); V[a].add(tmp); V[b].sub(tmp);
    }
    for (let i = 0; i < nodes.length; i++) { V[i].addScaledVector(P[i], -0.01 * alpha); P[i].add(V[i]); V[i].multiplyScalar(0.6); }
  }
  return P;
}

export default function Graph3D({ onOpen }) {
  const { t } = useI18n();
  const ref = useRef(null);
  const [data, setData] = useState(null);
  const [hidden, setHidden] = useState({});
  const [sel, setSel] = useState(null);
  const [tip, setTip] = useState(null);
  const api3d = useRef({});

  useEffect(() => { api.graph().then(setData); }, []);

  useEffect(() => {
    if (!data || !ref.current) return;
    const el = ref.current;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    el.appendChild(renderer.domElement);
    const labels = new CSS2DRenderer();
    labels.domElement.style.cssText = "position:absolute;inset:0;pointer-events:none";
    el.appendChild(labels.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x05060f, 0.012);
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 500);
    camera.position.set(0, 6, 46);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.autoRotate = true; controls.autoRotateSpeed = 0.6;
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const pl = new THREE.PointLight(0x8b7cff, 300, 200); pl.position.set(20, 30, 20); scene.add(pl);

    const P = layout(data.nodes, data.links);
    // frame the whole graph
    const center = P.reduce((c, p) => c.add(p), new THREE.Vector3()).divideScalar(Math.max(1, P.length));
    P.forEach((p) => p.sub(center));
    const radius = Math.max(8, ...P.map((p) => p.length()));
    camera.position.set(0, radius * 0.25, radius * 2.3);
    camera.far = radius * 12; camera.updateProjectionMatrix();
    scene.fog.density = 0.18 / radius;
    const k = Math.max(1, radius / 12);
    const meshes = data.nodes.map((n, i) => {
      const r = SIZE[n.kind] * k * (1 + Math.min(n.weight, 8) * 0.08);
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 24), new THREE.MeshStandardMaterial({ color: COLORS[n.kind], emissive: COLORS[n.kind], emissiveIntensity: 0.55, roughness: 0.3 }));
      const halo = new THREE.Mesh(new THREE.SphereGeometry(r * 2.1, 16, 16), new THREE.MeshBasicMaterial({ color: COLORS[n.kind], transparent: true, opacity: 0.08, depthWrite: false }));
      m.add(halo);
      m.position.copy(P[i]); m.userData = n;
      if (n.kind !== "usecase" || data.nodes.length < 40) {
        const div = document.createElement("div");
        div.textContent = n.label.length > 28 ? n.label.slice(0, 27) + "…" : n.label;
        div.style.cssText = `font:${n.kind === "usecase" ? "500 11px" : "600 12px"} Inter, sans-serif;color:${n.kind === "usecase" ? "#c9cdf5" : "#fff"};text-shadow:0 1px 6px #000;white-space:nowrap;transform:translateY(-${16 + (r / k) * 12}px)`;
        m.add(new CSS2DObject(div));
      }
      scene.add(m);
      return m;
    });
    const byId = new Map(meshes.map((m) => [m.userData.id, m]));
    const lineMat = new THREE.LineBasicMaterial({ color: 0x8b9cff, transparent: true, opacity: 0.35 });
    const lines = data.links.map((l) => {
      const g = new THREE.BufferGeometry().setFromPoints([byId.get(l.source).position, byId.get(l.target).position]);
      const line = new THREE.Line(g, lineMat.clone()); line.userData = l; scene.add(line); return line;
    });

    const stars = new THREE.Points(new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(Float32Array.from({ length: 2400 }, () => (Math.random() - 0.5) * 300), 3)), new THREE.PointsMaterial({ color: 0x9aa4ff, size: 0.25, transparent: true, opacity: 0.5 }));
    scene.add(stars);

    const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
    const pick = (e) => {
      const r = renderer.domElement.getBoundingClientRect();
      mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(mouse, camera);
      return ray.intersectObjects(meshes.filter((m) => m.visible), false)[0]?.object;
    };
    const onMove = (e) => {
      const o = pick(e); const r = el.getBoundingClientRect();
      setTip(o ? { x: e.clientX - r.left, y: e.clientY - r.top, label: o.userData.label } : null);
      renderer.domElement.style.cursor = o ? "pointer" : "grab";
    };
    let down;
    const onDown = (e) => { down = [e.clientX, e.clientY]; };
    const onUp = (e) => {
      if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
      const o = pick(e);
      if (!o) { setSel(null); highlight(null); return; }
      controls.autoRotate = false;
      setSel(o.userData); highlight(o.userData.id);
    };
    const highlight = (id) => {
      const near = new Set(id ? [id, ...data.links.flatMap((l) => (l.source === id ? [l.target] : l.target === id ? [l.source] : []))] : []);
      meshes.forEach((m) => { m.material.emissiveIntensity = !id || near.has(m.userData.id) ? 0.6 : 0.08; m.material.opacity = 1; });
      lines.forEach((ln) => { ln.material.opacity = !id ? 0.35 : ln.userData.source === id || ln.userData.target === id ? 0.85 : 0.04; });
    };
    renderer.domElement.addEventListener("pointermove", onMove);
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);
    api3d.current = {
      neighbors: (id) => data.links.flatMap((l) => (l.source === id ? [l.target] : l.target === id ? [l.source] : [])).map((x) => byId.get(x).userData),
      setHidden: (h) => {
        meshes.forEach((m) => { m.visible = !h[m.userData.kind]; });
        lines.forEach((ln) => { ln.visible = byId.get(ln.userData.source).visible && byId.get(ln.userData.target).visible; });
      },
    };

    const resize = () => { const w = el.clientWidth, h = el.clientHeight; renderer.setSize(w, h); labels.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(el);
    let raf, tt = 0;
    const tick = () => {
      tt += 0.01;
      meshes.forEach((m, i) => { m.children[0].scale.setScalar(1 + Math.sin(tt * 2 + i) * 0.08); });
      controls.update(); renderer.render(scene, camera); labels.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); controls.dispose(); renderer.dispose();
      scene.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
      el.innerHTML = "";
    };
  }, [data]);

  useEffect(() => { api3d.current.setHidden?.(hidden); }, [hidden, data]);

  const kinds = ["usecase", "vertical", "type", "customer", "integration"];
  const neighbors = sel ? api3d.current.neighbors?.(sel.id) || [] : [];
  return (
    <div className="container page">
      <div className="page-head"><h1>{t("graph_title")}</h1><p>{t("graph_sub")}</p></div>
      <div className="graph-wrap">
        <div ref={ref} style={{ position: "absolute", inset: 0 }} />
        <div className="graph-legend">
          {kinds.map((k) => (
            <button key={k} className={`pill ${hidden[k] ? "off" : ""}`} onClick={() => setHidden({ ...hidden, [k]: !hidden[k] })}>
              <span className="dot" style={{ color: `#${COLORS[k].toString(16).padStart(6, "0")}` }} /> {t(`legend_${k}`)}
            </button>
          ))}
        </div>
        {tip && <div className="graph-tip" style={{ left: tip.x, top: tip.y }}>{tip.label}</div>}
        {sel && (
          <div className="graph-side">
            <span className="pill" style={{ background: "transparent", color: "#dfe2ff" }}>{t(`legend_${sel.kind}`)}</span>
            <h3 style={{ margin: "10px 0 6px", fontFamily: "var(--display)", fontSize: 20 }}>{sel.label}</h3>
            {sel.useCaseId && <button className="btn btn-primary btn-sm" style={{ margin: "8px 0 14px" }} onClick={() => onOpen(sel.useCaseId)}>Open profile</button>}
            <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 1, color: "#8f95c7", margin: "10px 0 8px" }}>{neighbors.length} connections</div>
            <div style={{ display: "grid", gap: 6 }}>
              {neighbors.map((n) => (
                <button key={n.id} className="btn btn-sm" style={{ justifyContent: "flex-start", color: "#eef0ff", background: "rgba(255,255,255,.06)", borderColor: "rgba(255,255,255,.1)" }} onClick={() => n.useCaseId && onOpen(n.useCaseId)}>
                  <span className="dot" style={{ color: `#${COLORS[n.kind].toString(16).padStart(6, "0")}` }} /> {n.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {data && data.nodes.length === 0 && <div className="empty" style={{ position: "relative", color: "#a9aed6" }}><div className="orb" /><h3 style={{ color: "#fff" }}>{t("empty_title")}</h3></div>}
      </div>
    </div>
  );
}

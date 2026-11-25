import { useEffect, useRef } from "react";
import * as THREE from "three";

// Animated "universe" core: a glowing faceted orb, orbit rings with travelling nodes and a star field.
export default function Hero3D({ dir = "ltr", nodes = 12 }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
    camera.position.set(0, 0, 14);

    const group = new THREE.Group();
    scene.add(group);

    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(2.3, 1), new THREE.MeshStandardMaterial({ color: 0x5b6cff, emissive: 0x2a1f8f, metalness: 0.6, roughness: 0.25, flatShading: true }));
    group.add(core);
    const wire = new THREE.Mesh(new THREE.IcosahedronGeometry(2.9, 2), new THREE.MeshBasicMaterial({ color: 0x22d3ee, wireframe: true, transparent: true, opacity: 0.18 }));
    group.add(wire);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(3.6, 48, 48), new THREE.MeshBasicMaterial({ color: 0x8b7cff, transparent: true, opacity: 0.06 }));
    group.add(halo);

    const ringColors = [0x8b7cff, 0x22d3ee, 0xe9c46a];
    const orbiters = [];
    ringColors.forEach((c, i) => {
      const r = 4.4 + i * 1.35;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.012, 8, 200), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.45 }));
      const tilt = new THREE.Group();
      tilt.rotation.set(1.2 + i * 0.35, i * 0.6, i * 0.4);
      tilt.add(ring);
      group.add(tilt);
      const count = Math.max(3, Math.round(nodes / 3) + i);
      for (let k = 0; k < count; k++) {
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.09 + Math.random() * 0.1, 16, 16), new THREE.MeshBasicMaterial({ color: c }));
        const glow = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 16), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.18 }));
        m.add(glow);
        tilt.add(m);
        orbiters.push({ m, r, a: (k / count) * Math.PI * 2, s: 0.12 + i * 0.05 });
      }
    });

    const starGeo = new THREE.BufferGeometry();
    const pts = new Float32Array(1500 * 3);
    for (let i = 0; i < pts.length; i++) pts[i] = (Math.random() - 0.5) * 70;
    starGeo.setAttribute("position", new THREE.BufferAttribute(pts, 3));
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xaab4ff, size: 0.05, transparent: true, opacity: 0.7 }));
    scene.add(stars);

    scene.add(new THREE.AmbientLight(0x8890ff, 0.6));
    const l1 = new THREE.PointLight(0x22d3ee, 60, 40); l1.position.set(6, 4, 6); scene.add(l1);
    const l2 = new THREE.PointLight(0xe9c46a, 40, 40); l2.position.set(-6, -3, 4); scene.add(l2);

    const mouse = { x: 0, y: 0 };
    const onMove = (e) => { mouse.x = e.clientX / window.innerWidth - 0.5; mouse.y = e.clientY / window.innerHeight - 0.5; };
    window.addEventListener("pointermove", onMove);

    const resize = () => {
      const w = el.clientWidth, h = el.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      const side = w > 900 ? (dir === "rtl" ? -1 : 1) * Math.min(6.5, w / 220) : 0;
      const narrow = w <= 900;
      group.position.set(narrow ? 2.5 : side, narrow ? 5.5 : 0, narrow ? -4 : 0);
      group.scale.setScalar(narrow ? 0.6 : 1);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    let raf, t = 0;
    const tick = () => {
      t += reduce ? 0 : 0.01;
      core.rotation.y += reduce ? 0 : 0.004; core.rotation.x += reduce ? 0 : 0.002;
      wire.rotation.y -= reduce ? 0 : 0.002;
      halo.scale.setScalar(1 + Math.sin(t * 1.5) * 0.03);
      for (const o of orbiters) { o.a += o.s * 0.02 * (reduce ? 0 : 1); o.m.position.set(Math.cos(o.a) * o.r, Math.sin(o.a) * o.r, 0); }
      stars.rotation.y += reduce ? 0 : 0.0004;
      group.rotation.y += (mouse.x * 0.5 - group.rotation.y) * 0.04;
      group.rotation.x += (mouse.y * 0.3 - group.rotation.x) * 0.04;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); window.removeEventListener("pointermove", onMove);
      renderer.dispose(); scene.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
      el.removeChild(renderer.domElement);
    };
  }, [dir, nodes]);
  return <div className="hero-canvas" ref={ref} aria-hidden="true" />;
}

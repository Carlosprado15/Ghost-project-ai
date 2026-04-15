// ============================================================
// GHOST PROJECT — App.jsx — VERSÃO FINAL UNIFICADA
// Correções:
// • Hooks sempre no topo, sem condicionais (regra dos Hooks)
// • Three.js CDN singleton (não re-injeta script)
// • Câmera traseira/frontal com alternância
// • Fundo preto garantido via CSS + inline fallback
// • Safe area iOS/Android (env safe-area-inset)
// ============================================================

import { useEffect, useRef, useState, useCallback } from "react";
import "./App.css";

// ── Constantes do Sistema (Cérebro) ───────────────────────
const SYS = {
  LOGO_URL:       "https://i.postimg.cc/RVQVdBx3/1776216880651.jpg",
  THREE_CDN:      "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js",
  SCAN_MS:        2600,
  DAMPING:        0.90,
  GOLD:           0xd4af37,
  GOLD_EMISSIVE:  0x3a2800,
  AMBIENT_INT:    0.7,
  KEY_INT:        3.2,
};

// ── Singleton loader (não duplica o script) ───────────────
let _threePromise = null;
function ensureThree() {
  if (_threePromise) return _threePromise;
  _threePromise = new Promise((resolve, reject) => {
    if (window.THREE) return resolve(window.THREE);
    const s = document.createElement("script");
    s.src     = SYS.THREE_CDN;
    s.onload  = () => resolve(window.THREE);
    s.onerror = () => reject(new Error("Three.js CDN falhou"));
    document.head.appendChild(s);
  });
  return _threePromise;
}

// ── Geometria: Relógio dourado procedural ─────────────────
function buildWatch(THREE) {
  const group = new THREE.Group();

  const gold = new THREE.MeshStandardMaterial({
    color: SYS.GOLD, emissive: SYS.GOLD_EMISSIVE,
    metalness: 1.0, roughness: 0.15,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: 0x0a0a0a, metalness: 0.3, roughness: 0.8,
  });
  const strap = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a, metalness: 0.15, roughness: 0.9,
  });

  // Bezel
  group.add(new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.09, 32, 100), gold));

  // Face
  const face = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.06, 64), dark);
  face.rotation.x = Math.PI / 2;
  group.add(face);

  // Marcadores hora
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const big = i % 3 === 0;
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(big ? 0.05 : 0.025, big ? 0.15 : 0.08, 0.03), gold
    );
    m.position.set(Math.sin(a) * 0.5, Math.cos(a) * 0.5, 0.05);
    m.rotation.z = -a;
    group.add(m);
  }

  // Ponteiro horas
  const ph = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.28, 0.025), gold);
  ph.position.set(0.06, 0.10, 0.07); ph.rotation.z = -0.8;
  group.add(ph);

  // Ponteiro minutos
  const pm = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.40, 0.025), gold);
  pm.position.set(-0.04, 0.14, 0.07); pm.rotation.z = 0.4;
  group.add(pm);

  // Coroa lateral
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.18, 16), gold);
  crown.rotation.z = Math.PI / 2; crown.position.set(0.78, 0, 0);
  group.add(crown);

  // Pulseiras
  const sGeo = new THREE.BoxGeometry(0.42, 0.55, 0.06);
  [-1.1, 1.1].forEach(y => {
    const s = new THREE.Mesh(sGeo, strap);
    s.position.set(0, y, 0);
    group.add(s);
  });

  // Partículas douradas
  const n = 140;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    pos[i*3]   = (Math.random() - 0.5) * 6;
    pos[i*3+1] = (Math.random() - 0.5) * 6;
    pos[i*3+2] = (Math.random() - 0.5) * 6;
  }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  group.add(new THREE.Points(pg, new THREE.PointsMaterial({
    color: SYS.GOLD, size: 0.018, transparent: true, opacity: 0.5,
  })));

  return group;
}

// ══════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════
export default function App() {

  // ── Refs (declarados incondicionalmente no topo) ────────
  const videoRef      = useRef(null);
  const canvasRef     = useRef(null);
  const overlayRef    = useRef(null);
  const threeRef      = useRef({ renderer:null, scene:null, camera:null, object:null, raf:null, keyLight:null });
  const orientRef     = useRef({ beta:0, gamma:0 });
  const touchRef      = useRef({ active:false, lastX:0, lastY:0, vx:0, vy:0 });
  const mouseRef      = useRef({ down:false, lastX:0, lastY:0 });
  const facingRef     = useRef("environment");

  // ── Estados ─────────────────────────────────────────────
  const [phase,    setPhase]    = useState("loading");
  const [scanPct,  setScanPct]  = useState(0);
  const [camError, setCamError] = useState(null);
  const [facing,   setFacing]   = useState("environment"); // usado para UI do botão

  // ── 1. Pré-carrega Three.js ─────────────────────────────
  useEffect(() => {
    ensureThree()
      .then(()  => setPhase("idle"))
      .catch(()  => setPhase("idle"));
  }, []);

  // ── 2. Sensor de orientação ─────────────────────────────
  useEffect(() => {
    const h = (e) => { orientRef.current = { beta: e.beta ?? 0, gamma: e.gamma ?? 0 }; };
    window.addEventListener("deviceorientation", h, true);
    return () => window.removeEventListener("deviceorientation", h, true);
  }, []);

  // ── 3. Resize ───────────────────────────────────────────
  useEffect(() => {
    const onResize = () => {
      const { renderer, camera } = threeRef.current;
      const c = canvasRef.current;
      if (!renderer || !c) return;
      const W = c.clientWidth, H = c.clientHeight;
      renderer.setSize(W, H, false);
      if (camera) { camera.aspect = W / H; camera.updateProjectionMatrix(); }
      const ol = overlayRef.current;
      if (ol) { ol.width = W; ol.height = H; }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ── 4. Cleanup geral ────────────────────────────────────
  useEffect(() => {
    return () => {
      const { renderer, raf } = threeRef.current;
      if (raf) cancelAnimationFrame(raf);
      if (renderer) renderer.dispose();
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  // ── Inicia/alterna câmera ───────────────────────────────
  const startCamera = useCallback(async (facingMode) => {
    setPhase("requesting");
    setCamError(null);
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setPhase("streaming");
    } catch (err) {
      setCamError(
        err.name === "NotAllowedError"
          ? "Permissão negada. Habilite a câmera nas configurações do navegador."
          : "Câmera indisponível neste dispositivo."
      );
      setPhase("idle");
    }
  }, []);

  const toggleCamera = useCallback(() => {
    const next = facingRef.current === "environment" ? "user" : "environment";
    facingRef.current = next;
    setFacing(next);
    // Para o Three.js se estiver rodando
    const { raf, renderer } = threeRef.current;
    if (raf) cancelAnimationFrame(raf);
    if (renderer) renderer.dispose();
    threeRef.current = { renderer:null, scene:null, camera:null, object:null, raf:null, keyLight:null };
    startCamera(next);
  }, [startCamera]);

  // ── Animação de scan (canvas 2D) ────────────────────────
  const runScan = useCallback((onComplete) => {
    const ol = overlayRef.current;
    const ctx = ol?.getContext("2d");
    if (!ol || !ctx) { onComplete(); return; }
    ol.width  = ol.clientWidth  || window.innerWidth;
    ol.height = ol.clientHeight || window.innerHeight;
    const start = performance.now();

    function frame(now) {
      const p = Math.min((now - start) / SYS.SCAN_MS, 1);
      setScanPct(p);
      ctx.clearRect(0, 0, ol.width, ol.height);

      const y = p * ol.height;
      const g = ctx.createLinearGradient(0, y - 32, 0, y + 4);
      g.addColorStop(0,   "rgba(212,175,55,0)");
      g.addColorStop(0.7, "rgba(212,175,55,0.14)");
      g.addColorStop(1,   "rgba(212,175,55,0.88)");
      ctx.fillStyle = g;
      ctx.fillRect(0, y - 32, ol.width, 36);
      ctx.beginPath();
      ctx.moveTo(0, y); ctx.lineTo(ol.width, y);
      ctx.strokeStyle = "rgba(212,175,55,0.92)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // cantos
      const L = 34, P = 26, alpha = 0.4 + p * 0.6;
      ctx.strokeStyle = `rgba(212,175,55,${alpha})`;
      ctx.lineWidth = 2;
      [[P,P,1,1],[ol.width-P,P,-1,1],[P,ol.height-P,1,-1],[ol.width-P,ol.height-P,-1,-1]].forEach(([x,cy,dx,dy]) => {
        ctx.beginPath();
        ctx.moveTo(x, cy+dy*L); ctx.lineTo(x, cy); ctx.lineTo(x+dx*L, cy);
        ctx.stroke();
      });

      if (p < 1) requestAnimationFrame(frame);
      else { ctx.clearRect(0,0,ol.width,ol.height); onComplete(); }
    }
    requestAnimationFrame(frame);
  }, []);

  const startScan = useCallback(() => {
    if (phase !== "streaming") return;
    setPhase("scanning");
    setScanPct(0);
    runScan(initAR);
  }, [phase, runScan]); // eslint-disable-line

  // ── Inicia cena Three.js ────────────────────────────────
  function initAR() {
    const THREE  = window.THREE;
    const canvas = canvasRef.current;
    if (!THREE || !canvas) { setPhase("ar"); return; }

    const W = canvas.clientWidth  || window.innerWidth;
    const H = canvas.clientHeight || window.innerHeight;
    canvas.width = W; canvas.height = H;

    const renderer = new THREE.WebGLRenderer({
      canvas, alpha: true, antialias: true, powerPreference: "high-performance",
    });
    renderer.setSize(W, H, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);

    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, W / H, 0.01, 100);
    camera.position.set(0, 0, 2.4);

    scene.add(new THREE.AmbientLight(0xffeedd, SYS.AMBIENT_INT));
    const key = new THREE.PointLight(0xffd700, SYS.KEY_INT, 12);
    key.position.set(2, 3, 3);
    scene.add(key);
    const fill = new THREE.PointLight(0xffffff, 1.2, 10);
    fill.position.set(-2, -1, 2);
    scene.add(fill);
    scene.add(Object.assign(new THREE.PointLight(0xd4af37, 0.8, 8), { position: { x:0, y:-3, z:-1 } }));

    const obj = buildWatch(THREE);
    scene.add(obj);
    threeRef.current = { renderer, scene, camera, object: obj, raf: null, keyLight: key };
    setPhase("ar");

    function loop() {
      threeRef.current.raf = requestAnimationFrame(loop);
      const { vx, vy, active } = touchRef.current;
      const { beta, gamma } = orientRef.current;

      if (active) {
        obj.rotation.y += vx * 0.013;
        obj.rotation.x += vy * 0.013;
        touchRef.current.vx *= SYS.DAMPING;
        touchRef.current.vy *= SYS.DAMPING;
      } else {
        const ty = (gamma / 45) * 0.55;
        const tx = ((beta - 45) / 45) * 0.35;
        obj.rotation.y += (ty - obj.rotation.y) * 0.06 + 0.003;
        obj.rotation.x += (tx - obj.rotation.x) * 0.05;
      }
      obj.position.y = Math.sin(Date.now() * 0.0009) * 0.055;
      key.intensity   = SYS.KEY_INT + Math.sin(Date.now() * 0.0018) * 0.35;
      renderer.render(scene, camera);
    }
    loop();
  }

  // ── Touch handlers ──────────────────────────────────────
  const onTouchStart = useCallback((e) => {
    if (e.touches.length !== 1) return;
    touchRef.current = { active:true, lastX:e.touches[0].clientX, lastY:e.touches[0].clientY, vx:0, vy:0 };
  }, []);
  const onTouchMove = useCallback((e) => {
    if (!touchRef.current.active || e.touches.length !== 1) return;
    e.preventDefault();
    const dx = e.touches[0].clientX - touchRef.current.lastX;
    const dy = e.touches[0].clientY - touchRef.current.lastY;
    touchRef.current.vx = dx; touchRef.current.vy = dy;
    touchRef.current.lastX = e.touches[0].clientX;
    touchRef.current.lastY = e.touches[0].clientY;
    const o = threeRef.current.object;
    if (o) { o.rotation.y += dx * 0.013; o.rotation.x += dy * 0.013; }
  }, []);
  const onTouchEnd   = useCallback(() => { touchRef.current.active = false; }, []);
  const onMouseDown  = useCallback((e) => {
    mouseRef.current = { down:true, lastX:e.clientX, lastY:e.clientY };
    touchRef.current.active = true;
  }, []);
  const onMouseMove  = useCallback((e) => {
    if (!mouseRef.current.down) return;
    const dx = e.clientX - mouseRef.current.lastX;
    const dy = e.clientY - mouseRef.current.lastY;
    mouseRef.current.lastX = e.clientX; mouseRef.current.lastY = e.clientY;
    touchRef.current.vx = dx; touchRef.current.vy = dy;
    const o = threeRef.current.object;
    if (o) { o.rotation.y += dx * 0.010; o.rotation.x += dy * 0.010; }
  }, []);
  const onMouseUp = useCallback(() => {
    mouseRef.current.down = false; touchRef.current.active = false;
  }, []);

  // ── Label do scan ───────────────────────────────────────
  const scanLabel =
    scanPct < 0.38 ? "Mapeando superfícies..." :
    scanPct < 0.72 ? "Calculando profundidade..." :
    "Ancorando objeto 3D...";

  // ══════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════
  return (
    <div className="gp-root">

      {/* Fundo de câmera */}
      <video
        ref={videoRef}
        className={`gp-video${(phase==="idle"||phase==="loading"||phase==="requesting") ? " hidden" : ""}`}
        playsInline muted autoPlay
      />

      {/* Canvas Three.js */}
      <canvas
        ref={canvasRef}
        className={`gp-canvas${phase==="ar" ? " visible" : ""}`}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
      />

      {/* Canvas overlay / scan */}
      <canvas ref={overlayRef} className="gp-overlay" />

      {/* ══ LOADING ══ */}
      {phase === "loading" && (
        <div className="gp-loading">
          <div className="gp-ring" />
          <p className="gp-loading-text">Iniciando GHOST PROJECT...</p>
        </div>
      )}

      {/* ══ IDLE ══ */}
      {phase === "idle" && (
        <div className="gp-idle">
          <div className="gp-grid-bg" />
          <div className="gp-idle-inner">
            <div className="gp-logo-block">
              <img
                src={SYS.LOGO_URL}
                alt="Ghost Project"
                className="gp-logo"
                onError={e => { e.currentTarget.style.display = "none"; }}
              />
              <span className="gp-logo-sub">PROJETO · RA</span>
            </div>

            <div className="gp-sep" />

            <p className="gp-tagline">
              Experimente antes de comprar.<br />
              <em>Realidade Aumentada para e-commerce.</em>
            </p>

            {camError && <div className="gp-error">{camError}</div>}

            <button className="gp-cta" onClick={() => startCamera(facingRef.current)}>
              INICIAR EXPERIÊNCIA AR
            </button>

            <p className="gp-hint">Câmera traseira · iOS Safari · Android Chrome</p>
          </div>
        </div>
      )}

      {/* ══ REQUESTING ══ */}
      {phase === "requesting" && (
        <div className="gp-overlay-ui">
          <div className="gp-spinner" />
          <p className="gp-status">Solicitando câmera...</p>
        </div>
      )}

      {/* ══ STREAMING ══ */}
      {phase === "streaming" && (
        <div className="gp-hud">
          <div className="gp-hud-top">
            <span className="gp-brand">GHOST · AR</span>
            <div className="gp-hud-right">
              <button className="gp-icon-btn" onClick={toggleCamera} title="Alternar câmera">
                {facing === "environment" ? "🔄" : "🤳"}
              </button>
              <span className="gp-badge">● ATIVA</span>
            </div>
          </div>
          <div className="gp-frame">
            <span className="gp-corner tl"/><span className="gp-corner tr"/>
            <span className="gp-corner bl"/><span className="gp-corner br"/>
            <p className="gp-frame-hint">Aponte para o ambiente</p>
          </div>
          <div className="gp-hud-bottom">
            <button className="gp-scan-btn" onClick={startScan}>ESCANEAR</button>
          </div>
        </div>
      )}

      {/* ══ SCANNING ══ */}
      {phase === "scanning" && (
        <div className="gp-hud">
          <div className="gp-hud-top">
            <span className="gp-brand">GHOST · AR</span>
            <span className="gp-badge scanning">◈ ANALISANDO</span>
          </div>
          <div className="gp-prog-wrap">
            <div className="gp-prog-bar" style={{ width: `${scanPct * 100}%` }} />
          </div>
          <p className="gp-scan-lbl">{scanLabel}</p>
        </div>
      )}

      {/* ══ AR ══ */}
      {phase === "ar" && (
        <div className="gp-hud">
          <div className="gp-hud-top">
            <span className="gp-brand">GHOST · AR</span>
            <div className="gp-hud-right">
              <button className="gp-icon-btn" onClick={toggleCamera}>
                {facing === "environment" ? "🔄" : "🤳"}
              </button>
              <span className="gp-badge live">◉ AO VIVO</span>
            </div>
          </div>
          <p className="gp-drag-hint">↺ Arraste para girar</p>
          <div className="gp-hud-bottom ar-row">
            <button className="gp-sec" onClick={() => {
              const { raf, renderer } = threeRef.current;
              if (raf) cancelAnimationFrame(raf);
              if (renderer) renderer.dispose();
              threeRef.current = { renderer:null, scene:null, camera:null, object:null, raf:null, keyLight:null };
              setPhase("streaming");
            }}>REPOSICIONAR</button>
            <button className="gp-sec accent" onClick={() => alert("✓ Decisão validada. Evento registrado.")}>
              VALIDAR COMPRA
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

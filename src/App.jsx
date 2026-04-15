/**
 * GHOST PROJECT AI — AR ENGINE v4.0
 * Brain: Three.js · GLTFLoader · DeviceOrientation · PWA
 * Voice: Ghost identity · Luxury black/gold · Universal AR
 */

import { useState, useRef, useEffect, useCallback } from "react";

// ── Constants ─────────────────────────────────────────────────────────
const S = { IDLE:"idle", LOADING:"loading", SCANNING:"scanning", AR:"ar", ERROR:"error" };
const GOLD      = "#d4af37";
const GOLD_DIM  = "rgba(212,175,55,0.42)";
const DARK      = "#06090f";
const LOGO_URL  = "https://i.ibb.co/JRcfKZhw/1776216880651.jpg";
const GLB_URL   = "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/WaterBottle/glTF-Binary/WaterBottle.glb";
const THREE_CDN = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
const GLTF_CDN  = "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js";

// ── PWA + Head meta injection ─────────────────────────────────────────
function injectHead() {
  // Title
  document.title = "Ghost Project";

  // Remove stale gp-head if it exists (hot-reload safe)
  document.getElementById("gp-head-block")?.remove();

  const frag = document.createDocumentFragment();
  const sentinel = document.createElement("meta");
  sentinel.id = "gp-head-block";
  frag.appendChild(sentinel);

  const addMeta = (attrs) => {
    const m = document.createElement("meta");
    Object.entries(attrs).forEach(([k,v]) => m.setAttribute(k,v));
    frag.appendChild(m);
  };
  const addLink = (attrs) => {
    const l = document.createElement("link");
    Object.entries(attrs).forEach(([k,v]) => l.setAttribute(k,v));
    frag.appendChild(l);
  };

  addMeta({ name:"application-name",             content:"Ghost Project" });
  addMeta({ name:"apple-mobile-web-app-title",   content:"Ghost Project" });
  addMeta({ name:"apple-mobile-web-app-capable", content:"yes" });
  addMeta({ name:"apple-mobile-web-app-status-bar-style", content:"black-translucent" });
  addMeta({ name:"mobile-web-app-capable",       content:"yes" });
  addMeta({ name:"theme-color",                  content:"#06090f" });

  // ★ These two lines are what appear as the home-screen icon
  addLink({ rel:"apple-touch-icon",          href:LOGO_URL });
  addLink({ rel:"apple-touch-icon-precomposed", href:LOGO_URL });
  addLink({ rel:"icon", type:"image/jpeg",   href:LOGO_URL });
  addLink({ rel:"shortcut icon",             href:LOGO_URL });

  document.head.appendChild(frag);
}

// ── CDN Loader (idempotent) ───────────────────────────────────────────
function loadScript(id, src) {
  return new Promise((resolve, reject) => {
    if (document.getElementById(id)) { resolve(); return; }
    const s = document.createElement("script");
    s.id = id; s.src = src;
    s.onload  = resolve;
    s.onerror = () => reject(new Error(`Failed: ${src}`));
    document.head.appendChild(s);
  });
}

async function loadLibs() {
  await loadScript("gp-three",   THREE_CDN);
  await loadScript("gp-gltf",    GLTF_CDN);
  return { THREE: window.THREE, GLTFLoader: window.THREE.GLTFLoader };
}

// ── AR Scene ──────────────────────────────────────────────────────────
class ARScene {
  constructor(canvas, THREE, GLTFLoader) {
    this.T          = THREE;
    this.canvas     = canvas;
    this.running    = false;
    this.rafId      = null;
    this._spawning  = false;
    this._spawnT    = 0;
    this.gyro       = { beta:0, gamma:0 };
    this.gyroLerp   = { x:0, y:0 };
    this.drag       = { on:false, x0:0, y0:0, rx:0, ry:0 };
    this.rot        = { x:0.25, y:0.4 };
    this.rotTarget  = { x:0.25, y:0.4 };

    this._initRenderer();
    this._initLights();
    this._initAmbient();
    this._bindGyro();
    this._bindPointer();
    this._loadGLB(GLTFLoader);
  }

  // ── Renderer / Camera / Scene ───────────────────────────────────────
  _initRenderer() {
    const T = this.T;
    const w = window.innerWidth, h = window.innerHeight;

    this.renderer = new T.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.outputEncoding  = T.sRGBEncoding;
    this.renderer.toneMapping     = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.4;

    this.scene  = new T.Scene();
    this.camera = new T.PerspectiveCamera(55, w / h, 0.01, 100);
    this.camera.position.set(0, 0, 3.5);

    // Single pivot receives all rotation — never recreated between loads
    this.pivot = new T.Group();
    this.pivot.scale.setScalar(0.001);
    this.scene.add(this.pivot);
  }

  _initLights() {
    const T = this.T;
    this.scene.add(new T.AmbientLight(0xffffff, 0.55));
    const key = new T.DirectionalLight(0xffd580, 2.2);
    key.position.set(3, 5, 4);
    this.scene.add(key);
    const rim = new T.DirectionalLight(0xd4af37, 0.9);
    rim.position.set(-4, -2, -3);
    this.scene.add(rim);
    const fill = new T.PointLight(0x4466aa, 0.7, 20);
    fill.position.set(0, -2, 3);
    this.scene.add(fill);
  }

  _initAmbient() {
    const T = this.T;

    // Floating particles
    const N = 70, pos = new Float32Array(N * 3);
    this._pVel = [];
    for (let i = 0; i < N; i++) {
      const r = 1.6 + Math.random() * 1.2;
      const θ = Math.random() * Math.PI * 2;
      const φ = Math.random() * Math.PI;
      pos[i*3]   = r * Math.sin(φ) * Math.cos(θ);
      pos[i*3+1] = r * Math.sin(φ) * Math.sin(θ) * 0.4;
      pos[i*3+2] = r * Math.cos(φ);
      this._pVel.push({ r, θ, spd: 0.003 + Math.random() * 0.004 });
    }
    const pGeo = new T.BufferGeometry();
    pGeo.setAttribute("position", new T.BufferAttribute(pos, 3));
    this._particles = new T.Points(pGeo,
      new T.PointsMaterial({ color:0xd4af37, size:0.032, transparent:true, opacity:0.55, sizeAttenuation:true }));
    this.scene.add(this._particles);

    // Holo rings
    const rMat = new T.MeshBasicMaterial({ color:0xd4af37, transparent:true, opacity:0.32 });
    this._ring1 = new T.Mesh(new T.TorusGeometry(1.4, 0.007, 6, 80), rMat);
    this._ring1.rotation.x = Math.PI / 2;
    this._ring1.position.y = -1.5;
    this.scene.add(this._ring1);

    this._ring2 = new T.Mesh(new T.TorusGeometry(0.85, 0.005, 6, 60), rMat.clone());
    this._ring2.rotation.x = Math.PI / 2;
    this._ring2.position.y = -1.5;
    this.scene.add(this._ring2);
  }

  // ── GLB loader — clears previous model first ──────────────────────
  _clearModel() {
    if (!this._model) return;
    this.pivot.remove(this._model);
    this._model.traverse(c => {
      if (c.isMesh) {
        c.geometry?.dispose();
        if (Array.isArray(c.material)) c.material.forEach(m => m.dispose());
        else c.material?.dispose();
      }
    });
    this._model = null;
  }

  _loadGLB(GLTFLoader) {
    this._clearModel();
    const loader = new GLTFLoader();
    loader.load(
      GLB_URL,
      (gltf) => {
        const model = gltf.scene;

        // Normalise to fit 1.8-unit box
        const box   = new this.T.Box3().setFromObject(model);
        const size  = new this.T.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);
        model.scale.setScalar(1.8 / maxDim);

        // Centre
        box.setFromObject(model);
        const centre = new this.T.Vector3();
        box.getCenter(centre);
        model.position.sub(centre);

        // Luxury PBR boost
        model.traverse(child => {
          if (child.isMesh && child.material) {
            [].concat(child.material).forEach(m => {
              if (m.metalness !== undefined) {
                m.metalness = Math.min(1, m.metalness + 0.3);
                m.roughness = Math.max(0.05, m.roughness - 0.2);
              }
              m.needsUpdate = true;
            });
          }
        });

        this._model = model;
        this.pivot.add(model);
      },
      undefined,
      (err) => {
        console.warn("GLB failed, using fallback:", err.message);
        this._buildFallback();
      }
    );
  }

  _buildFallback() {
    const T = this.T;
    const gold  = new T.MeshStandardMaterial({ color:0xd4af37, metalness:0.95, roughness:0.1 });
    const dark  = new T.MeshStandardMaterial({ color:0x0a0e1a, metalness:0.3,  roughness:0.6 });
    const glass = new T.MeshStandardMaterial({ color:0x88aacc, metalness:0.1,  roughness:0, transparent:true, opacity:0.3 });
    const glow  = new T.MeshStandardMaterial({ color:0x4ade80, emissive:0x4ade80, emissiveIntensity:1.2 });

    const grp   = new T.Group();
    grp.add(new T.Mesh(new T.BoxGeometry(1.1,1.3,0.22), gold));
    const bezel = new T.Mesh(new T.BoxGeometry(0.9,1.08,0.12), dark);
    bezel.position.z = 0.07; grp.add(bezel);
    const scr   = new T.Mesh(new T.BoxGeometry(0.82,0.98,0.06), glass);
    scr.position.z = 0.12; grp.add(scr);
    const crown = new T.Mesh(new T.CylinderGeometry(0.06,0.06,0.28,12), gold);
    crown.rotation.z = Math.PI/2; crown.position.set(0.62,0.2,0); grp.add(crown);
    const ring  = new T.Mesh(new T.TorusGeometry(0.3,0.04,8,40), glow);
    ring.position.z = 0.16; grp.add(ring);
    this._glowRing = ring;

    this._model = grp;
    this.pivot.add(grp);
  }

  // ── Public: trigger spawn animation ──────────────────────────────
  spawnObject() {
    this.pivot.scale.setScalar(0.001);
    this.rot       = { x:0.25, y:0.4 };
    this.rotTarget = { x:0.25, y:0.4 };
    this._spawnT   = performance.now();
    this._spawning = true;
  }

  // ── Render loop ───────────────────────────────────────────────────
  start() { this.running = true; this._tick(); }

  _tick() {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(() => this._tick());
    const t = performance.now() * 0.001;

    // Spawn elastic ease
    if (this._spawning) {
      const p    = Math.min((performance.now() - this._spawnT) / 1100, 1);
      const ease = p < 0.5 ? 4*p*p*p : 1 - Math.pow(-2*p+2, 3)/2;
      const over = Math.sin(p * Math.PI * 2.2) * 0.07 * (1 - p);
      this.pivot.scale.setScalar(ease + over);
      if (p >= 1) { this.pivot.scale.setScalar(1); this._spawning = false; }
    }

    // Auto-spin when not dragging
    if (!this.drag.on) this.rotTarget.y += 0.005;

    // Lerp rotation
    this.rot.x += (this.rotTarget.x - this.rot.x) * 0.09;
    this.rot.y += (this.rotTarget.y - this.rot.y) * 0.09;

    // Gyro depth shift
    const gx = (this.gyro.gamma || 0) * 0.0025;
    const gy = ((this.gyro.beta  || 45) - 45) * 0.002;
    this.gyroLerp.x += (gx - this.gyroLerp.x) * 0.06;
    this.gyroLerp.y += (gy - this.gyroLerp.y) * 0.06;

    this.pivot.rotation.x = this.rot.x + this.gyroLerp.y * 0.5;
    this.pivot.rotation.y = this.rot.y + this.gyroLerp.x * 0.5;
    this.pivot.position.y = Math.sin(t * 1.05) * 0.065;

    if (this._glowRing)
      this._glowRing.material.emissiveIntensity = 0.9 + Math.sin(t * 3) * 0.5;

    if (this._ring1) this._ring1.rotation.z += 0.006;
    if (this._ring2) this._ring2.rotation.z -= 0.009;

    if (this._particles) {
      const pos = this._particles.geometry.attributes.position.array;
      this._pVel.forEach((v, i) => {
        v.θ += v.spd;
        pos[i*3]   = v.r * Math.cos(v.θ);
        pos[i*3+1] = v.r * Math.sin(v.θ) * 0.32;
        pos[i*3+2] = v.r * Math.sin(v.θ);
      });
      this._particles.geometry.attributes.position.needsUpdate = true;
    }

    this.renderer.render(this.scene, this.camera);
  }

  resize(w, h) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  // ── Input bindings ────────────────────────────────────────────────
  _bindGyro() {
    this._gyroH = e => { this.gyro.beta = e.beta||0; this.gyro.gamma = e.gamma||0; };
    window.addEventListener("deviceorientation", this._gyroH, true);
  }

  _bindPointer() {
    const el = this.canvas;
    const start = (cx, cy) => {
      this.drag = { on:true, x0:cx, y0:cy, rx:this.rotTarget.x, ry:this.rotTarget.y };
    };
    const move = (cx, cy) => {
      if (!this.drag.on) return;
      this.rotTarget.y = this.drag.ry + (cx - this.drag.x0) * 0.011;
      this.rotTarget.x = Math.max(-1.3, Math.min(1.3,
        this.drag.rx + (cy - this.drag.y0) * 0.011));
    };
    const end = () => { this.drag.on = false; };

    this._th = e => { if (e.touches.length===1) start(e.touches[0].clientX, e.touches[0].clientY); };
    this._tm = e => { e.preventDefault(); if (e.touches.length===1) move(e.touches[0].clientX, e.touches[0].clientY); };
    this._te = () => end();
    this._md = e => start(e.clientX, e.clientY);
    this._mm = e => move(e.clientX, e.clientY);
    this._mu = () => end();

    el.addEventListener("touchstart",  this._th, { passive:true });
    el.addEventListener("touchmove",   this._tm, { passive:false });
    el.addEventListener("touchend",    this._te, { passive:true });
    el.addEventListener("mousedown",   this._md);
    window.addEventListener("mousemove", this._mm);
    window.addEventListener("mouseup",   this._mu);
  }

  destroy() {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this._clearModel();
    window.removeEventListener("deviceorientation", this._gyroH, true);
    this.canvas.removeEventListener("touchstart",  this._th);
    this.canvas.removeEventListener("touchmove",   this._tm);
    this.canvas.removeEventListener("touchend",    this._te);
    this.canvas.removeEventListener("mousedown",   this._md);
    window.removeEventListener("mousemove", this._mm);
    window.removeEventListener("mouseup",   this._mu);
    this.renderer.dispose();
  }
}

// ── Camera stream cascade ─────────────────────────────────────────────
async function getCameraStream(facingMode) {
  const opts = [
    { video:{ facingMode:{ ideal:facingMode }, width:{ ideal:1280 }, height:{ ideal:720 } }, audio:false },
    { video:{ facingMode:{ exact:facingMode } }, audio:false },
    { video:true, audio:false },
  ];
  let last;
  for (const c of opts) {
    try { return await navigator.mediaDevices.getUserMedia(c); }
    catch(e) {
      last = e;
      if (e.name==="NotAllowedError"||e.name==="PermissionDeniedError") throw e;
    }
  }
  throw last;
}

// ── Global CSS ────────────────────────────────────────────────────────
const GCSS = `
@import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;600;700&family=Share+Tech+Mono&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html,body,#root{height:100%;width:100%;overflow:hidden;background:${DARK};}
@keyframes fadeUp   {from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
@keyframes spin     {from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
@keyframes pulseRing{0%,100%{transform:scale(1);opacity:.4}50%{transform:scale(1.06);opacity:.85}}
@keyframes blink    {0%,100%{opacity:1}50%{opacity:.1}}
@keyframes scanDown {0%{top:-3px;opacity:0}5%{opacity:1}95%{opacity:.85}100%{top:100%;opacity:0}}
@keyframes scanFade {0%{opacity:0}15%{opacity:1}85%{opacity:1}100%{opacity:0}}
@keyframes ripple   {0%{transform:translate(-50%,-50%) scale(0);opacity:.5}100%{transform:translate(-50%,-50%) scale(2.8);opacity:0}}
@keyframes flipIn   {from{opacity:0;transform:scale(.94)}to{opacity:1;transform:scale(1)}}
@keyframes glowBtn  {0%,100%{box-shadow:0 0 18px rgba(212,175,55,.1)}50%{box-shadow:0 0 36px rgba(212,175,55,.3)}}
.gp-btn{font-family:'Share Tech Mono',monospace;letter-spacing:.16em;cursor:pointer;border:none;outline:none;
  transition:opacity .18s,transform .14s;-webkit-tap-highlight-color:transparent;
  touch-action:manipulation;user-select:none;}
.gp-btn:active{transform:scale(.94);opacity:.7;}
.gp-btn:focus-visible{outline:2px solid rgba(212,175,55,.5);outline-offset:3px;}
`;

// ── Logo component ────────────────────────────────────────────────────
function GhostLogo({ size = 72, showText = true }) {
  const [imgOk, setImgOk] = useState(true);

  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:"10px" }}>
      {/* Container: transparent bg, no grey box */}
      <div style={{
        width: size, height: size,
        borderRadius: "50%",
        overflow: "hidden",
        border: "1.5px solid rgba(212,175,55,0.4)",
        boxShadow: "0 0 26px rgba(212,175,55,0.16)",
        background: "transparent",   // ← no grey
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        {imgOk ? (
          <img
            src={LOGO_URL}
            alt="Ghost Project"
            crossOrigin="anonymous"
            onError={() => setImgOk(false)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
              background: "transparent",
            }}
          />
        ) : (
          <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 120 120" fill="none">
            <defs>
              <linearGradient id="fgG" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f5e070"/>
                <stop offset="100%" stopColor="#8a6010"/>
              </linearGradient>
            </defs>
            <path d="M95 60 A35 35 0 1 0 95 61 Z" stroke="url(#fgG)" strokeWidth="10"
              fill="none" strokeLinecap="round" strokeDasharray="180 40"/>
            <path d="M80 60 L60 60 L60 75" stroke="#d4af37" strokeWidth="9"
              fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            <ellipse cx="38" cy="92" rx="7"  ry="10" fill="#d4af37" opacity=".8"/>
            <ellipse cx="60" cy="95" rx="8"  ry="11" fill="#d4af37"/>
            <ellipse cx="82" cy="92" rx="7"  ry="10" fill="#d4af37" opacity=".8"/>
          </svg>
        )}
      </div>

      {showText && (
        <div style={{ textAlign:"center" }}>
          <div style={{
            fontSize:"clamp(18px,5vw,26px)", fontWeight:700,
            letterSpacing:".3em", color:GOLD,
            fontFamily:"'Rajdhani',sans-serif", lineHeight:1,
            textShadow:"0 0 28px rgba(212,175,55,.28)",
          }}>GHOST PROJECT</div>
          <div style={{
            fontSize:"8.5px", letterSpacing:".48em", color:GOLD_DIM,
            marginTop:"5px", fontFamily:"'Share Tech Mono',monospace",
          }}>AI · AR · E-COMMERCE</div>
        </div>
      )}
    </div>
  );
}

// ── Scan overlay ──────────────────────────────────────────────────────
function ScanOverlay({ onComplete }) {
  useEffect(() => {
    const t = setTimeout(onComplete, 2800);
    return () => clearTimeout(t);
  }, [onComplete]);

  return (
    <div style={{
      position:"fixed", inset:0, zIndex:30,
      background:"rgba(6,9,15,0.9)",
      display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center",
      animation:"scanFade 2.8s ease both",
    }}>
      <div style={{
        position:"relative",
        width:"min(260px,66vw)", height:"min(260px,66vw)",
        border:"1px solid rgba(212,175,55,.2)",
        borderRadius:"12px",
      }}>
        {[
          {top:0,left:0,borderTop:"2px solid",borderLeft:"2px solid",borderTopLeftRadius:8},
          {top:0,right:0,borderTop:"2px solid",borderRight:"2px solid",borderTopRightRadius:8},
          {bottom:0,left:0,borderBottom:"2px solid",borderLeft:"2px solid",borderBottomLeftRadius:8},
          {bottom:0,right:0,borderBottom:"2px solid",borderRight:"2px solid",borderBottomRightRadius:8},
        ].map((s,i) => (
          <div key={i} style={{ position:"absolute", width:24, height:24, borderColor:GOLD, ...s }}/>
        ))}
        <div style={{
          position:"absolute", left:0, right:0, height:"2px",
          borderRadius:"1px",
          background:`linear-gradient(90deg,transparent,${GOLD},transparent)`,
          animation:"scanDown 1.4s ease-in-out infinite",
          boxShadow:"0 0 12px rgba(212,175,55,.6)",
        }}/>
        <div style={{
          position:"absolute", top:"50%", left:"50%",
          transform:"translate(-50%,-50%)",
          width:42, height:42,
          border:"1px solid rgba(212,175,55,.35)", borderRadius:"50%",
        }}>
          <div style={{
            position:"absolute", inset:"-22px",
            border:"1px solid rgba(212,175,55,.1)", borderRadius:"50%",
            animation:"ripple 1.6s ease-out infinite",
          }}/>
        </div>
      </div>
      <div style={{
        marginTop:"24px", color:"rgba(212,175,55,.6)", fontSize:"10px",
        letterSpacing:".32em", fontFamily:"'Share Tech Mono',monospace",
      }}>
        CALIBRANDO AR
        <span style={{animation:"blink 1s infinite 0s"}}>.</span>
        <span style={{animation:"blink 1s infinite .3s"}}>.</span>
        <span style={{animation:"blink 1s infinite .6s"}}>.</span>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════
// MAIN APP
// ══════════════════════════════════════════════════════════════════════
export default function App() {
  const [stage,    setStage]    = useState(S.IDLE);
  const [facing,   setFacing]   = useState("environment");
  const [errMsg,   setErrMsg]   = useState("");
  const [mirrored, setMirrored] = useState(false);

  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const sceneRef  = useRef(null);
  const libsRef   = useRef(null); // cached { THREE, GLTFLoader }

  // ── One-time boot ─────────────────────────────────────────────────
  useEffect(() => {
    injectHead();
    if (!document.getElementById("gp-css")) {
      const el = document.createElement("style");
      el.id = "gp-css"; el.textContent = GCSS;
      document.head.appendChild(el);
    }
    // Pre-load Three.js libs in background so they're ready instantly
    loadLibs().then(libs => { libsRef.current = libs; }).catch(() => {});
    return () => { _stopAll(); };
  }, []);

  useEffect(() => {
    const onResize = () => sceneRef.current?.resize(innerWidth, innerHeight);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ── Helpers ───────────────────────────────────────────────────────
  function _stopAll() {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    sceneRef.current?.destroy();
    sceneRef.current = null;
  }

  const attachVideo = (stream) => {
    let n = 0;
    const go = () => {
      const v = videoRef.current;
      if (v) {
        v.srcObject = stream;
        v.setAttribute("playsinline", "");
        v.setAttribute("webkit-playsinline", "");
        v.muted = true;
        v.play().catch(() => {});
      } else if (++n < 25) setTimeout(go, 80);
    };
    go();
  };

  const startCamera = async (facingMode) => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    const stream = await getCameraStream(facingMode);
    streamRef.current = stream;
    const settings = stream.getVideoTracks()[0]?.getSettings?.() ?? {};
    setMirrored((settings.facingMode ?? facingMode) === "user");
    return stream;
  };

  /**
   * buildScene — always creates a FRESH ARScene on the current canvas.
   * Called every time AR mode activates (including after camera flip).
   */
  const buildScene = async () => {
    // Destroy previous scene fully (disposes WebGL context + event listeners)
    if (sceneRef.current) {
      sceneRef.current.destroy();
      sceneRef.current = null;
    }

    // Get or load libs
    if (!libsRef.current) {
      libsRef.current = await loadLibs();
    }
    const { THREE, GLTFLoader } = libsRef.current;

    const canvas = canvasRef.current;
    if (!canvas) return null;

    const sc = new ARScene(canvas, THREE, GLTFLoader);
    sceneRef.current = sc;
    sc.start();
    return sc;
  };

  // ── State machine ─────────────────────────────────────────────────
  const handleActivate = async () => {
    setStage(S.LOADING);
    setErrMsg("");
    try {
      const stream = await startCamera(facing);
      // Mount video + canvas, then build scene during scan animation
      setStage(S.SCANNING);
      attachVideo(stream);
      await buildScene();
    } catch(e) {
      const n = e.name || "";
      setErrMsg(
        (n==="NotAllowedError"||n==="PermissionDeniedError")
          ? "ACESSO À CÂMERA NEGADO.\n\n1. Toque no 🔒 na barra de endereço\n2. Permissões → Câmera → Permitir\n3. Recarregue a página"
          : n==="NotFoundError"
          ? "NENHUMA CÂMERA ENCONTRADA."
          : `ERRO: ${n || e.message}`
      );
      setStage(S.ERROR);
    }
  };

  const handleScanDone = useCallback(() => {
    setStage(S.AR);
    setTimeout(() => sceneRef.current?.spawnObject(), 100);
  }, []);

  // Camera flip: restart stream AND rebuild 3D scene on new canvas state
  const handleFlip = async () => {
    const next = facing === "environment" ? "user" : "environment";
    setFacing(next);
    if (stage === S.AR || stage === S.SCANNING) {
      try {
        const stream = await startCamera(next);
        attachVideo(stream);
        // Rebuild scene so canvas/renderer align with new orientation
        await buildScene();
        sceneRef.current?.spawnObject();
      } catch {
        setFacing(facing); // revert on failure
      }
    }
  };

  const handleDeactivate = () => {
    _stopAll();
    setStage(S.IDLE);
  };

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div style={{
      position:"fixed", inset:0, background:DARK,
      display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center",
      fontFamily:"'Rajdhani','Share Tech Mono',sans-serif",
      overflow:"hidden",
    }}>
      {/* Grid bg */}
      <div style={{
        position:"absolute", inset:0, pointerEvents:"none",
        backgroundImage:`
          linear-gradient(rgba(212,175,55,.026) 1px,transparent 1px),
          linear-gradient(90deg,rgba(212,175,55,.026) 1px,transparent 1px)`,
        backgroundSize:"44px 44px", zIndex:0,
      }}/>
      <div style={{
        position:"absolute", top:"50%", left:"50%",
        transform:"translate(-50%,-50%)",
        width:"80vmax", height:"80vmax",
        background:"radial-gradient(circle,rgba(212,175,55,.04) 0%,transparent 65%)",
        pointerEvents:"none", zIndex:0,
      }}/>

      {/* ══ IDLE ══════════════════════════════════════════════════ */}
      {stage === S.IDLE && (
        <div style={{
          position:"relative", zIndex:1,
          display:"flex", flexDirection:"column",
          alignItems:"center", padding:"44px 28px",
          width:"100%", maxWidth:"380px",
          animation:"fadeUp .6s ease both",
        }}>
          {/* Logo with orbit rings */}
          <div style={{
            position:"relative", marginBottom:"30px",
            display:"flex", alignItems:"center", justifyContent:"center",
          }}>
            <div style={{
              position:"absolute", inset:"-18px",
              border:"1px dashed rgba(212,175,55,.12)", borderRadius:"50%",
              animation:"spin 22s linear infinite",
            }}/>
            <div style={{
              position:"absolute", inset:"-7px",
              border:"1px solid rgba(212,175,55,.2)", borderRadius:"50%",
              animation:"pulseRing 3s ease-in-out infinite",
            }}/>
            <GhostLogo size={82} showText={false}/>
          </div>

          {/* Brand text */}
          <div style={{ textAlign:"center", marginBottom:"4px" }}>
            <div style={{
              fontSize:"clamp(20px,5.5vw,27px)", fontWeight:700,
              letterSpacing:".32em", color:GOLD,
              fontFamily:"'Rajdhani',sans-serif", lineHeight:1,
              textShadow:"0 0 30px rgba(212,175,55,.26)",
            }}>GHOST PROJECT</div>
            <div style={{
              fontSize:"8.5px", letterSpacing:".5em", color:GOLD_DIM,
              marginTop:"6px", fontFamily:"'Share Tech Mono',monospace",
            }}>AI · AR · E-COMMERCE</div>
          </div>

          <div style={{
            width:"100%", height:"1px",
            background:"linear-gradient(90deg,transparent,rgba(212,175,55,.17),transparent)",
            margin:"22px 0",
          }}/>

          <div style={{
            textAlign:"center", color:GOLD_DIM, fontSize:"10px",
            letterSpacing:".09em", lineHeight:"1.8",
            fontFamily:"'Share Tech Mono',monospace", marginBottom:"30px",
          }}>
            VISUALIZAÇÃO 3D EM REALIDADE AUMENTADA<br/>
            VALIDAÇÃO DE PRODUTO EM TEMPO REAL
          </div>

          {/* CTA pill */}
          <button className="gp-btn" onClick={handleActivate} style={{
            width:"100%", padding:"17px 24px",
            borderRadius:"50px",
            border:"1.5px solid rgba(212,175,55,.48)",
            background:"linear-gradient(135deg,rgba(212,175,55,.14),rgba(212,175,55,.04))",
            color:GOLD, fontSize:"12px",
            animation:"glowBtn 3.5s ease-in-out infinite",
          }}>
            ◈ &nbsp;ATIVAR GHOST AR
          </button>

          {/* Camera pills */}
          <div style={{ marginTop:"15px", display:"flex", gap:"10px" }}>
            {["environment","user"].map(f => (
              <button key={f} className="gp-btn" onClick={() => setFacing(f)} style={{
                padding:"9px 20px", borderRadius:"50px",
                border:`1px solid ${facing===f?"rgba(212,175,55,.44)":"rgba(212,175,55,.1)"}`,
                background: facing===f ? "rgba(212,175,55,.1)" : "transparent",
                color: facing===f ? GOLD : "rgba(212,175,55,.25)",
                fontSize:"9px",
              }}>
                {f==="environment" ? "TRASEIRA" : "FRONTAL"}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ══ LOADING ═══════════════════════════════════════════════ */}
      {stage === S.LOADING && (
        <div style={{
          position:"relative", zIndex:1,
          display:"flex", flexDirection:"column",
          alignItems:"center", gap:"22px",
          animation:"fadeUp .35s ease both",
        }}>
          <div style={{
            width:"52px", height:"52px", borderRadius:"50%",
            border:"1.5px solid rgba(212,175,55,.1)",
            borderTop:"1.5px solid rgba(212,175,55,.78)",
            animation:"spin .85s linear infinite",
          }}/>
          <div style={{
            color:"rgba(212,175,55,.5)", fontSize:"10px",
            letterSpacing:".3em", fontFamily:"'Share Tech Mono',monospace",
          }}>
            INICIALIZANDO
            <span style={{animation:"blink 1s infinite 0s"}}>.</span>
            <span style={{animation:"blink 1s infinite .3s"}}>.</span>
            <span style={{animation:"blink 1s infinite .6s"}}>.</span>
          </div>
        </div>
      )}

      {/* ══ SCANNING + AR  (video + canvas always mounted together) */}
      {(stage === S.SCANNING || stage === S.AR) && (
        <div style={{
          position:"fixed", inset:0, zIndex:10,
          background:"#000",
          animation:"flipIn .3s ease both",
        }}>
          {/* Camera video */}
          <video ref={videoRef} autoPlay playsInline muted style={{
            position:"absolute", inset:0,
            width:"100%", height:"100%",
            objectFit:"cover",
            transform: mirrored ? "scaleX(-1)" : "none",
            background:"#000",
          }}/>

          {/* Three.js canvas */}
          <canvas ref={canvasRef} style={{
            position:"absolute", inset:0,
            width:"100%", height:"100%",
            pointerEvents: stage===S.AR ? "auto" : "none",
            zIndex:1,
            display:"block",
          }}/>

          {/* Scan animation */}
          {stage === S.SCANNING && <ScanOverlay onComplete={handleScanDone}/>}

          {/* AR HUD */}
          {stage === S.AR && (
            <>
              {/* Non-interactive overlays */}
              <div style={{ position:"absolute", inset:0, zIndex:2, pointerEvents:"none" }}>
                {/* Corner brackets */}
                {[
                  {top:14,left:14,borderTop:"2px solid",borderLeft:"2px solid",borderTopLeftRadius:4},
                  {top:14,right:14,borderTop:"2px solid",borderRight:"2px solid",borderTopRightRadius:4},
                  {bottom:72,left:14,borderBottom:"2px solid",borderLeft:"2px solid",borderBottomLeftRadius:4},
                  {bottom:72,right:14,borderBottom:"2px solid",borderRight:"2px solid",borderBottomRightRadius:4},
                ].map((s,i) => (
                  <div key={i} style={{ position:"absolute", width:22, height:22,
                    borderColor:"rgba(212,175,55,.55)", ...s }}/>
                ))}

                {/* Top bar */}
                <div style={{
                  position:"absolute", top:0, left:0, right:0,
                  padding:"max(env(safe-area-inset-top,14px),14px) 18px 14px",
                  background:"linear-gradient(to bottom,rgba(6,9,15,.75),transparent)",
                  display:"flex", alignItems:"center", justifyContent:"space-between",
                }}>
                  <GhostLogo size={30} showText={false}/>
                  <div style={{
                    fontSize:"11px", fontWeight:700, letterSpacing:".26em",
                    color:GOLD, fontFamily:"'Rajdhani',sans-serif",
                    textShadow:"0 0 14px rgba(212,175,55,.38)",
                  }}>GHOST PROJECT</div>
                  <div style={{ display:"flex", alignItems:"center", gap:"5px" }}>
                    <div style={{
                      width:6, height:6, borderRadius:"50%", background:"#4ade80",
                      boxShadow:"0 0 8px rgba(74,222,128,.9)",
                      animation:"blink 1.6s ease-in-out infinite",
                    }}/>
                    <span style={{
                      fontSize:"8px", letterSpacing:".2em",
                      color:"rgba(74,222,128,.8)", fontFamily:"'Share Tech Mono',monospace",
                    }}>LIVE</span>
                  </div>
                </div>

                {/* Drag hint */}
                <div style={{
                  position:"absolute", bottom:"100px", left:"50%",
                  transform:"translateX(-50%)",
                  color:"rgba(212,175,55,.28)", fontSize:"9px",
                  letterSpacing:".15em", fontFamily:"'Share Tech Mono',monospace",
                  whiteSpace:"nowrap",
                }}>
                  ↔ &nbsp;ARRASTE PARA GIRAR
                </div>
              </div>

              {/* Bottom control bar (interactive) */}
              <div style={{
                position:"absolute", bottom:0, left:0, right:0, zIndex:3,
                padding:`18px 20px max(env(safe-area-inset-bottom,22px),22px)`,
                background:"linear-gradient(to top,rgba(6,9,15,.88),transparent)",
                display:"flex", alignItems:"center", justifyContent:"center", gap:"20px",
              }}>
                {/* Close */}
                <button className="gp-btn" onClick={handleDeactivate} style={{
                  width:"50px", height:"50px", borderRadius:"50%",
                  border:"1.5px solid rgba(212,175,55,.26)",
                  background:"rgba(212,175,55,.07)",
                  color:"rgba(212,175,55,.58)",
                  display:"flex", alignItems:"center", justifyContent:"center",
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>

                {/* Validate */}
                <button className="gp-btn" style={{
                  width:"70px", height:"70px", borderRadius:"50%",
                  border:`2px solid ${GOLD}`,
                  background:"linear-gradient(135deg,rgba(212,175,55,.2),rgba(212,175,55,.05))",
                  color:GOLD, fontSize:"8px", letterSpacing:".12em",
                  display:"flex", flexDirection:"column",
                  alignItems:"center", justifyContent:"center", gap:"3px",
                  boxShadow:"0 0 28px rgba(212,175,55,.18)",
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  OK
                </button>

                {/* Flip */}
                <button className="gp-btn" onClick={handleFlip} style={{
                  width:"50px", height:"50px", borderRadius:"50%",
                  border:"1.5px solid rgba(212,175,55,.26)",
                  background:"rgba(212,175,55,.07)",
                  color:"rgba(212,175,55,.58)",
                  display:"flex", alignItems:"center", justifyContent:"center",
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <path d="M20 7h-3a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2Z"/>
                    <circle cx="12" cy="13" r="3"/>
                  </svg>
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ══ ERROR ════════════════════════════════════════════════ */}
      {stage === S.ERROR && (
        <div style={{
          position:"relative", zIndex:1,
          display:"flex", flexDirection:"column",
          alignItems:"center", gap:"20px",
          padding:"0 32px", maxWidth:"340px",
          textAlign:"center",
          animation:"fadeUp .4s ease both",
        }}>
          <div style={{ fontSize:"28px", color:"rgba(212,175,55,.2)" }}>⊘</div>
          <div style={{
            color:"rgba(212,175,55,.7)", fontSize:"10.5px",
            letterSpacing:".08em", lineHeight:"1.9",
            fontFamily:"'Share Tech Mono',monospace", whiteSpace:"pre-line",
          }}>{errMsg}</div>
          <button className="gp-btn" onClick={() => setStage(S.IDLE)} style={{
            padding:"13px 30px", borderRadius:"50px",
            border:"1px solid rgba(212,175,55,.3)",
            background:"rgba(212,175,55,.07)",
            color:"rgba(212,175,55,.64)",
            fontSize:"10px", letterSpacing:".2em", marginTop:"4px",
          }}>
            TENTAR NOVAMENTE
          </button>
        </div>
      )}
    </div>
  );
}

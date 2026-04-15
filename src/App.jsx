/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║           GHOST PROJECT AI — AR ENGINE v2.0                     ║
 * ║  SYSTEM BRAIN: Architecture, 3D engine, AR logic, gestures      ║
 * ║  USER VOICE:   Visual identity, UX flow, product presentation   ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Stack:  React 18 · Three.js (CDN, no bundle cost) · WebGL
 * AR mode: Camera feed + DeviceOrientation gyro anchoring + touch drag
 * Universal: iOS Safari 15+ · Android Chrome 90+ · Desktop Chrome/FF
 */

import { useState, useRef, useEffect, useCallback } from "react";

// ══════════════════════════════════════════════════════════════════════
// SECTION 1 — CONSTANTS & STATE MACHINE
// ══════════════════════════════════════════════════════════════════════
const S = {
  IDLE:     "idle",
  LOADING:  "loading",
  SCANNING: "scanning",   // Ghost scan effect before AR activates
  AR:       "ar",
  ERROR:    "error",
};

const GOLD  = "#d4af37";
const GOLD2 = "rgba(212,175,55,0.45)";
const DARK  = "#060d1a";

// ══════════════════════════════════════════════════════════════════════
// SECTION 2 — THREE.JS DYNAMIC LOADER
// Three.js loaded from CDN to keep the Vite bundle at zero weight.
// ══════════════════════════════════════════════════════════════════════
let THREE_CACHE = null;

function loadThree() {
  if (THREE_CACHE) return Promise.resolve(THREE_CACHE);
  return new Promise((resolve, reject) => {
    if (window.THREE) { THREE_CACHE = window.THREE; resolve(THREE_CACHE); return; }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
    s.onload  = () => { THREE_CACHE = window.THREE; resolve(THREE_CACHE); };
    s.onerror = () => reject(new Error("Three.js failed to load"));
    document.head.appendChild(s);
  });
}

// ══════════════════════════════════════════════════════════════════════
// SECTION 3 — THREE.JS AR SCENE MANAGER
// Encapsulates all WebGL logic. Mounts/unmounts cleanly on the canvas.
// ══════════════════════════════════════════════════════════════════════
class ARScene {
  constructor(canvas, THREE) {
    this.THREE   = THREE;
    this.canvas  = canvas;
    this.running = false;
    this.rafId   = null;

    // Gyro state
    this.gyro = { alpha: 0, beta: 0, gamma: 0 };
    this.gyroSmooth = { x: 0, y: 0 };

    // Touch drag state
    this.drag   = { active: false, startX: 0, startY: 0, rotX: 0, rotY: 0 };
    this.lastRot = { x: 0.3, y: 0.4 };
    this.targetRot = { x: 0.3, y: 0.4 };

    this._buildScene();
    this._bindGyro();
    this._bindTouch();
  }

  _buildScene() {
    const T = this.THREE;
    const w = this.canvas.clientWidth  || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;

    // ── Renderer ──────────────────────────────────────────────────────
    this.renderer = new T.WebGLRenderer({
      canvas:    this.canvas,
      alpha:     true,          // transparent background = camera shows through
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = false; // off for perf on mobile

    // ── Camera ────────────────────────────────────────────────────────
    this.camera = new T.PerspectiveCamera(60, w / h, 0.1, 100);
    this.camera.position.set(0, 0, 4);

    // ── Scene ─────────────────────────────────────────────────────────
    this.scene = new T.Scene();

    // ── Lights ────────────────────────────────────────────────────────
    const ambient = new T.AmbientLight(0xffffff, 0.3);
    this.scene.add(ambient);

    const key = new T.DirectionalLight(0xffd700, 1.8);
    key.position.set(3, 4, 5);
    this.scene.add(key);

    const rim = new T.DirectionalLight(0xd4af37, 0.6);
    rim.position.set(-4, -2, -3);
    this.scene.add(rim);

    const fill = new T.PointLight(0x4488ff, 0.4, 20);
    fill.position.set(0, -3, 2);
    this.scene.add(fill);

    // ── Build the AR Object: Luxury Smartwatch ────────────────────────
    this.arGroup = new T.Group();
    this.scene.add(this.arGroup);

    this._buildWatch(T);

    // ── Floating particles ────────────────────────────────────────────
    this._buildParticles(T);

    // ── Ghost holographic ring ────────────────────────────────────────
    this._buildHoloRing(T);
  }

  _buildWatch(T) {
    const goldMat = new T.MeshStandardMaterial({
      color:     0xd4af37,
      metalness: 0.95,
      roughness: 0.12,
      envMapIntensity: 1.0,
    });
    const darkMat = new T.MeshStandardMaterial({
      color:     0x0a0e1a,
      metalness: 0.3,
      roughness: 0.6,
    });
    const glassMat = new T.MeshStandardMaterial({
      color:       0x88aaff,
      metalness:   0.1,
      roughness:   0.0,
      transparent: true,
      opacity:     0.35,
    });
    const glowMat = new T.MeshStandardMaterial({
      color:     0x4ade80,
      emissive:  0x4ade80,
      emissiveIntensity: 1.2,
      metalness: 0,
      roughness: 1,
    });

    // Case body (rounded box)
    const caseGeo = new T.BoxGeometry(1.1, 1.3, 0.22, 4, 4, 2);
    // Round the corners via vertex displacement
    const posArr = caseGeo.attributes.position.array;
    for (let i = 0; i < posArr.length; i += 3) {
      const x = posArr[i], y = posArr[i+1], z = posArr[i+2];
      const r = 0.18;
      posArr[i]   = x + Math.sign(x) * Math.max(0, Math.abs(x) - (0.55 - r)) * 0.3;
      posArr[i+1] = y + Math.sign(y) * Math.max(0, Math.abs(y) - (0.65 - r)) * 0.3;
    }
    caseGeo.attributes.position.needsUpdate = true;
    caseGeo.computeVertexNormals();

    const watchCase = new T.Mesh(caseGeo, goldMat);
    this.arGroup.add(watchCase);

    // Screen bezel (inset dark frame)
    const bezelGeo = new T.BoxGeometry(0.9, 1.08, 0.12);
    const bezel = new T.Mesh(bezelGeo, darkMat);
    bezel.position.z = 0.07;
    this.arGroup.add(bezel);

    // Glass screen
    const screenGeo = new T.BoxGeometry(0.82, 0.98, 0.06);
    const screen = new T.Mesh(screenGeo, glassMat);
    screen.position.z = 0.12;
    this.arGroup.add(screen);

    // Crown (side button)
    const crownGeo = new T.CylinderGeometry(0.06, 0.06, 0.28, 12);
    const crown = new T.Mesh(crownGeo, goldMat);
    crown.rotation.z = Math.PI / 2;
    crown.position.set(0.62, 0.2, 0);
    this.arGroup.add(crown);

    // Digital crown detail ring
    const ringGeo = new T.TorusGeometry(0.06, 0.012, 8, 20);
    const ring1 = new T.Mesh(ringGeo, goldMat);
    ring1.rotation.z = Math.PI / 2;
    ring1.position.set(0.72, 0.2, 0);
    this.arGroup.add(ring1);

    // Side button
    const btnGeo = new T.BoxGeometry(0.06, 0.22, 0.12);
    const btn = new T.Mesh(btnGeo, goldMat);
    btn.position.set(0.59, -0.15, 0);
    this.arGroup.add(btn);

    // Band top
    const bandTopGeo = new T.BoxGeometry(0.85, 0.55, 0.16);
    const bandTop = new T.Mesh(bandTopGeo, darkMat);
    bandTop.position.y = 1.0;
    this.arGroup.add(bandTop);

    // Band bottom
    const bandBotGeo = new T.BoxGeometry(0.85, 0.55, 0.16);
    const bandBot = new T.Mesh(bandBotGeo, darkMat);
    bandBot.position.y = -1.0;
    this.arGroup.add(bandBot);

    // Screen content: activity ring glow
    const ringDisplayGeo = new T.TorusGeometry(0.3, 0.04, 8, 40);
    const ringDisplay = new T.Mesh(ringDisplayGeo, glowMat);
    ringDisplay.position.z = 0.16;
    this.arGroup.add(ringDisplay);

    // Center dot (watch face indicator)
    const dotGeo = new T.CircleGeometry(0.06, 16);
    const dotMat = new T.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.8 });
    const dot = new T.Mesh(dotGeo, dotMat);
    dot.position.z = 0.17;
    this.arGroup.add(dot);

    // Store refs for animation
    this.ringDisplay = ringDisplay;
    this.watchCase   = watchCase;

    // Initial scale-in: start small
    this.arGroup.scale.setScalar(0.01);
  }

  _buildParticles(T) {
    const count = 60;
    const geo   = new T.BufferGeometry();
    const pos   = new Float32Array(count * 3);
    const vel   = [];

    for (let i = 0; i < count; i++) {
      const r = 1.8 + Math.random() * 1.4;
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.random() * Math.PI;
      pos[i*3]   = r * Math.sin(phi) * Math.cos(theta);
      pos[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i*3+2] = r * Math.cos(phi);
      vel.push({
        theta: Math.random() * Math.PI * 2,
        speed: 0.002 + Math.random() * 0.004,
        r,
      });
    }
    geo.setAttribute("position", new T.BufferAttribute(pos, 3));
    const mat = new T.PointsMaterial({
      color: 0xd4af37, size: 0.04, transparent: true,
      opacity: 0.6, sizeAttenuation: true,
    });
    this.particles = new T.Points(geo, mat);
    this.particleVel = vel;
    this.scene.add(this.particles);
  }

  _buildHoloRing(T) {
    // Outer scanning ring below the object
    const geo = new T.TorusGeometry(1.5, 0.008, 6, 80);
    const mat = new T.MeshStandardMaterial({
      color: 0xd4af37, emissive: 0xd4af37,
      emissiveIntensity: 0.8,
      transparent: true, opacity: 0.45,
    });
    this.holoRing = new T.Mesh(geo, mat);
    this.holoRing.rotation.x = Math.PI / 2;
    this.holoRing.position.y = -1.6;
    this.scene.add(this.holoRing);

    // Inner ring
    const geo2 = new T.TorusGeometry(0.9, 0.005, 6, 60);
    this.holoRing2 = new T.Mesh(geo2, mat.clone());
    this.holoRing2.rotation.x = Math.PI / 2;
    this.holoRing2.position.y = -1.6;
    this.scene.add(this.holoRing2);
  }

  _bindGyro() {
    this._gyroHandler = (e) => {
      this.gyro.alpha = e.alpha || 0;
      this.gyro.beta  = e.beta  || 0;
      this.gyro.gamma = e.gamma || 0;
    };
    window.addEventListener("deviceorientation", this._gyroHandler, true);
  }

  _bindTouch() {
    const el = this.canvas;

    this._onTouchStart = (e) => {
      if (e.touches.length === 1) {
        this.drag.active = true;
        this.drag.startX = e.touches[0].clientX;
        this.drag.startY = e.touches[0].clientY;
        this.drag.rotX   = this.targetRot.x;
        this.drag.rotY   = this.targetRot.y;
      }
    };
    this._onTouchMove = (e) => {
      if (!this.drag.active || e.touches.length !== 1) return;
      e.preventDefault();
      const dx = e.touches[0].clientX - this.drag.startX;
      const dy = e.touches[0].clientY - this.drag.startY;
      this.targetRot.y = this.drag.rotY + dx * 0.012;
      this.targetRot.x = this.drag.rotX + dy * 0.012;
      // Clamp vertical rotation
      this.targetRot.x = Math.max(-1.2, Math.min(1.2, this.targetRot.x));
    };
    this._onTouchEnd = () => { this.drag.active = false; };

    // Mouse drag (desktop)
    this._onMouseDown = (e) => {
      this.drag.active = true;
      this.drag.startX = e.clientX;
      this.drag.startY = e.clientY;
      this.drag.rotX   = this.targetRot.x;
      this.drag.rotY   = this.targetRot.y;
    };
    this._onMouseMove = (e) => {
      if (!this.drag.active) return;
      const dx = e.clientX - this.drag.startX;
      const dy = e.clientY - this.drag.startY;
      this.targetRot.y = this.drag.rotY + dx * 0.008;
      this.targetRot.x = this.drag.rotX + dy * 0.008;
      this.targetRot.x = Math.max(-1.2, Math.min(1.2, this.targetRot.x));
    };
    this._onMouseUp = () => { this.drag.active = false; };

    el.addEventListener("touchstart",  this._onTouchStart, { passive: true });
    el.addEventListener("touchmove",   this._onTouchMove,  { passive: false });
    el.addEventListener("touchend",    this._onTouchEnd,   { passive: true });
    el.addEventListener("mousedown",   this._onMouseDown);
    window.addEventListener("mousemove", this._onMouseMove);
    window.addEventListener("mouseup",   this._onMouseUp);
  }

  // Called once AR mode activates — animates the object into existence
  spawnObject() {
    this._spawnStart = performance.now();
    this._spawning = true;
  }

  start() {
    this.running = true;
    this._tick();
  }

  _tick() {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(() => this._tick());

    const T   = this.THREE;
    const now = performance.now();
    const t   = now * 0.001;

    // ── Spawn animation (scale 0 → 1 with overshoot) ─────────────────
    if (this._spawning) {
      const elapsed = (now - this._spawnStart) / 1000;
      if (elapsed < 1.2) {
        // Elastic ease-out
        const p  = elapsed / 1.2;
        const ea = p < 0.5
          ? 4 * p * p * p
          : 1 - Math.pow(-2 * p + 2, 3) / 2;
        const overshoot = Math.sin(p * Math.PI * 2.5) * 0.08 * (1 - p);
        this.arGroup.scale.setScalar(ea + overshoot);
      } else {
        this.arGroup.scale.setScalar(1);
        this._spawning = false;
      }
    }

    // ── Smooth rotation: gyro offset + drag ───────────────────────────
    if (!this.drag.active) {
      // Gentle auto-spin when not dragging
      this.targetRot.y += 0.004;
    }

    // Smooth interpolation toward target
    this.lastRot.x += (this.targetRot.x - this.lastRot.x) * 0.08;
    this.lastRot.y += (this.targetRot.y - this.lastRot.y) * 0.08;

    // Gyro depth-shift: moves object slightly based on device tilt
    const gyroX = (this.gyro.gamma || 0) * 0.003; // left-right tilt
    const gyroY = (this.gyro.beta  || 45) * 0.002; // forward-back tilt
    this.gyroSmooth.x += (gyroX - this.gyroSmooth.x) * 0.05;
    this.gyroSmooth.y += (gyroY - this.gyroSmooth.y) * 0.05;

    // Apply rotations
    this.arGroup.rotation.x = this.lastRot.x + this.gyroSmooth.y * 0.4;
    this.arGroup.rotation.y = this.lastRot.y + this.gyroSmooth.x * 0.4;

    // Floating bob
    this.arGroup.position.y = Math.sin(t * 1.1) * 0.06;

    // Ring glow pulse
    if (this.ringDisplay) {
      this.ringDisplay.material.emissiveIntensity = 0.8 + Math.sin(t * 3) * 0.4;
    }

    // Holo rings rotation
    if (this.holoRing)  this.holoRing.rotation.z  += 0.006;
    if (this.holoRing2) this.holoRing2.rotation.z -= 0.009;

    // Particles orbit
    if (this.particles) {
      const pos = this.particles.geometry.attributes.position.array;
      for (let i = 0; i < this.particleVel.length; i++) {
        const v = this.particleVel[i];
        v.theta += v.speed;
        pos[i*3]   = v.r * Math.cos(v.theta);
        pos[i*3+1] = v.r * Math.sin(v.theta) * 0.35;
        pos[i*3+2] = v.r * Math.sin(v.theta);
      }
      this.particles.geometry.attributes.position.needsUpdate = true;
    }

    this.renderer.render(this.scene, this.camera);
  }

  resize(w, h) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  destroy() {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    window.removeEventListener("deviceorientation", this._gyroHandler, true);
    this.canvas.removeEventListener("touchstart",  this._onTouchStart);
    this.canvas.removeEventListener("touchmove",   this._onTouchMove);
    this.canvas.removeEventListener("touchend",    this._onTouchEnd);
    this.canvas.removeEventListener("mousedown",   this._onMouseDown);
    window.removeEventListener("mousemove", this._onMouseMove);
    window.removeEventListener("mouseup",   this._onMouseUp);
    this.renderer.dispose();
  }
}

// ══════════════════════════════════════════════════════════════════════
// SECTION 4 — CAMERA UTILITIES (same robust cascade from v1)
// ══════════════════════════════════════════════════════════════════════
async function getCameraStream(facingMode) {
  const strategies = [
    { video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
    { video: { facingMode: { exact: facingMode } }, audio: false },
    { video: true, audio: false },
  ];
  let lastErr;
  for (const c of strategies) {
    try { return await navigator.mediaDevices.getUserMedia(c); }
    catch (e) {
      lastErr = e;
      if (e.name === "NotAllowedError" || e.name === "PermissionDeniedError") throw e;
    }
  }
  throw lastErr;
}

// ══════════════════════════════════════════════════════════════════════
// SECTION 5 — GLOBAL CSS
// ══════════════════════════════════════════════════════════════════════
const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;600;700&family=Share+Tech+Mono&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html,body,#root{height:100%;width:100%;overflow:hidden;background:${DARK};}
@keyframes fadeUp   {from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
@keyframes spin     {from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
@keyframes pulseRing{0%,100%{transform:scale(1);opacity:.45}50%{transform:scale(1.06);opacity:.9}}
@keyframes blink    {0%,100%{opacity:1}50%{opacity:.12}}
@keyframes scanDown {0%{top:-4px;opacity:0}5%{opacity:1}95%{opacity:.7}100%{top:100%;opacity:0}}
@keyframes scanFade {0%{opacity:0}20%{opacity:1}80%{opacity:1}100%{opacity:0}}
@keyframes ripple   {0%{transform:translate(-50%,-50%) scale(0);opacity:.6}100%{transform:translate(-50%,-50%) scale(2.5);opacity:0}}
@keyframes flipIn   {from{opacity:0;transform:scale(.95)}to{opacity:1;transform:scale(1)}}
@keyframes glowPulse{0%,100%{box-shadow:0 0 20px rgba(212,175,55,.15)}50%{box-shadow:0 0 40px rgba(212,175,55,.35)}}
.gp-btn{font-family:'Share Tech Mono',monospace;letter-spacing:.18em;cursor:pointer;border:none;outline:none;
  transition:opacity .2s,transform .15s;-webkit-tap-highlight-color:transparent;
  touch-action:manipulation;user-select:none;}
.gp-btn:active{transform:scale(.95);opacity:.75;}
.gp-btn:focus-visible{outline:2px solid rgba(212,175,55,.55);outline-offset:3px;}
`;

// ══════════════════════════════════════════════════════════════════════
// SECTION 6 — SUB-COMPONENTS
// ══════════════════════════════════════════════════════════════════════

// Official Ghost Project logo mark (SVG recreation of the metallic G)
const GhostLogo = ({ size = 52, showText = true }) => (
  <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:"6px" }}>
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      <defs>
        <linearGradient id="lgGold1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#f5e070"/>
          <stop offset="40%"  stopColor="#d4af37"/>
          <stop offset="100%" stopColor="#8a6010"/>
        </linearGradient>
        <linearGradient id="lgGold2" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor="#ffe880"/>
          <stop offset="100%" stopColor="#c09820"/>
        </linearGradient>
        <filter id="lgGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.5" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="lgShadow">
          <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#d4af37" floodOpacity="0.4"/>
        </filter>
      </defs>

      {/* Outer arc of G */}
      <path
        d="M95 60 A35 35 0 1 0 95 61 Z"
        stroke="url(#lgGold1)" strokeWidth="10"
        fill="none" strokeLinecap="round"
        filter="url(#lgGlow)"
        strokeDasharray="180 40"
      />
      {/* Inner crossbar */}
      <path
        d="M80 60 L60 60 L60 75"
        stroke="url(#lgGold2)" strokeWidth="9"
        fill="none" strokeLinecap="round" strokeLinejoin="round"
        filter="url(#lgShadow)"
      />
      {/* Bottom ghost tail — 3 rounded protrusions */}
      <ellipse cx="38" cy="92" rx="7"  ry="10" fill="url(#lgGold1)" opacity=".85"/>
      <ellipse cx="60" cy="95" rx="8"  ry="11" fill="url(#lgGold1)"/>
      <ellipse cx="82" cy="92" rx="7"  ry="10" fill="url(#lgGold1)" opacity=".85"/>

      {/* Light reflection streak */}
      <path d="M70 30 Q80 40 75 55" stroke="rgba(255,240,140,.55)" strokeWidth="3"
        fill="none" strokeLinecap="round"/>
    </svg>

    {showText && (
      <div style={{ textAlign:"center" }}>
        <div style={{
          fontSize:"clamp(16px,4.5vw,22px)", fontWeight:700,
          letterSpacing:".32em", color:GOLD,
          fontFamily:"'Rajdhani',sans-serif", lineHeight:1,
          textShadow:"0 0 28px rgba(212,175,55,.35)",
        }}>GHOST PROJECT</div>
        <div style={{
          fontSize:"8px", letterSpacing:".5em", color:GOLD2,
          marginTop:"5px", fontFamily:"'Share Tech Mono',monospace",
        }}>AI · AR · E-COMMERCE</div>
      </div>
    )}
  </div>
);

// Scanning animation overlay
const ScanOverlay = ({ onComplete }) => {
  useEffect(() => {
    const t = setTimeout(onComplete, 2800);
    return () => clearTimeout(t);
  }, [onComplete]);

  return (
    <div style={{
      position:"fixed", inset:0, zIndex:20,
      background:"rgba(6,13,26,.92)",
      display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center",
      animation:"scanFade 2.8s ease both",
    }}>
      {/* Scan frame */}
      <div style={{
        position:"relative",
        width:"min(280px,70vw)", height:"min(280px,70vw)",
        border:"1px solid rgba(212,175,55,.3)",
      }}>
        {/* Corner brackets */}
        {[
          {top:0,left:0,borderTop:"2px solid",borderLeft:"2px solid"},
          {top:0,right:0,borderTop:"2px solid",borderRight:"2px solid"},
          {bottom:0,left:0,borderBottom:"2px solid",borderLeft:"2px solid"},
          {bottom:0,right:0,borderBottom:"2px solid",borderRight:"2px solid"},
        ].map((s,i) => (
          <div key={i} style={{
            position:"absolute",width:28,height:28,
            borderColor:GOLD,...s
          }}/>
        ))}
        {/* Scan line */}
        <div style={{
          position:"absolute",left:0,right:0,height:"2px",
          background:`linear-gradient(90deg,transparent,${GOLD},transparent)`,
          animation:"scanDown 1.4s ease-in-out infinite",
          boxShadow:"0 0 12px rgba(212,175,55,.6)",
        }}/>
        {/* Center reticle */}
        <div style={{
          position:"absolute",top:"50%",left:"50%",
          transform:"translate(-50%,-50%)",
          width:40,height:40,
          border:"1px solid rgba(212,175,55,.4)",
          borderRadius:"50%",
        }}>
          <div style={{
            position:"absolute",inset:"-20px",
            border:"1px solid rgba(212,175,55,.12)",
            borderRadius:"50%",
            animation:"ripple 1.5s ease-out infinite",
          }}/>
        </div>
      </div>
      <div style={{
        marginTop:"28px",
        color:"rgba(212,175,55,.7)",fontSize:"10px",
        letterSpacing:".35em",fontFamily:"'Share Tech Mono',monospace",
      }}>
        CALIBRANDO AR
        <span style={{animation:"blink 1s infinite 0s"}}>.</span>
        <span style={{animation:"blink 1s infinite .3s"}}>.</span>
        <span style={{animation:"blink 1s infinite .6s"}}>.</span>
      </div>
    </div>
  );
};

// AR corner brackets overlay
const ARBrackets = () => (
  <div style={{position:"absolute",inset:0,pointerEvents:"none",zIndex:2}}>
    {[
      {top:14,left:14,borderTop:"2px solid",borderLeft:"2px solid"},
      {top:14,right:14,borderTop:"2px solid",borderRight:"2px solid"},
      {bottom:14,left:14,borderBottom:"2px solid",borderLeft:"2px solid"},
      {bottom:14,right:14,borderBottom:"2px solid",borderRight:"2px solid"},
    ].map((s,i) => (
      <div key={i} style={{position:"absolute",width:22,height:22,
        borderColor:"rgba(212,175,55,.65)",...s}}/>
    ))}
  </div>
);

// ══════════════════════════════════════════════════════════════════════
// SECTION 7 — MAIN APP
// ══════════════════════════════════════════════════════════════════════
export default function App() {
  const [stage,    setStage]    = useState(S.IDLE);
  const [facing,   setFacing]   = useState("environment");
  const [errMsg,   setErrMsg]   = useState("");
  const [mirrored, setMirrored] = useState(false);

  const videoRef    = useRef(null);
  const canvasRef   = useRef(null);
  const streamRef   = useRef(null);
  const arSceneRef  = useRef(null);

  // ── Inject CSS ──────────────────────────────────────────────────────
  useEffect(() => {
    if (document.getElementById("gp-css")) return;
    const el = document.createElement("style");
    el.id = "gp-css";
    el.textContent = GLOBAL_CSS;
    document.head.appendChild(el);
  }, []);

  // ── Cleanup ─────────────────────────────────────────────────────────
  useEffect(() => () => {
    stopStream();
    arSceneRef.current?.destroy();
  }, []);

  // ── Resize handler ──────────────────────────────────────────────────
  useEffect(() => {
    const onResize = () => arSceneRef.current?.resize(window.innerWidth, window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const attachVideo = (stream) => {
    let tries = 0;
    const go = () => {
      const v = videoRef.current;
      if (v) {
        v.srcObject = stream;
        v.setAttribute("playsinline","");
        v.setAttribute("webkit-playsinline","");
        v.muted = true;
        v.play().catch(() => {});
      } else if (++tries < 20) setTimeout(go, 80);
    };
    go();
  };

  // ── Start camera ────────────────────────────────────────────────────
  const startCamera = async (facingMode) => {
    stopStream();
    const stream = await getCameraStream(facingMode);
    streamRef.current = stream;
    const track    = stream.getVideoTracks()[0];
    const settings = track?.getSettings?.() ?? {};
    setMirrored((settings.facingMode ?? facingMode) === "user");
    return stream;
  };

  // ── Initialize Three.js AR scene on canvas ──────────────────────────
  const initARScene = async () => {
    if (arSceneRef.current) { arSceneRef.current.destroy(); arSceneRef.current = null; }
    const THREE = await loadThree();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scene = new ARScene(canvas, THREE);
    arSceneRef.current = scene;
    scene.start();
    return scene;
  };

  // ── ACTIVATE: camera → scan → AR ───────────────────────────────────
  const handleActivate = async () => {
    setStage(S.LOADING);
    setErrMsg("");
    try {
      const stream = await startCamera(facing);
      setStage(S.SCANNING);
      attachVideo(stream);
      // Three.js loads during scan animation (2.8s window)
      await initARScene();
    } catch (e) {
      const n = e.name || "";
      setErrMsg(
        n === "NotAllowedError" || n === "PermissionDeniedError"
          ? "ACESSO À CÂMERA NEGADO.\n\n1. Toque no 🔒 na barra de endereço\n2. Permissões → Câmera → Permitir\n3. Recarregue"
          : n === "NotFoundError"
          ? "NENHUMA CÂMERA ENCONTRADA."
          : `ERRO: ${n || e.message}`
      );
      setStage(S.ERROR);
    }
  };

  // ── Scan complete → switch to AR view ──────────────────────────────
  const handleScanComplete = useCallback(() => {
    setStage(S.AR);
    setTimeout(() => arSceneRef.current?.spawnObject(), 100);
  }, []);

  // ── Flip camera ─────────────────────────────────────────────────────
  const handleFlip = async () => {
    const next = facing === "environment" ? "user" : "environment";
    setFacing(next);
    if (stage === S.AR || stage === S.SCANNING) {
      try {
        const stream = await startCamera(next);
        attachVideo(stream);
      } catch { setFacing(facing); }
    }
  };

  // ── Deactivate ──────────────────────────────────────────────────────
  const handleDeactivate = () => {
    stopStream();
    arSceneRef.current?.destroy();
    arSceneRef.current = null;
    setStage(S.IDLE);
  };

  // ══════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════
  return (
    <div style={{
      position:"fixed", inset:0, background:DARK,
      display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center",
      fontFamily:"'Rajdhani','Share Tech Mono',sans-serif",
      overflow:"hidden",
    }}>
      {/* Persistent grid bg */}
      <div style={{
        position:"absolute",inset:0,pointerEvents:"none",
        backgroundImage:`
          linear-gradient(rgba(212,175,55,.03) 1px,transparent 1px),
          linear-gradient(90deg,rgba(212,175,55,.03) 1px,transparent 1px)`,
        backgroundSize:"44px 44px",zIndex:0,
      }}/>
      <div style={{
        position:"absolute",top:"50%",left:"50%",
        transform:"translate(-50%,-50%)",
        width:"80vmax",height:"80vmax",
        background:"radial-gradient(circle,rgba(212,175,55,.045) 0%,transparent 65%)",
        pointerEvents:"none",zIndex:0,
      }}/>

      {/* ══ IDLE ═══════════════════════════════════════════════════════ */}
      {stage === S.IDLE && (
        <div style={{
          position:"relative",zIndex:1,
          display:"flex",flexDirection:"column",
          alignItems:"center",padding:"44px 28px",
          width:"100%",maxWidth:"380px",
          animation:"fadeUp .6s ease both",
        }}>
          {/* Logo with rings */}
          <div style={{position:"relative",marginBottom:"36px"}}>
            <div style={{
              position:"absolute",inset:"-18px",
              border:"1px dashed rgba(212,175,55,.14)",borderRadius:"50%",
              animation:"spin 20s linear infinite",
            }}/>
            <div style={{
              position:"absolute",inset:"-7px",
              border:"1px solid rgba(212,175,55,.25)",borderRadius:"50%",
              animation:"pulseRing 3s ease-in-out infinite",
            }}/>
            <div style={{
              width:"90px",height:"90px",borderRadius:"50%",
              background:"linear-gradient(135deg,rgba(212,175,55,.11),rgba(212,175,55,.03))",
              border:"1.5px solid rgba(212,175,55,.42)",
              display:"flex",alignItems:"center",justifyContent:"center",
              boxShadow:"0 0 32px rgba(212,175,55,.12)",
              animation:"glowPulse 4s ease-in-out infinite",
            }}>
              <GhostLogo size={50} showText={false}/>
            </div>
          </div>

          <GhostLogo size={0} showText={true}/>

          {/* Divider */}
          <div style={{
            width:"100%",height:"1px",
            background:"linear-gradient(90deg,transparent,rgba(212,175,55,.2),transparent)",
            margin:"26px 0",
          }}/>

          <div style={{
            textAlign:"center",color:GOLD2,fontSize:"10px",
            letterSpacing:".1em",lineHeight:"1.8",
            fontFamily:"'Share Tech Mono',monospace",marginBottom:"34px",
          }}>
            VISUALIZAÇÃO 3D EM REALIDADE AUMENTADA<br/>
            VALIDAÇÃO DE PRODUTO EM TEMPO REAL
          </div>

          {/* Main CTA */}
          <button className="gp-btn" onClick={handleActivate} style={{
            width:"100%",padding:"18px 24px",borderRadius:"4px",
            border:"1.5px solid rgba(212,175,55,.52)",
            background:"linear-gradient(135deg,rgba(212,175,55,.14),rgba(212,175,55,.04))",
            color:GOLD,fontSize:"12px",
            boxShadow:"0 0 24px rgba(212,175,55,.08)",
          }}>
            ◈ &nbsp;ATIVAR GHOST AR
          </button>

          {/* Camera selector */}
          <div style={{marginTop:"16px",display:"flex",gap:"10px"}}>
            {["environment","user"].map(f => (
              <button key={f} className="gp-btn" onClick={() => setFacing(f)} style={{
                padding:"9px 18px",borderRadius:"3px",
                border:`1px solid ${facing===f?"rgba(212,175,55,.48)":"rgba(212,175,55,.12)"}`,
                background:facing===f?"rgba(212,175,55,.09)":"transparent",
                color:facing===f?GOLD:"rgba(212,175,55,.28)",fontSize:"9px",
              }}>
                {f==="environment" ? "TRASEIRA" : "FRONTAL"}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ══ LOADING ════════════════════════════════════════════════════ */}
      {stage === S.LOADING && (
        <div style={{
          position:"relative",zIndex:1,
          display:"flex",flexDirection:"column",
          alignItems:"center",gap:"22px",
          animation:"fadeUp .35s ease both",
        }}>
          <div style={{
            width:"52px",height:"52px",borderRadius:"50%",
            border:"1.5px solid rgba(212,175,55,.12)",
            borderTop:"1.5px solid rgba(212,175,55,.75)",
            animation:"spin .85s linear infinite",
          }}/>
          <div style={{
            color:"rgba(212,175,55,.55)",fontSize:"10px",
            letterSpacing:".3em",fontFamily:"'Share Tech Mono',monospace",
          }}>
            INICIALIZANDO
            <span style={{animation:"blink 1s infinite 0s"}}>.</span>
            <span style={{animation:"blink 1s infinite .3s"}}>.</span>
            <span style={{animation:"blink 1s infinite .6s"}}>.</span>
          </div>
        </div>
      )}

      {/* ══ SCANNING + AR (video + canvas always present when active) ═ */}
      {(stage === S.SCANNING || stage === S.AR) && (
        <div style={{position:"fixed",inset:0,zIndex:10,background:"#000",animation:"flipIn .3s ease both"}}>

          {/* Camera feed */}
          <video ref={videoRef} autoPlay playsInline muted style={{
            position:"absolute",inset:0,
            width:"100%",height:"100%",
            objectFit:"cover",
            transform: mirrored ? "scaleX(-1)" : "none",
            background:"#000",
          }}/>

          {/* Three.js WebGL canvas — transparent, sits over video */}
          <canvas ref={canvasRef} style={{
            position:"absolute",inset:0,
            width:"100%",height:"100%",
            pointerEvents: stage === S.AR ? "auto" : "none",
            zIndex:1,
          }}/>

          {/* Scan overlay */}
          {stage === S.SCANNING && <ScanOverlay onComplete={handleScanComplete}/>}

          {/* AR HUD (only in AR mode) */}
          {stage === S.AR && (
            <>
              <div style={{position:"absolute",inset:0,zIndex:2,pointerEvents:"none"}}>
                <ARBrackets/>
                {/* Top HUD */}
                <div style={{
                  position:"absolute",top:0,left:0,right:0,
                  padding:"max(env(safe-area-inset-top,14px),14px) 20px 14px",
                  background:"linear-gradient(to bottom,rgba(6,13,26,.72),transparent)",
                  display:"flex",alignItems:"center",justifyContent:"space-between",
                }}>
                  <GhostLogo size={26} showText={false}/>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:"10px",fontWeight:700,letterSpacing:".24em",
                      color:GOLD,fontFamily:"'Rajdhani',sans-serif"}}>GHOST PROJECT</div>
                    <div style={{fontSize:"7.5px",letterSpacing:".25em",
                      color:"rgba(212,175,55,.42)",fontFamily:"'Share Tech Mono',monospace"}}>
                      AR · ATIVO
                    </div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:"5px"}}>
                    <div style={{width:6,height:6,borderRadius:"50%",background:"#4ade80",
                      boxShadow:"0 0 8px rgba(74,222,128,.9)",
                      animation:"blink 1.6s ease-in-out infinite"}}/>
                    <span style={{fontSize:"8px",letterSpacing:".2em",
                      color:"rgba(74,222,128,.82)",fontFamily:"'Share Tech Mono',monospace"}}>
                      LIVE
                    </span>
                  </div>
                </div>

                {/* Gesture hint */}
                <div style={{
                  position:"absolute",bottom:"100px",left:"50%",
                  transform:"translateX(-50%)",
                  color:"rgba(212,175,55,.35)",fontSize:"9px",
                  letterSpacing:".18em",fontFamily:"'Share Tech Mono',monospace",
                  whiteSpace:"nowrap",
                }}>
                  ↔ ARRASTE PARA GIRAR
                </div>
              </div>

              {/* Bottom controls */}
              <div style={{
                position:"absolute",bottom:0,left:0,right:0,zIndex:3,
                padding:`18px 20px max(env(safe-area-inset-bottom,22px),22px)`,
                background:"linear-gradient(to top,rgba(6,13,26,.85),transparent)",
                display:"flex",alignItems:"center",justifyContent:"center",gap:"22px",
              }}>
                {/* Close */}
                <button className="gp-btn" onClick={handleDeactivate} style={{
                  width:"48px",height:"48px",borderRadius:"50%",
                  border:"1.5px solid rgba(212,175,55,.28)",
                  background:"rgba(212,175,55,.07)",
                  color:"rgba(212,175,55,.6)",
                  display:"flex",alignItems:"center",justifyContent:"center",
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>

                {/* Center validate button */}
                <button className="gp-btn" style={{
                  width:"68px",height:"68px",borderRadius:"50%",
                  border:`2px solid ${GOLD}`,
                  background:"linear-gradient(135deg,rgba(212,175,55,.2),rgba(212,175,55,.05))",
                  color:GOLD,fontSize:"8px",letterSpacing:".14em",
                  display:"flex",flexDirection:"column",
                  alignItems:"center",justifyContent:"center",gap:"3px",
                  boxShadow:"0 0 28px rgba(212,175,55,.18)",
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/>
                    <path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
                    <line x1="7" y1="12" x2="17" y2="12"/>
                  </svg>
                  OK
                </button>

                {/* Flip */}
                <button className="gp-btn" onClick={handleFlip} style={{
                  width:"48px",height:"48px",borderRadius:"50%",
                  border:"1.5px solid rgba(212,175,55,.28)",
                  background:"rgba(212,175,55,.07)",
                  color:"rgba(212,175,55,.6)",
                  display:"flex",alignItems:"center",justifyContent:"center",
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 7h-3a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2Z"/>
                    <circle cx="12" cy="13" r="3"/>
                  </svg>
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ══ ERROR ══════════════════════════════════════════════════════ */}
      {stage === S.ERROR && (
        <div style={{
          position:"relative",zIndex:1,
          display:"flex",flexDirection:"column",
          alignItems:"center",gap:"20px",
          padding:"0 32px",maxWidth:"340px",
          textAlign:"center",
          animation:"fadeUp .4s ease both",
        }}>
          <div style={{fontSize:"28px",color:"rgba(212,175,55,.24)"}}>⊘</div>
          <div style={{
            color:"rgba(212,175,55,.74)",fontSize:"10.5px",
            letterSpacing:".08em",lineHeight:"1.9",
            fontFamily:"'Share Tech Mono',monospace",whiteSpace:"pre-line",
          }}>{errMsg}</div>
          <button className="gp-btn" onClick={() => setStage(S.IDLE)} style={{
            padding:"13px 28px",borderRadius:"3px",
            border:"1px solid rgba(212,175,55,.34)",
            background:"rgba(212,175,55,.07)",
            color:"rgba(212,175,55,.68)",
            fontSize:"10px",letterSpacing:".22em",marginTop:"4px",
          }}>
            TENTAR NOVAMENTE
          </button>
        </div>
      )}
    </div>
  );
}

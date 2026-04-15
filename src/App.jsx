// ============================================================
// GHOST PROJECT — App.jsx (Versão Final Otimizada)
// ============================================================

import { useEffect, useRef, useState, useCallback } from "react";

// ── Constantes de sistema ──────────────────────────────────
const SYSTEM = {
  SCAN_DURATION_MS: 2800,
  ROTATION_DAMPING: 0.92,
  OBJECT_DISTANCE: 2.2,
  AMBIENT_INTENSITY: 0.6,
  POINT_LIGHT_INTENSITY: 3.0,
  GOLD_COLOR: 0xd4af37,
  GOLD_EMISSIVE: 0x3a2800,
  BG_COLOR: 0x0a0a0a,
};

function loadThreeJS() {
  return new Promise((resolve, reject) => {
    if (window.THREE) return resolve(window.THREE);
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
    script.onload = () => resolve(window.THREE);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function buildGoldObject(THREE) {
  const group = new THREE.Group();
  const bezelGeo = new THREE.TorusGeometry(0.72, 0.09, 32, 100);
  const goldMat = new THREE.MeshStandardMaterial({
    color: SYSTEM.GOLD_COLOR,
    emissive: SYSTEM.GOLD_EMISSIVE,
    metalness: 1.0,
    roughness: 0.18,
  });
  const bezel = new THREE.Mesh(bezelGeo, goldMat);
  group.add(bezel);

  const faceGeo = new THREE.CylinderGeometry(0.62, 0.62, 0.06, 64);
  const faceMat = new THREE.MeshStandardMaterial({ color: 0x0d0d0d, metalness: 0.4, roughness: 0.7 });
  const face = new THREE.Mesh(faceGeo, faceMat);
  face.rotation.x = Math.PI / 2;
  group.add(face);

  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const markGeo = i % 3 === 0 ? new THREE.BoxGeometry(0.05, 0.16, 0.03) : new THREE.BoxGeometry(0.025, 0.09, 0.03);
    const mark = new THREE.Mesh(markGeo, goldMat);
    mark.position.set(Math.sin(angle) * 0.5, Math.cos(angle) * 0.5, 0.05);
    mark.rotation.z = -angle;
    group.add(mark);
  }

  const hourGeo = new THREE.BoxGeometry(0.04, 0.28, 0.025);
  const hourHand = new THREE.Mesh(hourGeo, goldMat);
  hourHand.position.set(0.06, 0.10, 0.07);
  hourHand.rotation.z = -0.8;
  group.add(hourHand);

  const minGeo = new THREE.BoxGeometry(0.025, 0.42, 0.025);
  const minHand = new THREE.Mesh(minGeo, goldMat);
  minHand.position.set(-0.05, 0.15, 0.07);
  minHand.rotation.z = 0.4;
  group.add(minHand);

  const crownGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.18, 16);
  const crown = new THREE.Mesh(crownGeo, goldMat);
  crown.rotation.z = Math.PI / 2;
  crown.position.set(0.78, 0, 0);
  group.add(crown);

  const strapGeo = new THREE.BoxGeometry(0.42, 0.55, 0.06);
  const strapMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.2, roughness: 0.9 });
  const strapTop = new THREE.Mesh(strapGeo, strapMat);
  strapTop.position.set(0, 1.1, 0);
  group.add(strapTop);
  const strapBot = new THREE.Mesh(strapGeo, strapMat);
  strapBot.position.set(0, -1.1, 0);
  group.add(strapBot);

  return group;
}

export default function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const threeRef = useRef({ renderer: null, scene: null, camera: null, object: null, animFrameId: null });
  const orientRef = useRef({ alpha: 0, beta: 0, gamma: 0 });
  const touchRef = useRef({ active: false, lastX: 0, lastY: 0, velX: 0, velY: 0 });

  const [phase, setPhase] = useState("idle");
  const [scanProgress, setScanProgress] = useState(0);
  const [threeLoaded, setThreeLoaded] = useState(false);
  const [permissionError, setPermissionError] = useState(null);

  useEffect(() => {
    loadThreeJS().then(() => setThreeLoaded(true)).catch(() => console.warn("Three.js falhou"));
  }, []);

  useEffect(() => {
    function handleOrientation(e) { orientRef.current = { alpha: e.alpha || 0, beta: e.beta || 0, gamma: e.gamma || 0 }; }
    window.addEventListener("deviceorientation", handleOrientation, true);
    return () => window.removeEventListener("deviceorientation", handleOrientation, true);
  }, []);

  const startCamera = useCallback(async () => {
    setPhase("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setPhase("streaming");
    } catch (err) {
      setPermissionError("Erro na câmera. Verifique as permissões.");
      setPhase("idle");
    }
  }, []);

  const startScan = useCallback(() => {
    setPhase("scanning");
    const start = performance.now();
    function animateScan(now) {
      const progress = Math.min((now - start) / SYSTEM.SCAN_DURATION_MS, 1);
      setScanProgress(progress);
      if (progress < 1) requestAnimationFrame(animateScan);
      else initThreeAR();
    }
    requestAnimationFrame(animateScan);
  }, []);

  function initThreeAR() {
    if (!window.THREE) return setPhase("ar");
    const THREE = window.THREE;
    const canvas = canvasRef.current;
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, canvas.clientWidth / canvas.clientHeight, 0.01, 100);
    camera.position.z = SYSTEM.OBJECT_DISTANCE;

    scene.add(new THREE.AmbientLight(0xfff0dd, 1));
    const pLight = new THREE.PointLight(0xffd700, 2);
    pLight.position.set(2, 3, 3);
    scene.add(pLight);

    const object = buildGoldObject(THREE);
    scene.add(object);
    threeRef.current = { renderer, scene, camera, object };
    setPhase("ar");

    function animate() {
      threeRef.current.animFrameId = requestAnimationFrame(animate);
      if (touchRef.current.active) {
        object.rotation.y += touchRef.current.velX * 0.01;
        object.rotation.x += touchRef.current.velY * 0.01;
        touchRef.current.velX *= 0.9; touchRef.current.velY *= 0.9;
      } else {
        object.rotation.y += 0.005;
      }
      renderer.render(scene, camera);
    }
    animate();
  }

  return (
    <div className="ghost-root">
      <video ref={videoRef} className={`ghost-video ${phase === "idle" ? "hidden" : ""}`} playsInline muted autoPlay />
      <canvas ref={canvasRef} className={`ghost-canvas ${phase === "ar" ? "visible" : ""}`} />
      {phase === "idle" && (
        <div className="ghost-idle">
          <div className="ghost-logo-wrapper">
             <img src="https://i.ibb.co/JRcfKZhw/1776216880651.jpg" alt="Ghost Project" className="ghost-logo-img" style={{width: '120px', background: 'transparent'}} />
             <div className="ghost-logo-sub">PROJECT · AR</div>
          </div>
          <button className="ghost-cta" onClick={startCamera}>INICIAR EXPERIÊNCIA AR</button>
        </div>
      )}
      {phase === "streaming" && <button className="ghost-scan-btn" onClick={startScan}>ESCANEAR AMBIENTE</button>}
      {phase === "scanning" && <div className="ghost-status-text">Analisando superfície... {Math.round(scanProgress*100)}%</div>}
    </div>
  );
}

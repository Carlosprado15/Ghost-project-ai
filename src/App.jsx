// ============================================================
// GHOST PROJECT — App.jsx
// Motor: Three.js via CDN (sem bundler dependency)
// Compatível: Safari iOS + Chrome Android + Desktop
// Arquitetura: System Prompt = Cérebro | User Prompt = Voz
// ============================================================

import { useEffect, useRef, useState, useCallback } from "react";

// ── Constantes de sistema ──────────────────────────────────
const SYSTEM = {
  SCAN_DURATION_MS: 2800,
  ROTATION_DAMPING: 0.92,
  OBJECT_DISTANCE: 2.2,       // metros simulados de profundidade
  AMBIENT_INTENSITY: 0.6,
  POINT_LIGHT_INTENSITY: 3.0,
  GOLD_COLOR: 0xd4af37,
  GOLD_EMISSIVE: 0x3a2800,
  BG_COLOR: 0x0a0a0a,
};

// ── Injetor de script Three.js (CDN) ──────────────────────
function loadThreeJS() {
  return new Promise((resolve, reject) => {
    if (window.THREE) return resolve(window.THREE);
    const script = document.createElement("script");
    script.src =
      "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
    script.onload = () => resolve(window.THREE);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// ── Geometria: Relógio/Toroide dourado ─────────────────────
function buildGoldObject(THREE) {
  const group = new THREE.Group();

  // Anel externo (bezel)
  const bezelGeo = new THREE.TorusGeometry(0.72, 0.09, 32, 100);
  const goldMat = new THREE.MeshStandardMaterial({
    color: SYSTEM.GOLD_COLOR,
    emissive: SYSTEM.GOLD_EMISSIVE,
    metalness: 1.0,
    roughness: 0.18,
  });
  const bezel = new THREE.Mesh(bezelGeo, goldMat);
  group.add(bezel);

  // Face do relógio
  const faceGeo = new THREE.CylinderGeometry(0.62, 0.62, 0.06, 64);
  const faceMat = new THREE.MeshStandardMaterial({
    color: 0x0d0d0d,
    metalness: 0.4,
    roughness: 0.7,
  });
  const face = new THREE.Mesh(faceGeo, faceMat);
  face.rotation.x = Math.PI / 2;
  group.add(face);

  // Marcadores de hora (12 bastões)
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const markGeo =
      i % 3 === 0
        ? new THREE.BoxGeometry(0.05, 0.16, 0.03)
        : new THREE.BoxGeometry(0.025, 0.09, 0.03);
    const mark = new THREE.Mesh(markGeo, goldMat);
    mark.position.set(
      Math.sin(angle) * 0.5,
      Math.cos(angle) * 0.5,
      0.05
    );
    mark.rotation.z = -angle;
    group.add(mark);
  }

  // Ponteiro de horas
  const hourGeo = new THREE.BoxGeometry(0.04, 0.28, 0.025);
  const hourHand = new THREE.Mesh(hourGeo, goldMat);
  hourHand.position.set(0.06, 0.10, 0.07);
  hourHand.rotation.z = -0.8;
  group.add(hourHand);

  // Ponteiro de minutos
  const minGeo = new THREE.BoxGeometry(0.025, 0.42, 0.025);
  const minHand = new THREE.Mesh(minGeo, goldMat);
  minHand.position.set(-0.05, 0.15, 0.07);
  minHand.rotation.z = 0.4;
  group.add(minHand);

  // Coroa lateral
  const crownGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.18, 16);
  const crown = new THREE.Mesh(crownGeo, goldMat);
  crown.rotation.z = Math.PI / 2;
  crown.position.set(0.78, 0, 0);
  group.add(crown);

  // Pulseira superior
  const strapGeo = new THREE.BoxGeometry(0.42, 0.55, 0.06);
  const strapMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a,
    metalness: 0.2,
    roughness: 0.9,
  });
  const strapTop = new THREE.Mesh(strapGeo, strapMat);
  strapTop.position.set(0, 1.1, 0);
  group.add(strapTop);

  // Pulseira inferior
  const strapBot = new THREE.Mesh(strapGeo, strapMat);
  strapBot.position.set(0, -1.1, 0);
  group.add(strapBot);

  // Partículas douradas de ambiente
  const particleCount = 120;
  const particleGeo = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 5;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 5;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 5;
  }
  particleGeo.setAttribute(
    "position",
    new THREE.BufferAttribute(positions, 3)
  );
  const particleMat = new THREE.PointsMaterial({
    color: SYSTEM.GOLD_COLOR,
    size: 0.018,
    transparent: true,
    opacity: 0.55,
  });
  const particles = new THREE.Points(particleGeo, particleMat);
  group.add(particles);

  return group;
}

// ══════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ══════════════════════════════════════════════════════════
export default function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);

  // Three.js refs
  const threeRef = useRef({
    renderer: null,
    scene: null,
    camera: null,
    object: null,
    animFrameId: null,
  });

  // Orientação do dispositivo (ancoragem)
  const orientRef = useRef({ alpha: 0, beta: 0, gamma: 0 });

  // Gestos touch
  const touchRef = useRef({
    active: false,
    lastX: 0,
    lastY: 0,
    velX: 0,
    velY: 0,
  });

  // Estados de UI
  const [phase, setPhase] = useState("idle"); // idle | requesting | streaming | scanning | ar
  const [scanProgress, setScanProgress] = useState(0);
  const [threeLoaded, setThreeLoaded] = useState(false);
  const [permissionError, setPermissionError] = useState(null);

  // ── Pré-carrega Three.js na montagem ──────────────────
  useEffect(() => {
    loadThreeJS()
      .then(() => setThreeLoaded(true))
      .catch(() => console.warn("Three.js CDN falhou"));
  }, []);

  // ── Orientação do dispositivo → ancoragem ─────────────
  useEffect(() => {
    function handleOrientation(e) {
      orientRef.current = {
        alpha: e.alpha || 0,
        beta: e.beta || 0,
        gamma: e.gamma || 0,
      };
    }
    window.addEventListener("deviceorientation", handleOrientation, true);
    return () =>
      window.removeEventListener("deviceorientation", handleOrientation, true);
  }, []);

  // ── Inicia câmera ──────────────────────────────────────
  const startCamera = useCallback(async () => {
    setPhase("requesting");
    setPermissionError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setPhase("streaming");
    } catch (err) {
      setPermissionError(
        err.name === "NotAllowedError"
          ? "Permissão de câmera negada. Habilite nas configurações do navegador."
          : "Câmera não disponível neste dispositivo."
      );
      setPhase("idle");
    }
  }, []);

  // ── Dispara scan ──────────────────────────────────────
  const startScan = useCallback(() => {
    if (phase !== "streaming") return;
    setPhase("scanning");
    setScanProgress(0);

    // Scan de overlay no canvas 2D
    const overlay = overlayCanvasRef.current;
    const ctx = overlay?.getContext("2d");
    const start = performance.now();

    function animateScan(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / SYSTEM.SCAN_DURATION_MS, 1);
      setScanProgress(progress);

      if (ctx && overlay) {
        ctx.clearRect(0, 0, overlay.width, overlay.height);
        // Linha de scan
        const y = progress * overlay.height;
        const grad = ctx.createLinearGradient(0, y - 30, 0, y + 4);
        grad.addColorStop(0, "rgba(212,175,55,0)");
        grad.addColorStop(0.6, "rgba(212,175,55,0.18)");
        grad.addColorStop(1, "rgba(212,175,55,0.85)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, y - 30, overlay.width, 34);

        // Linha nítida
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(overlay.width, y);
        ctx.strokeStyle = "rgba(212,175,55,0.95)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Cantos do frame
        drawCorners(ctx, overlay.width, overlay.height, progress);
      }

      if (progress < 1) {
        requestAnimationFrame(animateScan);
      } else {
        if (ctx && overlay) ctx.clearRect(0, 0, overlay.width, overlay.height);
        initThreeAR();
      }
    }
    requestAnimationFrame(animateScan);
  }, [phase]);

  // ── Desenha cantos do frame de scan ───────────────────
  function drawCorners(ctx, w, h, progress) {
    const len = 36;
    const pad = 28;
    const alpha = 0.4 + progress * 0.6;
    ctx.strokeStyle = `rgba(212,175,55,${alpha})`;
    ctx.lineWidth = 2;

    const corners = [
      [pad, pad, 1, 1],
      [w - pad, pad, -1, 1],
      [pad, h - pad, 1, -1],
      [w - pad, h - pad, -1, -1],
    ];
    corners.forEach(([x, y, dx, dy]) => {
      ctx.beginPath();
      ctx.moveTo(x, y + dy * len);
      ctx.lineTo(x, y);
      ctx.lineTo(x + dx * len, y);
      ctx.stroke();
    });
  }

  // ── Inicializa cena Three.js sobre o vídeo ────────────
  function initThreeAR() {
    if (!window.THREE) {
      console.warn("Three.js não carregado");
      setPhase("ar");
      return;
    }
    const THREE = window.THREE;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    canvas.width = W;
    canvas.height = H;

    // Renderer transparente sobre o vídeo
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Cena
    const scene = new THREE.Scene();

    // Câmera perspectiva
    const camera = new THREE.PerspectiveCamera(55, W / H, 0.01, 100);
    camera.position.set(0, 0, SYSTEM.OBJECT_DISTANCE);

    // Luzes
    const ambientLight = new THREE.AmbientLight(
      0xffeedd,
      SYSTEM.AMBIENT_INTENSITY
    );
    scene.add(ambientLight);

    const keyLight = new THREE.PointLight(
      0xffd700,
      SYSTEM.POINT_LIGHT_INTENSITY,
      12
    );
    keyLight.position.set(2, 3, 3);
    keyLight.castShadow = true;
    scene.add(keyLight);

    const fillLight = new THREE.PointLight(0xffffff, 1.2, 10);
    fillLight.position.set(-2, -1, 2);
    scene.add(fillLight);

    const rimLight = new THREE.PointLight(0xd4af37, 0.8, 8);
    rimLight.position.set(0, -3, -1);
    scene.add(rimLight);

    // Objeto 3D
    const object = buildGoldObject(THREE);
    object.position.set(0, 0, 0);
    scene.add(object);

    threeRef.current = { renderer, scene, camera, object, animFrameId: null };
    setPhase("ar");

    // ── Loop de renderização ──────────────────────────
    let autoRotY = 0;

    function animate() {
      threeRef.current.animFrameId = requestAnimationFrame(animate);

      const touch = touchRef.current;
      const orient = orientRef.current;

      if (touch.active) {
        // Gesto manual: rotação direta
        object.rotation.y += touch.velX * 0.012;
        object.rotation.x += touch.velY * 0.012;
        // Amortece velocidade
        touch.velX *= SYSTEM.ROTATION_DAMPING;
        touch.velY *= SYSTEM.ROTATION_DAMPING;
      } else {
        // Ancoragem por orientação do dispositivo
        const targetY = (orient.gamma / 45) * 0.6;
        const targetX = ((orient.beta - 45) / 45) * 0.4;
        object.rotation.y += (targetY - object.rotation.y) * 0.06;
        object.rotation.x += (targetX - object.rotation.x) * 0.06;

        // Auto-giro leve quando sem toque
        autoRotY += 0.003;
        object.rotation.y += 0.003;
      }

      // Leve flutuação vertical
      object.position.y = Math.sin(Date.now() * 0.0008) * 0.06;

      // Luz pulsante
      keyLight.intensity =
        SYSTEM.POINT_LIGHT_INTENSITY +
        Math.sin(Date.now() * 0.002) * 0.4;

      renderer.render(scene, camera);
    }
    animate();
  }

  // ── Gestos touch ──────────────────────────────────────
  const handleTouchStart = useCallback((e) => {
    if (e.touches.length !== 1) return;
    touchRef.current = {
      active: true,
      lastX: e.touches[0].clientX,
      lastY: e.touches[0].clientY,
      velX: 0,
      velY: 0,
    };
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (!touchRef.current.active || e.touches.length !== 1) return;
    e.preventDefault();
    const dx = e.touches[0].clientX - touchRef.current.lastX;
    const dy = e.touches[0].clientY - touchRef.current.lastY;
    touchRef.current.velX = dx;
    touchRef.current.velY = dy;
    touchRef.current.lastX = e.touches[0].clientX;
    touchRef.current.lastY = e.touches[0].clientY;

    if (threeRef.current.object) {
      threeRef.current.object.rotation.y += dx * 0.012;
      threeRef.current.object.rotation.x += dy * 0.012;
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    touchRef.current.active = false;
  }, []);

  // ── Mouse drag (desktop) ──────────────────────────────
  const mouseRef = useRef({ down: false, lastX: 0, lastY: 0 });

  const handleMouseDown = useCallback((e) => {
    mouseRef.current = { down: true, lastX: e.clientX, lastY: e.clientY };
    touchRef.current.active = true;
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!mouseRef.current.down) return;
    const dx = e.clientX - mouseRef.current.lastX;
    const dy = e.clientY - mouseRef.current.lastY;
    mouseRef.current.lastX = e.clientX;
    mouseRef.current.lastY = e.clientY;
    touchRef.current.velX = dx;
    touchRef.current.velY = dy;
    if (threeRef.current.object) {
      threeRef.current.object.rotation.y += dx * 0.010;
      threeRef.current.object.rotation.x += dy * 0.010;
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    mouseRef.current.down = false;
    touchRef.current.active = false;
  }, []);

  // ── Resize handler ────────────────────────────────────
  useEffect(() => {
    function onResize() {
      const { renderer, camera } = threeRef.current;
      const canvas = canvasRef.current;
      if (!renderer || !canvas) return;
      const W = canvas.clientWidth;
      const H = canvas.clientHeight;
      renderer.setSize(W, H);
      if (camera) {
        camera.aspect = W / H;
        camera.updateProjectionMatrix();
      }
      // Overlay canvas
      const ol = overlayCanvasRef.current;
      if (ol) { ol.width = W; ol.height = H; }
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ── Cleanup ───────────────────────────────────────────
  useEffect(() => {
    return () => {
      const { renderer, animFrameId } = threeRef.current;
      if (animFrameId) cancelAnimationFrame(animFrameId);
      if (renderer) renderer.dispose();
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // ══════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════
  return (
    <div className="ghost-root">
      {/* ── Vídeo de câmera (background) ── */}
      <video
        ref={videoRef}
        className={`ghost-video ${phase === "idle" || phase === "requesting" ? "hidden" : ""}`}
        playsInline
        muted
        autoPlay
      />

      {/* ── Canvas Three.js (sobre o vídeo) ── */}
      <canvas
        ref={canvasRef}
        className={`ghost-canvas ${phase === "ar" ? "visible" : ""}`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      />

      {/* ── Canvas de overlay / scan ── */}
      <canvas
        ref={overlayCanvasRef}
        className="ghost-overlay-canvas"
      />

      {/* ══ FASE: IDLE ══ */}
      {phase === "idle" && (
        <div className="ghost-idle">
          <div className="ghost-bg-grid" />
          <div className="ghost-idle-content">
            {/* ── LOGOTIPO ──
                Substitua a URL abaixo pela URL pública do seu logo:
                Ex: "https://res.cloudinary.com/seu-id/image/upload/logo.png"
            ─────────────────────────────────────────────────────── */}
            <div className="ghost-logo-wrapper">
              {/* OPÇÃO A: imagem externa (recomendado) */}
              {/* <img src="URL_DO_SEU_LOGO_AQUI" alt="Ghost Project" className="ghost-logo-img" /> */}

              {/* OPÇÃO B: logotipo SVG inline (substitua o path abaixo) */}
              <svg
                className="ghost-logo-svg"
                viewBox="0 0 160 60"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <text
                  x="50%"
                  y="50%"
                  dominantBaseline="middle"
                  textAnchor="middle"
                  fontFamily="'Georgia', serif"
                  fontSize="22"
                  letterSpacing="8"
                  fill="url(#goldGrad)"
                >
                  GHOST
                </text>
                <defs>
                  <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#a07830" />
                    <stop offset="40%" stopColor="#f0d060" />
                    <stop offset="70%" stopColor="#d4af37" />
                    <stop offset="100%" stopColor="#8a6520" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="ghost-logo-sub">PROJECT · AR</div>
            </div>

            <div className="ghost-divider" />

            <p className="ghost-tagline">
              Experimente antes de comprar.<br />
              <span className="ghost-tagline-accent">Realidade Aumentada para e-commerce.</span>
            </p>

            {permissionError && (
              <div className="ghost-error">{permissionError}</div>
            )}

            <button className="ghost-cta" onClick={startCamera}>
              <span className="ghost-cta-ring" />
              <span className="ghost-cta-text">INICIAR EXPERIÊNCIA AR</span>
            </button>

            <p className="ghost-hint">
              Câmera traseira · iOS Safari · Android Chrome
            </p>
          </div>
        </div>
      )}

      {/* ══ FASE: REQUESTING ══ */}
      {phase === "requesting" && (
        <div className="ghost-overlay-ui">
          <div className="ghost-spinner" />
          <p className="ghost-status-text">Solicitando câmera...</p>
        </div>
      )}

      {/* ══ FASE: STREAMING ══ */}
      {phase === "streaming" && (
        <div className="ghost-ar-hud">
          <div className="ghost-hud-header">
            <div className="ghost-hud-logo">GHOST · AR</div>
            <div className="ghost-hud-badge">● CÂMERA ATIVA</div>
          </div>

          <div className="ghost-scan-frame">
            <div className="ghost-scan-corner tl" />
            <div className="ghost-scan-corner tr" />
            <div className="ghost-scan-corner bl" />
            <div className="ghost-scan-corner br" />
            <p className="ghost-scan-hint">Aponte para o ambiente</p>
          </div>

          <div className="ghost-hud-footer">
            <button className="ghost-scan-btn" onClick={startScan}>
              <span className="ghost-scan-btn-inner">ESCANEAR</span>
            </button>
          </div>
        </div>
      )}

      {/* ══ FASE: SCANNING ══ */}
      {phase === "scanning" && (
        <div className="ghost-ar-hud">
          <div className="ghost-hud-header">
            <div className="ghost-hud-logo">GHOST · AR</div>
            <div className="ghost-hud-badge scanning">◈ ANALISANDO</div>
          </div>
          <div className="ghost-scan-progress-wrap">
            <div
              className="ghost-scan-progress-bar"
              style={{ width: `${scanProgress * 100}%` }}
            />
          </div>
          <p className="ghost-scan-label">
            {scanProgress < 0.4
              ? "Mapeando superfícies..."
              : scanProgress < 0.75
              ? "Calculando profundidade..."
              : "Ancorando objeto..."}
          </p>
        </div>
      )}

      {/* ══ FASE: AR ══ */}
      {phase === "ar" && (
        <div className="ghost-ar-hud ar-active">
          <div className="ghost-hud-header">
            <div className="ghost-hud-logo">GHOST · AR</div>
            <div className="ghost-hud-badge live">◉ AO VIVO</div>
          </div>

          <div className="ghost-ar-controls-hint">
            <span>↺ Arraste para girar</span>
          </div>

          <div className="ghost-hud-footer ar-footer">
            <button
              className="ghost-secondary-btn"
              onClick={() => {
                const { animFrameId, renderer } = threeRef.current;
                if (animFrameId) cancelAnimationFrame(animFrameId);
                if (renderer) renderer.dispose();
                setPhase("streaming");
              }}
            >
              REPOSICIONAR
            </button>
            <button
              className="ghost-secondary-btn accent"
              onClick={() => {
                alert("Checkout integration: evento registrado.");
              }}
            >
              VALIDAR COMPRA
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

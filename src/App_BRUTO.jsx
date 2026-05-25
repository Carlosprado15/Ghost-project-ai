import { useState, useRef, useEffect, useCallback } from 'react';
import './App.css';

// ─── CDN loaders ──────────────────────────────────────────────────────────────
function loadScript(src, id) {
  return new Promise((resolve, reject) => {
    if (document.getElementById(id)) {
      resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.id = id;
    s.crossOrigin = 'anonymous';
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function loadMediaPipe() {
  await loadScript(
    'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js',
    'mp-cu'
  );
  await loadScript(
    'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js',
    'mp-du'
  );
  await loadScript(
    'https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js',
    'mp-h'
  );
}

function useModelViewer() {
  useEffect(() => {
    if (document.querySelector('script[data-mv]')) return;
    const s = document.createElement('script');
    s.type = 'module';
    s.setAttribute('data-mv', '1');
    s.src =
      'https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js';
    document.head.appendChild(s);
  }, []);
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRACKING BRUTO - SEM SMOOTHING
// Objetivo: validar geometria anatômica pura
// ═══════════════════════════════════════════════════════════════════════════════

// Conversão de coordenadas MediaPipe → viewport
function landmarkToViewport(norm, videoEl, mirrorX) {
  const iW = videoEl.videoWidth || 1280;
  const iH = videoEl.videoHeight || 720;
  const r = videoEl.getBoundingClientRect();

  const scale = Math.max(r.width / iW, r.height / iH);
  const dW = iW * scale;
  const dH = iH * scale;
  const ox = (r.width - dW) / 2;
  const oy = (r.height - dH) / 2;

  let x = norm.x * dW + ox + r.left;
  const y = norm.y * dH + oy + r.top;

  if (mirrorX) {
    x = r.right - (norm.x * dW + ox);
  }

  return { x, y };
}

// Cálculo de rotação do relógio baseado no vetor anatômico do antebraço
function wristRotationDeg(landmarks, videoEl, mirrorX) {
  const wrist = landmarkToViewport(landmarks[0], videoEl, mirrorX);
  const idx = landmarkToViewport(landmarks[5], videoEl, mirrorX);
  const mid = landmarkToViewport(landmarks[9], videoEl, mirrorX);
  const pinky = landmarkToViewport(landmarks[17], videoEl, mirrorX);

  // Centro da palma usando index, middle e pinky
  const palmCenterX = (idx.x + mid.x + pinky.x) / 3;
  const palmCenterY = (idx.y + mid.y + pinky.y) / 3;

  const dx = palmCenterX - wrist.x;
  const dy = palmCenterY - wrist.y;

  return Math.atan2(dy, dx) * (180 / Math.PI) - 90;
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState('home');
  const [camMode, setCamMode] = useState('environment');
  const [camError, setCamError] = useState('');
  const [showBuy, setShowBuy] = useState(false);
  const [tracking, setTracking] = useState(false);

  // Estado do relógio - TRACKING BRUTO (sem smoothing)
  const [watch, setWatch] = useState({ x: 0, y: 0, size: 140, rot: 0 });

  // ✅ NOVO: Estado do círculo verde de validação do wrist (com smoothing leve)
  const [wristCircle, setWristCircle] = useState({ x: 0, y: 0, visible: false });
  const wristSmoothRef = useRef({ x: 0, y: 0 });

  // Debug info
  const [debugInfo, setDebugInfo] = useState({
    handedness: '',
    palmWidth: 0,
    rotation: 0,
    wristX: 0,
    wristY: 0,
  });

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const handsRef = useRef(null);
  const cameraRef = useRef(null);
  const buyTimer = useRef(null);
  const activeRef = useRef(false);
  const lmRef = useRef(null);

  useModelViewer();

  const openScanner = () => {
    console.log('[DEBUG] Abrindo scanner');
    setCamError('');
    setShowBuy(false);
    setTracking(false);
    setScreen('scanner');
  };

  // ── Debug Canvas ──────────────────────────────────────────────────────────
  const drawDebugCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const lm = lmRef.current;

    if (!canvas || !video || !lm) return;

    const rect = video.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const mirror = camMode === 'user';

    // Converter landmark para coordenadas do canvas
    const toCanvasCoord = (norm) => {
      const vp = landmarkToViewport(norm, video, mirror);
      return { x: vp.x - rect.left, y: vp.y - rect.top };
    };

    // Desenhar TODOS os landmarks
    lm.forEach((l, i) => {
      const p = toCanvasCoord(l);
      ctx.fillStyle = '#00ff00';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, 2 * Math.PI);
      ctx.fill();

      // Números dos landmarks
      ctx.fillStyle = '#ffffff';
      ctx.font = '10px monospace';
      ctx.fillText(i, p.x + 6, p.y - 3);
    });

    // Destacar landmarks chave
    const wrist = toCanvasCoord(lm[0]);
    const index = toCanvasCoord(lm[5]);
    const middle = toCanvasCoord(lm[9]);
    const pinky = toCanvasCoord(lm[17]);

    // Círculo GRANDE no pulso
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(wrist.x, wrist.y, 15, 0, 2 * Math.PI);
    ctx.stroke();

    // Vetor anatômico do antebraço (pulso → centro da palma)
    const palmCenterX = (index.x + middle.x + pinky.x) / 3;
    const palmCenterY = (index.y + middle.y + pinky.y) / 3;

    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(wrist.x, wrist.y);
    ctx.lineTo(palmCenterX, palmCenterY);
    ctx.stroke();

    // Linha da largura da palma (index → pinky)
    ctx.strokeStyle = '#ffff00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(index.x, index.y);
    ctx.lineTo(pinky.x, pinky.y);
    ctx.stroke();

    // Seta indicando direção do vetor
    const dx = palmCenterX - wrist.x;
    const dy = palmCenterY - wrist.y;
    const len = Math.hypot(dx, dy);
    const arrowLen = 20;
    const arrowX = palmCenterX;
    const arrowY = palmCenterY;

    ctx.fillStyle = '#ff0000';
    ctx.beginPath();
    ctx.arc(arrowX, arrowY, 8, 0, 2 * Math.PI);
    ctx.fill();
  }, [camMode]);

  // ── MediaPipe callback ────────────────────────────────────────────────────
  const onHandsResults = useCallback(
    (results) => {
      if (!activeRef.current || !videoRef.current) return;

      if (!results.multiHandLandmarks?.length) {
        setTracking(false);
        lmRef.current = null;
        // ✅ NOVO: Esconder círculo verde quando perder tracking
        setWristCircle({ x: 0, y: 0, visible: false });
        return;
      }

      const lm = results.multiHandLandmarks[0];
      const hand = results.multiHandedness?.[0];
      const mirror = camMode === 'user';
      const vid = videoRef.current;

      // Salvar landmarks para debug canvas
      lmRef.current = lm;

      // TRACKING BRUTO - SEM SMOOTHING
      const wristPx = landmarkToViewport(lm[0], vid, mirror);
      const idxPx = landmarkToViewport(lm[5], vid, mirror);
      const pinkyPx = landmarkToViewport(lm[17], vid, mirror);

      // Largura da palma → tamanho do relógio
      const palmPx = Math.hypot(idxPx.x - pinkyPx.x, idxPx.y - pinkyPx.y);
      const watchSize = Math.max(90, Math.min(220, palmPx * 1.85));

      // Rotação do relógio
      const watchRot = wristRotationDeg(lm, vid, mirror);

      // ATUALIZAÇÃO DIRETA - SEM LERP
      setWatch({
        x: wristPx.x,
        y: wristPx.y,
        size: watchSize,
        rot: watchRot,
      });

      // ✅ NOVO: Atualizar círculo verde com smoothing LEVE (alpha = 0.3)
      const alpha = 0.3; // Smoothing leve
      wristSmoothRef.current.x = wristSmoothRef.current.x * (1 - alpha) + wristPx.x * alpha;
      wristSmoothRef.current.y = wristSmoothRef.current.y * (1 - alpha) + wristPx.y * alpha;

      setWristCircle({
        x: wristSmoothRef.current.x,
        y: wristSmoothRef.current.y,
        visible: true,
      });

      setDebugInfo({
        handedness: hand?.label || 'Unknown',
        palmWidth: Math.round(palmPx),
        rotation: Math.round(watchRot),
        wristX: Math.round(wristPx.x),
        wristY: Math.round(wristPx.y),
      });

      setTracking(true);

      // Desenhar debug canvas
      drawDebugCanvas();
    },
    [camMode, drawDebugCanvas]
  );

  // ── Camera + MediaPipe start ──────────────────────────────────────────────
  useEffect(() => {
    if (screen !== 'scanner') return;
    activeRef.current = true;

    (async () => {
      try {
        console.log('[DEBUG] Carregando MediaPipe...');
        await loadMediaPipe();
        if (!activeRef.current) return;

        console.log('[DEBUG] Criando detector Hands...');
        const hands = new window.Hands({
          locateFile: (f) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`,
        });
        hands.setOptions({
          maxNumHands: 1,
          modelComplexity: 1,
          minDetectionConfidence: 0.5, // BAIXO - não bloquear detecção
          minTrackingConfidence: 0.5, // BAIXO - não perder tracking
        });
        hands.onResults(onHandsResults);
        handsRef.current = hands;

        console.log('[DEBUG] Iniciando câmera...');
        const camera = new window.Camera(videoRef.current, {
          onFrame: async () => {
            if (handsRef.current && videoRef.current) {
              await handsRef.current.send({ image: videoRef.current });
            }
          },
          facingMode: camMode,
          width: 1280,
          height: 720,
        });
        await camera.start();
        cameraRef.current = camera;
        console.log('[DEBUG] Câmera iniciada');

        if (videoRef.current?.srcObject) {
          streamRef.current = videoRef.current.srcObject;
        }

        buyTimer.current = setTimeout(() => {
          if (activeRef.current) setShowBuy(true);
        }, 3000);
      } catch (err) {
        console.error('[DEBUG] ERRO:', err);
        if (activeRef.current) {
          const msg = err?.message ?? String(err);
          setCamError(`Câmera indisponível: ${msg}`);
          setScreen('home');
        }
      }
    })();

    return () => {
      console.log('[DEBUG] Cleanup');
      activeRef.current = false;
      clearTimeout(buyTimer.current);
      cameraRef.current?.stop();
      cameraRef.current = null;
      handsRef.current?.close();
      handsRef.current = null;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [screen, camMode, onHandsResults]);

  const closeScanner = () => {
    activeRef.current = false;
    clearTimeout(buyTimer.current);
    setShowBuy(false);
    setTracking(false);
    setScreen('home');
  };

  // ── HOME ──────────────────────────────────────────────────────────────────
  if (screen === 'home') {
    return (
      <div className="home">
        <div
          className="home-background"
          style={{ backgroundImage: 'url("/logo.jpeg")' }}
        />
        <div className="home-content">
          <div className="home-tagline">
            <p>Try Before You Buy</p>
          </div>
          <div className="home-buttons">
            <div className="cam-selector">
              <button
                className={
                  camMode === 'environment' ? 'cam-btn active' : 'cam-btn'
                }
                onClick={() => setCamMode('environment')}
              >
                Câmera Traseira
              </button>
              <button
                className={camMode === 'user' ? 'cam-btn active' : 'cam-btn'}
                onClick={() => setCamMode('user')}
              >
                Câmera Frontal
              </button>
            </div>
            {camError && <p className="cam-error">{camError}</p>}
            <button className="scan-btn" onClick={openScanner}>
              START AR SCANNER
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── SCANNER ───────────────────────────────────────────────────────────────
  const watchStyle = {
    position: 'fixed',
    left: `${watch.x}px`,
    top: `${watch.y}px`,
    width: `${watch.size}px`,
    height: `${watch.size}px`,
    transform: `translate(-50%, -50%) rotate(${watch.rot}deg)`,
    pointerEvents: 'none',
    zIndex: 15,
    // APARECE INSTANTANEAMENTE quando tracking ativo
    opacity: tracking ? 1 : 0,
    transition: 'none', // SEM transição
    filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.55))',
  };

  // ✅ NOVO: Estilo do círculo verde de validação
  const wristCircleStyle = {
    position: 'fixed',
    left: `${wristCircle.x}px`,
    top: `${wristCircle.y}px`,
    width: '30px',
    height: '30px',
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'none',
    zIndex: 20, // Acima do relógio
    opacity: wristCircle.visible ? 1 : 0,
    transition: 'opacity 0.2s ease',
  };

  return (
    <div className="scanner">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="video-feed"
        style={camMode === 'user' ? { transform: 'scaleX(-1)' } : {}}
      />

      {/* Canvas debug - landmarks e vetores */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 99,
          transform: camMode === 'user' ? 'scaleX(-1)' : 'none',
        }}
      />

      {/* ✅ NOVO: Círculo verde de validação do wrist tracking */}
      <div style={wristCircleStyle}>
        <svg width="30" height="30" viewBox="0 0 30 30">
          <circle
            cx="15"
            cy="15"
            r="12"
            fill="none"
            stroke="#00ff00"
            strokeWidth="3"
          />
          <circle cx="15" cy="15" r="4" fill="#00ff00" opacity="0.6" />
        </svg>
      </div>

      {/* Painel debug EXTENSIVO */}
      <div
        style={{
          position: 'fixed',
          top: 60,
          left: 10,
          right: 10,
          background: 'rgba(0,0,0,0.9)',
          color: '#00ff00',
          padding: '12px',
          fontFamily: 'monospace',
          fontSize: 11,
          zIndex: 100,
          borderRadius: 8,
          border: '2px solid #00ff00',
          maxWidth: 400,
        }}
      >
        <div
          style={{
            fontWeight: 'bold',
            color: '#ffff00',
            marginBottom: 8,
            fontSize: 13,
          }}
        >
          🔬 DEBUG GEOMÉTRICO - TRACKING BRUTO
        </div>
        <div style={{ color: '#0ff' }}>
          Tracking: {tracking ? 'ATIVO ✓' : 'INATIVO'}
        </div>
        <div style={{ color: '#0ff' }}>Handedness: {debugInfo.handedness}</div>
        <div style={{ color: '#0f0', marginTop: 4 }}>
          🟢 Círculo Verde: {wristCircle.visible ? 'VISÍVEL (Wrist Landmark 0)' : 'OCULTO'}
        </div>
        <div
          style={{ marginTop: 6, borderTop: '1px solid #333', paddingTop: 6 }}
        >
          <div>
            Pulso X: <span style={{ color: '#fff' }}>{debugInfo.wristX}px</span>
          </div>
          <div>
            Pulso Y: <span style={{ color: '#fff' }}>{debugInfo.wristY}px</span>
          </div>
          <div>
            Largura Palma:{' '}
            <span style={{ color: '#fff' }}>{debugInfo.palmWidth}px</span>
          </div>
          <div>
            Tamanho Relógio:{' '}
            <span style={{ color: '#fff' }}>{Math.round(watch.size)}px</span>
          </div>
          <div>
            Rotação:{' '}
            <span style={{ color: '#fff' }}>{debugInfo.rotation}°</span>
          </div>
        </div>
        <div style={{ marginTop: 6, fontSize: 9, color: '#888' }}>
          ⚠️ SEM SMOOTHING - Geometria pura
        </div>
        <div style={{ marginTop: 4, fontSize: 9, color: '#888' }}>
          🔵 Azul = Pulso | 🔴 Vermelho = Vetor Antebraço | 🟡 Amarelo = Largura
          Palma
        </div>
        <div style={{ marginTop: 4, fontSize: 9, color: '#0f0' }}>
          🟢 Verde = Wrist Tracking Real (Landmark 0 com smoothing leve)
        </div>
      </div>

      <div className="scan-overlay">
        <div className="scan-line-bar" />
        <div className="scan-corners">
          <div className="corner tl" />
          <div className="corner tr" />
          <div className="corner bl" />
          <div className="corner br" />
        </div>
      </div>

      {/* Relógio 3D - APARECE INSTANTANEAMENTE */}
      <div className="watch-container" style={watchStyle}>
        <model-viewer
          src="/relogio.glb"
          disable-zoom
          shadow-intensity="1"
          exposure="1.2"
          interaction-prompt="none"
          camera-orbit="0deg 75deg 100%"
          field-of-view="30deg"
          min-camera-orbit="auto auto 100%"
          max-camera-orbit="auto auto 100%"
          camera-controls="false"
          style={{ width: '100%', height: '100%', background: 'transparent' }}
        />
      </div>

      <div className="hud-top">
        <button className="back-btn" onClick={closeScanner}>
          ← Voltar
        </button>
        <div className="ar-badge">
          <span className={`ar-dot ${tracking ? 'active' : ''}`} />
          {tracking ? 'TRACKING BRUTO ATIVO' : 'AR ATIVO'}
        </div>
      </div>

      {!tracking && (
        <div className="tracking-hint">
          <p>APONTE PARA O SEU PULSO</p>
        </div>
      )}

      <div className="action-container">
        {showBuy && tracking && (
          <div className="action-buttons">
            <button className="action-btn primary">Comprar Agora</button>
            <button className="action-btn secondary">Ver Detalhes</button>
          </div>
        )}
      </div>
    </div>
  );
}

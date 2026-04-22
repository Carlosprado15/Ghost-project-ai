import { useState, useRef, useEffect, useCallback } from 'react';
import './App.css';

// ─── MediaPipe CDN loader ─────────────────────────────────────────────────────
function loadScript(src, id) {
  return new Promise((resolve, reject) => {
    if (document.getElementById(id)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src; s.id = id; s.crossOrigin = 'anonymous';
    s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}
async function loadMediaPipe() {
  await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js', 'mp-cu');
  await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js', 'mp-du');
  await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js', 'mp-h');
}

// ─── model-viewer loader ──────────────────────────────────────────────────────
function useModelViewer() {
  useEffect(() => {
    if (document.querySelector('script[data-mv]')) return;
    const s = document.createElement('script');
    s.type = 'module'; s.setAttribute('data-mv', '1');
    s.src = 'https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js';
    document.head.appendChild(s);
  }, []);
}

// ─── Exponential smoothing ────────────────────────────────────────────────────
const ALPHA      = 0.30;   // position — responsive but stable
const ALPHA_SIZE = 0.20;   // size — slightly slower to avoid pulsing

function smooth(prev, next, alpha) {
  if (prev === null) return next;
  return prev + alpha * (next - prev);
}

// ─── MediaPipe landmark indices ───────────────────────────────────────────────
const WRIST_IDX     = 0;
const INDEX_MCP_IDX = 5;
const PINKY_MCP_IDX = 17;

// ─── THE ROOT CAUSE FIX ───────────────────────────────────────────────────────
// MediaPipe normalizes landmarks [0..1] relative to the INPUT IMAGE fed to it.
// We feed the <video> element at 1280×720. The screen may be 393×852 (CSS px).
// Previous code multiplied normalized coords by container.clientWidth (~393px)
// → watch appeared stuck at ~30% of correct position = top-left corner.
//
// CORRECT APPROACH:
// 1. Read the video's actual rendered size via getBoundingClientRect().
// 2. Also account for letterbox/pillarbox offset (video is object-fit:cover).
// 3. Map normalized landmark → rendered video pixel → screen pixel.
// ─────────────────────────────────────────────────────────────────────────────

function landmarkToScreen(normX, normY, videoEl, mirrorX) {
  // video intrinsic resolution (what MediaPipe sees)
  const intrW = videoEl.videoWidth  || 1280;
  const intrH = videoEl.videoHeight || 720;

  // video rendered rect on screen (CSS pixels, includes offset from top-left)
  const rect = videoEl.getBoundingClientRect();
  const rendW = rect.width;
  const rendH = rect.height;

  // object-fit:cover scale factor and offset
  // The video scales uniformly to COVER the element; one axis may be clipped.
  const scaleX = rendW / intrW;
  const scaleY = rendH / intrH;
  const scale  = Math.max(scaleX, scaleY);          // cover = max

  const displayW = intrW * scale;
  const displayH = intrH * scale;
  const offsetX  = (rendW - displayW) / 2;          // negative when clipped
  const offsetY  = (rendH - displayH) / 2;

  // normalized → display pixels → screen pixels (relative to viewport)
  let sx = normX * displayW + offsetX + rect.left;
  const sy =  normY * displayH + offsetY + rect.top;

  if (mirrorX) sx = rect.right - (normX * displayW + offsetX);

  return { x: sx, y: sy };
}

function palmSizePx(lmA, lmB, videoEl, mirrorX) {
  const a = landmarkToScreen(lmA.x, lmA.y, videoEl, mirrorX);
  const b = landmarkToScreen(lmB.x, lmB.y, videoEl, mirrorX);
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function App() {
  const [screen,   setScreen]   = useState('home');
  const [camMode,  setCamMode]  = useState('environment');
  const [camError, setCamError] = useState('');
  const [showBuy,  setShowBuy]  = useState(false);
  const [tracking, setTracking] = useState(false);   // true = hand detected

  // Watch position in VIEWPORT px (position:fixed)
  const [watchPos, setWatchPos] = useState({ x: 0, y: 0, size: 150 });

  const videoRef    = useRef(null);
  const streamRef   = useRef(null);
  const handsRef    = useRef(null);
  const mpCameraRef = useRef(null);
  const buyTimer    = useRef(null);
  const smoothX     = useRef(null);
  const smoothY     = useRef(null);
  const smoothSize  = useRef(null);
  const activeRef   = useRef(false);

  useModelViewer();

  const openScanner = () => {
    setCamError(''); setShowBuy(false);
    smoothX.current = null; smoothY.current = null; smoothSize.current = null;
    setTracking(false);
    setScreen('scanner');
  };

  // ── MediaPipe result callback ─────────────────────────────────────────────
  const onResults = useCallback((results) => {
    if (!activeRef.current) return;
    const vid = videoRef.current;
    if (!vid) return;

    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      setTracking(false);
      return;
    }

    const landmarks = results.multiHandLandmarks[0];
    const wrist    = landmarks[WRIST_IDX];
    const indexMCP = landmarks[INDEX_MCP_IDX];
    const pinkyMCP = landmarks[PINKY_MCP_IDX];

    const mirrorX = camMode === 'user';

    // ── CORRECT coordinate mapping ──────────────────────────────────────────
    const { x: rawX, y: rawY } = landmarkToScreen(wrist.x, wrist.y, vid, mirrorX);

    // Palm width in screen pixels → watch diameter (scale factor 1.8 feels natural)
    const palmPx  = palmSizePx(indexMCP, pinkyMCP, vid, mirrorX);
    const rawSize = Math.max(80, Math.min(240, palmPx * 1.8));

    // Exponential smoothing
    smoothX.current    = smooth(smoothX.current,    rawX,    ALPHA);
    smoothY.current    = smooth(smoothY.current,    rawY,    ALPHA);
    smoothSize.current = smooth(smoothSize.current, rawSize, ALPHA_SIZE);

    setTracking(true);
    setWatchPos({
      x:    smoothX.current,
      y:    smoothY.current,
      size: smoothSize.current,
    });
  }, [camMode]);

  // ── Camera + MediaPipe startup ────────────────────────────────────────────
  useEffect(() => {
    if (screen !== 'scanner') return;
    activeRef.current = true;

    (async () => {
      try {
        await loadMediaPipe();
        if (!activeRef.current) return;

        // eslint-disable-next-line no-undef
        const hands = new window.Hands({
          locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`,
        });
        hands.setOptions({
          maxNumHands           : 1,
          modelComplexity       : 1,
          minDetectionConfidence: 0.65,
          minTrackingConfidence : 0.55,
        });
        hands.onResults(onResults);
        handsRef.current = hands;

        // Let Camera util own the stream — no prior getUserMedia
        // eslint-disable-next-line no-undef
        const mpCam = new window.Camera(videoRef.current, {
          onFrame: async () => {
            if (handsRef.current && videoRef.current) {
              await handsRef.current.send({ image: videoRef.current });
            }
          },
          facingMode: camMode,
          width : 1280,
          height: 720,
        });
        await mpCam.start();
        mpCameraRef.current = mpCam;

        if (videoRef.current?.srcObject) {
          streamRef.current = videoRef.current.srcObject;
        }

        buyTimer.current = setTimeout(() => {
          if (activeRef.current) setShowBuy(true);
        }, 5000);

      } catch (err) {
        if (activeRef.current) {
          setCamError(`Câmera indisponível: ${err?.message ?? err}`);
          setScreen('home');
        }
      }
    })();

    return () => {
      activeRef.current = false;
      clearTimeout(buyTimer.current);
      mpCameraRef.current?.stop();   mpCameraRef.current = null;
      handsRef.current?.close();     handsRef.current = null;
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, camMode]);

  const closeScanner = () => {
    activeRef.current = false;
    clearTimeout(buyTimer.current);
    setShowBuy(false); setTracking(false);
    setScreen('home');
  };

  // ── HOME screen ───────────────────────────────────────────────────────────
  if (screen === 'home') {
    return (
      <div className="home">
        <div className="home-tagline"><p>Try Before You Buy</p></div>
        <div className="home-buttons">
          <div className="cam-selector">
            <button
              className={camMode === 'environment' ? 'cam-btn active' : 'cam-btn'}
              onClick={() => setCamMode('environment')}
            >📷 Câmera Traseira</button>
            <button
              className={camMode === 'user' ? 'cam-btn active' : 'cam-btn'}
              onClick={() => setCamMode('user')}
            >🤳 Câmera Frontal</button>
          </div>
          {camError && <p className="cam-error">{camError}</p>}
          <button className="scan-btn" onClick={openScanner}>
            INICIAR LEITOR DE RA
          </button>
        </div>
      </div>
    );
  }

  // ── SCANNER screen ────────────────────────────────────────────────────────
  // Watch style: position:fixed uses viewport coords from getBoundingClientRect
  // opacity 0 until first hand detected → no ghost in corner
  const watchDynamicStyle = {
    position  : 'fixed',
    left      : `${watchPos.x}px`,
    top       : `${watchPos.y}px`,
    width     : `${watchPos.size}px`,
    height    : `${watchPos.size}px`,
    // center horizontally, shift up ~90% of height so watch sits ON the wrist
    transform : 'translate(-50%, -90%)',
    transition: 'none',
    pointerEvents: 'none',
    zIndex    : 4,
    // HIDDEN until tracking starts — prevents "ghost" in top-left corner
    opacity   : tracking ? 1 : 0,
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

      <div className="scan-line-overlay">
        <div className="scan-line-bar" />
      </div>

      <div className="scan-corners">
        <div className="sc tl" /><div className="sc tr" />
        <div className="sc bl" /><div className="sc br" />
      </div>

      {/* Watch anchored to wrist — position:fixed, viewport coords */}
      <div style={watchDynamicStyle}>
        <model-viewer
          src="/relogio.glb"
          camera-controls
          auto-rotate
          shadow-intensity="1"
          exposure="1.1"
          interaction-prompt="none"
          orientation="0deg 0deg 0deg"
          camera-orbit="0deg 75deg 0.18m"
          min-camera-orbit="auto auto 0.12m"
          max-camera-orbit="auto auto 0.28m"
          field-of-view="28deg"
          style={{ width: '100%', height: '100%', background: 'transparent' }}
        />
      </div>

      {/* HUD top */}
      <div className="hud-top">
        <button className="back-btn" onClick={closeScanner}>← Voltar</button>
        <div className="ar-badge">
          <span className={`ar-dot${tracking ? ' ar-dot--tracking' : ''}`} />
          {tracking ? 'PULSO DETECTADO' : 'AR ATIVO'}
        </div>
      </div>

      {/* Bottom UI: hint + buy buttons stacked, never overlapping */}
      <div className="bottom-ui">
        {!tracking && (
          <div className="tracking-hint">
            Mostre seu pulso para a câmera
          </div>
        )}
        {showBuy && (
          <div className="action-buttons-row">
            <button className="action-btn">Comprar agora</button>
            <button className="action-btn">Ver detalhes</button>
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useRef, useEffect, useCallback } from 'react';
import './App.css';

// ─── MediaPipe CDN loader ────────────────────────────────────────────────────
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
  await loadScript(
    'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js',
    'mp-camera-utils'
  );
  await loadScript(
    'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js',
    'mp-drawing-utils'
  );
  await loadScript(
    'https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js',
    'mp-hands'
  );
}

// ─── model-viewer loader ─────────────────────────────────────────────────────
function useModelViewer() {
  useEffect(() => {
    if (document.querySelector('script[data-mv]')) return;
    const s = document.createElement('script');
    s.type = 'module'; s.setAttribute('data-mv', '1');
    s.src = 'https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js';
    document.head.appendChild(s);
  }, []);
}

// ─── Exponential smoothing ───────────────────────────────────────────────────
// FIX 3: increased ALPHA 0.18 → 0.28 for faster wrist tracking on mobile
const ALPHA      = 0.28;
const ALPHA_SIZE = 0.18;

function smooth(prev, next, alpha) {
  if (prev === null) return next;
  return prev + alpha * (next - prev);
}

// ─── MediaPipe landmark indices ───────────────────────────────────────────────
const WRIST_IDX     = 0;
const INDEX_MCP_IDX = 5;
const PINKY_MCP_IDX = 17;

// ─── Main component ──────────────────────────────────────────────────────────
export default function App() {
  const [screen,   setScreen]   = useState('home');
  const [camMode,  setCamMode]  = useState('environment');
  const [camError, setCamError] = useState('');
  const [showBuy,  setShowBuy]  = useState(false);
  const [tracking, setTracking] = useState(false);

  const [watchStyle, setWatchStyle] = useState({
    left: '50%', top: '50%',
    width: '140px', height: '140px',
    transform: 'translate(-50%, -50%)',
    transition: 'none',
  });

  const videoRef     = useRef(null);
  const streamRef    = useRef(null);
  const handsRef     = useRef(null);
  const mpCameraRef  = useRef(null);
  const buyTimer     = useRef(null);
  const smoothX      = useRef(null);
  const smoothY      = useRef(null);
  const smoothSize   = useRef(null);
  const containerRef = useRef(null);
  const activeRef    = useRef(false);

  useModelViewer();

  const openScanner = () => {
    setCamError(''); setShowBuy(false);
    smoothX.current = null; smoothY.current = null; smoothSize.current = null;
    setScreen('scanner');
  };

  // ── MediaPipe result callback ──────────────────────────────────────────────
  const onResults = useCallback((results) => {
    if (!activeRef.current) return;
    const container = containerRef.current;
    if (!container) return;

    const cw = container.clientWidth;
    const ch = container.clientHeight;

    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      setTracking(false);
      return;
    }

    setTracking(true);

    const landmarks = results.multiHandLandmarks[0];
    const wrist    = landmarks[WRIST_IDX];
    const indexMCP = landmarks[INDEX_MCP_IDX];
    const pinkyMCP = landmarks[PINKY_MCP_IDX];

    const mirrorX = camMode === 'user';
    const rawX = (mirrorX ? 1 - wrist.x : wrist.x) * cw;
    const rawY = wrist.y * ch;

    // FIX 3: tighter multiplier 2.6 → 2.0, max size 300 → 200px
    const palmWidthNorm = Math.hypot(
      (mirrorX ? -(indexMCP.x - pinkyMCP.x) : (indexMCP.x - pinkyMCP.x)),
      indexMCP.y - pinkyMCP.y
    );
    const rawSize = Math.max(60, Math.min(200, palmWidthNorm * cw * 2.0));

    smoothX.current    = smooth(smoothX.current,    rawX,    ALPHA);
    smoothY.current    = smooth(smoothY.current,    rawY,    ALPHA);
    smoothSize.current = smooth(smoothSize.current, rawSize, ALPHA_SIZE);

    const sx = smoothX.current;
    const sy = smoothY.current;
    const sz = smoothSize.current;

    setWatchStyle({
      position     : 'absolute',
      left         : `${sx}px`,
      top          : `${sy}px`,
      width        : `${sz}px`,
      height       : `${sz}px`,
      // FIX 3: -80% vertical offset so watch sits above the wrist joint
      transform    : 'translate(-50%, -80%)',
      transition   : 'none',
      pointerEvents: 'none',
    });
  }, [camMode]);

  // ── FIX 1: Let MediaPipe Camera util own the stream entirely ──────────────
  // Do NOT call getUserMedia separately before this.
  // Passing constraints directly to Camera() prevents NotReadableError on Android.
  useEffect(() => {
    if (screen !== 'scanner') return;
    activeRef.current = true;

    (async () => {
      try {
        await loadMediaPipe();
        if (!activeRef.current) return;

        // eslint-disable-next-line no-undef
        const hands = new window.Hands({
          locateFile: (file) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
        });
        hands.setOptions({
          maxNumHands          : 1,
          modelComplexity      : 1,
          minDetectionConfidence: 0.65,
          minTrackingConfidence : 0.55,
        });
        hands.onResults(onResults);
        handsRef.current = hands;

        // FIX 1: Camera util acquires stream itself — no prior getUserMedia
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

        // Keep stream ref for cleanup
        if (videoRef.current && videoRef.current.srcObject) {
          streamRef.current = videoRef.current.srcObject;
        }

        buyTimer.current = setTimeout(() => {
          if (activeRef.current) setShowBuy(true);
        }, 5000);

      } catch (err) {
        if (activeRef.current) {
          setCamError(`Câmera indisponível: ${err && err.message ? err.message : err}`);
          setScreen('home');
        }
      }
    })();

    return () => {
      activeRef.current = false;
      clearTimeout(buyTimer.current);

      if (mpCameraRef.current) {
        mpCameraRef.current.stop();
        mpCameraRef.current = null;
      }
      if (handsRef.current) {
        handsRef.current.close();
        handsRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, camMode]);

  const closeScanner = () => {
    activeRef.current = false;
    clearTimeout(buyTimer.current);
    setShowBuy(false);
    setTracking(false);
    setScreen('home');
  };

  // ── HOME screen — UNCHANGED ────────────────────────────────────────────────
  if (screen === 'home') {
    return (
      <div className="home">
        <div className="home-tagline">
          <p>Try Before You Buy</p>
        </div>
        <div className="home-buttons">
          <div className="cam-selector">
            <button
              className={camMode === 'environment' ? 'cam-btn active' : 'cam-btn'}
              onClick={() => setCamMode('environment')}
            >
              📷 Câmera Traseira
            </button>
            <button
              className={camMode === 'user' ? 'cam-btn active' : 'cam-btn'}
              onClick={() => setCamMode('user')}
            >
              🤳 Câmera Frontal
            </button>
          </div>
          {camError && <p className="cam-error">{camError}</p>}
          <button className="scan-btn" onClick={openScanner}>
            INICIAR LEITOR DE RA
          </button>
        </div>
      </div>
    );
  }

  // ── SCANNER screen ─────────────────────────────────────────────────────────
  return (
    <div className="scanner" ref={containerRef}>
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

      {/* Watch — FIX 2: orientation corrected to 0deg, FIX 3: size/position via watchStyle */}
      <div className="watch-overlay" style={watchStyle}>
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

      {/* FIX 4: buttons at bottom of screen, outside watch-overlay */}
      {showBuy && (
        <div className="action-buttons-fixed">
          <button className="action-btn">Comprar agora</button>
          <button className="action-btn">Ver detalhes</button>
        </div>
      )}

      <div className="hud-top">
        <button className="back-btn" onClick={closeScanner}>← Voltar</button>
        <div className="ar-badge">
          <span className={`ar-dot${tracking ? ' ar-dot--tracking' : ''}`} />
          {tracking ? 'PULSO DETECTADO' : 'AR ATIVO'}
        </div>
      </div>

      {!tracking && (
        <div className="tracking-hint">
          Mostre seu pulso para a câmera
        </div>
      )}
    </div>
  );
}

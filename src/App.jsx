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
// α ∈ (0,1]: closer to 1 = more reactive, closer to 0 = smoother
const ALPHA      = 0.18;   // position smoothing
const ALPHA_SIZE = 0.12;   // size smoothing

function smooth(prev, next, alpha) {
  if (prev === null) return next;
  return prev + alpha * (next - prev);
}

// ─── Wrist landmark index in MediaPipe Hands ─────────────────────────────────
// 0 = WRIST, 5 = INDEX_FINGER_MCP  → used to estimate wrist width / watch size
const WRIST_IDX     = 0;
const INDEX_MCP_IDX = 5;
const PINKY_MCP_IDX = 17;

// ─── Main component ──────────────────────────────────────────────────────────
export default function App() {
  const [screen,   setScreen]   = useState('home');
  const [camMode,  setCamMode]  = useState('environment');
  const [camError, setCamError] = useState('');
  const [showBuy,  setShowBuy]  = useState(false);
  const [tracking, setTracking] = useState(false); // true when hand found

  // Watch overlay position state (in px / px)
  const [watchStyle, setWatchStyle] = useState({
    left: '50%', top: '50%',
    width: '180px', height: '180px',
    transform: 'translate(-50%, -50%)',
    transition: 'none',
  });

  const videoRef      = useRef(null);
  const canvasRef     = useRef(null); // hidden canvas fed to MediaPipe
  const streamRef     = useRef(null);
  const handsRef      = useRef(null);
  const mpCameraRef   = useRef(null);
  const buyTimer      = useRef(null);
  const smoothX       = useRef(null);
  const smoothY       = useRef(null);
  const smoothSize    = useRef(null);
  const containerRef  = useRef(null);
  const activeRef     = useRef(false); // gate to avoid state updates after unmount

  useModelViewer();

  // ── Open scanner ──────────────────────────────────────────────────────────
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

    // Use the first detected hand
    const landmarks = results.multiHandLandmarks[0];
    const wrist     = landmarks[WRIST_IDX];
    const indexMCP  = landmarks[INDEX_MCP_IDX];
    const pinkyMCP  = landmarks[PINKY_MCP_IDX];

    // MediaPipe gives normalized [0,1] coords; mirror X for front camera
    const mirrorX = camMode === 'user';

    const rawX = (mirrorX ? 1 - wrist.x : wrist.x) * cw;
    const rawY = wrist.y * ch;

    // Size: distance between index-MCP and pinky-MCP (palm width) → watch size
    const palmWidthNorm = Math.hypot(
      (mirrorX ? -(indexMCP.x - pinkyMCP.x) : (indexMCP.x - pinkyMCP.x)),
      indexMCP.y - pinkyMCP.y
    );
    const rawSize = Math.max(60, Math.min(300, palmWidthNorm * cw * 2.6));

    // Exponential smoothing
    smoothX.current    = smooth(smoothX.current,    rawX,     ALPHA);
    smoothY.current    = smooth(smoothY.current,    rawY,     ALPHA);
    smoothSize.current = smooth(smoothSize.current, rawSize,  ALPHA_SIZE);

    const sx = smoothX.current;
    const sy = smoothY.current;
    const sz = smoothSize.current;

    setWatchStyle({
      position : 'absolute',
      left     : `${sx}px`,
      top      : `${sy}px`,
      width    : `${sz}px`,
      height   : `${sz}px`,
      transform: 'translate(-50%, -60%)',  // offset so watch sits on wrist
      transition: 'none',
      pointerEvents: 'none',
    });
  }, [camMode]);

  // ── Start camera + MediaPipe when screen === 'scanner' ────────────────────
  useEffect(() => {
    if (screen !== 'scanner') return;
    activeRef.current = true;
    let mpCam = null;

    (async () => {
      try {
        // 1. Get camera stream
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: camMode, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (!activeRef.current) { stream.getTracks().forEach(t => t.stop()); return; }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        // 2. Load MediaPipe scripts
        await loadMediaPipe();
        if (!activeRef.current) return;

        // 3. Create Hands instance
        // eslint-disable-next-line no-undef
        const hands = new window.Hands({
          locateFile: (file) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
        });
        hands.setOptions({
          maxNumHands      : 1,
          modelComplexity  : 1,
          minDetectionConfidence: 0.7,
          minTrackingConfidence : 0.6,
        });
        hands.onResults(onResults);
        handsRef.current = hands;

        // 4. Use MediaPipe Camera util to feed frames
        // eslint-disable-next-line no-undef
        mpCam = new window.Camera(videoRef.current, {
          onFrame: async () => {
            if (handsRef.current && videoRef.current) {
              await handsRef.current.send({ image: videoRef.current });
            }
          },
          width : 1280,
          height: 720,
        });
        mpCam.start();
        mpCameraRef.current = mpCam;

        // 5. Buy button timer
        buyTimer.current = setTimeout(() => {
          if (activeRef.current) setShowBuy(true);
        }, 5000);

      } catch {
        if (activeRef.current) {
          setCamError('Câmera indisponível.');
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

  // ── HOME screen ────────────────────────────────────────────────────────────
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
      {/* Live camera feed */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="video-feed"
        style={camMode === 'user' ? { transform: 'scaleX(-1)' } : {}}
      />

      {/* Scanning animation overlay */}
      <div className="scan-line-overlay">
        <div className="scan-line-bar" />
      </div>

      {/* Corner brackets */}
      <div className="scan-corners">
        <div className="sc tl" /><div className="sc tr" />
        <div className="sc bl" /><div className="sc br" />
      </div>

      {/* ── Watch overlay — anchored to wrist via MediaPipe ── */}
      <div className="watch-overlay" style={watchStyle}>
        <model-viewer
          src="/relogio.glb"
          camera-controls
          auto-rotate
          shadow-intensity="1"
          exposure="1.1"
          interaction-prompt="none"
          orientation="0deg 0deg 90deg"
          camera-orbit="0deg 75deg 0.18m"
          min-camera-orbit="auto auto 0.12m"
          max-camera-orbit="auto auto 0.28m"
          field-of-view="28deg"
          style={{ width: '100%', height: '100%', background: 'transparent' }}
        />
        {showBuy && (
          <div className="action-buttons">
            <button className="action-btn">Buy Now</button>
            <button className="action-btn">View Details</button>
          </div>
        )}
      </div>

      {/* HUD — top bar */}
      <div className="hud-top">
        <button className="back-btn" onClick={closeScanner}>← Back</button>
        <div className="ar-badge">
          <span className={`ar-dot${tracking ? ' ar-dot--tracking' : ''}`} />
          {tracking ? 'WRIST LOCKED' : 'AR ACTIVE'}
        </div>
      </div>

      {/* Tracking hint */}
      {!tracking && (
        <div className="tracking-hint">
          Show your wrist to the camera
        </div>
      )}
    </div>
  );
}

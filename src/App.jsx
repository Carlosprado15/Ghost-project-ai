import { useState, useRef, useEffect, useCallback } from 'react';
import './App.css';

// ─── CDN loaders ──────────────────────────────────────────────────────────────
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
function useModelViewer() {
  useEffect(() => {
    if (document.querySelector('script[data-mv]')) return;
    const s = document.createElement('script');
    s.type = 'module'; s.setAttribute('data-mv', '1');
    s.src = 'https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js';
    document.head.appendChild(s);
  }, []);
}

// ─── Lerp ─────────────────────────────────────────────────────────────────────
// FIX 3 ▸ lerp on EVERY value (position x/y, size, and rotation angle)
//   LERP_POS  : 0.20 → smooth but responsive on mobile (~60 fps)
//   LERP_SIZE : 0.12 → size changes slower than position to avoid pulsing
//   LERP_ROT  : 0.15 → rotation angle tracks wrist angle gradually
const LERP_POS  = 0.20;
const LERP_SIZE = 0.12;
const LERP_ROT  = 0.15;

function lerp(prev, next, factor) {
  if (prev === null) return next;
  return prev + (next - prev) * factor;
}

// ─────────────────────────────────────────────────────────────────────────────
// FIX 1 ▸ COORDINATE MAPPING
//
// MediaPipe outputs landmarks normalized [0..1] relative to the INPUT IMAGE
// dimensions (1280 × 720 in our case). The <video> element is displayed
// object-fit:cover inside a full-viewport div, so the rendered pixels do NOT
// match 1:1 with normalized coords × viewport size.
//
// Steps:
//   a) Compute the cover-scale: scale = max(renderedW/intrinsicW, renderedH/intrinsicH)
//   b) Compute pillarbox/letterbox offsets (can be negative = clipped side)
//   c) Map:  screenX = normX × intrinsicW × scale + offsetX + rect.left
//   d) For front camera (user) mirror X:
//             screenX = rect.right − (normX × intrinsicW × scale + offsetX)
// ─────────────────────────────────────────────────────────────────────────────
function landmarkToViewport(norm, videoEl, mirrorX) {
  const iW = videoEl.videoWidth  || 1280;
  const iH = videoEl.videoHeight || 720;
  const r  = videoEl.getBoundingClientRect();

  // object-fit:cover → scale by the LARGER ratio so both axes are covered
  const scale = Math.max(r.width / iW, r.height / iH);

  const dW = iW * scale;  // displayed (possibly clipped) width in CSS px
  const dH = iH * scale;
  const ox = (r.width  - dW) / 2;   // negative when clipped horizontally
  const oy = (r.height - dH) / 2;

  let x = norm.x * dW + ox + r.left;
  const y = norm.y * dH + oy + r.top;

  if (mirrorX) {
    // mirror relative to the rendered video rect
    x = r.right - (norm.x * dW + ox);
  }

  return { x, y };
}

// ─────────────────────────────────────────────────────────────────────────────
// FIX 2 ▸ WATCH ROTATION from wrist orientation
//
// MediaPipe Hands gives us:
//   landmark[0]  = WRIST
//   landmark[5]  = INDEX_FINGER_MCP  (base of index)
//   landmark[9]  = MIDDLE_FINGER_MCP (base of middle)
//
// We project all three onto the screen plane and compute the angle of the
// wrist-to-knuckle vector, then apply that as a CSS rotation on the overlay.
// This makes the watch face follow the natural wrist rotation.
//
// Fallback: if calculation is degenerate (hand too small / side-on), the last
// known good angle is held via lerp so there's no sudden snap.
// ─────────────────────────────────────────────────────────────────────────────
function wristRotationDeg(landmarks, videoEl, mirrorX) {
  const wrist  = landmarkToViewport(landmarks[0], videoEl, mirrorX);
  const idx    = landmarkToViewport(landmarks[5], videoEl, mirrorX);
  const mid    = landmarkToViewport(landmarks[9], videoEl, mirrorX);

  // midpoint between index-MCP and middle-MCP → stable palm axis point
  const palmMidX = (idx.x + mid.x) / 2;
  const palmMidY = (idx.y + mid.y) / 2;

  const dx = palmMidX - wrist.x;
  const dy = palmMidY - wrist.y;

  // atan2 gives angle in radians; convert to degrees
  // subtract 90° so that a hand pointing straight up gives 0° rotation
  return Math.atan2(dy, dx) * (180 / Math.PI) - 90;
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function App() {
  const [screen,   setScreen]   = useState('home');
  const [camMode,  setCamMode]  = useState('environment');
  const [camError, setCamError] = useState('');
  const [showBuy,  setShowBuy]  = useState(false);
  const [tracking, setTracking] = useState(false);

  // All watch transform values stored as a single object so one setState
  // triggers one render per frame — avoids tearing between x/y/size/rot
  const [watch, setWatch] = useState({ x: 0, y: 0, size: 140, rot: 0 });

  const videoRef    = useRef(null);
  const streamRef   = useRef(null);
  const handsRef    = useRef(null);
  const cameraRef   = useRef(null);
  const buyTimer    = useRef(null);
  const activeRef   = useRef(false);
  const rafRef      = useRef(null);

  // Smoothed values kept in refs (not state) to avoid re-render on every frame
  const smX   = useRef(null);
  const smY   = useRef(null);
  const smSz  = useRef(null);
  const smRot = useRef(null);

  useModelViewer();

  const openScanner = () => {
    setCamError(''); setShowBuy(false); setTracking(false);
    smX.current = smY.current = smSz.current = smRot.current = null;
    setScreen('scanner');
  };

  // ── MediaPipe callback ────────────────────────────────────────────────────
  const onHandsResults = useCallback((results) => {
    if (!activeRef.current || !videoRef.current) return;

    if (!results.multiHandLandmarks?.length) {
      setTracking(false);
      return;
    }

    const lm     = results.multiHandLandmarks[0];
    const mirror = camMode === 'user';
    const vid    = videoRef.current;

    // FIX 1 ▸ correct coordinate mapping (see function above)
    const wristPx = landmarkToViewport(lm[0], vid, mirror);
    const idxPx   = landmarkToViewport(lm[5], vid, mirror);
    const pinkyPx = landmarkToViewport(lm[17], vid, mirror);

    // Palm width in screen px → watch diameter
    // Multiplier 1.85 gives a natural wrist-sized watch
    const palmPx = Math.hypot(idxPx.x - pinkyPx.x, idxPx.y - pinkyPx.y);
    const rawSz  = Math.max(90, Math.min(220, palmPx * 1.85));

    // FIX 2 ▸ wrist rotation angle (see function above)
    const rawRot = wristRotationDeg(lm, vid, mirror);

    // FIX 3 ▸ lerp all values independently
    smX.current   = lerp(smX.current,   wristPx.x, LERP_POS);
    smY.current   = lerp(smY.current,   wristPx.y, LERP_POS);
    smSz.current  = lerp(smSz.current,  rawSz,     LERP_SIZE);
    smRot.current = lerp(smRot.current, rawRot,    LERP_ROT);

    setTracking(true);

    // Batch DOM update via rAF — runs once per frame, not per MediaPipe result
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      setWatch({
        x:    smX.current,
        y:    smY.current,
        size: smSz.current,
        rot:  smRot.current,
      });
    });
  }, [camMode]);

  // ── Camera + MediaPipe start ──────────────────────────────────────────────
  useEffect(() => {
    if (screen !== 'scanner') return;
    activeRef.current = true;

    (async () => {
      try {
        await loadMediaPipe();
        if (!activeRef.current) return;

        const hands = new window.Hands({
          locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`,
        });
        hands.setOptions({
          maxNumHands           : 1,
          modelComplexity       : 1,
          minDetectionConfidence: 0.55,
          minTrackingConfidence : 0.50,
        });
        hands.onResults(onHandsResults);
        handsRef.current = hands;

        // Let Camera util own the stream — prevents NotReadableError on Android
        const camera = new window.Camera(videoRef.current, {
          onFrame: async () => {
            if (handsRef.current && videoRef.current) {
              await handsRef.current.send({ image: videoRef.current });
            }
          },
          facingMode: camMode,
          width : 1280,
          height: 720,
        });
        await camera.start();
        cameraRef.current = camera;

        if (videoRef.current?.srcObject) {
          streamRef.current = videoRef.current.srcObject;
        }

        buyTimer.current = setTimeout(() => {
          if (activeRef.current) setShowBuy(true);
        }, 3000);

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
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      cameraRef.current?.stop();  cameraRef.current = null;
      handsRef.current?.close();  handsRef.current = null;
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [screen, camMode, onHandsResults]);

  const closeScanner = () => {
    activeRef.current = false;
    clearTimeout(buyTimer.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setShowBuy(false); setTracking(false);
    setScreen('home');
  };

  // ── HOME ──────────────────────────────────────────────────────────────────
  if (screen === 'home') {
    return (
      <div className="home">
        <div className="home-background" style={{ backgroundImage: 'url("/logo.jpeg")' }} />
        <div className="home-content">
          <div className="home-tagline"><p>Try Before You Buy</p></div>
          <div className="home-buttons">
            <div className="cam-selector">
              <button
                className={camMode === 'environment' ? 'cam-btn active' : 'cam-btn'}
                onClick={() => setCamMode('environment')}
              >Câmera Traseira</button>
              <button
                className={camMode === 'user' ? 'cam-btn active' : 'cam-btn'}
                onClick={() => setCamMode('user')}
              >Câmera Frontal</button>
            </div>
            {camError && <p className="cam-error">{camError}</p>}
            <button className="scan-btn" onClick={openScanner}>START AR SCANNER</button>
          </div>
        </div>
      </div>
    );
  }

  // ── SCANNER ───────────────────────────────────────────────────────────────
  //
  // Watch style uses position:fixed + viewport coords from getBoundingClientRect.
  // transform combines:
  //   translate(-50%, -80%) → center horizontally, place above wrist joint
  //   rotate(Xdeg)          → FIX 2: align to wrist angle
  // opacity 0 until first detection → no ghost render in corner
  //
  const watchStyle = {
    position : 'fixed',
    left     : watch.x,
    top      : watch.y,
    width    : watch.size,
    height   : watch.size,
    transform: `translate(-50%, -80%) rotate(${watch.rot}deg)`,
    pointerEvents: 'none',
    zIndex   : 15,
    opacity  : tracking ? 1 : 0,
    transition: 'opacity 0.2s ease',
    filter   : 'drop-shadow(0 10px 30px rgba(0,0,0,0.5))',
  };

  return (
    <div className="scanner">
      <video
        ref={videoRef}
        autoPlay playsInline muted
        className="video-feed"
        style={camMode === 'user' ? { transform: 'scaleX(-1)' } : {}}
      />

      <div className="scan-overlay">
        <div className="scan-line-bar" />
        <div className="scan-corners">
          <div className="corner tl" />
          <div className="corner tr" />
          <div className="corner bl" />
          <div className="corner br" />
        </div>
      </div>

      {/* Watch — position:fixed, viewport coords, opacity gated on tracking */}
      <div className="watch-container" style={watchStyle}>
        <model-viewer
          src="/relogio.glb"
          camera-controls
          disable-zoom
          auto-rotate
          shadow-intensity="1"
          exposure="1.2"
          interaction-prompt="none"
          camera-orbit="0deg 75deg 0.16m"
          min-camera-orbit="auto auto 0.10m"
          max-camera-orbit="auto auto 0.24m"
          field-of-view="30deg"
          style={{ width: '100%', height: '100%', background: 'transparent' }}
        />
      </div>

      <div className="hud-top">
        <button className="back-btn" onClick={closeScanner}>← Voltar</button>
        <div className="ar-badge">
          <span className={`ar-dot ${tracking ? 'active' : ''}`} />
          AR ATIVO
        </div>
      </div>

      {!tracking && (
        <div className="tracking-hint">
          <p>APONTE PARA O SEU PULSO</p>
        </div>
      )}

      <div className="action-container">
        {showBuy && (
          <div className="action-buttons">
            <button className="action-btn primary">Comprar Agora</button>
            <button className="action-btn secondary">Ver Detalhes</button>
          </div>
        )}
      </div>
    </div>
  );
}

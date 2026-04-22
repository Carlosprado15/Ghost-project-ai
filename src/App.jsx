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
    s.type = 'module';
    s.setAttribute('data-mv', '1');
    s.src = 'https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js';
    document.head.appendChild(s);
  }, []);
}

// ─── High-performance LERP smoothing ──────────────────────────────────────────
const LERP_POS = 0.55;
const LERP_SIZE = 0.45;

function lerp(prev, next, factor) {
  if (prev === null) return next;
  return prev + (next - prev) * factor;
}

// ─── MediaPipe landmark indices ───────────────────────────────────────────────
const WRIST_IDX = 0;
const INDEX_MCP_IDX = 5;
const PINKY_MCP_IDX = 17;

// ─── Precision coordinate mapping ─────────────────────────────────────────────
function landmarkToScreen(normX, normY, videoEl, mirrorX) {
  const intrW = videoEl.videoWidth || 1280;
  const intrH = videoEl.videoHeight || 720;
  
  const rect = videoEl.getBoundingClientRect();
  const rendW = rect.width;
  const rendH = rect.height;
  
  const scaleX = rendW / intrW;
  const scaleY = rendH / intrH;
  const scale = Math.max(scaleX, scaleY);
  
  const displayW = intrW * scale;
  const displayH = intrH * scale;
  const offsetX = (rendW - displayW) / 2;
  const offsetY = (rendH - displayH) / 2;
  
  let screenX = normX * displayW + offsetX + rect.left;
  const screenY = normY * displayH + offsetY + rect.top;
  
  if (mirrorX) {
    screenX = rect.right - (normX * displayW + offsetX);
  }
  
  return { x: screenX, y: screenY };
}

function palmSizePx(lmA, lmB, videoEl, mirrorX) {
  const a = landmarkToScreen(lmA.x, lmA.y, videoEl, mirrorX);
  const b = landmarkToScreen(lmB.x, lmB.y, videoEl, mirrorX);
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState('home');
  const [camMode, setCamMode] = useState('environment');
  const [camError, setCamError] = useState('');
  const [showBuy, setShowBuy] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [watchPos, setWatchPos] = useState({ x: 0, y: 0, size: 150 });
  
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const handsRef = useRef(null);
  const mpCameraRef = useRef(null);
  const buyTimer = useRef(null);
  const smoothX = useRef(null);
  const smoothY = useRef(null);
  const smoothSize = useRef(null);
  const activeRef = useRef(false);
  const rafId = useRef(null);
  
  useModelViewer();
  
  const openScanner = () => {
    setCamError('');
    setShowBuy(false);
    smoothX.current = null;
    smoothY.current = null;
    smoothSize.current = null;
    setTracking(false);
    setScreen('scanner');
  };
  
  // ─── MediaPipe results callback ─────────────────────────────────────────────
  const onResults = useCallback((results) => {
    if (!activeRef.current) return;
    const vid = videoRef.current;
    if (!vid) return;
    
    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      setTracking(false);
      return;
    }
    
    const landmarks = results.multiHandLandmarks[0];
    const wrist = landmarks[WRIST_IDX];
    const indexMCP = landmarks[INDEX_MCP_IDX];
    const pinkyMCP = landmarks[PINKY_MCP_IDX];
    
    const mirrorX = camMode === 'user';
    
    const { x: rawX, y: rawY } = landmarkToScreen(wrist.x, wrist.y, vid, mirrorX);
    const palmPx = palmSizePx(indexMCP, pinkyMCP, vid, mirrorX);
    const rawSize = Math.max(100, Math.min(180, palmPx * 1.35));
    
    smoothX.current = lerp(smoothX.current, rawX, LERP_POS);
    smoothY.current = lerp(smoothY.current, rawY, LERP_POS);
    smoothSize.current = lerp(smoothSize.current, rawSize, LERP_SIZE);
    
    setTracking(true);
    
    if (rafId.current) cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(() => {
      setWatchPos({
        x: smoothX.current,
        y: smoothY.current,
        size: smoothSize.current,
      });
    });
  }, [camMode]);
  
  // ─── Camera + MediaPipe startup ─────────────────────────────────────────────
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
          maxNumHands: 1,
          modelComplexity: 1,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
        hands.onResults(onResults);
        handsRef.current = hands;
        
        // eslint-disable-next-line no-undef
        const mpCam = new window.Camera(videoRef.current, {
          onFrame: async () => {
            if (handsRef.current && videoRef.current) {
              await handsRef.current.send({ image: videoRef.current });
            }
          },
          facingMode: camMode,
          width: 1280,
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
      if (rafId.current) cancelAnimationFrame(rafId.current);
      mpCameraRef.current?.stop();
      mpCameraRef.current = null;
      handsRef.current?.close();
      handsRef.current = null;
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [screen, camMode, onResults]);
  
  const closeScanner = () => {
    activeRef.current = false;
    clearTimeout(buyTimer.current);
    if (rafId.current) cancelAnimationFrame(rafId.current);
    setShowBuy(false);
    setTracking(false);
    setScreen('home');
  };
  
  // ─── HOME Screen - Luxury Splash ────────────────────────────────────────────
  if (screen === 'home') {
    return (
      <div className="home">
        <div className="home-overlay" />
        <div className="home-content">
          <div className="luxury-logo">GHOST</div>
          <div className="home-tagline">
            <p>Try Before You Buy</p>
          </div>
          <div className="home-buttons">
            <div className="cam-selector">
              <button
                className={camMode === 'environment' ? 'cam-btn active' : 'cam-btn'}
                onClick={() => setCamMode('environment')}
              >
                📷 Rear Camera
              </button>
              <button
                className={camMode === 'user' ? 'cam-btn active' : 'cam-btn'}
                onClick={() => setCamMode('user')}
              >
                🤳 Front Camera
              </button>
            </div>
            {camError && <p className="cam-error">{camError}</p>}
            <button className="scan-btn" onClick={openScanner}>
              INITIATE AR SCANNER
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  // ─── SCANNER Screen - Full AR Experience ────────────────────────────────────
  const watchStyle = {
    position: 'fixed',
    left: `${watchPos.x}px`,
    top: `${watchPos.y}px`,
    width: `${watchPos.size}px`,
    height: `${watchPos.size}px`,
    transform: 'translate(-50%, -85%)',
    transition: 'none',
    pointerEvents: 'none',
    zIndex: 10,
    opacity: tracking ? 1 : 0,
    willChange: 'left, top, width, height, opacity',
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
      
      {/* Luxury AR UI Overlays */}
      <div className="scan-overlay">
        <div className="scan-line-overlay">
          <div className="scan-line-bar" />
        </div>
        
        <div className="scan-corners">
          <div className="sc tl" />
          <div className="sc tr" />
          <div className="sc bl" />
          <div className="sc br" />
        </div>
      </div>
      
      {/* 3D Watch - Tracks wrist precisely */}
      <div style={watchStyle}>
        <model-viewer
          src="/relogio.glb"
          camera-controls
          auto-rotate
          shadow-intensity="1"
          exposure="1.2"
          interaction-prompt="none"
          orientation="0deg 0deg 0deg"
          camera-orbit="0deg 75deg 0.18m"
          min-camera-orbit="auto auto 0.12m"
          max-camera-orbit="auto auto 0.28m"
          field-of-view="28deg"
          style={{ width: '100%', height: '100%', background: 'transparent' }}
        />
      </div>
      
      {/* HUD Top */}
      <div className="hud-top">
        <button className="back-btn" onClick={closeScanner}>← Back</button>
        <div className="ar-badge">
          <span className={`ar-dot${tracking ? ' ar-dot--tracking' : ''}`} />
          {tracking ? 'WRIST DETECTED' : 'AR ACTIVE'}
        </div>
      </div>
      
      {/* Bottom UI - Elegant Action Buttons */}
      <div className="bottom-ui">
        {!tracking && (
          <div className="tracking-hint">
            Show your wrist to the camera
          </div>
        )}
        {showBuy && (
          <div className="action-buttons-row">
            <button className="action-btn primary">Buy Now</button>
            <button className="action-btn secondary">View Details</button>
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useRef, useEffect, useCallback } from 'react';
import './App.css';

// ─── Script Loaders ──────────────────────────────────────────────────────────
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
    s.type = 'module';
    s.setAttribute('data-mv', '1');
    s.src = 'https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js';
    document.head.appendChild(s);
  }, []);
}

// ─── LERP para movimento suave ───────────────────────────────────────────────
const LERP_FACTOR = 0.5;

function lerp(prev, next, factor) {
  if (prev === null) return next;
  return prev + (next - prev) * factor;
}

// ─── Mapeamento de coordenadas do MediaPipe para tela ────────────────────────
function mapWristToScreen(landmark, videoElement) {
  const videoWidth = videoElement.videoWidth || 1280;
  const videoHeight = videoElement.videoHeight || 720;
  const rect = videoElement.getBoundingClientRect();
  
  const scale = Math.max(rect.width / videoWidth, rect.height / videoHeight);
  const displayWidth = videoWidth * scale;
  const displayHeight = videoHeight * scale;
  const offsetX = (rect.width - displayWidth) / 2;
  const offsetY = (rect.height - displayHeight) / 2;
  
  const screenX = landmark.x * displayWidth + offsetX + rect.left;
  const screenY = landmark.y * displayHeight + offsetY + rect.top;
  
  return { x: screenX, y: screenY };
}

// ─── Componente Principal ─────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState('home');
  const [camMode, setCamMode] = useState('environment');
  const [camError, setCamError] = useState('');
  const [showBuy, setShowBuy] = useState(false);
  const [watchPosition, setWatchPosition] = useState({ x: 0, y: 0, size: 140 });
  
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const handsRef = useRef(null);
  const cameraRef = useRef(null);
  const buyTimer = useRef(null);
  const activeRef = useRef(false);
  const smoothX = useRef(null);
  const smoothY = useRef(null);
  const rafRef = useRef(null);
  
  useModelViewer();
  
  const openScanner = () => {
    setCamError('');
    setShowBuy(false);
    smoothX.current = null;
    smoothY.current = null;
    setScreen('scanner');
  };
  
  // ─── Callback do MediaPipe - Processa landmarks da mão ─────────────────────
  const onHandsResults = useCallback((results) => {
    if (!activeRef.current || !videoRef.current) return;
    
    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      return;
    }
    
    const landmarks = results.multiHandLandmarks[0];
    const wrist = landmarks[0];
    
    const screenPos = mapWristToScreen(wrist, videoRef.current);
    
    smoothX.current = lerp(smoothX.current, screenPos.x, LERP_FACTOR);
    smoothY.current = lerp(smoothY.current, screenPos.y, LERP_FACTOR);
    
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      setWatchPosition({
        x: smoothX.current,
        y: smoothY.current,
        size: 140
      });
    });
  }, []);
  
  // ─── Inicialização da Câmera e MediaPipe ───────────────────────────────────
  useEffect(() => {
    if (screen !== 'scanner') return;
    activeRef.current = true;
    
    (async () => {
      try {
        await loadMediaPipe();
        if (!activeRef.current) return;
        
        const hands = new window.Hands({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        });
        
        hands.setOptions({
          maxNumHands: 1,
          modelComplexity: 1,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });
        
        hands.onResults(onHandsResults);
        handsRef.current = hands;
        
        const camera = new window.Camera(videoRef.current, {
          onFrame: async () => {
            if (handsRef.current && videoRef.current) {
              await handsRef.current.send({ image: videoRef.current });
            }
          },
          facingMode: camMode,
          width: 1280,
          height: 720
        });
        
        await camera.start();
        cameraRef.current = camera;
        
        if (videoRef.current?.srcObject) {
          streamRef.current = videoRef.current.srcObject;
        }
        
        buyTimer.current = setTimeout(() => {
          if (activeRef.current) setShowBuy(true);
        }, 5000);
        
      } catch (err) {
        if (activeRef.current) {
          setCamError('Câmera indisponível.');
          setScreen('home');
        }
      }
    })();
    
    return () => {
      activeRef.current = false;
      clearTimeout(buyTimer.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (cameraRef.current) cameraRef.current.stop();
      if (handsRef.current) handsRef.current.close();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [screen, camMode, onHandsResults]);
  
  const closeScanner = () => {
    clearTimeout(buyTimer.current);
    setShowBuy(false);
    setScreen('home');
  };
  
  // ─── Tela HOME ──────────────────────────────────────────────────────────────
  if (screen === 'home') {
    return (
      <div className="home">
        <div className="home-background" style={{ backgroundImage: 'url("/logo.jpeg")' }} />
        <div className="home-content">
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
      </div>
    );
  }
  
  // ─── Tela SCANNER ───────────────────────────────────────────────────────────
  const watchStyle = {
    position: 'fixed',
    left: watchPosition.x,
    top: watchPosition.y,
    width: watchPosition.size,
    height: watchPosition.size,
    transform: 'translate(-50%, -70%)',
    pointerEvents: 'none',
    zIndex: 20
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
        <div className="sc tl" />
        <div className="sc tr" />
        <div className="sc bl" />
        <div className="sc br" />
      </div>
      
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
      </div>
      
      {showBuy && (
        <div className="action-buttons">
          <button className="action-btn">Buy Now</button>
          <button className="action-btn">View Details</button>
        </div>
      )}
      
      <div className="hud-top">
        <button className="back-btn" onClick={closeScanner}>← Back</button>
        <div className="ar-badge">
          <span className="ar-dot" />
          AR ACTIVE
        </div>
      </div>
    </div>
  );
}

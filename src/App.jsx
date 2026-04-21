import { useState, useRef, useEffect } from 'react';
import './App.css';

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

export default function App() {
  const [screen, setScreen]     = useState('home');
  const [camMode, setCamMode]   = useState('environment');
  const [camError, setCamError] = useState('');
  const [showBuy, setShowBuy]   = useState(false);
  const videoRef  = useRef(null);
  const streamRef = useRef(null);
  const buyTimer  = useRef(null);

  useModelViewer();

  const openScanner = async () => {
    setCamError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: camMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      setShowBuy(false);
      setScreen('scanner');
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });
      buyTimer.current = setTimeout(() => setShowBuy(true), 5000);
    } catch {
      setCamError('Câmera indisponível. Verifique as permissões.');
    }
  };

  const closeScanner = () => {
    clearTimeout(buyTimer.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setShowBuy(false);
    setScreen('home');
  };

  if (screen === 'home') {
    return (
      <div className="home">
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
            START AR SCANNER
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="scanner">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="video-feed"
      />

      <div className="watch-overlay">
        {/* @ts-ignore */}
        <model-viewer
          src="/relogio.glb"
          camera-controls
          auto-rotate
          shadow-intensity="1"
          exposure="1.1"
          style={{ width: '100%', height: '100%', background: 'transparent' }}
        />
        {showBuy && (
          <button className="buy-btn">
            View Details
          </button>
        )}
      </div>

      <div className="hud-top">
        <button className="back-btn" onClick={closeScanner}>← Voltar</button>
        <div className="ar-badge">
          <span className="ar-dot" />
          AR ATIVO
        </div>
      </div>
    </div>
  );
}

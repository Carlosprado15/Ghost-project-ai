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

  const openScanner = () => {
    setCamError('');
    setShowBuy(false);
    setScreen('scanner');
  };

  useEffect(() => {
    if (screen !== 'scanner') return;

    let active = true;

    navigator.mediaDevices.getUserMedia({
      video: { facingMode: camMode, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    }).then(stream => {
      if (!active) { stream.getTracks().forEach(t => t.stop()); return; }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      buyTimer.current = setTimeout(() => { if (active) setShowBuy(true); }, 5000);
    }).catch(() => {
      if (active) {
        setCamError('Câmera indisponível.');
        setScreen('home');
      }
    });

    return () => {
      active = false;
      clearTimeout(buyTimer.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [screen, camMode]);

  const closeScanner = () => {
    clearTimeout(buyTimer.current);
    setShowBuy(false);
    setScreen('home');
  };

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

  return (
    <div className="scanner">
      <video ref={videoRef} autoPlay playsInline muted className="video-feed" />

      <div className="scan-line-overlay">
        <div className="scan-line-bar" />
      </div>

      <div className="scan-corners">
        <div className="sc tl" />
        <div className="sc tr" />
        <div className="sc bl" />
        <div className="sc br" />
      </div>

      <div className="watch-overlay">
        <model-viewer
          src="/relogio.glb"
          camera-controls
          auto-rotate
          shadow-intensity="1"
          exposure="1.1"
          interaction-prompt="none"
          style={{ width: '100%', height: '100%', background: 'transparent' }}
        />
        {showBuy && (
          <div className="action-buttons">
            <button className="action-btn">Buy Now</button>
            <button className="action-btn">View Details</button>
          </div>
        )}
      </div>

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

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
  const [screen, setScreen]   = useState('home');
  const [camMode, setCamMode] = useState('environment');
  const [camError, setCamError] = useState('');
  const videoRef  = useRef(null);
  const streamRef = useRef(null);

  useModelViewer();

  const openScanner = async () => {
    setCamError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: camMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      setScreen('scanner');
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });
    } catch {
      setCamError('Câmera indisponível. Verifique as permissões.');
    }
  };

  const closeScanner = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setScreen('home');
  };

  /* ── TELA INICIAL ─────────────────────────────────────────── */
  if (screen === 'home') {
    return (
      <div className="home">
        {/* logo.jpeg cobre 100% da tela como fundo */}

        {/* Botões posicionados na base, sobre a imagem */}
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
            INICIAR SCANNER AR
          </button>
        </div>
      </div>
    );
  }

  /* ── TELA DO SCANNER ──────────────────────────────────────── */
  return (
    <div className="scanner">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="video-feed"
      />

      {/* Relógio 3D sobre a câmera */}
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
      </div>

      {/* HUD topo */}
      <div className="hud-top">
        <button className="back-btn" onClick={closeScanner}>← Voltar</button>
        <div className="ar-badge">
          <span className="ar-dot" />
          AR ATIVO
        </div>
      </div>

      {/* Frame de mira */}
      <div className="scan-frame">
        <div className="corner tl" />
        <div className="corner tr" />
        <div className="corner bl" />
        <div className="corner br" />
        <div className="scan-line" />
      </div>

      {/* HUD base */}
      <div className="hud-bottom">
        <p className="hud-hint">Aponte para o seu pulso</p>
        <span className="hud-brand">Ghost Project AI</span>
      </div>
    </div>
  );
}

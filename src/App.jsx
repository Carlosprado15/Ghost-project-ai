import { useState, useRef, useEffect } from 'react';
import './App.css';

/* Registrar o custom element model-viewer via CDN */
/* O script é injetado uma vez no <head> */
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
  const [screen, setScreen]   = useState('home');   // 'home' | 'camera'
  const [camMode, setCamMode] = useState('environment');
  const [error, setError]     = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useModelViewer();

  /* Iniciar câmera */
  const startCamera = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: camMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      setScreen('camera');
      /* Aguarda o DOM montar o <video> antes de atribuir */
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      }, 100);
    } catch (err) {
      setError('Acesso à câmera negado. Habilite nas configurações do navegador.');
    }
  };

  /* Parar câmera ao sair */
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setScreen('home');
  };

  /* ── TELA INICIAL ─────────────────────────────────────────────── */
  if (screen === 'home') {
    return (
      <div className="home">
      

        <main className="home-main">
          <div className="text-block">
            <h1>GHOST PROJECT AI</h1>
            <p>Tecnologia de Provador Virtual de Alta Precisão</p>
          </div>

          {/* Visualizador 3D do relógio */}
          <div className="viewer-wrap">
            <model-viewer
              src="/relogio.glb"
              ar
              camera-controls
              auto-rotate
              shadow-intensity="1"
              exposure="1"
              style={{ width: '100%', height: '320px' }}
            >
              <div slot="progress-bar" className="mv-progress" />
            </model-viewer>
          </div>

          {/* Seletor de câmera */}
          <div className="cam-selector">
            <button
              className={camMode === 'environment' ? 'cam-btn active' : 'cam-btn'}
              onClick={() => setCamMode('environment')}
            >
              📷 Traseira
            </button>
            <button
              className={camMode === 'user' ? 'cam-btn active' : 'cam-btn'}
              onClick={() => setCamMode('user')}
            >
              🤳 Frontal
            </button>
          </div>

          {error && <p className="error-msg">{error}</p>}

          <button className="scan-btn" onClick={startCamera}>
            INICIAR SCANNER AR
          </button>
        </main>

        <footer className="home-footer">
          <span>Ghost Project AI — Powered by WebXR</span>
        </footer>
      </div>
    );
  }

  /* ── TELA DA CÂMERA ───────────────────────────────────────────── */
  return (
    <div className="camera-screen">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="video-feed"
      />

      {/* HUD topo */}
      <div className="hud-top">
        <button className="back-btn" onClick={stopCamera}>← Voltar</button>
        <div className="ar-badge">
          <span className="ar-dot" />
          AR ATIVO
        </div>
      </div>

      {/* Cantos do scanner */}
      <div className="scan-frame">
        <div className="corner tl" />
        <div className="corner tr" />
        <div className="corner bl" />
        <div className="corner br" />
        <div className="scan-line" />
      </div>

      {/* HUD base */}
      <div className="hud-bottom">
        <p>Aponte para o seu pulso</p>
        <span>Ghost Project AI</span>
      </div>
    </div>
  );
}

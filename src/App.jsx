import { useState, useRef, useEffect } from 'react';
import './App.css';

/* Registrar o custom element model-viewer via CDN */
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

/* Componente de Logo corrigido para logo.jpeg */
function Logo() {
  return (
    <div className="logo-container">
      <img
        src="/logo.jpeg"
        alt="Ghost Project AI"
        className="main-logo"
      />
    </div>
  );
}

export default function App() {
  const [screen, setScreen]   = useState('home');
  const [camMode, setCamMode] = useState('environment');
  const [error, setError]     = useState('');
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useModelViewer();

  const startCamera = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: camMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      setScreen('camera');
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

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setScreen('home');
  };

  if (screen === 'home') {
    return (
      <div className="home">
        {/* Logo adicionado no topo */}
        <Logo />

        <main className="home-main">
          <div className="text-block">
            <h1>GHOST PROJECT AI</h1>
            <p>Tecnologia de Provador Virtual de Alta Precisão</p>
          </div>

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

  return (
    <div className="camera-screen">
      <video ref={videoRef} autoPlay playsInline muted className="video-feed" />
      <div className="hud-top">
        <button className="back-btn" onClick={stopCamera}>← Voltar</button>
        <div className="ar-badge">
          <span className="ar-dot" />
          AR ATIVO
        </div>
      </div>
      <div className="scan-frame">
        <div className="corner tl" />
        <div className="corner tr" />
        <div className="corner bl" />
        <div className="corner br" />
        <div className="scan-line" />
      </div>
      <div className="hud-bottom">
        <p>Aponte para o seu pulso</p>
        <span>Ghost Project AI</span>
      </div>
    </div>
  );
}

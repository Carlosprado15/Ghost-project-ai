import { useState, useRef, useEffect } from 'react';
import './App.css';

/* ── Carrega o model-viewer via CDN uma única vez ───────────────── */
function useModelViewer() {
  useEffect(() => {
    if (document.querySelector('script[data-mv]')) return;
    const s = document.createElement('script');
    s.type = 'module';
    s.setAttribute('data-mv', '1');
    s.src =
      'https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js';
    document.head.appendChild(s);
  }, []);
}

export default function App() {
  const [screen, setScreen]   = useState('home');   // 'home' | 'scanner'
  const [camMode, setCamMode] = useState('environment');
  const [camError, setCamError] = useState('');
  const videoRef  = useRef(null);
  const streamRef = useRef(null);

  useModelViewer();

  /* Abre câmera automaticamente — sem diálogo de confirmação        */
  const openScanner = async () => {
    setCamError('');
    try {
      const constraints = {
        video: {
          facingMode: camMode,
          width:  { ideal: 1280 },
          height: { ideal: 720  },
        },
        audio: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      setScreen('scanner');
      /* Aguarda o DOM renderizar o <video> */
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });
    } catch {
      setCamError(
        'Câmera indisponível. Verifique as permissões do navegador.',
      );
    }
  };

  /* Para câmera e volta para home */
  const closeScanner = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setScreen('home');
  };

  /* ════════════════════════════════════════════════════════════════
     TELA INICIAL
  ════════════════════════════════════════════════════════════════ */
  if (screen === 'home') {
    return (
      <div className="home">

        {/* LOGO — imagem já contém o símbolo + texto "GHOST PROJECT AI" */}
        <div className="logo-wrap">
          <img src="/logo.jpeg" alt="Ghost Project AI" className="logo-img" />
        </div>

        {/* Viewer 3D do relógio */}
        <div className="viewer-wrap">
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

        {/* Controles — ficam abaixo do viewer, nunca tampam o logo */}
        <div className="controls">

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

          {camError && <p className="cam-error">{camError}</p>}

          {/* Botão principal */}
          <button className="scan-btn" onClick={openScanner}>
            INICIAR SCANNER AR
          </button>

          <p className="footer-txt">Ghost Project AI — Powered by WebXR</p>
        </div>
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════════════
     TELA DO SCANNER
  ════════════════════════════════════════════════════════════════ */
  return (
    <div className="scanner-screen">

      {/* Feed da câmera — ocupa a tela inteira */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="video-feed"
      />

      {/* HUD — topo */}
      <div className="hud-top">
        <button className="back-btn" onClick={closeScanner}>
          ← Voltar
        </button>
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

      {/* HUD — base */}
      <div className="hud-bottom">
        <p className="hud-hint">Aponte para o seu pulso</p>
        <span className="hud-brand">Ghost Project AI</span>
      </div>

    </div>
  );
}

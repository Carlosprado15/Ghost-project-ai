import { useState, useRef, useEffect, useCallback } from 'react';
import './App.css';
import { getEmbeddedParam } from './utils/urlParams';

// ─── CDN loaders ──────────────────────────────────────────────────────────────
function loadScript(src, id) {
  return new Promise((resolve, reject) => {
    if (document.getElementById(id)) {
      resolve();
      return;
    }

    const s = document.createElement('script');
    s.src = src;
    s.id = id;
    s.crossOrigin = 'anonymous';
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function loadMediaPipe() {
  await loadScript(
    'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js',
    'mp-cu'
  );

  await loadScript(
    'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js',
    'mp-du'
  );

  await loadScript(
    'https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js',
    'mp-h'
  );
}

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

// ─── Conversão MediaPipe → viewport ─────────────────────────────────────────
function landmarkToViewport(norm, videoEl, mirrorX) {
  const iW = videoEl.videoWidth || 1280;
  const iH = videoEl.videoHeight || 720;

  const r = videoEl.getBoundingClientRect();

  const scale = Math.max(r.width / iW, r.height / iH);

  const dW = iW * scale;
  const dH = iH * scale;

  const ox = (r.width - dW) / 2;
  const oy = (r.height - dH) / 2;

  let x = norm.x * dW + ox + r.left;
  const y = norm.y * dH + oy + r.top;

  if (mirrorX) {
    x = r.right - (norm.x * dW + ox);
  }

  return { x, y };
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState('home');
  const [camMode, setCamMode] = useState('environment');
  const [camError, setCamError] = useState('');
  const [tracking, setTracking] = useState(false);
  const [showBuy, setShowBuy] = useState(false);

  // Estado do relógio
  const [watch, setWatch] = useState({
    x: 0,
    y: 0,
    size: 220,
    visible: false,
  });

  // Refs para smoothing
  const smoothPosRef = useRef({
    x: 0,
    y: 0,
    size: 220,
  });

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const handsRef = useRef(null);
  const cameraRef = useRef(null);
  const activeRef = useRef(false);
  const buyTimer = useRef(null);

  useModelViewer();

  const handleBuyNow = () => {
    const productUrl = new URLSearchParams(window.location.search).get(
      'productUrl'
    );
    if (productUrl) {
      window.location.href = productUrl;
    }
  };

  const handleContinueShopping = () => {
    // Fecha o modal do Ghost Project (que é o App_FINAL.jsx)
    window.parent.postMessage('ghost-project-close', '*');
  };

  const openScanner = () => {
    setCamError('');
    setShowBuy(false);
    setTracking(false);
    setScreen('scanner');
  };

  // ─── MediaPipe callback ───────────────────────────────────────────────────
  const onHandsResults = useCallback(
    (results) => {
      if (!activeRef.current || !videoRef.current) return;

if (!results.multiHandLandmarks?.length) {
  setTracking(false);
  return;
}

      const lm = results.multiHandLandmarks[0];

      const mirror = camMode === 'user';
      const vid = videoRef.current;

      // ─── Landmarks principais ─────────────────────────────────────────────
      const wristPx = landmarkToViewport(lm[0], vid, mirror);

      const indexMcp = landmarkToViewport(lm[5], vid, mirror);

      const pinkyMcp = landmarkToViewport(lm[17], vid, mirror);

      // ─── Distância anatômica da palma ────────────────────────────────────
      const anatomicalDistance = Math.hypot(
        indexMcp.x - pinkyMcp.x,
        indexMcp.y - pinkyMcp.y
      );

      // ─── ESCALA REALISTA DO RELÓGIO ──────────────────────────────────────
      const watchScaleFactor = 1.45;

      const minWatchSize = 140;
      const maxWatchSize = 420;

      let desiredSize = anatomicalDistance * watchScaleFactor;

      desiredSize = Math.max(minWatchSize, Math.min(maxWatchSize, desiredSize));

      // ─── SMOOTHING LEVE ──────────────────────────────────────────────────
      const alphaPos = 0.35;
      const alphaSize = 0.2;

      smoothPosRef.current.x =
        smoothPosRef.current.x * (1 - alphaPos) + wristPx.x * alphaPos;

      smoothPosRef.current.y =
        smoothPosRef.current.y * (1 - alphaPos) + wristPx.y * alphaPos;

      smoothPosRef.current.size =
        smoothPosRef.current.size * (1 - alphaSize) + desiredSize * alphaSize;

      // ─── Atualizar relógio ───────────────────────────────────────────────
      setWatch({
        x: smoothPosRef.current.x,
        y: smoothPosRef.current.y,
        size: smoothPosRef.current.size,
        visible: true,
      });

      setTracking(true);
    },
    [camMode]
  );

  // ─── Camera + MediaPipe ──────────────────────────────────────────────────
  useEffect(() => {
    if (screen !== 'scanner') return;

    activeRef.current = true;

    (async () => {
      try {
        await loadMediaPipe();

        if (!activeRef.current) return;

        const hands = new window.Hands({
          locateFile: (f) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`,
        });

        hands.setOptions({
          maxNumHands: 1,
          modelComplexity: 0,
          minDetectionConfidence: 0.3,
          minTrackingConfidence: 0.3,
        });

        hands.onResults(onHandsResults);

        handsRef.current = hands;

        // Aguarda modelo estabilizar
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const camera = new window.Camera(videoRef.current, {
          onFrame: async () => {
            if (handsRef.current && videoRef.current) {
              const vid = videoRef.current;

              if (vid.readyState === vid.HAVE_ENOUGH_DATA) {
                await handsRef.current.send({
                  image: vid,
                });
              }
            }
          },

          facingMode: camMode,
          width: 640,
          height: 480,
        });

        await camera.start();

        cameraRef.current = camera;

        if (videoRef.current?.srcObject) {
          streamRef.current = videoRef.current.srcObject;
        }

        // Timer botão CTA
        buyTimer.current = setTimeout(() => {
          if (activeRef.current) {
            setShowBuy(true);
          }
        }, 3000);
      } catch (err) {
        console.error('[ERROR]', err);

        if (activeRef.current) {
          const msg = err?.message ?? String(err);

          setCamError(`Câmera indisponível: ${msg}`);

          setScreen('home');
        }
      }
    })();

    return () => {
      activeRef.current = false;

      clearTimeout(buyTimer.current);

      cameraRef.current?.stop();
      cameraRef.current = null;

      handsRef.current?.close();
      handsRef.current = null;

      streamRef.current?.getTracks().forEach((t) => t.stop());

      streamRef.current = null;

      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [screen, camMode, onHandsResults]);

  const closeScanner = () => {
    activeRef.current = false;

    clearTimeout(buyTimer.current);

    setShowBuy(false);
    setTracking(false);

    setScreen('home');
  };

  // ─── HOME ────────────────────────────────────────────────────────────────
  if (screen === 'home') {
    return (
      <div className="home">
        <div
          className="home-background"
          style={{
            backgroundImage: 'url("/logo.jpeg")',
          }}
        />

        <div className="home-content">
          <div className="home-tagline">
            <p
              style={{
                fontSize: '0.65em',
                letterSpacing: '0.15em',
                fontWeight: '300',
              }}
            >
              TRY THE EXPERIENCE
            </p>
          </div>

          <div className="home-buttons">
            <div className="cam-selector">
              <button
                className={
                  camMode === 'environment' ? 'cam-btn active' : 'cam-btn'
                }
                onClick={() => setCamMode('environment')}
              >
                Câmera Traseira
              </button>

              <button
                className={camMode === 'user' ? 'cam-btn active' : 'cam-btn'}
                onClick={() => setCamMode('user')}
              >
                Câmera Frontal
              </button>
            </div>

            {camError && <p className="cam-error">{camError}</p>}

            <button className="scan-btn" onClick={openScanner}>
              START SCANNER
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Watch Style ─────────────────────────────────────────────────────────
  const watchStyle = {
    position: 'fixed',
    left: `${watch.x}px`,
    top: `${watch.y}px`,
    width: `${watch.size}px`,
    height: `${watch.size}px`,
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'none',
    zIndex: 15,
    opacity: watch.visible ? 1 : 0,

    transition: 'opacity 0.3s ease, width 0.2s ease, height 0.2s ease',

    filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.4)) blur(0.5px)',
  };

  // ─── SCANNER ─────────────────────────────────────────────────────────────
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

      {/* Relógio 3D */}
      <div className="watch-container" style={watchStyle}>
        <model-viewer
          src="/relogio.glb"
          disable-zoom
          shadow-intensity="0.8"
          exposure="1.0"
          interaction-prompt="none"
          camera-orbit="0deg 78deg 105%"
          field-of-view="26deg"
          min-camera-orbit="auto auto 105%"
          max-camera-orbit="auto auto 105%"
          camera-controls="false"
          tone-mapping="neutral"
          style={{
            width: '100%',
            height: '100%',
            background: 'transparent',
            opacity: 0.98,
          }}
        />
      </div>

      {/* Overlay */}
      <div className="scan-overlay">
        <div className="scan-line-bar" />

        <div className="scan-corners">
          <div className="corner tl" />
          <div className="corner tr" />
          <div className="corner bl" />
          <div className="corner br" />
        </div>
      </div>

      {/* HUD */}
      <div className="hud-top">
        <button className="back-btn" onClick={closeScanner}>
          ← Voltar
        </button>

        <div className="ar-badge">
          <span className={`ar-dot ${tracking ? 'active' : ''}`} />
          AR ATIVO
        </div>
      </div>

      {/* CTA */}
      <div className="action-container">
        {showBuy &&  (
          <div className="action-buttons">
            <button className="action-btn primary" onClick={handleBuyNow}>
              Comprar Agora
            </button>
            <button
              className="action-btn secondary"
              onClick={handleContinueShopping}
            >
              Continuar Comprando
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

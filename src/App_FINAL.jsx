import { useState, useRef, useEffect, useCallback } from 'react';
import './App.css';
import { getEmbeddedParam, getModelUrl, getProductId } from './utils/urlParams';
import DiagnosticPage from './DiagnosticPage';
import ReportPanel from './ReportPanel';
import TestModelsPage from './TestModelsPage';

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
  const [showDiagnostic, setShowDiagnostic] = useState(false);
  const [showTestModels, setShowTestModels] = useState(false);
  const [showReportPanel, setShowReportPanel] = useState(false); // New state for ReportPanel
  const [testProductId, setTestProductId] = useState(null);
  const [cameFromTestModels, setCameFromTestModels] = useState(false);
  const [modelLoadingStartTime, setModelLoadingStartTime] = useState(null);
  const [modelViewerLoadedTime, setModelViewerLoadedTime] = useState(null);
  const [firstDisplayTime, setFirstDisplayTime] = useState(null);
  const [showB2BModal, setShowB2BModal] = useState(false);
  const [b2bEmail, setB2bEmail] = useState('');

  const modelViewerRef = useRef(null);

  // Estado do relógio
  const [watch, setWatch] = useState({
    x: 0,
    y: 0,
    size: 220,
    rotation: 0,
    pitch: 0,      // ← NOVO: inclinação vertical
    yaw: 0,        // ← NOVO: rotação lateral
    visible: false,
  });

  // Refs para smoothing
  const smoothPosRef = useRef({
    x: 0,
    y: 0,
    size: 220,
  });

  const smoothRotRef = useRef(0);
  const smoothPitchRef = useRef(0);  // ← NOVO
  const smoothYawRef = useRef(0);    // ← NOVO
  const lastValidDataRef = useRef(null);

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
    closeScanner();
    if (cameFromTestModels) {
      setShowTestModels(true);
      setCameFromTestModels(false);
    } else if (window.parent === window) {
      setScreen('home');
    }
  };

  const openScanner = (productId = null) => {
    setCamError('');
    setShowBuy(false);
    setTracking(false);
    setTestProductId(productId); // Set the product ID for testing
    setScreen('scanner');

    // Reset model loading states
    setModelLoadingStartTime(performance.now());
    setModelViewerLoadedTime(null);
    setFirstDisplayTime(null);
  };

  const handleSelectTestProduct = (productId) => {
    setCameFromTestModels(true);
    openScanner(productId);
    setShowTestModels(false); // Hide the test models page
  };

  // ─── MediaPipe callback ───────────────────────────────────────────────────
  const onHandsResults = useCallback(
    (results) => {
      if (!activeRef.current || !videoRef.current) return;

      const currentTime = performance.now();

      if (!results.multiHandLandmarks?.length) {
        // CORREÇÃO: Fade out suave e reset de rotações ao perder tracking
        if (lastValidDataRef.current) {
          // Fade out com reset gradual de pitch/yaw/rotation
          setWatch(prev => ({ 
            ...prev, 
            visible: false,
            pitch: 0,
            yaw: 0,
            rotation: 0
          }));
          
          // Reset dos refs de smoothing para próxima detecção
          setTimeout(() => {
            if (!activeRef.current) return;
            smoothPitchRef.current = 0;
            smoothYawRef.current = 0;
            smoothRotRef.current = 0;
          }, 200); // Após fade out completo
        }
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

      const middleMcp = landmarkToViewport(lm[9], vid, mirror);

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

      // ─── OFFSET ANATÔMICO: deslocar para dentro do antebraço ─────────────
      const forearmVectorX = middleMcp.x - wristPx.x;
      const forearmVectorY = middleMcp.y - wristPx.y;
      const forearmLength = Math.hypot(forearmVectorX, forearmVectorY);

      const offsetAmount = 15; // pixels para dentro do antebraço
      const offsetX = (forearmVectorX / forearmLength) * offsetAmount;
      const offsetY = (forearmVectorY / forearmLength) * offsetAmount;

      const adjustedWristX = wristPx.x + offsetX;
      const adjustedWristY = wristPx.y + offsetY;

      // ─── ROTAÇÃO: ângulo do antebraço ─────────────────────────────────────
      let watchRotation = Math.atan2(forearmVectorY, forearmVectorX) * (180 / Math.PI);

      // ─── PITCH: inclinação vertical (usando profundidade Z) ──────────────
      const wristZ = lm[0].z;
      const middleZ = lm[9].z;
      const deltaZ = middleZ - wristZ;
      
      // Normalizar deltaZ para escala de pixels (REDUZIDO para 30% da amplitude original)
      const zScale = 300; // Reduzido de 1000 para 300 (30% da amplitude)
      const deltaZPx = deltaZ * zScale;
      
      // Pitch = ângulo de inclinação do antebraço
      let watchPitch = Math.atan2(deltaZPx, forearmLength) * (180 / Math.PI);
      
      // Limitar pitch para evitar valores extremos (REDUZIDO para ±15°)
      watchPitch = Math.max(-15, Math.min(15, watchPitch));

      // ─── YAW: rotação lateral (torção da palma) ───────────────────────────
      const indexZ = lm[5].z;
      const pinkyZ = lm[17].z;
      const palmTwistZ = indexZ - pinkyZ;
      
      // Normalizar para escala de pixels (usa o mesmo zScale reduzido)
      const palmTwistZPx = palmTwistZ * zScale;
      
      // Yaw = torção da palma (quanto a mão está virada)
      const palmWidth = Math.hypot(indexMcp.x - pinkyMcp.x, indexMcp.y - pinkyMcp.y);
      let watchYaw = Math.atan2(palmTwistZPx, palmWidth) * (180 / Math.PI);
      
      // Limitar yaw para evitar valores extremos (REDUZIDO para ±20°)
      watchYaw = Math.max(-20, Math.min(20, watchYaw));

      // ─── DEAD ZONE para rotação (evitar micro-oscilações) ────────────────
      const rotationDeadZone = 2.5; // graus
      const rotationDiff = watchRotation - smoothRotRef.current;
      
      if (Math.abs(rotationDiff) < rotationDeadZone) {
        watchRotation = smoothRotRef.current;
      }

      // ─── SMOOTHING para rotação ──────────────────────────────────────────
      const alphaRot = 0.25;
      smoothRotRef.current = smoothRotRef.current * (1 - alphaRot) + watchRotation * alphaRot;

      // ─── SMOOTHING para pitch e yaw (mais lento para reduzir ruído Z) ────
      const alpha3D = 0.09; // Reduzido de 0.20 para 0.09 (menos sensível ao ruído)
      smoothPitchRef.current = smoothPitchRef.current * (1 - alpha3D) + watchPitch * alpha3D;
      smoothYawRef.current = smoothYawRef.current * (1 - alpha3D) + watchYaw * alpha3D;

      // ─── DEAD ZONE para posição (evitar tremor) ──────────────────────────
      const positionDeadZone = 3; // pixels
      
      let targetX = adjustedWristX;
      let targetY = adjustedWristY;
      
      if (lastValidDataRef.current) {
        const deltaX = Math.abs(adjustedWristX - lastValidDataRef.current.x);
        const deltaY = Math.abs(adjustedWristY - lastValidDataRef.current.y);
        
        if (deltaX < positionDeadZone) targetX = lastValidDataRef.current.x;
        if (deltaY < positionDeadZone) targetY = lastValidDataRef.current.y;
      }

      // ─── SMOOTHING para posição e tamanho (mais rápido que pitch/yaw) ────
      const alphaPos = 0.22; // Reduzido de 0.55 para 0.22 (mais responsivo)
      const alphaSize = 0.35;

      smoothPosRef.current.x =
        smoothPosRef.current.x * (1 - alphaPos) + targetX * alphaPos;

      smoothPosRef.current.y =
        smoothPosRef.current.y * (1 - alphaPos) + targetY * alphaPos;

      smoothPosRef.current.size =
        smoothPosRef.current.size * (1 - alphaSize) + desiredSize * alphaSize;

      // ─── Armazenar última posição válida ─────────────────────────────────
      lastValidDataRef.current = {
        x: smoothPosRef.current.x,
        y: smoothPosRef.current.y,
        rotation: smoothRotRef.current,
        pitch: smoothPitchRef.current,    // ← NOVO
        yaw: smoothYawRef.current          // ← NOVO
      };

      // ─── Atualizar relógio ───────────────────────────────────────────────
      setWatch({
        x: smoothPosRef.current.x,
        y: smoothPosRef.current.y,
        size: smoothPosRef.current.size,
        rotation: smoothRotRef.current,
        pitch: smoothPitchRef.current,     // ← NOVO
        yaw: smoothYawRef.current,         // ← NOVO
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
        await new Promise((resolve) => setTimeout(resolve, 400));

        // CORREÇÃO CIRÚRGICA: Verificar se videoRef.current existe antes da inicialização da câmera
        if (!videoRef.current) {
          console.error("VIDEO_REF_NULL: videoRef.current é null no momento da inicialização da câmera");
          return;
        }

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

  const handleB2BSubmit = (e) => {
    e.preventDefault();
    console.log('Lead Ghost Project:', b2bEmail);
    setB2bEmail('');
    setShowB2BModal(false);
  };

  // ─── DIAGNOSTIC ──────────────────────────────────────────────────────────
  if (showDiagnostic) {
    return <DiagnosticPage onBack={() => setShowDiagnostic(false)} />;
  }

  // ─── TEST MODELS ─────────────────────────────────────────────────────────
  if (showTestModels) {
    return (
      <TestModelsPage
        onSelectProduct={handleSelectTestProduct}
        onBack={() => setShowTestModels(false)}
      />
    );
  }

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

            {/* Botão TEST MODELS visível apenas em desenvolvimento */}
            {import.meta.env.DEV && (
              <button
                className="scan-btn"
                onClick={() => setShowTestModels(true)}
                style={{ backgroundColor: '#007bff', marginBottom: '10px' }}
              >
                🧪 TEST MODELS
              </button>
            )}

            <button className="scan-btn" onClick={openScanner}>
              START SCANNER
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Watch Style ─────────────────────────────────────────────────────────
  // CORREÇÃO CRÍTICA: Perspective no container pai + ordem correta do transform
  const watchContainerStyle = {
    position: 'fixed',
    left: `${watch.x}px`,
    top: `${watch.y}px`,
    width: `${watch.size}px`,
    height: `${watch.size}px`,
    pointerEvents: 'none',
    zIndex: 15,
    opacity: watch.visible ? 1 : 0,
    transition: 'opacity 0.15s ease, width 0.1s ease, height 0.1s ease',
    // PERSPECTIVE aplicada no container PAI
    perspective: '800px',
    perspectiveOrigin: '50% 50%',
    // Translate para centralizar no pulso
    transform: 'translate(-50%, -50%)',
  };

  const watchStyle = {
    width: '100%',
    height: '100%',
    // ORDEM CRÍTICA: rotações 3D aplicadas DEPOIS do posicionamento
    transform: `
      rotateZ(${watch.rotation}deg)
      rotateX(${watch.pitch}deg)
      rotateY(${watch.yaw}deg)
    `,
    transformStyle: 'preserve-3d',
    transformOrigin: 'center center',
    filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.4))',
  };

  // ─── SCANNER ─────────────────────────────────────────────────────────────
  // VALIDATION: Obter productId e modelUrl
  const productId = testProductId || getProductId();
  const modelUrl = getModelUrl(productId);
  const hasValidProduct = productId && modelUrl;

  return (
    <div className="scanner">
      {/* Video sempre renderizado quando screen === 'scanner' */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="video-feed"
        style={camMode === 'user' ? { transform: 'scaleX(-1)' } : {}}
      />

      {/* Se não há produto válido, mostrar erro sobreposto */}
      {!hasValidProduct ? (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(0, 0, 0, 0.95)',
          color: '#fff',
          textAlign: 'center',
          padding: '20px',
          zIndex: 20
        }}>
          <div style={{
            backgroundColor: 'rgba(255, 0, 0, 0.1)',
            border: '2px solid #ff0000',
            borderRadius: '10px',
            padding: '30px',
            maxWidth: '500px'
          }}>
            <h2 style={{ color: '#ff0000', marginBottom: '20px' }}>
              ================================
            </h2>
            <h1 style={{ fontSize: '24px', marginBottom: '20px' }}>
              PRODUTO NÃO IDENTIFICADO
            </h1>
            <p style={{ fontSize: '16px', marginBottom: '20px' }}>
              Nenhum productId foi recebido.
            </p>
            <p style={{ fontSize: '16px', marginBottom: '30px' }}>
              Verifique a URL ou a integração da loja.
            </p>
            <h2 style={{ color: '#ff0000', marginBottom: '20px' }}>
              ================================
            </h2>
            <button 
              className="back-btn" 
              onClick={closeScanner}
              style={{
                backgroundColor: '#ff0000',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              ← Voltar
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Scanner amarelo */}
          <div className="scan-overlay">
            <div className="scan-line-bar" />
            <div className="scan-corners">
              <div className="corner tl" />
              <div className="corner tr" />
              <div className="corner bl" />
              <div className="corner br" />
            </div>
          </div>

          {/* Relógio 3D - ESTRUTURA CORRIGIDA: container com perspective + wrapper com rotações */}
          <div className="watch-container" style={watchContainerStyle}>
            <div style={watchStyle}>
              <model-viewer
                ref={modelViewerRef}
                src={modelUrl}
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
                orientation={`${watch.pitch}deg ${watch.yaw}deg ${watch.rotation - 90}deg`}
                scale="2 2 2"
                style={{
                  width: '100%',
                  height: '100%',
                  background: 'transparent',
                  opacity: 0.98
                }}
                onLoad={() => setModelViewerLoadedTime(performance.now())}
                onUpdate={() => {
                  if (!firstDisplayTime && modelViewerRef.current?.modelIsVisible) {
                    setFirstDisplayTime(performance.now());
                  }
                }}
              />
            </div>
          </div>

          {/* HUD */}
          <div className="hud-top">
            <button className="back-btn" onClick={() => {
              if (cameFromTestModels) {
                closeScanner();
                setShowTestModels(true);
                setCameFromTestModels(false);
              } else {
                closeScanner();
              }
            }}>
              ← Voltar{cameFromTestModels ? ' ao Catálogo' : ''}
            </button>
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

          {/* Ghost Project AI Signature */}
          <div className="ghost-signature">
            <button 
              className="ghost-signature-btn"
              onClick={() => setShowB2BModal(true)}
            >
              Powered by Ghost Project AI
            </button>
          </div>
        </>
      )}

      {/* B2B Modal */}
      {showB2BModal && (
        <div className="b2b-modal-overlay" onClick={() => setShowB2BModal(false)}>
          <div className="b2b-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="b2b-modal-body">
              <h1 className="b2b-title">GHOST PROJECT AI</h1>
              <p className="b2b-subtitle">
                A próxima geração da experiência de compra em Realidade Aumentada.
              </p>

              <div className="b2b-section">
                <p className="b2b-text">
                  Você acabou de experimentar o motor de Realidade Aumentada desenvolvido para o e-commerce moderno.
                </p>
                <p className="b2b-text">
                  Enquanto soluções convencionais sofrem com instabilidade e perda de alinhamento, o Ghost Project entrega tracking anatômico preciso, estabilidade anti-jitter e renderização otimizada diretamente no dispositivo móvel.
                </p>
              </div>

              <div className="b2b-pillars">
                <div className="b2b-pillar">
                  <h3>Redução Logística</h3>
                  <p>Diminua em até 50% as taxas de devolução e troca ao eliminar dúvidas sobre escala, proporção e ajuste do produto.</p>
                </div>
                <div className="b2b-pillar">
                  <h3>Performance Cinemática</h3>
                  <p>Renderização fluida e oclusão em tempo real adaptadas à Nova Arquitetura Mobile.</p>
                </div>
                <div className="b2b-pillar">
                  <h3>Integração Modular</h3>
                  <p>Arquitetura preparada para integração rápida em plataformas globais de e-commerce.</p>
                </div>
              </div>

              <div className="b2b-cta-section">
                <p className="b2b-cta-text">
                  Leve a precisão do Ghost Project para sua operação ou conecte-se com nossa engenharia como parceiro estratégico.
                </p>
                <p className="b2b-cta-subtitle">
                  Entre para a lista de acesso exclusivo.
                </p>
              </div>

              <form className="b2b-form" onSubmit={handleB2BSubmit}>
                <input
                  type="email"
                  className="b2b-input"
                  placeholder="Digite seu e-mail corporativo"
                  value={b2bEmail}
                  onChange={(e) => setB2bEmail(e.target.value)}
                  required
                />
                <button type="submit" className="b2b-submit-btn">
                  SOLICITAR DEMONSTRAÇÃO PRIVADA
                </button>
              </form>

              <p className="b2b-footer">
                Segurança ponta a ponta. Seus dados de engenharia e negócios protegidos de acordo com diretrizes globais de privacidade.
              </p>

              <button className="b2b-back-btn" onClick={() => setShowB2BModal(false)}>
                ← Voltar para a Experiência AR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
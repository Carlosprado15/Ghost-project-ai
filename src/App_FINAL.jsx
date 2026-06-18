import { useState, useRef, useEffect, useCallback } from 'react';
import './App.css';
import { getEmbeddedParam, getModelUrl, getProductId, getProductUrl, isStoreMode } from './utils/urlParams';
import DiagnosticPage from './DiagnosticPage';
import ReportPanel from './ReportPanel';
import TestModelsPage from './TestModelsPage';
import LandingPage from './LandingPage';
import { WristTracker } from './tracking/WristTracker.js';
import { RenderPipeline } from './tracking/RenderPipeline.js';

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

function isDesktopDevice() {
  return !/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState('home');
  const [camMode, setCamMode] = useState('environment');
  const [camError, setCamError] = useState('');
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
  const [showLandingPage, setShowLandingPage] = useState(false);
  const [b2bEmail, setB2bEmail] = useState('');
  const [b2bStatus, setB2bStatus] = useState('idle'); // idle | sending | success | error
  const [showQRScreen, setShowQRScreen] = useState(false);

  const modelViewerRef = useRef(null);

  // Estado do relógio (atualizado pelo pipeline)
  const [watch, setWatch] = useState({ x: 0, y: 0, size: 0, rotation: 0 });
  
  // Estado de debug profissional
  const [dbg, setDbg] = useState({
    status: 'Aguardando',
    isTracking: false,
    isStable: false,
    confidence: 0,
    fps: 0,
    frames: 0,
    lostFrames: 0,
  });

  // Refs
  const videoRef    = useRef(null);
  const canvasRef   = useRef(null);
  const handsRef    = useRef(null);
  const cameraRef   = useRef(null);
  const streamRef   = useRef(null);
  const buyTimer    = useRef(null);
  const activeRef   = useRef(false);
  
  // Sistema de tracking profissional
  const trackerRef  = useRef(null);
  const pipelineRef = useRef(null);
  const lmRef       = useRef(null);
  const frameCount  = useRef(0);

  // MISSÃO 004 — renderCallback: recebe pose do RenderPipeline e atualiza estado React
  const renderCallback = useCallback((pose) => {
    setWatch(pose);
  }, []);

  // MISSÃO 004 — debugCallback: atualiza fps no estado de debug
  const debugCallback = useCallback((info) => {
    setDbg(prev => ({ ...prev, fps: info.fps }));
  }, []);

  useModelViewer();

  // Inicialização única da nova arquitetura de tracking (instâncias ociosas)
  useEffect(() => {
    trackerRef.current = new WristTracker({
      minConfidence: 0.6,
      minStabilityFrames: 8,
      maxLostFrames: 30,
      positionMinCutoff: 1.2,
      positionBeta: 0.3,
      rotationMinCutoff: 1.0,
      rotationBeta: 0.5,
      scaleMinCutoff: 0.8,
      scaleBeta: 0.1,
      watchSizeMultiplier: 1.5,
      watchOffsetRatio: 0.18,
    });
    pipelineRef.current = new RenderPipeline();

    return () => {
      trackerRef.current?.reset();
      pipelineRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    if (isStoreMode()) {
      openScanner(null);
    }
  }, []);



const handleBuyNow = () => {
  const params = new URLSearchParams(window.location.search);
  const cartUrl = params.get('cartUrl');
  const productUrl = params.get('productUrl');
  
  if (cartUrl) {
    window.location.href = decodeURIComponent(cartUrl);
  } else if (productUrl) {
    window.location.href = decodeURIComponent(productUrl);
  }
};

  const handleContinueShopping = () => {
    closeScanner();
    if (cameFromTestModels) {
      setShowTestModels(true);
      setCameFromTestModels(false);
    } else if (isStoreMode()) {
      window.location.href = getProductUrl() || '/';
    } else if (window.parent === window) {
      setScreen('home');
    }
  };

  const openScanner = (productId = null) => {
    setCamError('');
    setShowBuy(false);
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

      const lms = results.multiHandLandmarks?.[0] ?? null;
      const videoRect = videoRef.current.getBoundingClientRect();
      const mirrorX = camMode === 'user';

      const pose = trackerRef.current.update(lms, null, videoRect, mirrorX);
      pipelineRef.current.updatePose(pose);
    },
    [camMode]
  );

  // ─── Camera + MediaPipe ──────────────────────────────────────────────────
  useEffect(() => {
    if (screen !== 'scanner') return;

    activeRef.current = true;

    // MISSÃO 004 — iniciar pipeline de renderização
    pipelineRef.current.start(renderCallback, debugCallback);

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

      // MISSÃO 004 — parar pipeline ao sair do scanner
      pipelineRef.current?.stop();

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
  }, [screen, camMode, onHandsResults, renderCallback, debugCallback]);

  const closeScanner = () => {
    activeRef.current = false;

    clearTimeout(buyTimer.current);

    setShowBuy(false);

    setScreen('home');
  };

  const handleB2BSubmit = async (e) => {
    e.preventDefault();
    setB2bStatus('sending');
    try {
      const res = await fetch('https://formspree.io/f/mpqegypq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ email: b2bEmail, source: 'Ghost Project AI — Modal B2B' }),
      });
      if (res.ok) {
        setB2bStatus('success');
        setB2bEmail('');
      } else {
        setB2bStatus('error');
      }
    } catch {
      setB2bStatus('error');
    }
  };

  const handleOpenLandingPage = () => {
    setShowB2BModal(false);
    setShowLandingPage(true);
  };

  // ─── LANDING PAGE ────────────────────────────────────────────────────────
  if (showLandingPage) {
    return <LandingPage onClose={() => setShowLandingPage(false)} />;
  }

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

  // ─── QR SCREEN (desktop) ─────────────────────────────────────────────────
  if (showQRScreen) {
    const qrUrl = window.location.href;
    const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrUrl)}`;

    return (
      <div className="home">
        <div className="home-background" style={{ backgroundImage: 'url("/logo.jpeg")' }} />
        <div className="home-content">
          <div style={{ textAlign: 'center' }}>
            <p style={{
              color: '#D4AF37',
              fontSize: '10px',
              letterSpacing: '0.22em',
              fontWeight: 300,
              marginBottom: '28px',
              textTransform: 'uppercase',
            }}>
              Experiência AR disponível no celular
            </p>
            <div style={{
              background: '#fff',
              padding: '14px',
              borderRadius: '12px',
              display: 'inline-block',
              marginBottom: '20px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
            }}>
              <img src={qrSrc} alt="QR Code" width={220} height={220} />
            </div>
            <p style={{
              color: 'rgba(255,255,255,0.65)',
              fontSize: '13px',
              letterSpacing: '0.04em',
              marginBottom: '6px',
            }}>
              Escaneie com seu celular
            </p>
            <p style={{
              color: 'rgba(255,255,255,0.3)',
              fontSize: '11px',
              letterSpacing: '0.08em',
              marginBottom: '32px',
            }}>
              Powered by Ghost Project AI
            </p>
            <button className="scan-btn" onClick={() => setShowQRScreen(false)}>
              ← Voltar
            </button>
          </div>
        </div>
      </div>
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

            <button className="scan-btn" onClick={() => {
              if (isDesktopDevice()) {
                setShowQRScreen(true);
              } else {
                openScanner(getProductId() || 'CW001');
              }
            }}>
              START SCANNER
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Watch Style ─────────────────────────────────────────────────────────
  const shouldRenderWatch = trackerRef.current?.shouldRender?.() ?? false;

  // CORREÇÃO CRÍTICA: Perspective no container pai + ordem correta do transform
  const watchContainerStyle = {
    position: 'fixed',
    left: `${watch.x}px`,
    top: `${watch.y}px`,
    width: `${watch.size}px`,
    height: `${watch.size}px`,
    pointerEvents: 'none',
    zIndex: 15,
    opacity: shouldRenderWatch ? 1 : 0,
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
    transform: `rotateZ(${watch.rotation}deg)`,
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
      {hasValidProduct && !shouldRenderWatch && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(0,0,0,0.85)',
          zIndex: 25,
          pointerEvents: 'none',
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '2px solid rgba(212,175,55,0.2)',
            borderTopColor: 'rgba(212,175,55,0.9)',
            borderRadius: '50%',
            animation: 'ghostSpin 1s linear infinite',
            marginBottom: '20px',
          }} />
          <p style={{
            color: '#fff',
            fontSize: '13px',
            letterSpacing: '0.08em',
            fontWeight: 500,
            opacity: 0.85,
          }}>
            Calibrando experiência espacial
          </p>
        </div>
      )}
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
                orientation={`0deg 0deg ${watch.rotation - 90}deg`}
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
        <div className="b2b-modal-overlay" onClick={() => { setShowB2BModal(false); setB2bStatus('idle'); }}>
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

              {b2bStatus === 'success' ? (
                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                  <p style={{ color: '#D4AF37', fontSize: '15px', fontWeight: 600, letterSpacing: '0.05em', marginBottom: '8px' }}>
                    ACESSO SOLICITADO
                  </p>
                  <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px' }}>
                    Entraremos em contato em breve.
                  </p>
                </div>
              ) : (
                <form className="b2b-form" onSubmit={handleB2BSubmit}>
                  <input
                    type="email"
                    className="b2b-input"
                    placeholder="Digite seu e-mail corporativo"
                    value={b2bEmail}
                    onChange={(e) => setB2bEmail(e.target.value)}
                    required
                    disabled={b2bStatus === 'sending'}
                  />
                  <button type="submit" className="b2b-submit-btn" disabled={b2bStatus === 'sending'}>
                    {b2bStatus === 'sending' ? 'ENVIANDO...' : 'SOLICITAR DEMONSTRAÇÃO PRIVADA'}
                  </button>
                  {b2bStatus === 'error' && (
                    <p style={{ color: '#ff6b6b', fontSize: '12px', textAlign: 'center', marginTop: '8px' }}>
                      Erro ao enviar. Tente novamente.
                    </p>
                  )}
                </form>
              )}

              <div className="b2b-divider">
                <span>ou</span>
              </div>

              <button 
                type="button" 
                className="b2b-full-access-btn"
                onClick={handleOpenLandingPage}
              >
                SOLICITAR ACESSO COMPLETO
              </button>

              <p className="b2b-footer">
                Segurança ponta a ponta. Seus dados de engenharia e negócios protegidos de acordo com diretrizes globais de privacidade.
              </p>

              <button className="b2b-back-btn" onClick={() => { setShowB2BModal(false); setB2bStatus('idle'); }}>
                ← Voltar para a Experiência AR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
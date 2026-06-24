import { useState, useRef, useEffect, useCallback } from 'react';
import './App.css';
import { ProductAdapter } from './sdk/product-adapter';
import { GhostProject } from './sdk/GhostProject';

import TestModelsPage from './TestModelsPage';
import LandingPage from './LandingPage';
import UrlDiagnosticsPanel from './components/UrlDiagnosticsPanel';
import { WristTracker } from './tracking/WristTracker.js';
import { RenderPipeline } from './tracking/RenderPipeline.js';
import { PrecisionFitController } from './tracking/PrecisionFitController.js';
import { createDefaultPipeline } from './pipeline/defaultPipeline.js';
import { LocalStorageAssetRepository } from './assets/LocalStorageAssetRepository.js';
import { ProductAsset } from './assets/ProductAsset.js';
import { AssetStatus } from './assets/AssetStatus.js';
import GhostDiagnostics from './components/GhostDiagnostics.jsx';
import Hero3D from './components/Hero3D.jsx';

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

const PIPELINE_LABELS = {
  UPLOADING:   '↑ ENVIANDO IMAGEM',
  GENERATING:  '⚙ GERANDO MODELO 3D',
  DOWNLOADING: '↓ BAIXANDO MODELO',
  VALIDATING:  '◎ VALIDANDO',
  READY:       '✓ MODELO PRONTO',
  ERROR:       '✕ FALHA NA GERAÇÃO',
};

// ─── Main component ──────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState('home');
  const [camMode, setCamMode] = useState('environment');
  const [camError, setCamError] = useState('');
  const [showBuy, setShowBuy] = useState(false);
  const [showTestModels, setShowTestModels] = useState(false);
  const [testProductId, setTestProductId] = useState(null);
  const [cameFromTestModels, setCameFromTestModels] = useState(false);
  const [showB2BModal, setShowB2BModal] = useState(false);
  const [showLandingPage, setShowLandingPage] = useState(false);
  const [b2bEmail, setB2bEmail] = useState('');
  const [b2bStatus, setB2bStatus] = useState('idle');
  const [showQRScreen, setShowQRScreen] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [screenshotDone, setScreenshotDone] = useState(false);
  const [pipelineStage, setPipelineStage]          = useState(null);
  const [pipelineError, setPipelineError]          = useState(null);
  const [generatedModelUrl, setGeneratedModelUrl]  = useState(null);
  const [show360, setShow360]                      = useState(false);

  // Precision Fit — offset manual sobre a pose do WristTracker
  const [pfOffset, setPfOffset] = useState({ x: 0, y: 0, scale: 1, rotation: 0 });
  const [pfEditing, setPfEditing] = useState(false);
  const [pfHintVisible, setPfHintVisible] = useState(false);

  const modelViewerRef = useRef(null);

  const [watch, setWatch] = useState({ x: 0, y: 0, size: 0, rotation: 0 });

  // Refs
  const videoRef    = useRef(null);
  const handsRef    = useRef(null);
  const cameraRef   = useRef(null);
  const streamRef   = useRef(null);
  const buyTimer    = useRef(null);
  const activeRef   = useRef(false);

  const trackerRef       = useRef(null);
  const pipelineRef      = useRef(null);
  const precisionFitRef  = useRef(null);
  const scannerDivRef    = useRef(null);
  const pfHintTimerRef   = useRef(null);
  const imagePipelineRef = useRef(null);
  const assetRepoRef     = useRef(null);
  const hasGeneratedRef  = useRef(false);

  // Performance metrics (Etapa 4)
  const perfRef = useRef({
    scannerOpenedAt:  null,
    firstTrackingAt:  null,
    modelLoadedAt:    null,
    glbStartAt:       null,
    glbEndAt:         null,
    firstRenderAt:    null,
  });
  const [perfMetrics, setPerfMetrics] = useState({});

  // Health issues registrados pelo Auto Health Check (Etapa 2)
  const [healthIssues, setHealthIssues] = useState([]);


  const renderCallback = useCallback((pose) => {
    setWatch(pose);
    // Perf: tempo até primeira renderização
    if (pose.size > 0 && perfRef.current.firstRenderAt === null && perfRef.current.scannerOpenedAt !== null) {
      perfRef.current.firstRenderAt = performance.now();
    }
  }, []);

  const debugCallback = useCallback(() => {}, []);

  // ─── Auto Health Check (Etapa 2) ─────────────────────────────────────────
  const runHealthCheck = useCallback(async () => {
    const issues = [];

    // câmera
    if (!navigator.mediaDevices?.getUserMedia) {
      issues.push('getUserMedia indisponível — câmera não funcionará');
    } else {
      try {
        if (navigator.permissions) {
          const perm = await navigator.permissions.query({ name: 'camera' }).catch(() => null);
          if (perm?.state === 'denied') issues.push('Permissão de câmera negada');
        }
      } catch { /* ignorar */ }
    }

    // WebGL / renderização
    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
      if (!gl) issues.push('WebGL indisponível — renderização 3D não funcionará');
    } catch {
      issues.push('Erro ao verificar WebGL');
    }

    // model-viewer
    if (typeof customElements !== 'undefined' && !customElements.get('model-viewer')) {
      // não é falha — carrega sob demanda; apenas aviso interno
      console.info('[HealthCheck] model-viewer ainda não registrado (normal em DEV antes do scanner)');
    }

    // pipeline
    if (!imagePipelineRef.current) {
      issues.push('ImageToModelPipeline não inicializado');
    }

    // Precision Fit
    if (!precisionFitRef.current) {
      issues.push('PrecisionFitController não inicializado');
    }

    // providers
    const providers = imagePipelineRef.current?.providerSelector?.getAll?.() ?? [];
    if (providers.length === 0) {
      issues.push('Nenhum provider 3D registrado — geração de modelos indisponível');
    }

    // cache
    try {
      localStorage.setItem('__ghost_hc__', '1');
      localStorage.removeItem('__ghost_hc__');
    } catch {
      issues.push('localStorage indisponível — assets não serão persistidos');
    }

    if (issues.length > 0) {
      console.warn('[HealthCheck] Problemas detectados:', issues);
    } else {
      console.info('[HealthCheck] Todos os sistemas OK');
    }

    setHealthIssues(issues);
  }, []);

  useModelViewer();

  // Inicialização única da nova arquitetura de tracking (instâncias ociosas)
  useEffect(() => {
    assetRepoRef.current   = new LocalStorageAssetRepository();
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
    precisionFitRef.current = new PrecisionFitController();
    imagePipelineRef.current = createDefaultPipeline();

    return () => {
      trackerRef.current?.reset();
      pipelineRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const embeddedProductId = params.get('productId');
    console.log('[M043][Etapa3-App] productId recebido:', embeddedProductId, '| embedded:', params.get('embedded'), '| productUrl:', params.get('productUrl'));
    if (embeddedProductId && params.get('embedded') === 'true') {
      if (isDesktopDevice()) {
        // Desktop: sem câmera — mostra QR direto para o usuário escanear com celular
        setShowQRScreen(true);
      } else {
        openScanner(embeddedProductId);
      }
    } else if (ProductAdapter.isStoreMode()) {
      setShow360(true);
    }
  }, []);



const handleBuyNow = () => {
  const { cartUrl, productUrl } = ProductAdapter.getActive();
  GhostProject._emit('onPurchase', { cartUrl, productUrl });
  if (cartUrl) {
    window.location.href = decodeURIComponent(cartUrl);
  } else if (productUrl) {
    window.location.href = decodeURIComponent(productUrl);
  } else {
    closeScanner();
  }
};

  const handleContinueShopping = () => {
    GhostProject._emit('onContinueShopping', {});
    closeScanner();
    if (cameFromTestModels) {
      setShowTestModels(true);
      setCameFromTestModels(false);
    } else if (ProductAdapter.isStoreMode()) {
      window.location.href = ProductAdapter.getActive().productUrl || '/';
    } else if (window.parent === window) {
      setScreen('home');
    }
  };

  const openScanner = (productId = null) => {
    console.log('[M043][Etapa4-openScanner] productId recebido:', productId);
    GhostProject._emit('onOpen', { productId });
    setCamError('');
    setShowBuy(false);
    setTestProductId(productId);
    setScreen('scanner');

    // Reset Precision Fit ao iniciar nova sessão
    precisionFitRef.current?.reset();
    setPfOffset({ x: 0, y: 0, scale: 1, rotation: 0 });
    setPfEditing(false);

    // MISSÃO 020: produto com modelUrl → carrega imediatamente, pipeline completamente bloqueado
    const _productForLoad = productId
      ? ProductAdapter.fromParams({ productId })
      : ProductAdapter.getActive();
    const _staticModelUrl = _productForLoad?.modelUrl || null;
    hasGeneratedRef.current = Boolean(_staticModelUrl);
    setGeneratedModelUrl(_staticModelUrl);
    setPipelineStage(null);
    setPipelineError(null);
    setWatch({ x: 0, y: 0, size: 0, rotation: 0 });

    // Perf: marca abertura do scanner
    perfRef.current = {
      scannerOpenedAt:  performance.now(),
      firstTrackingAt:  null,
      modelLoadedAt:    null,
      glbStartAt:       null,
      glbEndAt:         null,
      firstRenderAt:    null,
    };
    setPerfMetrics({});

    // Auto Health Check (Etapa 2) — assíncrono, nunca interrompe
    runHealthCheck().catch(() => {});
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

        if (!videoRef.current) return;

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

      pipelineRef.current?.stop();
      imagePipelineRef.current?.cancel?.().catch(() => {});

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

  // Precision Fit — touch handlers com passive:false para permitir preventDefault
  useEffect(() => {
    if (screen !== 'scanner') return;
    const el = scannerDivRef.current;
    if (!el) return;

    const pf = precisionFitRef.current;

    const onStart = (e) => {
      if (e.touches.length === 2 && pf) {
        pf.handleTouchStart(e.touches);
        setPfEditing(true);
      }
    };

    const onMove = (e) => {
      if (pf?.isEditing && e.touches.length === 2) {
        e.preventDefault();
        pf.handleTouchMove(e.touches);
        setPfOffset({ x: pf.offsetX, y: pf.offsetY, scale: pf.offsetScale, rotation: pf.offsetRotation });
      }
    };

    const onEnd = (e) => {
      if (pf) {
        pf.handleTouchEnd(e.touches.length);
        setPfEditing(pf.isEditing);
      }
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd, { passive: true });
    el.addEventListener('touchcancel', onEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [screen]);

  // Precision Fit UX — controla hint "Ajuste com dois dedos" e auto-hide em 2s
  useEffect(() => {
    if (pfEditing) {
      setPfHintVisible(true);
      clearTimeout(pfHintTimerRef.current);
      pfHintTimerRef.current = setTimeout(() => setPfHintVisible(false), 2000);
    } else {
      clearTimeout(pfHintTimerRef.current);
      setPfHintVisible(false);
    }
    return () => clearTimeout(pfHintTimerRef.current);
  }, [pfEditing]);

  const handlePrecisionFitReset = useCallback(() => {
    precisionFitRef.current?.reset();
    setPfOffset({ x: 0, y: 0, scale: 1, rotation: 0 });
    setPfEditing(false);
  }, []);

  const captureAndGenerate = useCallback(async () => {
    if (hasGeneratedRef.current) return;
    // Guard absoluto: produto com GLB estático nunca executa pipeline
    const _guardProd = testProductId
      ? ProductAdapter.fromParams({ productId: testProductId })
      : ProductAdapter.getActive();

    if (_guardProd?.modelUrl) {
      hasGeneratedRef.current = true; return;
    }
    hasGeneratedRef.current = true;

    setPipelineError(null);

    // Perf: início da geração GLB
    const glbStart = performance.now();
    perfRef.current.glbStartAt = glbStart;

    try {
      const video = videoRef.current;
      if (!video || video.readyState < 2) {
        hasGeneratedRef.current = false;
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width  = video.videoWidth  || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (camMode === 'user') { ctx.save(); ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
      ctx.drawImage(video, 0, 0);
      if (camMode === 'user') ctx.restore();

      const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.9));
      if (!blob || !activeRef.current) return;

      const url = await imagePipelineRef.current.run(blob, {
        onProgress: (stage) => { if (activeRef.current) setPipelineStage(stage); },
      });

      if (url && activeRef.current) {
        // Perf: fim da geração + modelo disponível
        const now = performance.now();
        perfRef.current.glbEndAt    = now;
        perfRef.current.modelLoadedAt = now;
        setPerfMetrics(prev => ({
          ...prev,
          glbGenerationTime: now - glbStart,
          timeToModel: perfRef.current.scannerOpenedAt
            ? now - perfRef.current.scannerOpenedAt
            : null,
        }));

        setGeneratedModelUrl(url);
        setPipelineStage('READY');

        // Persistir asset gerado no repositório local
        // Error recovery (Etapa 3): falha silenciosa — nunca bloqueia o app
        const pid = testProductId || ProductAdapter.getActive().productId || 'ghost_generated';
        const asset = new ProductAsset({
          productId:    pid,
          storeId:      'ghost',
          sku:          pid,
          name:         'Produto Gerado',
          brand:        'Ghost Project AI',
          category:     'generated',
          glbModel:     url,
          metadata:     { generatedAt: Date.now(), provider: 'auto' },
        });
        asset.status = AssetStatus.READY;
        assetRepoRef.current?.save(asset).catch((saveErr) => {
          console.warn('[Asset] Falha ao persistir no localStorage — dado disponível apenas em memória:', saveErr.message);
        });
        // REGRA 5: atualizar ProductAdapter para usar GLB gerado nas próximas execuções
        ProductAdapter.cacheGeneratedModel(pid, url);
      }
    } catch (err) {
      console.error('[Pipeline]', err);
      if (activeRef.current) {
        setPipelineStage('ERROR');
        setPipelineError('Falha ao gerar modelo. Tente novamente.');
        hasGeneratedRef.current = false;
        perfRef.current.glbStartAt = null;
      }
    }
  }, [camMode, testProductId]);

  const retryGenerate = useCallback(() => {
    setPipelineStage(null);
    setPipelineError(null);
    hasGeneratedRef.current = false;
    const t = setTimeout(captureAndGenerate, 500);
    return () => clearTimeout(t);
  }, [captureAndGenerate]);

  const trackingActive = watch.size > 0;
  useEffect(() => {
    // Perf: tempo até primeiro tracking ativo
    if (trackingActive && perfRef.current.firstTrackingAt === null && perfRef.current.scannerOpenedAt !== null) {
      const now = performance.now();
      perfRef.current.firstTrackingAt = now;
      setPerfMetrics(prev => ({
        ...prev,
        timeToTracking: now - perfRef.current.scannerOpenedAt,
        firstRenderTime: perfRef.current.firstRenderAt
          ? perfRef.current.firstRenderAt - perfRef.current.scannerOpenedAt
          : null,
      }));
    }

    if (!trackingActive || screen !== 'scanner' || hasGeneratedRef.current) return;
    // Guard extra: nunca disparar pipeline se produto tem GLB
    const _activeProd = testProductId
      ? ProductAdapter.fromParams({ productId: testProductId })
      : ProductAdapter.getActive();

    if (_activeProd?.modelUrl) return;
    const t = setTimeout(captureAndGenerate, 1500);
    return () => clearTimeout(t);
  }, [trackingActive, screen, captureAndGenerate, testProductId]);

  useEffect(() => {
    if (pipelineStage !== 'READY') return;
    const t = setTimeout(() => setPipelineStage(null), 3000);
    return () => clearTimeout(t);
  }, [pipelineStage]);

  // [M043] Etapa 6 — log do src final carregado no model-viewer
  useEffect(() => {
    if (screen !== 'scanner') return;
    console.log('[M043][Etapa6-model-viewer] generatedModelUrl (state):', generatedModelUrl);
  }, [screen, generatedModelUrl]);

  // Fallback para pipeline se GLB falhar ao carregar
  useEffect(() => {
    const mv = modelViewerRef.current;
    if (!mv || screen !== 'scanner') return;
    const handleModelError = () => {
      if (!generatedModelUrl) {
        hasGeneratedRef.current = false;
      }
    };
    mv.addEventListener('error', handleModelError);
    return () => mv.removeEventListener('error', handleModelError);
  }, [screen, generatedModelUrl]);

  const closeScanner = () => {
    GhostProject._emit('onClose', {});
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

  const takeScreenshot = useCallback(async () => {
    if (isCapturing) return;
    setIsCapturing(true);
    try {
      const video = videoRef.current;
      const mv    = modelViewerRef.current;
      if (!video) return;

      const w = video.videoWidth  || video.clientWidth;
      const h = video.videoHeight || video.clientHeight;

      const canvas = document.createElement('canvas');
      canvas.width  = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');

      if (camMode === 'user') { ctx.save(); ctx.translate(w, 0); ctx.scale(-1, 1); }
      ctx.drawImage(video, 0, 0, w, h);
      if (camMode === 'user') ctx.restore();

      if (mv) {
        const mvCanvas = mv.shadowRoot?.querySelector('canvas');
        if (mvCanvas) {
          const mvRect = mv.getBoundingClientRect();
          const vRect  = video.getBoundingClientRect();
          const sx = w / vRect.width;
          const sy = h / vRect.height;
          ctx.drawImage(mvCanvas,
            (mvRect.left - vRect.left) * sx,
            (mvRect.top  - vRect.top)  * sy,
            mvRect.width  * sx,
            mvRect.height * sy
          );
        }
      }

      const barH = Math.round(h * 0.06);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, h - barH, w, barH);
      ctx.fillStyle = '#D4AF37';
      ctx.font = `500 ${Math.round(barH * 0.38)}px sans-serif`;
      ctx.fillText('Powered by Ghost Project AI',
        Math.round(w * 0.04),
        h - Math.round(barH * 0.22)
      );

      canvas.toBlob((blob) => {
        const file = new File([blob], 'ghost-project-ar.jpg', { type: 'image/jpeg' });
        GhostProject._emit('onScreenshot', { blob });
        setScreenshotDone(true);
        setTimeout(() => setScreenshotDone(false), 1600);
        if (navigator.canShare?.({ files: [file] })) {
          navigator.share({ files: [file], title: 'Ghost Project AI' })
            .then(() => GhostProject._emit('onShare', {}))
            .catch(() => {});
        } else {
          const url = URL.createObjectURL(blob);
          const a   = document.createElement('a');
          a.href     = url;
          a.download = 'ghost-project-ar.jpg';
          a.click();
          URL.revokeObjectURL(url);
        }
      }, 'image/jpeg', 0.92);

    } catch (err) {
      // Error recovery (Etapa 3): screenshot falhou — log sem interromper app
      console.error('[Screenshot]', err);
    } finally {
      setIsCapturing(false);
    }
  }, [camMode, isCapturing]);

  // ─── LANDING PAGE ────────────────────────────────────────────────────────
  if (showLandingPage) {
    return <LandingPage onClose={() => setShowLandingPage(false)} />;
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
    const _qrParams = new URLSearchParams(window.location.search);
    // Garante que productId e embedded estejam no QR
    if (!_qrParams.get('productId')) {
      const _activePid = ProductAdapter.getActive().productId;
      if (_activePid) _qrParams.set('productId', _activePid);
    }
    _qrParams.set('embedded', 'true');
    const qrUrl = window.location.origin + window.location.pathname + '?' + _qrParams.toString();
    const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUrl)}`;

    return (
      <div className="home">
        <div className="home-background" style={{ backgroundImage: 'url("/logo.jpeg")' }} />
        <div className="home-content">
          <div style={{ textAlign: 'center', animation: 'hero3d-enter 0.7s cubic-bezier(0.16,1,0.3,1) both' }}>
            <p style={{
              color: '#D4AF37',
              fontSize: '9px',
              letterSpacing: '0.32em',
              fontWeight: 400,
              marginBottom: '6px',
              textTransform: 'uppercase',
              opacity: 0.9,
            }}>
              Ghost Project AI
            </p>
            <p style={{
              color: 'rgba(255,255,255,0.48)',
              fontSize: '11px',
              letterSpacing: '0.18em',
              fontWeight: 300,
              marginBottom: '28px',
              textTransform: 'uppercase',
            }}>
              Experiência AR no celular
            </p>
            <div style={{
              background: '#fff',
              padding: '14px',
              borderRadius: '16px',
              display: 'inline-block',
              marginBottom: '22px',
              boxShadow: '0 0 0 1px rgba(212,175,55,0.38), 0 12px 48px rgba(0,0,0,0.7)',
            }}>
              <img src={qrSrc} alt="QR Code" width={200} height={200} />
            </div>
            <p style={{
              color: 'rgba(255,255,255,0.72)',
              fontSize: '13px',
              letterSpacing: '0.05em',
              fontWeight: 300,
              marginBottom: '5px',
            }}>
              Aponte a câmera do celular
            </p>
            <p style={{
              color: 'rgba(212,175,55,0.52)',
              fontSize: '10px',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              marginBottom: '36px',
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

  // ─── 360° PREVIEW ────────────────────────────────────────────────────────
  if (show360) {
    const p360 = ProductAdapter.getActive();
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        background: '#f8f8f8',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0,
        fontFamily: "'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}>
        <UrlDiagnosticsPanel />
        {/* Cabeçalho */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          padding: '20px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <p style={{
            color: 'rgba(10,10,10,0.35)',
            fontSize: '9px',
            letterSpacing: '0.32em',
            fontWeight: 400,
            textTransform: 'uppercase',
            margin: 0,
          }}>
            Ghost Project AI
          </p>
        </div>

        {/* Título do produto */}
        {p360?.productName && (
          <p style={{
            color: 'rgba(10,10,10,0.72)',
            fontSize: '13px',
            fontWeight: 400,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            marginBottom: '8px',
            marginTop: '0',
            textAlign: 'center',
          }}>
            {p360.productName}
          </p>
        )}

        {/* Visualizador 360° */}
        <Hero3D
          modelSrc={p360?.modelUrl}
          productName={p360?.productName}
        />

        {/* Botões de ação */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          width: '100%',
          maxWidth: '320px',
          padding: '0 24px',
          marginTop: '4px',
        }}>
          <button
            onClick={() => {
              setShow360(false);
              openScanner(p360?.productId || null);
            }}
            style={{
              background: '#0a0a0a',
              border: 'none',
              borderRadius: '14px',
              color: '#ffffff',
              fontSize: '11px',
              fontWeight: 500,
              letterSpacing: '0.22em',
              padding: '14px 20px',
              cursor: 'pointer',
              textTransform: 'uppercase',
              transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.14)',
            }}
          >
            VER EM AR
          </button>
          <button
            onClick={() => {
              setShow360(false);
              handleBuyNow();
            }}
            style={{
              background: 'rgba(10,10,10,0.04)',
              border: '1px solid rgba(0,0,0,0.12)',
              borderRadius: '14px',
              color: 'rgba(10,10,10,0.62)',
              fontSize: '11px',
              fontWeight: 400,
              letterSpacing: '0.18em',
              padding: '13px 20px',
              cursor: 'pointer',
              textTransform: 'uppercase',
              transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
            }}
          >
            COMPRAR AGORA
          </button>
        </div>

        {/* Watermark */}
        <p style={{
          position: 'absolute',
          bottom: '16px',
          left: 0,
          right: 0,
          textAlign: 'center',
          color: 'rgba(0,0,0,0.12)',
          fontSize: '9px',
          letterSpacing: '0.20em',
          fontWeight: 400,
          textTransform: 'uppercase',
          margin: 0,
          pointerEvents: 'none',
        }}>
          Powered by Ghost Project AI
        </p>
      </div>
    );
  }

  // ─── HOME ────────────────────────────────────────────────────────────────
  if (screen === 'home') {
    return (
      <div className="home">
        <UrlDiagnosticsPanel />
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

          {/* Ghost Diagnostics — disponível também na home em DEV */}
          {import.meta.env.DEV && (
            <GhostDiagnostics
              trackerRef={trackerRef}
              pipelineRef={pipelineRef}
              precisionFitRef={precisionFitRef}
              imagePipelineRef={imagePipelineRef}
              perfMetrics={perfMetrics}
              healthIssues={healthIssues}
            />
          )}

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
                openScanner(ProductAdapter.getActive().productId);
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

  // Precision Fit: aplica offset manual sobre a pose do WristTracker
  const finalWatch = {
    ...watch,
    x: watch.x + pfOffset.x,
    y: watch.y + pfOffset.y,
    size: watch.size * pfOffset.scale,
    rotation: watch.rotation + pfOffset.rotation,
  };

  const watchContainerStyle = {
    position: 'fixed',
    left: `${finalWatch.x}px`,
    top: `${finalWatch.y}px`,
    width: `${finalWatch.size}px`,
    height: `${finalWatch.size}px`,
    pointerEvents: 'none',
    zIndex: 15,
    opacity: shouldRenderWatch ? 1 : 0,
    transition: pfEditing
      ? 'opacity 0.3s ease, filter 0.25s cubic-bezier(0.25,0.46,0.45,0.94), transform 0.18s cubic-bezier(0.34,1.56,0.64,1)'
      : 'opacity 0.10s ease, filter 0.10s ease, transform 0.18s cubic-bezier(0.34,1.2,0.64,1), width 0.08s linear, height 0.08s linear',
    perspective: '900px',
    perspectiveOrigin: '50% 50%',
    transform: pfEditing
      ? 'translate(-50%, -50%) scale(1.06)'
      : shouldRenderWatch
        ? 'translate(-50%, -50%) scale(1)'
        : 'translate(-50%, -50%) scale(0.92)',
    filter: pfEditing
      ? [
          'drop-shadow(0 16px 48px rgba(0,0,0,0.72))',
          'drop-shadow(0 0 28px rgba(212,175,55,0.95))',
          'drop-shadow(0 0 56px rgba(212,175,55,0.52))',
          'drop-shadow(0 0 96px rgba(212,175,55,0.22))',
        ].join(' ')
      : 'drop-shadow(0 10px 30px rgba(0,0,0,0.5))',
  };

  const watchStyle = {
    width: '100%',
    height: '100%',
    transform: `rotateZ(${finalWatch.rotation}deg)`,
    transformStyle: 'preserve-3d',
    transformOrigin: 'center center',
    filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.4))',
  };

  // ─── SCANNER ─────────────────────────────────────────────────────────────
  const _scanProduct  = testProductId
    ? ProductAdapter.fromParams({ productId: testProductId })
    : ProductAdapter.getActive();
  const productId     = _scanProduct.productId;
  const modelUrl      = _scanProduct.modelUrl;
  const hasValidProduct = productId && modelUrl;

  return (
    <div className="scanner" ref={scannerDivRef}>
      <UrlDiagnosticsPanel />
      {/* Ghost Diagnostics — apenas em desenvolvimento (Etapas 1, 2, 4) */}
      {import.meta.env.DEV && (
        <GhostDiagnostics
          trackerRef={trackerRef}
          pipelineRef={pipelineRef}
          precisionFitRef={precisionFitRef}
          imagePipelineRef={imagePipelineRef}
          perfMetrics={perfMetrics}
          healthIssues={healthIssues}
        />
      )}
      {/* Video sempre renderizado quando screen === 'scanner' */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="video-feed"
        style={camMode === 'user' ? { transform: 'scaleX(-1)' } : {}}
      />

      {/* Indicador de recalibração — exibido quando tracking é perdido */}
      {hasValidProduct && !shouldRenderWatch && (
        <div style={{
          position: 'fixed',
          top: 'calc(50% + 148px)',
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          zIndex: 18,
          pointerEvents: 'none',
          animation: 'ghostFadeInY 0.5s cubic-bezier(0.4,0,0.2,1) both',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '7px',
            background: 'rgba(0,0,0,0.36)',
            border: '1px solid rgba(212,175,55,0.10)',
            borderRadius: '20px',
            padding: '6px 15px',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}>
            <div style={{
              width: '10px',
              height: '10px',
              border: '1.5px solid rgba(212,175,55,0.15)',
              borderTopColor: 'rgba(212,175,55,0.65)',
              borderRadius: '50%',
              animation: 'ghostSpin 1s linear infinite',
              flexShrink: 0,
            }} />
            <p style={{
              color: 'rgba(255,255,255,0.42)',
              fontSize: '10px',
              letterSpacing: '0.10em',
              fontWeight: 400,
              whiteSpace: 'nowrap',
              margin: 0,
            }}>
              Recalibrando
            </p>
          </div>
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

          {/* Flash visual no momento da captura */}
          {isCapturing && (
            <div style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(255,255,255,0.14)',
              zIndex: 50,
              pointerEvents: 'none',
              animation: 'screenshotFlash 0.35s ease forwards',
            }} />
          )}

          {/* Botão screenshot — canto superior direito */}
          <button
            onClick={takeScreenshot}
            disabled={isCapturing}
            style={{
              position: 'fixed',
              top: '16px',
              right: '14px',
              zIndex: 20,
              background: screenshotDone
                ? 'rgba(46,213,115,0.22)'
                : 'rgba(0,0,0,0.50)',
              border: screenshotDone
                ? '1px solid rgba(46,213,115,0.55)'
                : '1px solid rgba(255,255,255,0.18)',
              borderRadius: '20px',
              padding: '9px 14px',
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              cursor: isCapturing ? 'wait' : 'pointer',
              opacity: isCapturing ? 0.5 : 1,
              transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
            }}
            title="Compartilhar experiência AR"
          >
            {screenshotDone ? (
              <span style={{ color: 'rgba(46,213,115,0.95)', fontSize: '13px', lineHeight: 1 }}>✓</span>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.82)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="18" cy="5" r="3"/>
                <circle cx="6" cy="12" r="3"/>
                <circle cx="18" cy="19" r="3"/>
                <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98"/>
              </svg>
            )}
            <span style={{
              color: screenshotDone ? 'rgba(46,213,115,0.92)' : 'rgba(255,255,255,0.80)',
              fontSize: '9px',
              fontWeight: 500,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
            }}>
              {screenshotDone ? 'Salvo!' : 'Compartilhar'}
            </span>
          </button>

          {/* Pipeline — indicador de progresso + erro + retry */}
          {pipelineStage && (
            <div style={{
              position: 'fixed',
              top: '16px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 22,
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: pipelineStage === 'READY'
                ? 'rgba(46,213,115,0.12)'
                : pipelineStage === 'ERROR'
                  ? 'rgba(255,68,68,0.12)'
                  : 'rgba(0,0,0,0.52)',
              border: `1px solid ${
                pipelineStage === 'READY'
                  ? 'rgba(46,213,115,0.5)'
                  : pipelineStage === 'ERROR'
                    ? 'rgba(255,68,68,0.45)'
                    : 'rgba(255,255,255,0.12)'
              }`,
              borderRadius: '20px',
              padding: '5px 16px',
              color: pipelineStage === 'READY'
                ? '#2ed573'
                : pipelineStage === 'ERROR'
                  ? '#ff6b6b'
                  : 'rgba(255,255,255,0.82)',
              fontSize: '10px',
              letterSpacing: '0.12em',
              fontWeight: 500,
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
              whiteSpace: 'nowrap',
            }}>
              <span style={{ pointerEvents: 'none' }}>
                {PIPELINE_LABELS[pipelineStage] ?? pipelineStage}
              </span>
              {pipelineStage === 'ERROR' && (
                <button
                  onClick={retryGenerate}
                  style={{
                    background: 'rgba(255,255,255,0.12)',
                    border: '1px solid rgba(255,255,255,0.22)',
                    borderRadius: '12px',
                    color: '#fff',
                    fontSize: '10px',
                    fontWeight: 600,
                    letterSpacing: '0.08em',
                    padding: '3px 10px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Retry
                </button>
              )}
            </div>
          )}

          {/* Precision Fit — indicador de modo ativo */}
          {pfEditing && (
            <div style={{
              position: 'fixed',
              top: '70px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 20,
              background: 'rgba(212,175,55,0.18)',
              border: '1px solid rgba(212,175,55,0.55)',
              borderRadius: '20px',
              padding: '5px 16px',
              color: '#D4AF37',
              fontSize: '11px',
              letterSpacing: '0.14em',
              fontWeight: 500,
              pointerEvents: 'none',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              animation: 'pfEnter 0.25s cubic-bezier(0.4,0,0.2,1) both',
            }}>
              PRECISION FIT
            </div>
          )}

          {/* Botão Reset Position — discreto, canto inferior esquerdo */}
          <button
            onClick={handlePrecisionFitReset}
            style={{
              position: 'fixed',
              bottom: '100px',
              left: '16px',
              zIndex: 20,
              background: 'rgba(0,0,0,0.4)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '8px',
              padding: '6px 10px',
              color: 'rgba(255,255,255,0.55)',
              fontSize: '10px',
              letterSpacing: '0.08em',
              cursor: 'pointer',
              backdropFilter: 'blur(4px)',
              transition: 'opacity 0.2s',
              opacity: (pfOffset.x !== 0 || pfOffset.y !== 0 || pfOffset.scale !== 1 || pfOffset.rotation !== 0) ? 1 : 0.3,
            }}
            title="Resetar ajuste manual"
          >
            Reset Position
          </button>

          <div className="watch-container" style={watchContainerStyle}>
            {/* Precision Fit UX — hint flutuante acima do produto */}
            <div style={{
              position: 'absolute',
              bottom: '100%',
              left: '50%',
              marginBottom: '10px',
              color: '#D4AF37',
              fontSize: '12px',
              fontWeight: 500,
              letterSpacing: '0.1em',
              background: 'rgba(0,0,0,0.58)',
              padding: '6px 14px',
              borderRadius: '14px',
              whiteSpace: 'nowrap',
              opacity: pfHintVisible ? 1 : 0,
              transform: pfHintVisible ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(5px)',
              transition: 'opacity 0.35s ease, transform 0.35s cubic-bezier(0.4,0,0.2,1)',
              pointerEvents: 'none',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              zIndex: 1,
            }}>
              Ajuste com dois dedos
            </div>
            <div style={watchStyle}>
              <model-viewer
                ref={modelViewerRef}
                src={generatedModelUrl || modelUrl}
                disable-zoom
                shadow-intensity="0.8"
                exposure="1.0"
                interaction-prompt="none"
                camera-orbit="0deg 78deg 105%"
                field-of-view="26deg"
                min-camera-orbit="auto auto 105%"
                max-camera-orbit="auto auto 105%"
                tone-mapping="neutral"
                orientation="0deg 0deg -90deg"
                scale="2 2 2"
                style={{
                  width: '100%',
                  height: '100%',
                  background: 'transparent',
                  opacity: 0.98
                }}
              />
            </div>
          </div>

          {/* HUD — botão Voltar visível apenas fora do store mode */}
          {(!ProductAdapter.isStoreMode() || cameFromTestModels) && (
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
          )}

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
                  Escolher Outro Produto
                </button>
              </div>
            )}
          </div>

          {/* Ghost Project AI Signature — interativo fora da loja, watermark na loja */}
          <div className="ghost-signature">
            {ProductAdapter.isStoreMode() ? (
              <span className="ghost-signature-btn" style={{ cursor: 'default', pointerEvents: 'none', opacity: 0.4 }}>
                Powered by Ghost Project AI
              </span>
            ) : (
              <button
                className="ghost-signature-btn"
                onClick={() => setShowB2BModal(true)}
              >
                Powered by Ghost Project AI
              </button>
            )}
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
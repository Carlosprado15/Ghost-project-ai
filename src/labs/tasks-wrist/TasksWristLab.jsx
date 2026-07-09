import { useEffect, useRef, useState, useCallback } from 'react';
import { useGhostWristAR } from '../../engine/react/useGhostWristAR.js';
import { runCalibration } from './calibrationRunner.js';
import { computeTrackingContinuity } from './calibrationMetrics.js';
import productsData from '../../data/products.json';
// M069F: preset que emula o smoothing alpha=0.35 da demo de 25/05/2026 —
// ponto de partida do modo ③ (o feeling comprovado com investidores).
import legacySmoothPreset from '../../engine/config/legacy-smooth.json';

// ── Product resolution from URL ───────────────────────────────────────────────
// Falls back to CW001 when no ?productId= in URL (lab default)
const _ACTIVE_PRODUCT = (() => {
  const id = new URLSearchParams(window.location.search).get('productId');
  return productsData.find(p => p.id === id) ?? productsData.find(p => p.id === 'CW001');
})();
// ?useNormalized=1 → usa os GLBs de public/models/normalized/ (pipeline
// scripts/normalize-glb/) para comparação A/B sem tocar nos originais.
const USE_NORMALIZED = new URLSearchParams(window.location.search).get('useNormalized') === '1';
const _BASE_GLB_URL  = _ACTIVE_PRODUCT?.modelUrl ?? '/models/CW001.glb';
const GLB_URL        = USE_NORMALIZED
  ? _BASE_GLB_URL.replace('/models/', '/models/normalized/')
  : _BASE_GLB_URL;
const ACTIVE_PRODUCT_ID = _ACTIVE_PRODUCT?.id ?? 'CW001';

const WATCH_W_NORM = 0.22;  // usado apenas quando DEBUG_OVERLAY=true
const STATIC_MS    = 3000;
const SLOW_MS      = 4000;
const REPORT_URL   = 'http://localhost:5174/report';

// ── Ajustes visuais ───────────────────────────────────────────────────────────
// Razão entre largura do relógio e (span lm5–lm17 × largura da tela).
// Faixa útil: 3.0 = discreto · 4.5 = natural · 6.0 = grande
const WRIST_SCALE_MULTIPLIER = 4.5;

// true  → mostra caixa de bounding-box + círculo de pulso no canvas (debug)
// false → experiência limpa, apenas o GLB ancorado no pulso
const DEBUG_OVERLAY = false;

const IS_AUTO = new URLSearchParams(window.location.search).get('auto') === '1';

// ── Helpers ──────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const panelBase = {
  background:     'rgba(0,0,0,0.85)',
  backdropFilter: 'blur(6px)',
  color:          '#e2e8f0',
  borderRadius:   10,
  fontFamily:     'monospace',
  fontSize:       11,
  border:         '1px solid rgba(255,255,255,0.10)',
  padding:        '10px 14px',
};

const mkBtn = (bg, disabled) => ({
  padding: '11px 18px', borderRadius: 8, border: 'none',
  background: disabled ? '#374151' : bg,
  color: '#fff', cursor: disabled ? 'default' : 'pointer',
  fontSize: 13, fontFamily: 'sans-serif', fontWeight: 600,
  opacity: disabled ? 0.45 : 1,
});

// ── Auto overlay messages ─────────────────────────────────────────────────────
const AUTO_MESSAGES = {
  'waiting-hand': { text: 'MOSTRE O PULSO NA CÂMERA', sub: 'aguardando detecção…',  color: '#facc15' },
  'prepare':      { text: 'PREPARE O PULSO',         sub: 'segure o pulso em frente à câmera', color: '#38bdf8' },
  'static':       { text: 'NÃO MOVA',                sub: 'gravando posição estática…', color: '#f87171' },
  'retry-static': { text: 'MÃO NÃO DETECTADA',       sub: 'REPOSICIONE o pulso…',    color: '#fb923c' },
  'transition':   { text: 'AGORA MOVA DEVAGAR',      sub: 'prepare o movimento lento', color: '#a78bfa' },
  'slow':         { text: 'MOVA DEVAGAR',             sub: 'gravando movimento…',      color: '#f97316' },
  'calibrating':  { text: 'CALCULANDO…',              sub: 'testando 49 combinações',  color: '#34d399' },
  'posting':      { text: 'SALVANDO RELATÓRIO…',      sub: '',                         color: '#34d399' },
  'done':         { text: '✓ CONCLUÍDO',              sub: '',                         color: '#4ade80' },
  'failed':       { text: '✗ ERRO',                   sub: '',                         color: '#f87171' },
};

// ─────────────────────────────────────────────────────────────────────────────

export default function TasksWristLab() {
  const videoRef   = useRef(null);
  const canvasRef  = useRef(null);
  const streamRef  = useRef(null);
  const mountedRef = useRef(true);
  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  // Camera
  const [facingMode, setFacingMode] = useState('environment');
  const [camReady,   setCamReady]   = useState(false);
  const [camError,   setCamError]   = useState(null);

  // GLB toggle
  const [glbActive, setGlbActive] = useState(true);

  // M069D: três modos visuais exclusivos (um por vez):
  //  'center'   → ① GLB fixo no centro — prova de render, NÃO testa pulso
  //  'tracking' → ② overlay de tracking no canvas, SEM GLB
  //  'wrist'    → ③ GLB ancorado no pulso — objetivo final
  // Estado inicial: 'center' (mais confiável para primeiro teste).
  // Exceção: no fluxo ?auto=1 inicia em 'wrist', pois a calibração termina
  // pedindo para avaliar o relógio ancorado no pulso.
  const [mode, setMode] = useState(IS_AUTO ? 'wrist' : 'center');
  const forceCenter = mode === 'center';

  // Erro de carga do GLB (404/parse) — nunca silencioso
  const [glbError, setGlbError] = useState(null);

  // HUD compacto por padrão; expande no botão "▼ HUD"
  const [hudOpen, setHudOpen] = useState(false);
  const attachGlbErrorListener = useCallback((el) => {
    if (!el || el.dataset.errBound) return;
    el.dataset.errBound = '1';
    el.addEventListener('error', () => setGlbError(`Erro: GLB não carregou — ${GLB_URL}`));
  }, []);

  // Manual recording (shared with auto flow via refs)
  const recModeRef   = useRef('idle');
  const recBufferRef = useRef([]);
  const [recState,     setRecState]     = useState('idle');
  const [recCountdown, setRecCountdown] = useState(0);
  const [staticLog,    setStaticLog]    = useState(null);
  const [slowLog,      setSlowLog]      = useState(null);
  const countdownRef = useRef(null);

  // Calibration
  const [calibRunning, setCalibRunning] = useState(false);
  const [calibResults, setCalibResults] = useState(null);
  const [calibError,   setCalibError]   = useState(null);
  const [showReport,   setShowReport]   = useState(false);

  // Filter preset — inicia com legacy-smooth (M069F); calibração pode trocar
  const [activePreset, setActivePreset] = useState({ ...legacySmoothPreset });

  // Auto mode state
  const autoRunningRef  = useRef(false);
  const [autoPhase,     setAutoPhase]     = useState(IS_AUTO ? 'waiting-hand' : null);
  const [autoProgress,  setAutoProgress]  = useState(0);
  const [autoCountdown, setAutoCountdown] = useState(0);
  const [autoBestCombo, setAutoBestCombo] = useState(null);
  const [autoError,     setAutoError]     = useState(null);
  const autoTriggeredRef = useRef(false);

  // ── onRawFrame (stable ref pattern) ────────────────────────────────────────
  const onRawFrame = useCallback((frame) => {
    const mode = recModeRef.current;
    if (mode === 'recording-static' || mode === 'recording-slow') {
      recBufferRef.current.push(frame);
    }
  }, []);

  // ── Engine hook ─────────────────────────────────────────────────────────────
  const tracking = useGhostWristAR({ videoRef, enabled: camReady, onRawFrame, filterPreset: legacySmoothPreset });
  const { isTracking, position, rotationZ, scale, raw, filtered, landmarks, fps, error: trackError, ready, mvReady, mvError, delegate, warning, modelSource, updateFilterPreset } = tracking;

  // M069G: watchdog visível do carregamento do detector de mão.
  // 'ok' → nada · 'slow' (>10s) → aviso amarelo · 'timeout' (>30s) → erro vermelho
  const [lmWaitState, setLmWaitState] = useState('ok');
  useEffect(() => {
    if (ready || trackError || !camReady) { setLmWaitState('ok'); return; }
    const t10 = setTimeout(() => setLmWaitState('slow'), 10000);
    const t30 = setTimeout(() => setLmWaitState('timeout'), 30000);
    return () => { clearTimeout(t10); clearTimeout(t30); };
  }, [camReady, ready, trackError]);

  // ── Camera ──────────────────────────────────────────────────────────────────
  // cameraStarting: bloqueia chamadas concorrentes de start — causa do erro
  // "The play() request was interrupted by a new load request".
  // Sequência obrigatória: stop() do stream anterior → await → start() novo.
  const camStartingRef = useRef(false);
  const [camStarting, setCamStarting] = useState(false);

  const startCamera = useCallback(async (facing) => {
    if (camStartingRef.current) return;   // start em andamento — ignora
    camStartingRef.current = true;
    setCamStarting(true);
    setCamReady(false);
    setCamError(null);
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCamReady(true);
    } catch (e) {
      setCamError(`Câmera: ${e.message}`);
    } finally {
      camStartingRef.current = false;
      setCamStarting(false);
    }
  }, []);

  useEffect(() => {
    startCamera(facingMode);
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, [facingMode, startCamera]);

  // ── Manual recording ────────────────────────────────────────────────────────
  function startRecording(mode, durationMs) {
    if (recModeRef.current !== 'idle') return;
    recBufferRef.current = [];
    recModeRef.current   = mode;
    setRecState(mode);
    setRecCountdown(Math.ceil(durationMs / 1000));

    let remaining = durationMs;
    countdownRef.current = setInterval(() => {
      remaining -= 500;
      setRecCountdown(Math.max(0, Math.ceil(remaining / 1000)));
      if (remaining <= 0) {
        clearInterval(countdownRef.current);
        const frames         = [...recBufferRef.current];
        recBufferRef.current = [];
        recModeRef.current   = 'idle';
        setRecState('idle');
        if (mode === 'recording-static') setStaticLog(frames);
        if (mode === 'recording-slow')   setSlowLog(frames);
      }
    }, 500);
  }

  useEffect(() => () => { if (countdownRef.current) clearInterval(countdownRef.current); }, []);

  // ── Promise-based recording for auto flow ───────────────────────────────────
  function recordWithProgress(mode, durationMs) {
    return new Promise((resolve) => {
      recBufferRef.current = [];
      recModeRef.current   = mode;
      setRecState(mode);
      setAutoProgress(0);

      const start = performance.now();
      const timer = setInterval(() => {
        const elapsed = performance.now() - start;
        setAutoProgress(Math.min(100, Math.round((elapsed / durationMs) * 100)));
        if (elapsed >= durationMs) {
          clearInterval(timer);
          const frames         = [...recBufferRef.current];
          recBufferRef.current = [];
          recModeRef.current   = 'idle';
          setRecState('idle');
          setAutoProgress(100);
          resolve(frames);
        }
      }, 100);
    });
  }

  // ── Auto sequence ───────────────────────────────────────────────────────────
  const applyPreset = useCallback((combo) => {
    updateFilterPreset({ minCutoff: combo.minCutoff, beta: combo.beta, dCutoff: combo.dCutoff });
    setActivePreset(combo);
  }, [updateFilterPreset]);

  async function runAutoSequence() {
    if (autoRunningRef.current) return;
    autoRunningRef.current = true;

    const safe = (fn) => { if (mountedRef.current) fn(); };

    try {
      // ── Prepare + 3-2-1 countdown ──
      safe(() => setAutoPhase('prepare'));
      for (let i = 3; i > 0; i--) {
        safe(() => setAutoCountdown(i));
        await sleep(1000);
      }
      safe(() => setAutoCountdown(0));

      // ── Static recording (up to 3 attempts) ──
      let staticFrames = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) {
          safe(() => setAutoPhase('retry-static'));
          await sleep(2500);
        }

        safe(() => setAutoPhase('static'));
        const frames = await recordWithProgress('recording-static', STATIC_MS);
        const cont   = computeTrackingContinuity(frames);

        if (cont >= 0.80) {
          staticFrames = frames;
          break;
        }

        if (attempt === 2) {
          safe(() => {
            setAutoPhase('failed');
            setAutoError('Mão não detectada após 3 tentativas. Ajuste a iluminação, o ângulo do pulso ou tente em ambiente mais claro.');
          });
          return;
        }
      }

      // ── Transition ──
      safe(() => setAutoPhase('transition'));
      for (let i = 2; i > 0; i--) {
        safe(() => setAutoCountdown(i));
        await sleep(1000);
      }
      safe(() => setAutoCountdown(0));

      // ── Slow-motion recording ──
      safe(() => setAutoPhase('slow'));
      const slowFrames = await recordWithProgress('recording-slow', SLOW_MS);

      safe(() => {
        setStaticLog(staticFrames);
        setSlowLog(slowFrames);
      });

      // ── Calibration ──
      safe(() => { setAutoPhase('calibrating'); setCalibRunning(true); });
      await sleep(30); // yield one frame so React can re-render
      const results = runCalibration(staticFrames, slowFrames);
      safe(() => { setCalibResults(results); setCalibRunning(false); });

      // ── Apply best preset ──
      applyPreset(results.best);

      // ── POST report ──
      safe(() => setAutoPhase('posting'));
      try {
        await fetch(REPORT_URL, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ markdown: results.reportMd }),
        });
      } catch (e) {
        // Non-fatal — report server may not be running
        console.warn('[auto] POST relatório falhou:', e.message);
      }

      safe(() => {
        setAutoBestCombo(results.best);
        setAutoPhase('done');
      });

    } catch (e) {
      safe(() => {
        setAutoPhase('failed');
        setAutoError(e.message);
        setCalibRunning(false);
      });
    } finally {
      autoRunningRef.current = false;
    }
  }

  // Trigger auto sequence on first hand detection
  useEffect(() => {
    if (!IS_AUTO || !tracking.isTracking) return;
    if (autoPhase !== 'waiting-hand' || autoTriggeredRef.current) return;
    autoTriggeredRef.current = true;
    runAutoSequence();
  }, [tracking.isTracking, autoPhase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Manual calibration ──────────────────────────────────────────────────────
  async function handleCalibrate() {
    if (!staticLog || !slowLog) return;
    setCalibRunning(true);
    setCalibError(null);
    setCalibResults(null);
    try {
      await sleep(0);
      const results = runCalibration(staticLog, slowLog);
      setCalibResults(results);
    } catch (e) {
      setCalibError(e.message);
    } finally {
      setCalibRunning(false);
    }
  }

  function downloadReport() {
    if (!calibResults?.reportMd) return;
    const blob = new Blob([calibResults.reportMd], { type: 'text/markdown' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = 'M069B_FILTER_CALIBRATION_REPORT.md';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // ── Canvas overlay ───────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const video  = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const isActive = tracking.isTracking && tracking.filtered;
    if (!isActive) return;

    const W = canvas.width, H = canvas.height;
    const { pos, rotZ, scale: sc } = tracking.filtered;
    const wx = pos.x * W, wy = pos.y * H;

    // ── MODO 2: overlay de tracking (SEM GLB) — prova de detecção do pulso ────
    if (mode === 'tracking' && tracking.landmarks) {
      const lms = tracking.landmarks;
      const l0  = { x: lms[0].x  * W, y: lms[0].y  * H };
      const l5  = { x: lms[5].x  * W, y: lms[5].y  * H };
      const l17 = { x: lms[17].x * W, y: lms[17].y * H };

      // b) linha azul lm5 → lm17 (base dos dedos)
      ctx.save();
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth   = 4;
      ctx.beginPath();
      ctx.moveTo(l5.x, l5.y);
      ctx.lineTo(l17.x, l17.y);
      ctx.stroke();

      // c) pontos verdes em lm5 e lm17
      ctx.fillStyle = '#22c55e';
      [l5, l17].forEach(pt => {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 8, 0, Math.PI * 2);
        ctx.fill();
      });

      // a) ponto vermelho no lm0 (pulso)
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(l0.x, l0.y, 10, 0, Math.PI * 2);
      ctx.fill();

      // d) métricas do tracking
      ctx.font         = 'bold 16px monospace';
      ctx.textAlign    = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle    = 'rgba(0,0,0,0.55)';
      ctx.fillRect(8, H - 66, 320, 58);
      ctx.fillStyle = '#fff';
      ctx.fillText(`rotZ ${(rotZ * 180 / Math.PI).toFixed(1)}°  scale ${sc.toFixed(4)}`, 14, H - 44);
      ctx.fillText(`pos filt ${pos.x.toFixed(3)}, ${pos.y.toFixed(3)}`, 14, H - 20);
      ctx.restore();
    }

    // ── Debug overlay (desligado por padrão — ver DEBUG_OVERLAY no topo) ──────
    if (DEBUG_OVERLAY) {
      const watchPx = sc * W * WATCH_W_NORM * 5;

      // Wrist circle
      ctx.save();
      ctx.beginPath();
      ctx.arc(wx, wy, 10, 0, Math.PI * 2);
      ctx.strokeStyle = '#4ade80';
      ctx.lineWidth   = 3;
      ctx.stroke();
      ctx.fillStyle = 'rgba(74,222,128,0.25)';
      ctx.fill();
      ctx.restore();

      // Watch bounding-box
      const rw = watchPx, rh = rw * 0.45;
      ctx.save();
      ctx.translate(wx, wy);
      ctx.rotate(rotZ);
      const hasPreset = !!activePreset;
      ctx.strokeStyle = hasPreset ? '#34d399' : '#facc15';
      ctx.lineWidth   = 3;
      ctx.fillStyle   = hasPreset ? 'rgba(52,211,153,0.12)' : 'rgba(250,204,21,0.12)';
      ctx.beginPath();
      ctx.roundRect(-rw / 2, -rh / 2, rw, rh, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle    = hasPreset ? '#34d399' : '#facc15';
      ctx.font         = `bold ${Math.max(10, rh * 0.3)}px monospace`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(hasPreset ? `mc=${activePreset.minCutoff} β=${activePreset.beta}` : ACTIVE_PRODUCT_ID, 0, 0);
      ctx.restore();
    }

    // ── Recording ring — sempre visível (UX de gravação, não é debug) ─────────
    if (recModeRef.current !== 'idle') {
      ctx.save();
      ctx.beginPath();
      ctx.arc(wx, wy, 22, 0, Math.PI * 2);
      ctx.strokeStyle = recModeRef.current === 'recording-static' ? '#f87171' : '#fb923c';
      ctx.lineWidth   = 3;
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.restore();
    }
  }, [tracking, activePreset, recState, mode]);

  // ── Derived ──────────────────────────────────────────────────────────────────
  const camLabel  = facingMode === 'environment' ? 'Traseira' : 'Frontal';
  const nextMode  = facingMode === 'environment' ? 'user' : 'environment';
  const isRecording   = recState !== 'idle';
  const canCalibrate  = !!staticLog && !!slowLog && !calibRunning && !isRecording;

  // Tamanho do GLB em pixels — proporcional ao pulso detectado e à tela atual.
  // Ajustar WRIST_SCALE_MULTIPLIER no topo do arquivo.
  // arScale por produto (campo opcional em products.json, default 1.0).
  const watchW = Math.round(scale * window.innerWidth * WRIST_SCALE_MULTIPLIER * (_ACTIVE_PRODUCT?.arScale ?? 1.0));
  const watchH = Math.round(watchW * 0.5); // proporção ~2:1 (face do relógio)

  const jitter = (() => {
    if (!raw?.pos || !filtered?.pos) return '—';
    const dx = (raw.pos.x - filtered.pos.x) * 1000;
    const dy = (raw.pos.y - filtered.pos.y) * 1000;
    return `${Math.sqrt(dx * dx + dy * dy).toFixed(1)} u`;
  })();

  // ── Auto overlay (fullscreen, high contrast, big font) ──────────────────────
  const renderAutoOverlay = () => {
    if (!IS_AUTO || !autoPhase) return null;

    const msg = AUTO_MESSAGES[autoPhase] ?? { text: autoPhase, sub: '', color: '#fff' };
    const isDone   = autoPhase === 'done';
    const isFailed = autoPhase === 'failed';
    const showProgress = autoPhase === 'static' || autoPhase === 'slow';
    const showCountdown = (autoPhase === 'prepare' || autoPhase === 'transition') && autoCountdown > 0;

    // M069C: overlay NÃO bloqueia mais a visão do GLB.
    // Container transparente + pointer-events none; o fundo escurecido existe
    // apenas na faixa de texto, ancorada no TOPO (o GLB renderiza no centro/pulso).
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 5,
        background: 'transparent',
        pointerEvents: 'none',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'flex-start',
        padding: '56px 16px 0', textAlign: 'center',
      }}>
        {/* Faixa de instrução — único elemento com fundo escuro */}
        <div style={{
          background: isDone ? 'rgba(0,40,0,0.6)' : isFailed ? 'rgba(60,0,0,0.6)' : 'rgba(0,0,0,0.6)',
          borderRadius: 14, padding: '14px 22px', maxWidth: '92%',
          pointerEvents: 'none',
        }}>
          {/* Main message */}
          <div style={{ color: msg.color, fontSize: '2rem', fontWeight: 900, lineHeight: 1.1, letterSpacing: 1, fontFamily: 'sans-serif' }}>
            {msg.text}
          </div>

          {/* Sub message */}
          {msg.sub && (
            <div style={{ color: '#e2e8f0', fontSize: '1rem', fontWeight: 600, marginTop: 8, fontFamily: 'sans-serif' }}>
              {msg.sub}
            </div>
          )}

          {/* Countdown */}
          {showCountdown && (
            <div style={{ color: '#fff', fontSize: '3rem', fontWeight: 900, marginTop: 8, fontFamily: 'sans-serif', lineHeight: 1 }}>
              {autoCountdown}
            </div>
          )}

          {/* Progress bar */}
          {showProgress && (
            <div style={{ width: 260, maxWidth: '100%', margin: '12px auto 0' }}>
              <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 8, height: 12, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 8,
                  background: autoPhase === 'static' ? '#f87171' : '#fb923c',
                  width: `${autoProgress}%`,
                  transition: 'width 0.1s linear',
                }} />
              </div>
              <div style={{ color: '#e2e8f0', fontSize: '0.85rem', marginTop: 4, fontFamily: 'monospace' }}>
                {autoProgress}%
              </div>
            </div>
          )}
        </div>

        {/* Done screen — botões precisam de pointer-events */}
        {isDone && autoBestCombo && (
          <div style={{
            marginTop: 14, fontFamily: 'monospace', fontSize: '0.95rem', color: '#e2e8f0', lineHeight: 1.7,
            background: 'rgba(0,40,0,0.6)', borderRadius: 14, padding: '12px 22px', maxWidth: '92%',
            pointerEvents: 'auto',
          }}>
            <div style={{ color: '#4ade80', fontSize: '1.1rem', fontWeight: 700 }}>Melhor combo aplicado:</div>
            <div>minCutoff = <span style={{ color: '#facc15' }}>{autoBestCombo.minCutoff}</span> · beta = <span style={{ color: '#facc15' }}>{autoBestCombo.beta}</span> · score = <span style={{ color: '#facc15' }}>{autoBestCombo.score.toFixed(3)}</span></div>
            <div style={{ color: '#cbd5e1', fontSize: '0.85rem', marginTop: 8 }}>
              {mvReady ? 'Mova o pulso e avalie o relógio.' : 'Carregando model-viewer…'}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => setGlbActive(v => !v)}
                style={{ ...mkBtn(glbActive ? '#16a34a' : '#7c3aed', false), fontSize: 14, padding: '10px 20px' }}
              >
                {glbActive ? '✓ GLB Ativo' : `Ativar GLB ${ACTIVE_PRODUCT_ID}`}
              </button>
              <button
                onClick={() => setAutoPhase(null)}
                style={{ ...mkBtn('#374151', false), fontSize: 14, padding: '10px 20px' }}
              >
                Ver HUD completo
              </button>
            </div>
          </div>
        )}

        {/* Failed screen — botão precisa de pointer-events */}
        {isFailed && (
          <div style={{
            marginTop: 14, color: '#fca5a5', fontSize: '0.95rem', fontFamily: 'sans-serif', maxWidth: 340, lineHeight: 1.6,
            background: 'rgba(60,0,0,0.6)', borderRadius: 14, padding: '12px 22px',
            pointerEvents: 'auto',
          }}>
            {autoError}
            <br /><br />
            <button
              onClick={() => {
                autoTriggeredRef.current = false;
                autoRunningRef.current   = false;
                setAutoPhase('waiting-hand');
                setAutoError(null);
              }}
              style={{ ...mkBtn('#dc2626', false), fontSize: 15, padding: '12px 24px' }}
            >
              Tentar novamente
            </button>
          </div>
        )}
      </div>
    );
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', overflow: 'hidden' }}>

      {/* Camera — camada 0 (atrás do GLB) */}
      <video
        ref={videoRef}
        playsInline
        muted
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 }}
      />

      {/* Canvas overlay — camada 1 (tracking overlay do modo ② + anel de gravação) */}
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }}
      />

      {/* MODO ③ — GLB ancorado no pulso (objetivo final) — camada 2 */}
      {mode === 'wrist' && glbActive && mvReady && isTracking && (
        <div style={{
          position:  'absolute',
          left:      `${(position.x * 100).toFixed(1)}%`,
          top:       `${(position.y * 100).toFixed(1)}%`,
          transform: `translate(-50%,-50%) rotate(${(rotationZ * 180 / Math.PI).toFixed(1)}deg)`,
          width:     watchW,
          height:    watchH,
          pointerEvents: 'none',
          zIndex: 2,
        }}>
          <model-viewer
            ref={attachGlbErrorListener}
            src={GLB_URL}
            disable-tap
            orientation={USE_NORMALIZED ? undefined : '0deg 0deg -90deg'}
            scale="2 2 2"
            style={{ width: '100%', height: '100%', background: 'transparent' }}
          />
        </div>
      )}

      {/* MODO ③ sem pulso detectado: aviso discreto, câmera continua visível */}
      {mode === 'wrist' && !isTracking && !autoPhase && (
        <div style={{
          position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
          zIndex: 10, background: 'rgba(0,0,0,0.55)', color: '#facc15',
          padding: '8px 16px', borderRadius: 20, fontFamily: 'monospace', fontSize: 14,
          pointerEvents: 'none',
        }}>
          Mostre o pulso na câmera
        </div>
      )}

      {/* MODO ① — GLB FORÇADO NO CENTRO — prova de render, camada 2.
          Ignora tracking/glbActive. Não é a experiência final. */}
      {forceCenter && (
        <>
          <div style={{
            position: 'absolute', top: 52, left: '50%', transform: 'translateX(-50%)',
            zIndex: 10, background: 'rgba(2,132,199,0.85)', color: '#fff',
            padding: '5px 14px', borderRadius: 16, fontFamily: 'monospace', fontSize: 11,
            whiteSpace: 'nowrap', pointerEvents: 'none',
          }}>
            MODO GLB CENTRAL — prova de render, NÃO testa pulso
          </div>
          <div style={{
            position: 'absolute', left: '50%', top: '50%',
            transform: 'translate(-50%,-50%)',
            width: Math.round(window.innerWidth * 0.7),
            height: Math.round(window.innerWidth * 0.35),
            pointerEvents: 'none', zIndex: 2,
            outline: '2px dashed #38bdf8',
          }}>
            <model-viewer
              ref={attachGlbErrorListener}
              src={GLB_URL}
              disable-tap
              orientation={USE_NORMALIZED ? undefined : '0deg 0deg -90deg'}
              scale="2 2 2"
              style={{ width: '100%', height: '100%', background: 'transparent' }}
            />
          </div>
        </>
      )}

      {/* M069G: watchdog do detector de mão — aviso aos 10s, erro aos 30s */}
      {!ready && !trackError && lmWaitState !== 'ok' && (
        <div style={{
          position: 'absolute', top: 122, left: '50%', transform: 'translateX(-50%)',
          zIndex: 10, maxWidth: '92%', textAlign: 'center',
          background: lmWaitState === 'timeout' ? 'rgba(127,29,29,0.92)' : 'rgba(113,63,18,0.92)',
          color: lmWaitState === 'timeout' ? '#fecaca' : '#fde68a',
          padding: '8px 14px', borderRadius: 8, fontFamily: 'monospace', fontSize: 12,
          pointerEvents: 'none', wordBreak: 'break-word',
        }}>
          {lmWaitState === 'timeout'
            ? 'Erro: detector não carregou. Verifique sua conexão.'
            : 'Carregando detector de mão… (pode levar até 30s na primeira vez)'}
        </div>
      )}

      {/* Erros nunca são silenciosos — banner vermelho sempre visível (topo,
          para não colidir com botões de modo/controles na parte inferior) */}
      {(trackError || camError || mvError || glbError) && (
        <div style={{
          position: 'absolute', top: 88, left: '50%', transform: 'translateX(-50%)',
          zIndex: 10, maxWidth: '92%', background: 'rgba(127,29,29,0.92)', color: '#fecaca',
          padding: '8px 14px', borderRadius: 8, fontFamily: 'monospace', fontSize: 12,
          pointerEvents: 'none', wordBreak: 'break-word', textAlign: 'center',
        }}>
          {[trackError, camError, mvError, glbError].filter(Boolean).join(' · ')}
        </div>
      )}

      {/* Auto overlay (renders above everything when active) */}
      {renderAutoOverlay()}

      {/* Report modal */}
      {showReport && calibResults?.reportMd && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 30, background: 'rgba(0,0,0,0.92)', overflowY: 'auto', padding: 24 }}>
          <button onClick={() => setShowReport(false)} style={{ ...mkBtn('#374151', false), marginBottom: 16 }}>✕ Fechar</button>
          <pre style={{ color: '#e2e8f0', fontFamily: 'monospace', fontSize: 11, whiteSpace: 'pre-wrap' }}>{calibResults.reportMd}</pre>
        </div>
      )}

      {/* ── HUD compacto/colapsável — topo esquerdo, nunca cobre o centro ──
          Colapsado: uma linha, pointer-events none exceto no botão ▼ HUD. */}
      <div style={{ position: 'absolute', top: 14, left: 14, zIndex: 10, pointerEvents: 'none', maxWidth: 262 }}>
        <div style={{ ...panelBase, padding: '5px 8px', display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
          <span>
            👁 cam{camReady ? '✅' : camError ? '🔴' : '🟡'}
            {' '}lm{ready ? '✅' : trackError ? '🔴' : '🟡'}
            {' '}trk{isTracking ? '✅' : '🔴'}
            {' '}mv{mvReady ? '✅' : mvError ? '🔴' : '🟡'}
            {' '}glb{glbError ? '🔴' : glbActive ? '✅' : '🔴'}
          </span>
          <button
            onClick={() => setHudOpen(v => !v)}
            style={{
              pointerEvents: 'auto', cursor: 'pointer',
              background: '#374151', color: '#e2e8f0', border: 'none',
              borderRadius: 6, padding: '3px 8px', fontSize: 11, fontFamily: 'monospace',
            }}
          >
            {hudOpen ? '▲ HUD' : '▼ HUD'}
          </button>
        </div>

        {hudOpen && (
          <div style={{ ...panelBase, marginTop: 6 }}>
            <div style={{ color: '#a78bfa', fontWeight: 700, fontSize: 12, marginBottom: 5 }}>
              Ghost Engine Lab — {ACTIVE_PRODUCT_ID}
              {' · '}{mode === 'center' ? 'modo ① central' : mode === 'tracking' ? 'modo ② tracking' : 'modo ③ pulso'}
            </div>

            {/* Diagnóstico específico do modo ativo */}
            {mode === 'center' && (
              <>
                <div><span style={{ color: '#94a3b8' }}>forceCenter: </span><span style={{ color: '#38bdf8' }}>true</span></div>
                <div style={{ wordBreak: 'break-all' }}>
                  <span style={{ color: '#94a3b8' }}>modelUrl: </span>
                  <span style={{ color: glbError ? '#f87171' : '#93c5fd' }}>{GLB_URL}</span>
                </div>
              </>
            )}
            {mode === 'tracking' && (
              <>
                <div><span style={{ color: '#94a3b8' }}>isTracking: </span>{String(isTracking)}</div>
                <div><span style={{ color: '#94a3b8' }}>lm0: </span>{landmarks ? `${landmarks[0].x.toFixed(3)}, ${landmarks[0].y.toFixed(3)}` : '—'}</div>
                <div><span style={{ color: '#94a3b8' }}>lm5: </span>{landmarks ? `${landmarks[5].x.toFixed(3)}, ${landmarks[5].y.toFixed(3)}` : '—'}</div>
                <div><span style={{ color: '#94a3b8' }}>lm17: </span>{landmarks ? `${landmarks[17].x.toFixed(3)}, ${landmarks[17].y.toFixed(3)}` : '—'}</div>
                <div><span style={{ color: '#94a3b8' }}>rotZ: </span>{filtered?.rotZ != null ? (filtered.rotZ * 180 / Math.PI).toFixed(1) + '°' : '—'}</div>
                <div><span style={{ color: '#94a3b8' }}>scale: </span>{filtered?.scale?.toFixed(4) ?? '—'}</div>
                <div><span style={{ color: '#94a3b8' }}>fps: </span>{fps}</div>
              </>
            )}
            {mode === 'wrist' && (
              <>
                <div><span style={{ color: '#94a3b8' }}>forceCenter: </span>false</div>
                <div><span style={{ color: '#94a3b8' }}>isTracking: </span>{String(isTracking)}</div>
                <div><span style={{ color: '#94a3b8' }}>position: </span>{filtered?.pos ? `${filtered.pos.x.toFixed(3)}, ${filtered.pos.y.toFixed(3)}` : '—'}</div>
                <div><span style={{ color: '#94a3b8' }}>rotZ: </span>{filtered?.rotZ != null ? (filtered.rotZ * 180 / Math.PI).toFixed(1) + '°' : '—'}</div>
                <div><span style={{ color: '#94a3b8' }}>scale: </span>{filtered?.scale?.toFixed(4) ?? '—'}</div>
                <div><span style={{ color: '#94a3b8' }}>mvReady: </span>{String(mvReady)} <span style={{ color: '#94a3b8' }}>| glbActive: </span>{String(glbActive)}</div>
                <div>
                  <span style={{ color: '#94a3b8' }}>preset: </span>
                  <span style={{ color: '#34d399' }}>
                    {activePreset?.name ?? `calibrado mc=${activePreset?.minCutoff} β=${activePreset?.beta}`}
                  </span>
                </div>
              </>
            )}

            {/* Comum a todos os modos */}
            <div style={{ marginTop: 5, borderTop: '1px solid rgba(255,255,255,0.10)', paddingTop: 5 }}>
              <div><span style={{ color: '#94a3b8' }}>delegate: </span>{delegate ?? '—'} · <span style={{ color: '#94a3b8' }}>detector: </span>{modelSource ?? '—'} · <span style={{ color: '#94a3b8' }}>câmera: </span>{camLabel}</div>
              <div><span style={{ color: '#94a3b8' }}>jitter: </span>{jitter} · <span style={{ color: '#94a3b8' }}>preset: </span><span style={{ color: '#34d399' }}>{activePreset?.name ?? `mc=${activePreset?.minCutoff} β=${activePreset?.beta}`}</span></div>
            </div>

            {warning    && <div style={{ color: '#facc15', wordBreak: 'break-word' }}>{warning}</div>}
            {trackError && <div style={{ color: '#f87171', wordBreak: 'break-word' }}>{trackError}</div>}
            {mvError    && <div style={{ color: '#f87171', wordBreak: 'break-word' }}>{mvError}</div>}
            {glbError   && <div style={{ color: '#f87171', wordBreak: 'break-word' }}>{glbError}</div>}
            {camError   && <div style={{ color: '#f87171', wordBreak: 'break-word' }}>{camError}</div>}
          </div>
        )}
      </div>

      {/* ── Calibration panel — top right (sempre visível quando não há overlay auto) ── */}
      {!autoPhase && (
        <div style={{ ...panelBase, position: 'absolute', top: 14, right: 14, zIndex: 10, width: 240 }}>
          <div style={{ color: '#fb923c', fontWeight: 700, fontSize: 12, marginBottom: 8 }}>
            Calibração One Euro Filter
          </div>

          {isRecording && (
            <div style={{ color: '#f87171', fontWeight: 700, fontSize: 13, marginBottom: 6 }}>
              ● REC {recState === 'recording-static' ? 'PARADO' : 'LENTO'} — {recCountdown}s
            </div>
          )}

          <div style={{ marginBottom: 8 }}>
            <div style={{ color: staticLog ? '#4ade80' : '#94a3b8' }}>
              {staticLog ? `✓ Parado (${staticLog.length} fr)` : '○ Parado — não gravado'}
            </div>
            <div style={{ color: slowLog ? '#4ade80' : '#94a3b8' }}>
              {slowLog ? `✓ Lento (${slowLog.length} fr)` : '○ Lento — não gravado'}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
            <button onClick={() => startRecording('recording-static', STATIC_MS)} disabled={isRecording || !isTracking} style={mkBtn('#dc2626', isRecording || !isTracking)}>
              {recState === 'recording-static' ? `⏺ Parado… ${recCountdown}s` : '⏺ Gravar teste parado (3s)'}
            </button>
            <button onClick={() => startRecording('recording-slow', SLOW_MS)} disabled={isRecording || !isTracking} style={mkBtn('#d97706', isRecording || !isTracking)}>
              {recState === 'recording-slow' ? `⏺ Lento… ${recCountdown}s` : '⏺ Gravar teste mov. lento (4s)'}
            </button>
            <button onClick={handleCalibrate} disabled={!canCalibrate} style={mkBtn('#7c3aed', !canCalibrate)}>
              {calibRunning ? '⚙ Calculando…' : '⚙ Rodar calibração'}
            </button>
          </div>

          {calibError && <div style={{ color: '#f87171', fontSize: 10, marginBottom: 6 }}>{calibError}</div>}

          {calibResults && (
            <div>
              <div style={{ color: '#a78bfa', fontWeight: 700, marginBottom: 4, fontSize: 11 }}>Top 5:</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                <thead>
                  <tr>{['mc', 'β', 'jitter', 'lag', 'score', ''].map(h => (
                    <th key={h} style={{ color: '#94a3b8', textAlign: 'left', paddingBottom: 3, paddingRight: 4 }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {calibResults.top5.map((r, i) => (
                    <tr key={i} style={{ background: i === 0 ? 'rgba(124,58,237,0.15)' : 'transparent' }}>
                      <td style={{ paddingRight: 4, color: i === 0 ? '#a78bfa' : '#e2e8f0' }}>{r.minCutoff}</td>
                      <td style={{ paddingRight: 4, color: i === 0 ? '#a78bfa' : '#e2e8f0' }}>{r.beta}</td>
                      <td style={{ paddingRight: 4, color: '#93c5fd' }}>{r.jitterMean.toFixed(4)}</td>
                      <td style={{ paddingRight: 4, color: '#93c5fd' }}>{r.lagMethod === 'cross-correlation' ? `${r.lagMs.toFixed(0)}ms` : `${r.lagFrames}fr`}</td>
                      <td style={{ paddingRight: 4, color: '#4ade80' }}>{r.score.toFixed(3)}</td>
                      <td>
                        <button
                          onClick={() => applyPreset(r)}
                          style={{ padding: '2px 7px', borderRadius: 5, border: 'none', background: activePreset?.minCutoff === r.minCutoff && activePreset?.beta === r.beta ? '#16a34a' : '#374151', color: '#fff', cursor: 'pointer', fontSize: 10 }}
                        >
                          {activePreset?.minCutoff === r.minCutoff && activePreset?.beta === r.beta ? '✓' : 'aplicar'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <button onClick={() => setShowReport(v => !v)} style={mkBtn('#374151', false)}>
                  {showReport ? 'Fechar' : 'Ver .md'}
                </button>
                <button onClick={downloadReport} style={mkBtn('#0f766e', false)}>↓ Download</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Bottom controls ── */}
      {!autoPhase && (
        <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setFacingMode(nextMode)} disabled={isRecording || camStarting} style={mkBtn('#374151', isRecording || camStarting)}>
              {camStarting ? 'Câmera: iniciando…' : `Câmera: ${camLabel} →`}
            </button>
            <button onClick={() => setGlbActive(v => !v)} disabled={!mvReady} style={mkBtn(glbActive ? '#16a34a' : '#7c3aed', !mvReady)}>
              {!mvReady ? 'model-viewer…' : glbActive ? '✓ GLB Ativo' : `Ativar GLB ${ACTIVE_PRODUCT_ID}`}
            </button>
          </div>
          <button onClick={() => window.history.back()} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.6)', color: '#e2e8f0', cursor: 'pointer', fontSize: 13, fontFamily: 'sans-serif' }}>
            ← Voltar
          </button>
        </div>
      )}

      {/* M069D: seletor de modo — sempre visível, um modo ativo por vez */}
      <div style={{
        position: 'absolute', bottom: 90, right: 14, zIndex: 10,
        display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'stretch',
      }}>
        {[
          ['center',   '① Testar GLB no centro'],
          ['tracking', '② Ver tracking do pulso'],
          ['wrist',    '③ GLB no pulso'],
        ].map(([m, label]) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            style={{
              ...mkBtn(mode === m ? '#0284c7' : '#1f2937', false),
              fontSize: 12, padding: '9px 14px', textAlign: 'left',
              border: mode === m ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.15)',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tracking indicator */}
      {ready && !autoPhase && (
        <div style={{ position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)', zIndex: 10, background: isTracking ? 'rgba(22,163,74,0.85)' : 'rgba(220,38,38,0.75)', color: '#fff', borderRadius: 20, padding: '5px 16px', fontSize: 13, fontFamily: 'monospace', fontWeight: 700 }}>
          {isTracking ? '● TRACKING' : '○ mostre o pulso na câmera'}
        </div>
      )}
    </div>
  );
}

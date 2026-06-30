import { useEffect, useRef, useState, useCallback } from 'react';

const LIB_URL          = '/libs/webarrocks/WebARRocksHand.js';
const NN_URL           = '/libs/webarrocks/NN_WRISTBACK_45.json';
const TEST_DURATION_MS = 10_000;

// ─── Pure helpers ────────────────────────────────────────────────────────────

function loadLibScript() {
  return new Promise((resolve, reject) => {
    if (document.getElementById('war-hand-lib')) { resolve(); return; }
    const s = document.createElement('script');
    s.src = LIB_URL; s.id = 'war-hand-lib';
    s.onload = resolve;
    s.onerror = () => reject(new Error('Failed to load WebARRocksHand.js'));
    document.head.appendChild(s);
  });
}

function clipToPixel(cx, cy, W, H) {
  return { px: (cx + 1) / 2 * W, py: (1 - cy) / 2 * H };
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// Metric definitions — single source of truth for display + evaluation + report
const METRICS_META = [
  { key: 'totalFrames',         label: 'Total frames'                                                                          },
  { key: 'detectedFrames',      label: 'Frames detectados'                                                                     },
  { key: 'detectionRate',       label: 'Taxa detecção',       unit: '%',  thresh: '≥ 70%',    crit: m => m.detectionRate >= 70       },
  { key: 'averageConfidence',   label: 'Confiança média',     unit: '',   thresh: '≥ 0.50',   crit: m => m.averageConfidence >= 0.50 },
  { key: 'minConfidence',       label: 'Confiança mínima',    unit: ''                                                        },
  { key: 'maxConfidence',       label: 'Confiança máxima',    unit: ''                                                        },
  { key: 'lostTrackingCount',   label: 'Perdas de tracking'                                                                   },
  { key: 'longestLostStreakMs', label: 'Maior perda',         unit: 'ms', thresh: '≤ 1000ms', crit: m => m.longestLostStreakMs <= 1000 },
  { key: 'avgLandmarksCount',   label: 'Landmarks médio'                                                                      },
  { key: 'jitterPxAvg',        label: 'Jitter médio',        unit: 'px', thresh: '≤ 35px',   crit: m => m.jitterPxAvg <= 35         },
  { key: 'jitterPxMax',        label: 'Jitter máximo',       unit: 'px'                                                      },
  { key: 'avgPlaceholderWidth', label: 'Largura média',       unit: 'px'                                                      },
  { key: 'placeholderWidthMax', label: 'Largura máxima',      unit: 'px', thresh: '≤ 160px',  crit: m => m.placeholderWidthMax <= 160 },
];

function computeMetrics(frames, elapsed) {
  const total = frames.length;
  if (total === 0) return null;

  const detF    = frames.filter(f => f.detected);
  const detRate = (detF.length / total) * 100;

  const confs  = detF.map(f => f.conf);
  const avgConf = confs.length ? confs.reduce((s, c) => s + c, 0) / confs.length : 0;

  // Lost-tracking streaks
  let lostCount = 0, maxStreakMs = 0, lostStart = null, wasDet = null;
  frames.forEach(f => {
    if (wasDet === true  && !f.detected) { lostCount++; lostStart = f.t; }
    if (wasDet === false &&  f.detected && lostStart !== null) {
      maxStreakMs = Math.max(maxStreakMs, f.t - lostStart); lostStart = null;
    }
    wasDet = f.detected;
  });
  if (!wasDet && lostStart !== null) maxStreakMs = Math.max(maxStreakMs, elapsed - lostStart);

  // Landmarks
  const lmCounts = detF.map(f => f.lmCount);
  const avgLm    = lmCounts.length ? lmCounts.reduce((s, c) => s + c, 0) / lmCounts.length : 0;

  // Jitter (CSS px, frame-to-frame displacement of landmark center)
  const jitters = [];
  for (let i = 1; i < frames.length; i++) {
    const a = frames[i - 1], b = frames[i];
    if (a.detected && b.detected && a.cx > 0 && b.cx > 0) {
      jitters.push(Math.hypot(b.cx - a.cx, b.cy - a.cy));
    }
  }
  const jAvg = jitters.length ? jitters.reduce((s, j) => s + j, 0) / jitters.length : 0;
  const jMax = jitters.length ? Math.max(...jitters) : 0;

  // Placeholder width (CSS px)
  const widths = detF.map(f => f.w).filter(w => w > 0);
  const avgW   = widths.length ? widths.reduce((s, w) => s + w, 0) / widths.length : 0;
  const maxW   = widths.length ? Math.max(...widths) : 0;

  return {
    totalFrames:         total,
    detectedFrames:      detF.length,
    detectionRate:       +detRate.toFixed(1),
    averageConfidence:   +avgConf.toFixed(3),
    minConfidence:       confs.length ? +(Math.min(...confs)).toFixed(3) : 0,
    maxConfidence:       confs.length ? +(Math.max(...confs)).toFixed(3) : 0,
    lostTrackingCount:   lostCount,
    longestLostStreakMs: Math.round(maxStreakMs),
    avgLandmarksCount:   +avgLm.toFixed(1),
    jitterPxAvg:         +jAvg.toFixed(1),
    jitterPxMax:         +jMax.toFixed(1),
    avgPlaceholderWidth: +avgW.toFixed(1),
    placeholderWidthMax: +maxW.toFixed(1),
  };
}

function evaluateResult(m) {
  const criteria = METRICS_META.filter(meta => meta.crit);
  const failReasons = criteria
    .filter(meta => !meta.crit(m))
    .map(meta => `${meta.label}: ${m[meta.key]}${meta.unit ?? ''} (req. ${meta.thresh})`);
  return { approved: failReasons.length === 0, failReasons };
}

function buildReport(m, ev, cameraLabel) {
  const lines = [
    '==============================',
    'RELATÓRIO — WebAR.rocks.hand Spike Lab',
    `Data: ${new Date().toLocaleString('pt-BR')}`,
    `NN: NN_WRISTBACK_45`,
    `Câmera: ${cameraLabel}`,
    `Resultado: ${ev.approved ? '✓ APROVADO' : '✗ REPROVADO'}`,
    '==============================',
    '',
    '--- MÉTRICAS ---',
    ...METRICS_META.map(meta => {
      const v    = m[meta.key];
      const val  = typeof v === 'number' && !Number.isInteger(v) ? v.toFixed(3) : String(v);
      const unit = meta.unit ?? '';
      const req  = meta.thresh ? `  (req. ${meta.thresh})` : '';
      return `${meta.label.padEnd(24)} ${val}${unit}${req}`;
    }),
  ];
  if (!ev.approved) {
    lines.push('', '--- MOTIVOS REPROVAÇÃO ---', ...ev.failReasons.map(r => '• ' + r));
  }
  lines.push('', '==============================');
  return lines.join('\n');
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WebARRocksLab() {
  const glCanvasRef = useRef(null);
  const ovCanvasRef = useRef(null);
  const ovCtxRef    = useRef(null);
  const activeRef   = useRef(false);
  const lastUpdRef  = useRef(0);
  // Last computed frame data from drawOverlay (CSS px) — used for metric collection
  const lastFrRef   = useRef({ cx: 0, cy: 0, w: 0 });
  // Test state (mutable, not reactive — only triggers setState at key moments)
  const testRef     = useRef({ phase: 'idle', frames: [], startTime: 0, lastCd: 10 });

  // Calibration refs (updated instantly, read inside callbackTrack)
  const scaleRef  = useRef(1.2);
  const offXRef   = useRef(0);
  const offYRef   = useRef(0);
  const rotOffRef = useRef(0);

  const [facingMode, setFacingMode] = useState('environment');
  const [status,     setStatus]     = useState('idle');
  const [detected,   setDetected]   = useState(false);
  const [diagData,   setDiagData]   = useState({});
  const [testPhase,  setTestPhase]  = useState('idle');   // 'idle' | 'running' | 'complete'
  const [countdown,  setCountdown]  = useState(10);
  const [testResult, setTestResult] = useState(null);     // { metrics, evaluation }
  const [copied,     setCopied]     = useState(false);

  // Calibration display state (sliders)
  const [scale,  setScale]  = useState(1.2);
  const [offX,   setOffX]   = useState(0);
  const [offY,   setOffY]   = useState(0);
  const [rotOff, setRotOff] = useState(0);

  const cameraLabel = facingMode === 'environment' ? 'traseira' : 'frontal';

  const sizeCanvases = useCallback(() => {
    const gl = glCanvasRef.current, ov = ovCanvasRef.current;
    if (!gl || !ov) return;
    const pr = window.devicePixelRatio || 1;
    const W  = Math.round(window.innerWidth  * pr);
    const H  = Math.round(window.innerHeight * pr);
    gl.width = ov.width = W; gl.height = ov.height = H;
    gl.style.width  = ov.style.width  = window.innerWidth  + 'px';
    gl.style.height = ov.style.height = window.innerHeight + 'px';
    if (window.WEBARROCKSHAND && activeRef.current) {
      try { window.WEBARROCKSHAND.resize(); } catch (_) {}
    }
  }, []);

  const drawOverlay = useCallback((detectState) => {
    const ctx = ovCtxRef.current, ov = ovCanvasRef.current;
    if (!ctx || !ov) return;
    const W = ov.width, H = ov.height, pr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, W, H);

    const isDetected = detectState.isDetected || (detectState.detected > 0.5);
    if (!isDetected) { lastFrRef.current = { cx: 0, cy: 0, w: 0 }; return; }

    const lms = detectState.landmarks;
    let cx, cy, watchW;

    if (lms?.length >= 2) {
      let sumX = 0, sumY = 0, minX = Infinity, maxX = -Infinity;
      lms.forEach(([lx, ly]) => {
        sumX += lx; sumY += ly;
        if (lx < minX) minX = lx;
        if (lx > maxX) maxX = lx;
      });
      const { px, py } = clipToPixel(sumX / lms.length, sumY / lms.length, W, H);
      cx = px + offXRef.current * pr;
      cy = py + offYRef.current * pr;
      const rawW = Math.abs(clipToPixel(maxX, 0, W, H).px - clipToPixel(minX, 0, W, H).px);
      watchW = clamp(rawW * scaleRef.current, 40 * pr, 160 * pr);
    } else {
      const { x, y } = detectState;
      const { px, py } = clipToPixel(x, y, W, H);
      cx = px + offXRef.current * pr;
      cy = py + offYRef.current * pr;
      watchW = clamp(90 * pr * scaleRef.current, 40 * pr, 160 * pr);
    }

    const watchH   = watchW * 0.55;
    const rotation = (detectState.rz ?? 0) + rotOffRef.current * (Math.PI / 180);

    // Store in CSS pixels for metric collection
    lastFrRef.current = { cx: cx / pr, cy: cy / pr, w: watchW / pr };

    // Watch placeholder
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(rotation);
    ctx.fillStyle = 'rgba(59,130,246,0.45)'; ctx.strokeStyle = '#60a5fa'; ctx.lineWidth = 2;
    ctx.fillRect  (-watchW / 2, -watchH / 2, watchW, watchH);
    ctx.strokeRect(-watchW / 2, -watchH / 2, watchW, watchH);
    ctx.fillStyle = 'rgba(59,130,246,0.28)';
    ctx.fillRect(-watchW * 0.18, -watchH / 2 - watchH * 0.26, watchW * 0.36, watchH * 0.26);
    ctx.fillRect(-watchW * 0.18,  watchH / 2,                  watchW * 0.36, watchH * 0.26);
    ctx.beginPath(); ctx.arc(0, 0, watchH * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fill();
    ctx.restore();

    ctx.beginPath(); ctx.arc(cx, cy, 4 * pr, 0, Math.PI * 2);
    ctx.fillStyle = '#ef4444'; ctx.fill();

    if (lms?.length) {
      lms.forEach(([lx, ly], i) => {
        const { px, py } = clipToPixel(lx, ly, W, H);
        ctx.beginPath(); ctx.arc(px, py, 4 * pr, 0, Math.PI * 2);
        ctx.fillStyle = i < 4 ? '#facc15' : '#4ade80'; ctx.fill();
      });
    }
  }, []);

  const callbackTrack = useCallback((detectState) => {
    if (!activeRef.current) return;
    window.WEBARROCKSHAND.render_video();
    drawOverlay(detectState);

    const isDetected = detectState.isDetected || (detectState.detected > 0.5);

    // ── Test collection ──────────────────────────────────────────────────────
    const test = testRef.current;
    if (test.phase === 'running') {
      const elapsed = performance.now() - test.startTime;
      const { cx, cy, w } = lastFrRef.current;
      test.frames.push({
        t: elapsed, detected: isDetected,
        conf: detectState.detected ?? 0, lmCount: detectState.landmarks?.length ?? 0,
        cx, cy, w,
      });

      // Countdown (update only when second changes)
      const cd = Math.max(0, Math.ceil((TEST_DURATION_MS - elapsed) / 1000));
      if (cd !== test.lastCd) { test.lastCd = cd; setCountdown(cd); }

      if (elapsed >= TEST_DURATION_MS) {
        test.phase = 'done';
        const metrics    = computeMetrics(test.frames, elapsed);
        const evaluation = evaluateResult(metrics);
        setTestResult({ metrics, evaluation });
        setTestPhase('complete');
      }
    }

    // ── Throttle React state for status panel (400ms) ────────────────────────
    const now = performance.now();
    if (now - lastUpdRef.current > 400) {
      lastUpdRef.current = now;
      setDetected(!!isDetected);
      const { landmarks, ...rest } = detectState;
      setDiagData({ ...rest, landmarks: landmarks?.length ?? 0 });
    }
  }, [drawOverlay]);

  useEffect(() => {
    let destroyed = false;
    (async () => {
      setStatus('carregando…'); setDetected(false);
      setTestPhase('idle'); setTestResult(null);
      try {
        await loadLibScript();
        if (destroyed) return;
        sizeCanvases();
        ovCtxRef.current = ovCanvasRef.current.getContext('2d');
        activeRef.current = true;
        window.WEBARROCKSHAND.init({
          canvasId: 'war-gl-canvas', NNsPaths: [NN_URL],
          videoSettings: { facingMode },
          callbackReady: (err) => {
            if (destroyed) return;
            if (err === 'WEBCAM_UNAVAILABLE' && facingMode === 'environment') {
              try { window.WEBARROCKSHAND.destroy(); } catch (_) {}
              setFacingMode('user'); return;
            }
            if (err) { setStatus('error: ' + err); return; }
            setStatus('ready');
          },
          callbackTrack,
        });
      } catch (e) { if (!destroyed) setStatus('error: ' + e.message); }
    })();
    window.addEventListener('resize', sizeCanvases);
    return () => {
      destroyed = true; activeRef.current = false;
      window.removeEventListener('resize', sizeCanvases);
      try { window.WEBARROCKSHAND?.destroy(); } catch (_) {}
    };
  }, [callbackTrack, sizeCanvases, facingMode]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleStop = () => {
    activeRef.current = false;
    testRef.current = { phase: 'idle', frames: [], startTime: 0, lastCd: 10 };
    try { window.WEBARROCKSHAND?.destroy(); } catch (_) {}
    const ov = ovCanvasRef.current;
    if (ov) ovCtxRef.current?.clearRect(0, 0, ov.width, ov.height);
    setStatus('parado'); setDetected(false); setTestPhase('idle'); setTestResult(null);
  };

  const handleStartTest = () => {
    if (testPhase !== 'idle' || status !== 'ready') return;
    testRef.current = { phase: 'running', frames: [], startTime: performance.now(), lastCd: 10 };
    setTestPhase('running'); setCountdown(10); setTestResult(null); setCopied(false);
  };

  const handleNewTest = () => {
    testRef.current = { phase: 'idle', frames: [], startTime: 0, lastCd: 10 };
    setTestPhase('idle'); setTestResult(null); setCopied(false); setCountdown(10);
  };

  const handleCopy = () => {
    if (!testResult) return;
    const text = buildReport(testResult.metrics, testResult.evaluation, cameraLabel);
    navigator.clipboard?.writeText(text)
      .then(() => setCopied(true))
      .catch(() => {
        // Fallback for browsers that block clipboard
        window.prompt('Copie o relatório abaixo (Ctrl+A → Ctrl+C):', text);
      });
  };

  const handleScale  = (v) => { scaleRef.current  = v; setScale(v);  };
  const handleOffX   = (v) => { offXRef.current   = v; setOffX(v);   };
  const handleOffY   = (v) => { offYRef.current   = v; setOffY(v);   };
  const handleRotOff = (v) => { rotOffRef.current = v; setRotOff(v); };

  // ── Style helpers ──────────────────────────────────────────────────────────

  const statusColor   = status.startsWith('error') ? '#f87171' : status === 'ready' ? '#4ade80' : '#facc15';
  const detectedColor = detected ? '#4ade80' : '#f87171';

  const SLIDERS = [
    { label: 'scaleMultiplier', val: scale,  fn: handleScale,  min: 0.3,  max: 4,   step: 0.05, fmt: v => v.toFixed(2) },
    { label: 'offsetX (px)',    val: offX,   fn: handleOffX,   min: -80,  max: 80,  step: 1,    fmt: v => v + 'px' },
    { label: 'offsetY (px)',    val: offY,   fn: handleOffY,   min: -80,  max: 80,  step: 1,    fmt: v => v + 'px' },
    { label: 'rotationOffset',  val: rotOff, fn: handleRotOff, min: -180, max: 180, step: 1,    fmt: v => v + '°' },
  ];

  const panelBase = {
    background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(6px)',
    color: '#e2e8f0', borderRadius: 10, fontFamily: 'monospace', fontSize: 11,
    border: '1px solid rgba(255,255,255,0.08)',
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0a0a0a', overflow: 'hidden' }}>
      {/* Camera feed (WebGL) */}
      <canvas id="war-gl-canvas" ref={glCanvasRef} style={{ position: 'absolute', inset: 0 }} />
      {/* Overlay (2D) */}
      <canvas ref={ovCanvasRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />

      {/* Status panel — top-left */}
      <div style={{ ...panelBase, position: 'absolute', top: 14, left: 14, zIndex: 10, padding: '10px 14px', maxWidth: 230 }}>
        <div style={{ fontWeight: 'bold', color: '#a78bfa', marginBottom: 5, fontSize: 12 }}>WebAR.rocks — Spike</div>
        <div>NN: <span style={{ color: '#93c5fd' }}>WRISTBACK_45</span></div>
        <div>câmera: <span style={{ color: '#fbbf24' }}>{cameraLabel}</span></div>
        <div>status: <span style={{ color: statusColor }}>{status}</span></div>
        <div style={{ marginTop: 4 }}>detected: <span style={{ color: detectedColor }}>{detected ? 'YES ✓' : 'NO'}</span></div>
        {Object.keys(diagData).length > 0 && (
          <div style={{ marginTop: 4, borderTop: '1px solid rgba(255,255,255,0.10)', paddingTop: 4 }}>
            {Object.entries(diagData).map(([k, v]) => (
              <div key={k}>
                <span style={{ color: '#94a3b8' }}>{k}: </span>
                <span style={{ color: '#93c5fd' }}>{typeof v === 'number' ? v.toFixed(4) : String(v)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Calibration sliders — top-right (hidden during test running/complete) */}
      {testPhase === 'idle' && (
        <div style={{ ...panelBase, position: 'absolute', top: 14, right: 14, zIndex: 10, padding: '10px 14px', width: 210 }}>
          <div style={{ fontWeight: 'bold', color: '#a78bfa', marginBottom: 8, fontSize: 12 }}>Calibração</div>
          {SLIDERS.map(({ label, val, fn, min, max, step, fmt }) => (
            <div key={label} style={{ marginBottom: 8 }}>
              <div style={{ color: '#94a3b8', marginBottom: 2 }}>
                {label}: <span style={{ color: '#e2e8f0' }}>{fmt(val)}</span>
              </div>
              <input type="range" min={min} max={max} step={step} value={val}
                onChange={e => fn(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: '#7c3aed', cursor: 'pointer' }} />
            </div>
          ))}
        </div>
      )}

      {/* ── TEST BUTTON — center, visible when ready & idle ── */}
      {testPhase === 'idle' && status === 'ready' && (
        <div style={{
          position: 'absolute', top: '42%', left: '50%',
          transform: 'translate(-50%, -50%)', zIndex: 10,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
        }}>
          <button
            onClick={handleStartTest}
            style={{
              padding: '18px 36px', borderRadius: 12, border: 'none',
              background: 'linear-gradient(135deg, #16a34a, #15803d)',
              color: '#fff', cursor: 'pointer', fontSize: 18,
              fontFamily: 'sans-serif', fontWeight: 700, letterSpacing: 0.5,
              boxShadow: '0 0 24px rgba(22,163,74,0.5)',
            }}
          >
            INICIAR TESTE DE 10 SEGUNDOS
          </button>
          <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, fontFamily: 'sans-serif' }}>
            Aponte a câmera para o pulso antes de iniciar
          </div>
        </div>
      )}

      {/* ── COUNTDOWN — center, visible during running ── */}
      {testPhase === 'running' && (
        <div style={{
          position: 'absolute', top: '42%', left: '50%',
          transform: 'translate(-50%, -50%)', zIndex: 10,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        }}>
          <div style={{
            fontSize: 80, fontWeight: 900, color: '#4ade80',
            fontFamily: 'sans-serif', lineHeight: 1,
            textShadow: '0 0 40px rgba(74,222,128,0.6)',
          }}>
            {countdown}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, fontFamily: 'sans-serif' }}>
            coletando dados…
          </div>
          {/* Progress bar */}
          <div style={{ width: 200, height: 6, background: 'rgba(255,255,255,0.15)', borderRadius: 3 }}>
            <div style={{
              height: '100%', borderRadius: 3, background: '#4ade80',
              width: `${((10 - countdown) / 10) * 100}%`,
              transition: 'width 0.5s linear',
            }} />
          </div>
        </div>
      )}

      {/* ── RESULTS OVERLAY ── */}
      {testPhase === 'complete' && testResult && (() => {
        const { metrics: m, evaluation: ev } = testResult;
        const approved = ev.approved;
        return (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 20,
            background: 'rgba(0,0,0,0.92)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'auto', padding: '20px 16px',
          }}>
            <div style={{
              background: '#111827', borderRadius: 14,
              padding: '24px 20px', width: '100%', maxWidth: 480,
              border: `2px solid ${approved ? '#16a34a' : '#dc2626'}`,
              boxShadow: `0 0 40px ${approved ? 'rgba(22,163,74,0.3)' : 'rgba(220,38,38,0.3)'}`,
            }}>
              {/* Header */}
              <div style={{
                fontSize: 28, fontWeight: 900, textAlign: 'center',
                color: approved ? '#4ade80' : '#f87171',
                fontFamily: 'sans-serif', marginBottom: 6,
              }}>
                {approved ? '✓ APROVADO' : '✗ REPROVADO'}
              </div>
              <div style={{ textAlign: 'center', color: '#64748b', fontSize: 12, fontFamily: 'monospace', marginBottom: 18 }}>
                NN_WRISTBACK_45 · câmera: {cameraLabel}
              </div>

              {/* Metrics table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'monospace', fontSize: 11 }}>
                <tbody>
                  {METRICS_META.map(meta => {
                    const v       = m[meta.key];
                    const hasCrit = !!meta.crit;
                    const pass    = hasCrit ? meta.crit(m) : null;
                    return (
                      <tr key={meta.key} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <td style={{ padding: '5px 0', color: '#94a3b8', paddingRight: 10 }}>{meta.label}</td>
                        <td style={{ padding: '5px 0', color: '#e2e8f0', textAlign: 'right', fontWeight: hasCrit ? 600 : 400 }}>
                          {typeof v === 'number' && !Number.isInteger(v) ? v.toFixed(3) : String(v)}{meta.unit ?? ''}
                        </td>
                        <td style={{ padding: '5px 0', paddingLeft: 8, textAlign: 'right', width: 60 }}>
                          {meta.thresh && (
                            <span style={{ color: '#475569', fontSize: 10 }}>{meta.thresh}</span>
                          )}
                        </td>
                        <td style={{ padding: '5px 0', paddingLeft: 6, width: 18 }}>
                          {pass === true  && <span style={{ color: '#4ade80' }}>✓</span>}
                          {pass === false && <span style={{ color: '#f87171' }}>✗</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Fail reasons */}
              {!approved && ev.failReasons.length > 0 && (
                <div style={{ marginTop: 14, padding: '10px 12px', background: 'rgba(220,38,38,0.12)', borderRadius: 8, border: '1px solid rgba(220,38,38,0.3)' }}>
                  <div style={{ color: '#f87171', fontWeight: 700, fontSize: 11, fontFamily: 'monospace', marginBottom: 6 }}>
                    MOTIVOS DA REPROVAÇÃO
                  </div>
                  {ev.failReasons.map((r, i) => (
                    <div key={i} style={{ color: '#fca5a5', fontSize: 11, fontFamily: 'monospace', marginBottom: 3 }}>• {r}</div>
                  ))}
                </div>
              )}

              {/* Action buttons */}
              <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button
                  onClick={handleCopy}
                  style={{
                    padding: '13px', borderRadius: 9, border: 'none',
                    background: copied ? '#15803d' : '#2563eb',
                    color: '#fff', cursor: 'pointer', fontSize: 15,
                    fontFamily: 'sans-serif', fontWeight: 600,
                  }}
                >
                  {copied ? '✓ Relatório copiado!' : 'Copiar relatório'}
                </button>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={handleNewTest}
                    style={{
                      flex: 1, padding: '11px', borderRadius: 9, border: 'none',
                      background: '#374151', color: '#e2e8f0', cursor: 'pointer',
                      fontSize: 14, fontFamily: 'sans-serif',
                    }}
                  >
                    Novo teste
                  </button>
                  <button
                    onClick={() => setTestPhase('idle')}
                    style={{
                      flex: 1, padding: '11px', borderRadius: 9,
                      border: '1px solid rgba(255,255,255,0.15)',
                      background: 'transparent', color: '#94a3b8', cursor: 'pointer',
                      fontSize: 14, fontFamily: 'sans-serif',
                    }}
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Bottom controls ── */}
      <div style={{
        position: 'absolute', bottom: 28, left: '50%',
        transform: 'translateX(-50%)', zIndex: 10,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
      }}>
        {testPhase !== 'running' && (
          <button
            onClick={() => setFacingMode(p => p === 'environment' ? 'user' : 'environment')}
            style={{
              padding: '14px 40px', borderRadius: 10, border: 'none',
              background: '#7c3aed', color: '#fff', cursor: 'pointer',
              fontSize: 17, fontFamily: 'sans-serif', fontWeight: 600,
            }}
          >
            Trocar câmera → {cameraLabel === 'traseira' ? 'frontal' : 'traseira'}
          </button>
        )}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={handleStop}
            style={{
              padding: '10px 22px', borderRadius: 8, border: 'none',
              background: '#dc2626', color: '#fff', cursor: 'pointer',
              fontSize: 14, fontFamily: 'sans-serif',
            }}
          >
            Parar câmera
          </button>
          <button
            onClick={() => window.history.back()}
            style={{
              padding: '10px 22px', borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(0,0,0,0.6)', color: '#e2e8f0',
              cursor: 'pointer', fontSize: 14, fontFamily: 'sans-serif',
            }}
          >
            ← Voltar
          </button>
        </div>
      </div>
    </div>
  );
}

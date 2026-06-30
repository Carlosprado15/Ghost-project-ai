import { useEffect, useRef, useState, useCallback } from 'react';

const LIB_URL = '/libs/webarrocks/WebARRocksHand.js';
const NN_URL  = '/libs/webarrocks/NN_WRISTBACK_45.json';

function loadLibScript() {
  return new Promise((resolve, reject) => {
    if (document.getElementById('war-hand-lib')) { resolve(); return; }
    const s = document.createElement('script');
    s.src = LIB_URL;
    s.id  = 'war-hand-lib';
    s.onload = resolve;
    s.onerror = () => reject(new Error('Failed to load WebARRocksHand.js'));
    document.head.appendChild(s);
  });
}

// WebGL clip coords (x,y in [-1,1], y-up) → canvas pixel coords (y-down)
function clipToPixel(cx, cy, W, H) {
  return { px: (cx + 1) / 2 * W, py: (1 - cy) / 2 * H };
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

export default function WebARRocksLab() {
  const glCanvasRef   = useRef(null);
  const ovCanvasRef   = useRef(null);
  const ovCtxRef      = useRef(null);
  const activeRef     = useRef(false);
  const lastUpdateRef = useRef(0);

  // Calibration refs — updated instantly, used inside callbackTrack
  const scaleRef   = useRef(1.2);
  const offXRef    = useRef(0);
  const offYRef    = useRef(0);
  const rotOffRef  = useRef(0);

  const [facingMode, setFacingMode] = useState('environment');
  const [status,     setStatus]     = useState('idle');
  const [detected,   setDetected]   = useState(false);
  const [diagData,   setDiagData]   = useState({});

  // Calibration state (for slider display only)
  const [scale,   setScale]   = useState(1.2);
  const [offX,    setOffX]    = useState(0);
  const [offY,    setOffY]    = useState(0);
  const [rotOff,  setRotOff]  = useState(0);

  const cameraLabel = facingMode === 'environment' ? 'traseira' : 'frontal';

  const sizeCanvases = useCallback(() => {
    const gl = glCanvasRef.current;
    const ov = ovCanvasRef.current;
    if (!gl || !ov) return;
    const pr = window.devicePixelRatio || 1;
    const W  = Math.round(window.innerWidth  * pr);
    const H  = Math.round(window.innerHeight * pr);
    gl.width  = ov.width  = W;
    gl.height = ov.height = H;
    gl.style.width  = ov.style.width  = window.innerWidth  + 'px';
    gl.style.height = ov.style.height = window.innerHeight + 'px';
    if (window.WEBARROCKSHAND && activeRef.current) {
      try { window.WEBARROCKSHAND.resize(); } catch (_) {}
    }
  }, []);

  const drawOverlay = useCallback((detectState) => {
    const ctx = ovCtxRef.current;
    const ov  = ovCanvasRef.current;
    if (!ctx || !ov) return;

    const W  = ov.width;
    const H  = ov.height;
    const pr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, W, H);

    const isDetected = detectState.isDetected || (detectState.detected > 0.5);
    if (!isDetected) return;

    const lms = detectState.landmarks;
    let cx, cy, watchW;

    if (lms?.length >= 2) {
      // Center: average of ALL landmark positions (more accurate than x,y for wrist)
      let sumX = 0, sumY = 0, minX = Infinity, maxX = -Infinity;
      lms.forEach(([lx, ly]) => {
        sumX += lx;
        sumY += ly;
        if (lx < minX) minX = lx;
        if (lx > maxX) maxX = lx;
      });
      const { px, py } = clipToPixel(sumX / lms.length, sumY / lms.length, W, H);
      cx = px + offXRef.current * pr;
      cy = py + offYRef.current * pr;

      // Width from landmark bounding box horizontal span → actual wrist width in canvas pixels
      const pxMin = clipToPixel(minX, 0, W, H).px;
      const pxMax = clipToPixel(maxX, 0, W, H).px;
      const rawW  = Math.abs(pxMax - pxMin);
      watchW = clamp(rawW * scaleRef.current, 40 * pr, 160 * pr);
    } else {
      // Fallback: use detectState.x/y (detection frame center) with fixed base size
      const { x, y } = detectState;
      const { px, py } = clipToPixel(x, y, W, H);
      cx = px + offXRef.current * pr;
      cy = py + offYRef.current * pr;
      watchW = clamp(90 * pr * scaleRef.current, 40 * pr, 160 * pr);
    }

    const watchH   = watchW * 0.55;
    const rotation = (detectState.rz ?? 0) + rotOffRef.current * (Math.PI / 180);

    // Watch body
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation);
    ctx.fillStyle   = 'rgba(59,130,246,0.45)';
    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth   = Math.max(1.5, 2 * pr / (window.devicePixelRatio || 1));
    ctx.fillRect  (-watchW / 2, -watchH / 2, watchW, watchH);
    ctx.strokeRect(-watchW / 2, -watchH / 2, watchW, watchH);
    // Straps
    ctx.fillStyle = 'rgba(59,130,246,0.28)';
    ctx.fillRect(-watchW * 0.18, -watchH / 2 - watchH * 0.26, watchW * 0.36, watchH * 0.26);
    ctx.fillRect(-watchW * 0.18,  watchH / 2,                  watchW * 0.36, watchH * 0.26);
    // Dial
    ctx.beginPath();
    ctx.arc(0, 0, watchH * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fill();
    ctx.restore();

    // Center anchor dot
    ctx.beginPath();
    ctx.arc(cx, cy, 4 * pr, 0, Math.PI * 2);
    ctx.fillStyle = '#ef4444';
    ctx.fill();

    // Landmark dots
    if (lms?.length) {
      lms.forEach(([lx, ly], i) => {
        const { px, py } = clipToPixel(lx, ly, W, H);
        ctx.beginPath();
        ctx.arc(px, py, 4 * pr, 0, Math.PI * 2);
        ctx.fillStyle = i < 4 ? '#facc15' : '#4ade80';
        ctx.fill();
      });
    }
  }, []);

  const callbackTrack = useCallback((detectState) => {
    if (!activeRef.current) return;
    window.WEBARROCKSHAND.render_video();
    drawOverlay(detectState);

    const now = performance.now();
    if (now - lastUpdateRef.current > 400) {
      lastUpdateRef.current = now;
      const isDetected = detectState.isDetected || (detectState.detected > 0.5);
      setDetected(!!isDetected);
      const { landmarks, ...rest } = detectState;
      setDiagData({ ...rest, landmarks: landmarks?.length ?? 0 });
    }
  }, [drawOverlay]);

  useEffect(() => {
    let destroyed = false;

    (async () => {
      setStatus('carregando…');
      setDetected(false);

      try {
        await loadLibScript();
        if (destroyed) return;

        sizeCanvases();
        ovCtxRef.current = ovCanvasRef.current.getContext('2d');
        activeRef.current = true;

        window.WEBARROCKSHAND.init({
          canvasId:      'war-gl-canvas',
          NNsPaths:      [NN_URL],
          videoSettings: { facingMode },
          callbackReady: (err) => {
            if (destroyed) return;
            if (err === 'WEBCAM_UNAVAILABLE' && facingMode === 'environment') {
              try { window.WEBARROCKSHAND.destroy(); } catch (_) {}
              setFacingMode('user');
              return;
            }
            if (err) { setStatus('error: ' + err); return; }
            setStatus('ready');
          },
          callbackTrack,
        });
      } catch (e) {
        if (!destroyed) setStatus('error: ' + e.message);
      }
    })();

    window.addEventListener('resize', sizeCanvases);
    return () => {
      destroyed = true;
      activeRef.current = false;
      window.removeEventListener('resize', sizeCanvases);
      try { window.WEBARROCKSHAND?.destroy(); } catch (_) {}
    };
  }, [callbackTrack, sizeCanvases, facingMode]);

  const handleStop = () => {
    activeRef.current = false;
    try { window.WEBARROCKSHAND?.destroy(); } catch (_) {}
    const ov = ovCanvasRef.current;
    if (ov) ovCtxRef.current?.clearRect(0, 0, ov.width, ov.height);
    setStatus('parado');
    setDetected(false);
  };

  const handleScale  = (v) => { scaleRef.current  = v; setScale(v);  };
  const handleOffX   = (v) => { offXRef.current   = v; setOffX(v);   };
  const handleOffY   = (v) => { offYRef.current   = v; setOffY(v);   };
  const handleRotOff = (v) => { rotOffRef.current = v; setRotOff(v); };

  const statusColor   = status.startsWith('error') ? '#f87171' : status === 'ready' ? '#4ade80' : '#facc15';
  const detectedColor = detected ? '#4ade80' : '#f87171';

  const SLIDERS = [
    { label: 'scaleMultiplier', val: scale,  fn: handleScale,  min: 0.3, max: 4,    step: 0.05, fmt: v => v.toFixed(2) },
    { label: 'offsetX (px)',    val: offX,   fn: handleOffX,   min: -80, max: 80,   step: 1,    fmt: v => v + 'px' },
    { label: 'offsetY (px)',    val: offY,   fn: handleOffY,   min: -80, max: 80,   step: 1,    fmt: v => v + 'px' },
    { label: 'rotationOffset',  val: rotOff, fn: handleRotOff, min: -180, max: 180, step: 1,    fmt: v => v + '°' },
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0a0a0a', overflow: 'hidden' }}>
      <canvas id="war-gl-canvas" ref={glCanvasRef} style={{ position: 'absolute', inset: 0 }} />
      <canvas ref={ovCanvasRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />

      {/* Status / diagnostic panel — top-left */}
      <div style={{
        position: 'absolute', top: 14, left: 14, zIndex: 10,
        background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(6px)',
        color: '#e2e8f0', borderRadius: 10, padding: '10px 14px',
        fontFamily: 'monospace', fontSize: 11, maxWidth: 240,
        border: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{ fontWeight: 'bold', color: '#a78bfa', marginBottom: 5, fontSize: 12 }}>
          WebAR.rocks — Spike Lab
        </div>
        <div>NN: <span style={{ color: '#93c5fd' }}>WRISTBACK_45</span></div>
        <div>câmera: <span style={{ color: '#fbbf24' }}>{cameraLabel}</span></div>
        <div>status: <span style={{ color: statusColor }}>{status}</span></div>
        <div style={{ marginTop: 4 }}>
          detected: <span style={{ color: detectedColor }}>{detected ? 'YES ✓' : 'NO'}</span>
        </div>
        {Object.keys(diagData).length > 0 && (
          <div style={{ marginTop: 4, borderTop: '1px solid rgba(255,255,255,0.10)', paddingTop: 4 }}>
            {Object.entries(diagData).map(([k, v]) => (
              <div key={k}>
                <span style={{ color: '#94a3b8' }}>{k}: </span>
                <span style={{ color: '#93c5fd' }}>
                  {typeof v === 'number' ? v.toFixed(4) : String(v)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Calibration sliders — top-right */}
      <div style={{
        position: 'absolute', top: 14, right: 14, zIndex: 10,
        background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(6px)',
        color: '#e2e8f0', borderRadius: 10, padding: '10px 14px',
        fontFamily: 'monospace', fontSize: 11, width: 210,
        border: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{ fontWeight: 'bold', color: '#a78bfa', marginBottom: 8, fontSize: 12 }}>
          Calibração
        </div>
        {SLIDERS.map(({ label, val, fn, min, max, step, fmt }) => (
          <div key={label} style={{ marginBottom: 8 }}>
            <div style={{ color: '#94a3b8', marginBottom: 2 }}>
              {label}: <span style={{ color: '#e2e8f0' }}>{fmt(val)}</span>
            </div>
            <input
              type="range" min={min} max={max} step={step} value={val}
              onChange={e => fn(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: '#7c3aed', cursor: 'pointer' }}
            />
          </div>
        ))}
      </div>

      {/* Controls — bottom-center */}
      <div style={{
        position: 'absolute', bottom: 28, left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10, display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: 12,
      }}>
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

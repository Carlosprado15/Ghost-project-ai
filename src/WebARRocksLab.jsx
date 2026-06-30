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

export default function WebARRocksLab() {
  const glCanvasRef   = useRef(null);  // WebGL canvas (library owns this)
  const ovCanvasRef   = useRef(null);  // 2D overlay canvas
  const ovCtxRef      = useRef(null);
  const activeRef     = useRef(false);
  const lastUpdateRef = useRef(0);

  const [status,   setStatus]   = useState('idle');
  const [detected, setDetected] = useState(false);
  const [confidence, setConfidence] = useState(0);
  const [lmCount,  setLmCount]  = useState(0);
  const [rawProps, setRawProps] = useState({});

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
    // notify lib of canvas resize
    if (window.WEBARROCKSHAND && activeRef.current) {
      try { window.WEBARROCKSHAND.resize(); } catch (_) {}
    }
  }, []);

  const drawOverlay = useCallback((detectState) => {
    const ctx = ovCtxRef.current;
    const ov  = ovCanvasRef.current;
    if (!ctx || !ov) return;

    const W = ov.width, H = ov.height;
    ctx.clearRect(0, 0, W, H);

    const isDetected = detectState.isDetected || (detectState.detected > 0.5);
    if (!isDetected) return;

    // Use x, y, s, rz from detectState directly (canonical API from README)
    const { x, y, s, rz } = detectState;
    const { px: cx, py: cy } = clipToPixel(x, y, W, H);

    // Scale: s is fraction of canvas width; detection frame is square
    const frameSize  = s * W;
    const watchW     = frameSize * 0.85;
    const watchH     = watchW   * 0.55;

    // Placeholder watch body
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rz);  // rz is already the in-plane rotation in radians
    ctx.fillStyle   = 'rgba(59,130,246,0.38)';
    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth   = 2.5;
    ctx.fillRect  (-watchW / 2, -watchH / 2, watchW, watchH);
    ctx.strokeRect(-watchW / 2, -watchH / 2, watchW, watchH);

    // Watch strap top
    ctx.fillStyle = 'rgba(59,130,246,0.25)';
    ctx.fillRect(-watchW * 0.2, -watchH / 2 - watchH * 0.3, watchW * 0.4, watchH * 0.3);
    // Watch strap bottom
    ctx.fillRect(-watchW * 0.2,  watchH / 2,                watchW * 0.4, watchH * 0.3);

    // Watch dial (circle)
    ctx.beginPath();
    ctx.arc(0, 0, watchH * 0.32, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fill();
    ctx.restore();

    // Center anchor dot
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#ef4444';
    ctx.fill();

    // Landmark dots (if available)
    const lms = detectState.landmarks;
    if (lms?.length) {
      lms.forEach(([lx, ly], i) => {
        const { px, py } = clipToPixel(lx, ly, W, H);
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, Math.PI * 2);
        ctx.fillStyle = i < 4 ? '#facc15' : '#4ade80';
        ctx.fill();
      });
    }
  }, []);

  const callbackTrack = useCallback((detectState) => {
    if (!activeRef.current) return;

    // Library renders the camera feed into the WebGL canvas
    window.WEBARROCKSHAND.render_video();

    drawOverlay(detectState);

    // Throttle React state updates to ~400ms
    const now = performance.now();
    if (now - lastUpdateRef.current > 400) {
      lastUpdateRef.current = now;
      const isDetected = detectState.isDetected || (detectState.detected > 0.5);
      setDetected(!!isDetected);
      setConfidence(+(detectState.detected ?? 0).toFixed(3));
      setLmCount(detectState.landmarks?.length ?? 0);
      const { landmarks, ...rest } = detectState;
      setRawProps(rest);
    }
  }, [drawOverlay]);

  useEffect(() => {
    let destroyed = false;

    (async () => {
      setStatus('loading…');
      try {
        await loadLibScript();
        if (destroyed) return;

        sizeCanvases();
        ovCtxRef.current = ovCanvasRef.current.getContext('2d');
        activeRef.current = true;

        window.WEBARROCKSHAND.init({
          canvasId:     'war-gl-canvas',
          NNsPaths:     [NN_URL],
          videoSettings: { facingMode: 'user' },
          callbackReady: (err) => {
            if (destroyed) return;
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
  }, [callbackTrack, sizeCanvases]);

  const handleStop = () => {
    activeRef.current = false;
    try { window.WEBARROCKSHAND?.destroy(); } catch (_) {}
    const ov = ovCanvasRef.current;
    if (ov) ovCtxRef.current?.clearRect(0, 0, ov.width, ov.height);
    setStatus('stopped');
    setDetected(false);
    setConfidence(0);
  };

  const statusColor = status.startsWith('error')
    ? '#f87171'
    : status === 'ready' ? '#4ade80' : '#facc15';

  const detectedColor = detected ? '#4ade80' : '#f87171';

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0a0a0a', overflow: 'hidden' }}>
      {/* WebGL canvas — library draws camera feed + manages WebGL context here */}
      <canvas
        id="war-gl-canvas"
        ref={glCanvasRef}
        style={{ position: 'absolute', inset: 0 }}
      />

      {/* 2D overlay — placeholder watch + landmarks */}
      <canvas
        ref={ovCanvasRef}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      />

      {/* Status / debug panel */}
      <div style={{
        position: 'absolute', top: 14, left: 14, zIndex: 10,
        background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(6px)',
        color: '#e2e8f0', borderRadius: 10, padding: '10px 14px',
        fontFamily: 'monospace', fontSize: 12, maxWidth: 310,
        border: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{ fontWeight: 'bold', color: '#a78bfa', marginBottom: 6, fontSize: 13 }}>
          WebAR.rocks.hand — Spike Lab
        </div>
        <div>NN: <span style={{ color: '#93c5fd' }}>NN_WRISTBACK_45</span></div>
        <div>status: <span style={{ color: statusColor }}>{status}</span></div>
        <div>detected: <span style={{ color: detectedColor }}>{detected ? 'YES ✓' : 'NO'}</span>
          {' '}conf: <span style={{ color: detectedColor }}>{confidence}</span>
        </div>
        <div>landmarks: {lmCount}</div>

        {Object.keys(rawProps).length > 0 && (
          <details style={{ marginTop: 8 }}>
            <summary style={{ cursor: 'pointer', color: '#93c5fd', userSelect: 'none' }}>
              detectState (raw)
            </summary>
            <pre style={{
              fontSize: 10, marginTop: 4,
              maxHeight: 200, overflow: 'auto',
              color: '#d1fae5',
            }}>
              {JSON.stringify(rawProps, null, 2)}
            </pre>
          </details>
        )}
      </div>

      {/* Controls */}
      <div style={{
        position: 'absolute', bottom: 28, left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10, display: 'flex', gap: 10,
      }}>
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
  );
}

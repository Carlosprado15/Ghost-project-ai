import { useState, useRef, useEffect, useCallback } from 'react';
import { WristTracker } from './tracking/WristTracker.js';

// ── CDN loaders — cópia isolada, sem dependência do App_FINAL ─────────────
function loadScript(src, id) {
  return new Promise((resolve, reject) => {
    if (document.getElementById(id)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src; s.id = id; s.crossOrigin = 'anonymous';
    s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function loadMediaPipe() {
  await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js', 'mp-cu');
  await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js', 'mp-du');
  await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js', 'mp-h');
}

// ── Presets de ROI ─────────────────────────────────────────────────────────
// Valores em fração do vídeo: x, y = canto superior-esquerdo; w, h = largura/altura
const PRESETS = {
  'Vídeo normal':    { x: 0,    y: 0,    w: 1.0,  h: 1.0 },
  'Tela celular':    { x: 0.10, y: 0.20, w: 0.80, h: 0.60 },
};

// ── Helpers (fora do componente — evita remount a cada render) ─────────────
function SliderRow({ label, value, min, max, step, display, onChange }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ color: 'rgba(255,255,255,0.60)', fontSize: 11 }}>{label}</span>
        <span style={{ color: '#D4AF37', fontSize: 11 }}>{display}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: '#D4AF37' }}
      />
    </div>
  );
}

function ToggleBtn({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      flex: 1,
      background: active ? 'rgba(212,175,55,0.20)' : 'rgba(255,255,255,0.05)',
      border: `1px solid ${active ? 'rgba(212,175,55,0.50)' : 'rgba(255,255,255,0.12)'}`,
      borderRadius: 8, color: active ? '#D4AF37' : 'rgba(255,255,255,0.40)',
      padding: '6px 4px', fontSize: 10, fontFamily: 'monospace',
      cursor: 'pointer', letterSpacing: '0.05em',
    }}>
      {label}
    </button>
  );
}

// ── Componente principal ───────────────────────────────────────────────────
export default function ReplayLab() {
  // ── Estado base ───────────────────────────────────────────────────────────
  const [videoSrc, setVideoSrc]         = useState(null);
  const [status, setStatus]             = useState('idle'); // idle | loading | ready | error
  const [debugData, setDebugData]       = useState(null);
  const [pose, setPose]                 = useState({ x: 0, y: 0, size: 0, rotation: 0 });
  const [tracking, setTracking]         = useState({ isTracking: false, confidence: 0 });
  const [detectionRate, setDetectionRate] = useState(0);

  // ── Parâmetros de tracking ao vivo ────────────────────────────────────────
  const [liveParams, setLiveParams] = useState({
    offsetRatio: 0.18, sizeMultiplier: 1.5, rotationOffset: -90,
    flipX: false, offsetDirection: 'default',
  });

  // ── ROI / Zoom ────────────────────────────────────────────────────────────
  const [roi, setRoi]           = useState({ x: 0, y: 0, w: 1.0, h: 1.0 });
  const [roiEnabled, setRoiEnabled] = useState(false);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const videoRef           = useRef(null);
  const handsRef           = useRef(null);
  const trackerRef         = useRef(null);
  const rafRef             = useRef(null);
  const lastCtRef          = useRef(-1);
  const activeRef          = useRef(false);
  const mirrorXRef         = useRef(false);
  const videoUrlRef        = useRef(null);
  const cropCanvasRef      = useRef(null);   // canvas offscreen para recorte ROI
  const roiRef             = useRef(roi);    // valor atual do ROI sem stale closure
  const roiEnabledRef      = useRef(false);  // idem para on/off
  const detectionWindowRef = useRef([]);     // janela deslizante de detecção (60 frames)
  const lastRateUpdateRef  = useRef(0);      // throttle do setState de taxa

  // ── Init: canvas offscreen 640×480 para recorte ROI ──────────────────────
  useEffect(() => {
    const c = document.createElement('canvas');
    c.width = 640;
    c.height = 480;
    cropCanvasRef.current = c;
  }, []);

  // ── Init: WristTracker (uma vez) ──────────────────────────────────────────
  useEffect(() => {
    trackerRef.current = new WristTracker({
      minConfidence: 0.6, minStabilityFrames: 8, maxLostFrames: 30,
      positionMinCutoff: 1.2, positionBeta: 0.3,
      rotationMinCutoff: 1.0, rotationBeta: 0.5,
      scaleMinCutoff: 0.8,   scaleBeta: 0.1,
      watchSizeMultiplier: 1.5, watchOffsetRatio: 0.18,
    });
    return () => trackerRef.current?.reset?.();
  }, []);

  // ── Sincroniza state → refs (evita stale closures em callbacks estáveis) ──
  useEffect(() => { roiRef.current = roi; }, [roi]);
  useEffect(() => { roiEnabledRef.current = roiEnabled; }, [roiEnabled]);

  // ── Sincroniza liveParams → config do tracker + mirrorXRef ────────────────
  useEffect(() => {
    mirrorXRef.current = liveParams.flipX;
    if (!trackerRef.current) return;
    trackerRef.current.config.watchOffsetRatio    = liveParams.offsetRatio;
    trackerRef.current.config.watchSizeMultiplier = liveParams.sizeMultiplier;
    trackerRef.current.config.watchRotationOffset = liveParams.rotationOffset;
    trackerRef.current.config.watchOffsetFlip     = liveParams.offsetDirection === 'forearm';
  }, [liveParams]);

  // ── onHandsResults — estável, lê tudo via refs ───────────────────────────
  const onHandsResults = useCallback((results) => {
    // Taxa de detecção (janela 60 frames, atualiza estado a cada 400ms)
    const hasHand = (results.multiHandLandmarks?.length ?? 0) > 0;
    const win = detectionWindowRef.current;
    win.push(hasHand);
    if (win.length > 60) win.shift();
    const now = Date.now();
    if (now - lastRateUpdateRef.current > 400) {
      lastRateUpdateRef.current = now;
      setDetectionRate(Math.round(win.filter(Boolean).length / win.length * 100));
    }

    if (!videoRef.current || !trackerRef.current) return;

    let lms = results.multiHandLandmarks?.[0] ?? null;
    const rect = videoRef.current.getBoundingClientRect();

    // Remapear landmarks do espaço do crop para o espaço do vídeo completo.
    // MediaPipe recebeu o canvas recortado → coords 0-1 estão dentro do ROI.
    // WristTracker espera coords 0-1 do vídeo inteiro → mapear de volta.
    if (lms && roiEnabledRef.current) {
      const { x: rx, y: ry, w: rw, h: rh } = roiRef.current;
      lms = lms.map(lm => ({
        ...lm,
        x: rx + lm.x * rw,
        y: ry + lm.y * rh,
      }));
    }

    const p = trackerRef.current.update(lms, null, rect, mirrorXRef.current);
    setDebugData(trackerRef.current.debugData ? { ...trackerRef.current.debugData } : null);
    setPose({ x: p.x ?? 0, y: p.y ?? 0, size: p.size ?? 0, rotation: p.rotation ?? 0 });
    setTracking({
      isTracking: trackerRef.current.state.isTracking,
      confidence: trackerRef.current.state.confidence,
    });
  }, []); // sem deps — lê tudo via refs

  // ── Loop rAF — envia frame (ou recorte) ao MediaPipe quando currentTime muda
  const startLoop = useCallback(() => {
    activeRef.current = true;
    lastCtRef.current = -1;
    const loop = async () => {
      if (!activeRef.current) return;
      const v = videoRef.current;
      if (v && handsRef.current && !v.paused && !v.ended && v.readyState >= 2) {
        const ct = v.currentTime;
        if (ct !== lastCtRef.current) {
          lastCtRef.current = ct;
          try {
            let source = v;
            // Se ROI ativo: recortar a região e ampliar para 640×480
            if (roiEnabledRef.current && cropCanvasRef.current && v.videoWidth > 0) {
              const c = cropCanvasRef.current;
              const ctx = c.getContext('2d');
              const { x, y, w, h } = roiRef.current;
              ctx.drawImage(
                v,
                x * v.videoWidth,  y * v.videoHeight,  // origem no vídeo
                w * v.videoWidth,  h * v.videoHeight,  // tamanho do recorte
                0, 0, c.width, c.height                // destino (640×480)
              );
              source = c;
            }
            await handsRef.current.send({ image: source });
          } catch (_) {}
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }, []);

  const stopLoop = useCallback(() => {
    activeRef.current = false;
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
  }, []);

  // ── Vincula play/pause/ended → start/stop do loop ─────────────────────────
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !videoSrc) return;
    const onPlay  = () => startLoop();
    const onPause = () => stopLoop();
    const onEnded = () => stopLoop();
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    v.addEventListener('ended', onEnded);
    return () => {
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('ended', onEnded);
      stopLoop();
    };
  }, [videoSrc, startLoop, stopLoop]);

  // ── Cleanup no unmount ────────────────────────────────────────────────────
  useEffect(() => () => {
    stopLoop();
    handsRef.current?.close?.();
    if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current);
  }, [stopLoop]);

  // ── Selecionar arquivo de vídeo ───────────────────────────────────────────
  const handleFilePick = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    stopLoop();

    if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current);
    const url = URL.createObjectURL(file);
    videoUrlRef.current = url;
    setVideoSrc(url);
    setDebugData(null);
    setPose({ x: 0, y: 0, size: 0, rotation: 0 });
    setTracking({ isTracking: false, confidence: 0 });
    setDetectionRate(0);
    detectionWindowRef.current = [];
    trackerRef.current?.reset?.();

    // MediaPipe + Hands: inicializam somente uma vez; reutilizados nas trocas de vídeo
    if (!handsRef.current) {
      setStatus('loading');
      try {
        await loadMediaPipe();
        const hands = new window.Hands({
          locateFile: (f) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`,
        });
        hands.setOptions({
          maxNumHands: 1, modelComplexity: 0,
          minDetectionConfidence: 0.3, minTrackingConfidence: 0.3,
        });
        hands.onResults(onHandsResults);
        handsRef.current = hands;
        setStatus('ready');
      } catch (err) {
        console.error('[ReplayLab]', err);
        setStatus('error');
      }
    } else {
      setStatus('ready');
    }
  }, [onHandsResults, stopLoop]);

  // ── Copiar URL com parâmetros atuais ──────────────────────────────────────
  const copyUrl = useCallback(() => {
    const p = new URLSearchParams();
    p.set('lab', 'replay');
    p.set('offsetRatio', liveParams.offsetRatio.toFixed(2));
    p.set('sizeMultiplier', liveParams.sizeMultiplier.toFixed(2));
    p.set('rotationOffset', String(liveParams.rotationOffset));
    if (liveParams.flipX) p.set('flipX', '1');
    if (liveParams.offsetDirection === 'forearm') p.set('offsetDirection', 'forearm');
    navigator.clipboard?.writeText(
      window.location.origin + window.location.pathname + '?' + p.toString()
    ).catch(() => {});
  }, [liveParams]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100dvh', background: '#0d0d0d', color: '#fff',
      fontFamily: 'monospace', overflowY: 'auto',
    }}>

      {/* Header */}
      <div style={{
        padding: '12px 16px 10px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(0,0,0,0.40)',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ color: '#D4AF37', fontWeight: 700, fontSize: 13, letterSpacing: '0.14em' }}>
            AR REPLAY LAB
          </span>
          <span style={{ color: 'rgba(255,255,255,0.22)', fontSize: 9, letterSpacing: '0.06em' }}>
            Ghost Project AI | ?lab=replay
          </span>
        </div>
        <p style={{ color: 'rgba(255,255,255,0.32)', fontSize: 10, margin: '4px 0 0', letterSpacing: '0.04em' }}>
          Carregue um vídeo do pulso. MediaPipe roda sobre o vídeo em tempo real.
        </p>
      </div>

      {/* File Picker */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <label style={{ cursor: 'pointer' }}>
          <span style={{
            display: 'inline-block',
            background: status === 'loading' ? 'rgba(255,255,255,0.05)' : 'rgba(212,175,55,0.12)',
            border: `1px solid ${status === 'loading' ? 'rgba(255,255,255,0.10)' : 'rgba(212,175,55,0.38)'}`,
            borderRadius: 8,
            color: status === 'loading' ? 'rgba(255,255,255,0.38)' : '#D4AF37',
            fontSize: 10, letterSpacing: '0.10em',
            padding: '7px 16px', textTransform: 'uppercase', cursor: 'pointer',
          }}>
            {status === 'loading' ? 'Carregando MediaPipe…' : 'Escolher Vídeo'}
          </span>
          <input type="file" accept="video/*" onChange={handleFilePick}
            disabled={status === 'loading'} style={{ display: 'none' }} />
        </label>
        {videoSrc && status === 'ready' && (
          <span style={{ color: 'rgba(255,255,255,0.28)', fontSize: 10 }}>
            ✓ pronto — aperte play
          </span>
        )}
        {status === 'error' && (
          <span style={{ color: '#f87171', fontSize: 10 }}>
            Erro ao carregar MediaPipe. Verifique a conexão.
          </span>
        )}
      </div>

      {/* Vídeo + caixa visual do ROI */}
      {videoSrc && (
        <div style={{ position: 'relative' }}>
          <video
            ref={videoRef}
            src={videoSrc}
            controls
            playsInline
            style={{
              display: 'block', width: '100%',
              maxHeight: '55vh', objectFit: 'contain',
              background: '#000',
            }}
          />
          {/* Retângulo amarelo mostrando a área analisada */}
          {roiEnabled && (
            <div style={{
              position: 'absolute',
              left:   `${roi.x * 100}%`,
              top:    `${roi.y * 100}%`,
              width:  `${roi.w * 100}%`,
              height: `${roi.h * 100}%`,
              border: '2px dashed rgba(212,175,55,0.80)',
              background: 'rgba(212,175,55,0.05)',
              pointerEvents: 'none',
              boxSizing: 'border-box',
            }}>
              <span style={{
                position: 'absolute', top: 3, left: 4,
                color: 'rgba(212,175,55,0.90)', fontSize: 9, fontFamily: 'monospace',
                letterSpacing: '0.06em', pointerEvents: 'none',
                textShadow: '0 1px 3px rgba(0,0,0,0.9)',
              }}>ROI</span>
            </div>
          )}
        </div>
      )}

      {/* Barra de status do tracking + taxa de detecção */}
      {status === 'ready' && videoSrc && (
        <div style={{
          padding: '7px 16px',
          background: tracking.isTracking ? 'rgba(0,200,80,0.07)' : 'rgba(255,255,255,0.02)',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          display: 'flex', gap: 18, fontSize: 10, flexWrap: 'wrap', alignItems: 'center',
        }}>
          <span style={{ color: tracking.isTracking ? '#4ade80' : '#f87171', fontWeight: 700 }}>
            {tracking.isTracking ? '● MÃO DETECTADA' : '○ sem tracking'}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.38)' }}>
            conf: {(tracking.confidence * 100).toFixed(0)}%
          </span>
          <span style={{
            color: detectionRate >= 60 ? '#4ade80' : detectionRate >= 20 ? '#facc15' : '#f87171',
          }}>
            detecção: {detectionRate}%
          </span>
          {debugData && <>
            <span style={{ color: 'rgba(255,255,255,0.38)' }}>
              wrist ({Math.round(debugData.wrist.x)}, {Math.round(debugData.wrist.y)})
            </span>
            <span style={{ color: 'rgba(255,255,255,0.38)' }}>
              anchor ({Math.round(debugData.watchAnchorX)}, {Math.round(debugData.watchAnchorY)})
            </span>
          </>}
          <span style={{ color: 'rgba(255,255,255,0.38)' }}>
            {Math.round(pose.size)}px | {pose.rotation.toFixed(1)}°
          </span>
        </div>
      )}

      {/* ── ROI / Zoom ───────────────────────────────────────────────────── */}
      {videoSrc && (
        <div style={{
          padding: '12px 16px 14px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          {/* Cabeçalho ROI + toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ color: '#D4AF37', fontWeight: 700, fontSize: 10, letterSpacing: '0.12em' }}>
              ROI / ZOOM
            </span>
            <button
              onClick={() => setRoiEnabled(v => !v)}
              style={{
                background: roiEnabled ? 'rgba(212,175,55,0.20)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${roiEnabled ? 'rgba(212,175,55,0.50)' : 'rgba(255,255,255,0.12)'}`,
                borderRadius: 8,
                color: roiEnabled ? '#D4AF37' : 'rgba(255,255,255,0.40)',
                padding: '4px 14px', fontSize: 10, fontFamily: 'monospace',
                cursor: 'pointer', letterSpacing: '0.06em',
              }}
            >
              {roiEnabled ? 'ON' : 'OFF'}
            </button>
          </div>

          {roiEnabled && (<>
            {/* Presets */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              {Object.entries(PRESETS).map(([label, preset]) => (
                <button
                  key={label}
                  onClick={() => setRoi(preset)}
                  style={{
                    flex: 1,
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 8,
                    color: 'rgba(255,255,255,0.50)',
                    padding: '5px 4px', fontSize: 9, fontFamily: 'monospace',
                    cursor: 'pointer', letterSpacing: '0.04em',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Sliders do ROI */}
            <SliderRow label="cropX" value={roi.x} min={0} max={0.9} step={0.01}
              display={roi.x.toFixed(2)}
              onChange={(v) => setRoi(p => ({ ...p, x: Math.min(v, 1 - p.w) }))} />
            <SliderRow label="cropY" value={roi.y} min={0} max={0.9} step={0.01}
              display={roi.y.toFixed(2)}
              onChange={(v) => setRoi(p => ({ ...p, y: Math.min(v, 1 - p.h) }))} />
            <SliderRow label="cropW" value={roi.w} min={0.10} max={1.0} step={0.01}
              display={roi.w.toFixed(2)}
              onChange={(v) => setRoi(p => ({ ...p, w: v, x: Math.min(p.x, 1 - v) }))} />
            <SliderRow label="cropH" value={roi.h} min={0.10} max={1.0} step={0.01}
              display={roi.h.toFixed(2)}
              onChange={(v) => setRoi(p => ({ ...p, h: v, y: Math.min(p.y, 1 - v) }))} />

            {/* Reset */}
            <button
              onClick={() => setRoi(PRESETS['Vídeo normal'])}
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.10)',
                borderRadius: 8, color: 'rgba(255,255,255,0.30)',
                fontSize: 9, letterSpacing: '0.06em',
                padding: '5px 10px', cursor: 'pointer', textTransform: 'uppercase',
              }}
            >
              Reset ROI
            </button>
          </>)}
        </div>
      )}

      {/* ── Parâmetros de tracking ao vivo ───────────────────────────────── */}
      {videoSrc && (
        <div style={{ padding: '14px 16px 36px' }}>
          <div style={{
            color: '#D4AF37', fontWeight: 700, fontSize: 10,
            letterSpacing: '0.12em', marginBottom: 14,
          }}>
            PARÂMETROS AO VIVO
          </div>

          <SliderRow label="offsetRatio" value={liveParams.offsetRatio}
            min={0.05} max={0.35} step={0.01} display={liveParams.offsetRatio.toFixed(2)}
            onChange={(v) => setLiveParams(p => ({ ...p, offsetRatio: v }))} />

          <SliderRow label="sizeMultiplier" value={liveParams.sizeMultiplier}
            min={0.8} max={2.4} step={0.05} display={liveParams.sizeMultiplier.toFixed(2)}
            onChange={(v) => setLiveParams(p => ({ ...p, sizeMultiplier: v }))} />

          <SliderRow label="rotationOffset" value={liveParams.rotationOffset}
            min={-180} max={180} step={5} display={`${liveParams.rotationOffset}°`}
            onChange={(v) => setLiveParams(p => ({ ...p, rotationOffset: parseInt(v) }))} />

          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <ToggleBtn
              label={`flipX: ${liveParams.flipX ? 'ON' : 'OFF'}`}
              active={liveParams.flipX}
              onClick={() => setLiveParams(p => ({ ...p, flipX: !p.flipX }))}
            />
            <ToggleBtn
              label={liveParams.offsetDirection === 'forearm' ? '→ forearm' : '→ default'}
              active={liveParams.offsetDirection === 'forearm'}
              onClick={() => setLiveParams(p => ({
                ...p, offsetDirection: p.offsetDirection === 'forearm' ? 'default' : 'forearm',
              }))}
            />
          </div>

          <button onClick={copyUrl} style={{
            width: '100%',
            background: 'rgba(212,175,55,0.08)',
            border: '1px solid rgba(212,175,55,0.25)',
            borderRadius: 8, color: 'rgba(212,175,55,0.72)',
            fontSize: 10, letterSpacing: '0.08em',
            padding: '7px 10px', cursor: 'pointer', textTransform: 'uppercase',
          }}>
            Copiar URL com parâmetros
          </button>
        </div>
      )}

      {/* Estado vazio */}
      {!videoSrc && (
        <div style={{ padding: '52px 24px', textAlign: 'center' }}>
          <p style={{ color: 'rgba(255,255,255,0.16)', fontSize: 13, letterSpacing: '0.06em', marginBottom: 12 }}>
            Nenhum vídeo carregado
          </p>
          <p style={{ color: 'rgba(255,255,255,0.09)', fontSize: 10, lineHeight: 1.8, letterSpacing: '0.04em' }}>
            Grave um vídeo do pulso no celular (MP4 / H.264),<br />
            transfira para o computador e carregue acima.
          </p>
        </div>
      )}

      {/* Overlay SVG fixo — pontos de tracking em coordenadas de viewport */}
      {status === 'ready' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 998, pointerEvents: 'none' }}>
          <svg style={{
            position: 'absolute', left: 0, top: 0,
            width: '100%', height: '100%', overflow: 'visible',
          }}>
            {debugData && (<>
              {/* Amarelo: vetor antebraço wrist → palmCenter */}
              <line
                x1={debugData.wrist.x} y1={debugData.wrist.y}
                x2={debugData.palmCenter.x} y2={debugData.palmCenter.y}
                stroke="#FFD700" strokeWidth={2.5} opacity={0.9}
              />
              {/* Laranja tracejado: wrist → watchAnchor */}
              <line
                x1={debugData.wrist.x} y1={debugData.wrist.y}
                x2={debugData.watchAnchorX} y2={debugData.watchAnchorY}
                stroke="#FF8C00" strokeWidth={1.5} strokeDasharray="5 3" opacity={0.8}
              />
              {/* Azul: wrist */}
              <circle cx={debugData.wrist.x} cy={debugData.wrist.y} r={8}
                fill="rgba(30,120,255,0.85)" stroke="#fff" strokeWidth={1.5} />
              <text x={debugData.wrist.x + 11} y={debugData.wrist.y + 4}
                fill="#7af" fontSize={10} fontFamily="monospace">wrist</text>
              {/* Verde: palmCenter */}
              <circle cx={debugData.palmCenter.x} cy={debugData.palmCenter.y} r={6}
                fill="rgba(0,210,70,0.85)" stroke="#fff" strokeWidth={1.5} />
              <text x={debugData.palmCenter.x + 8} y={debugData.palmCenter.y + 4}
                fill="#4f8" fontSize={10} fontFamily="monospace">palm</text>
              {/* Vermelho: watchAnchor pré-smoothing */}
              <circle cx={debugData.watchAnchorX} cy={debugData.watchAnchorY} r={6}
                fill="rgba(255,50,50,0.85)" stroke="#fff" strokeWidth={1.5} />
              <text x={debugData.watchAnchorX + 8} y={debugData.watchAnchorY + 4}
                fill="#f88" fontSize={10} fontFamily="monospace">anchor</text>
            </>)}
            {/* Branco + dourado: centro de renderização + contorno do tamanho do relógio */}
            {pose.size > 0 && (<>
              <circle cx={pose.x} cy={pose.y} r={pose.size / 2}
                fill="none" stroke="rgba(212,175,55,0.35)" strokeWidth={1.5} strokeDasharray="4 4" />
              <circle cx={pose.x} cy={pose.y} r={11}
                fill="none" stroke="#fff" strokeWidth={2.5} opacity={0.9} />
              <circle cx={pose.x} cy={pose.y} r={3} fill="#fff" opacity={0.9} />
              <text x={pose.x + 14} y={pose.y + 4} fill="#fff" fontSize={10} fontFamily="monospace">render</text>
            </>)}
          </svg>
        </div>
      )}
    </div>
  );
}

import { useRef, useState, useEffect, useCallback } from 'react';
import { useGhostWristAR } from './useGhostWristAR.js';

const DEFAULT_ORIENTATION  = '0deg 0deg -90deg';
const DEFAULT_SCALE_MULT   = 4.5;

/**
 * GhostWristARView — full standalone AR component.
 *
 * Manages its own camera stream. The host app only needs to provide
 * a glbUrl and optionally styling/behaviour props.
 *
 * Props:
 *   glbUrl          — path or URL to the .glb model (required)
 *   orientation     — model-viewer orientation string (default: "0deg 0deg -90deg")
 *   scaleMultiplier — pixel scale factor relative to wrist span (default: 4.5)
 *   arScale         — per-product additional multiplier (default: 1.0)
 *   filterPreset    — { minCutoff, beta, dCutoff } (default: engine preset)
 *   debug           — show debug HUD (default: false)
 *   forceCenter     — diagnóstico: renderiza o GLB fixo no centro da tela,
 *                     ignorando o tracking (prova se o model-viewer carrega)
 *   style           — extra CSS for the outer container
 *   children        — overlays rendered on top
 */
export function GhostWristARView({
  glbUrl,
  orientation     = DEFAULT_ORIENTATION,
  scaleMultiplier = DEFAULT_SCALE_MULT,
  arScale         = 1.0,
  filterPreset    = null,
  debug           = false,
  forceCenter     = false,
  style,
  children,
}) {
  const videoRef   = useRef(null);
  const streamRef  = useRef(null);
  const [facingMode, setFacingMode] = useState('environment');
  const [camReady,   setCamReady]   = useState(false);
  const [camError,   setCamError]   = useState(null);
  const [glbError,   setGlbError]   = useState(null);

  const { isTracking, position, rotationZ, scale, fps, error: trackError, ready, mvReady, mvError, delegate, warning, updateFilterPreset } = useGhostWristAR({
    videoRef,
    enabled:      camReady,
    filterPreset,
    debug,
  });

  // Captura 404/falha de parse do GLB no model-viewer (evento 'error')
  const attachGlbErrorListener = useCallback((el) => {
    if (!el || el.dataset.errBound) return;
    el.dataset.errBound = '1';
    el.addEventListener('error', () => setGlbError(`Erro: GLB não carregou — ${glbUrl}`));
  }, [glbUrl]);

  useEffect(() => {
    if (filterPreset) updateFilterPreset(filterPreset);
  }, [filterPreset, updateFilterPreset]);

  // cameraStarting: evita chamadas concorrentes de start — causa do erro
  // "The play() request was interrupted by a new load request".
  const camStartingRef = useRef(false);

  const startCamera = useCallback(async (mode) => {
    if (camStartingRef.current) return;   // start em andamento — ignora
    camStartingRef.current = true;
    setCamReady(false);
    setCamError(null);
    try {
      // stop() → await → start(): encerra o stream anterior por completo
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: mode }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCamReady(true);
    } catch (e) {
      setCamError(`Camera: ${e.message}`);
    } finally {
      camStartingRef.current = false;
    }
  }, []);

  useEffect(() => {
    startCamera(facingMode);
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, [facingMode, startCamera]);

  const watchW = Math.round(scale * window.innerWidth * scaleMultiplier * arScale);
  const watchH = Math.round(watchW * 0.5);

  // forceCenter ignora o tracking: posição fixa no centro, tamanho fixo
  const centerW = Math.round(window.innerWidth * 0.7);
  const glbBoxStyle = forceCenter
    ? {
        position: 'absolute', left: '50%', top: '50%',
        transform: 'translate(-50%,-50%)',
        width: centerW, height: Math.round(centerW * 0.5),
        pointerEvents: 'none', zIndex: 2,
        outline: '2px dashed #38bdf8',
      }
    : {
        position:  'absolute',
        left:      `${(position.x * 100).toFixed(1)}%`,
        top:       `${(position.y * 100).toFixed(1)}%`,
        transform: `translate(-50%,-50%) rotate(${(rotationZ * 180 / Math.PI).toFixed(1)}deg)`,
        width:  watchW,
        height: watchH,
        pointerEvents: 'none',
        zIndex: 2,
      };

  const anyError = trackError || camError || mvError || glbError;

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', overflow: 'hidden', ...style }}>
      <video
        ref={videoRef}
        playsInline muted
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 }}
      />

      {glbUrl && (forceCenter || (mvReady && isTracking)) && (
        <div style={glbBoxStyle}>
          <model-viewer
            ref={attachGlbErrorListener}
            src={glbUrl}
            disable-tap
            orientation={orientation}
            scale="2 2 2"
            style={{ width: '100%', height: '100%', background: 'transparent' }}
          />
        </div>
      )}

      {/* Erros nunca são silenciosos — banner sempre visível, mesmo sem debug */}
      {anyError && (
        <div style={{
          position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
          zIndex: 10, maxWidth: '92%', background: 'rgba(127,29,29,0.92)', color: '#fecaca',
          padding: '8px 14px', borderRadius: 8, fontFamily: 'monospace', fontSize: 12,
          pointerEvents: 'none', wordBreak: 'break-word',
        }}>
          {[trackError, camError, mvError, glbError].filter(Boolean).join(' · ')}
        </div>
      )}

      {children}

      {debug && (
        <div style={{
          position: 'absolute', top: 10, left: 10, zIndex: 10,
          background: 'rgba(0,0,0,0.75)', color: '#e2e8f0',
          padding: '8px 12px', borderRadius: 8,
          fontFamily: 'monospace', fontSize: 11,
        }}>
          <div>{camReady ? '🟢' : camError ? '🔴' : '🟡'} cameraReady</div>
          <div>{ready ? '🟢' : trackError ? '🔴' : '🟡'} handLandmarkerReady{delegate ? ` (${delegate})` : ''}</div>
          <div>{isTracking ? '🟢' : '🔴'} isTracking</div>
          <div>{mvReady ? '🟢' : mvError ? '🔴' : '🟡'} mvReady</div>
          <div>modelUrl: {glbUrl ?? '—'}</div>
          <div>fps: {fps}</div>
          <div>facing: {facingMode}</div>
          {forceCenter && <div style={{ color: '#38bdf8' }}>forceCenter ATIVO (posição fixa)</div>}
          {warning    && <div style={{ color: '#facc15' }}>{warning}</div>}
          {trackError && <div style={{ color: '#f87171' }}>track: {trackError}</div>}
          {mvError    && <div style={{ color: '#f87171' }}>{mvError}</div>}
          {glbError   && <div style={{ color: '#f87171' }}>{glbError}</div>}
          {camError   && <div style={{ color: '#f87171' }}>{camError}</div>}
          <button
            onClick={() => setFacingMode(m => m === 'environment' ? 'user' : 'environment')}
            style={{ marginTop: 6, padding: '3px 8px', fontSize: 10, cursor: 'pointer', borderRadius: 4, border: 'none', background: '#374151', color: '#fff' }}
          >
            flip camera
          </button>
        </div>
      )}
    </div>
  );
}

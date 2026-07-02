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
  style,
  children,
}) {
  const videoRef   = useRef(null);
  const streamRef  = useRef(null);
  const [facingMode, setFacingMode] = useState('environment');
  const [camReady,   setCamReady]   = useState(false);
  const [camError,   setCamError]   = useState(null);

  const { isTracking, position, rotationZ, scale, fps, error: trackError, ready, mvReady, updateFilterPreset } = useGhostWristAR({
    videoRef,
    enabled:      camReady,
    filterPreset,
    debug,
  });

  useEffect(() => {
    if (filterPreset) updateFilterPreset(filterPreset);
  }, [filterPreset, updateFilterPreset]);

  const startCamera = useCallback(async (mode) => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCamReady(false);
    setCamError(null);
    try {
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
    }
  }, []);

  useEffect(() => {
    startCamera(facingMode);
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, [facingMode, startCamera]);

  const watchW = Math.round(scale * window.innerWidth * scaleMultiplier * arScale);
  const watchH = Math.round(watchW * 0.5);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', overflow: 'hidden', ...style }}>
      <video
        ref={videoRef}
        playsInline muted
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
      />

      {mvReady && isTracking && glbUrl && (
        <div style={{
          position:  'absolute',
          left:      `${(position.x * 100).toFixed(1)}%`,
          top:       `${(position.y * 100).toFixed(1)}%`,
          transform: `translate(-50%,-50%) rotate(${(rotationZ * 180 / Math.PI).toFixed(1)}deg)`,
          width:  watchW,
          height: watchH,
          pointerEvents: 'none',
          zIndex: 5,
        }}>
          <model-viewer
            src={glbUrl}
            auto-rotate={false}
            camera-controls={false}
            disable-tap
            orientation={orientation}
            scale="2 2 2"
            style={{ width: '100%', height: '100%', background: 'transparent' }}
          />
        </div>
      )}

      {children}

      {debug && (
        <div style={{
          position: 'absolute', top: 10, left: 10, zIndex: 20,
          background: 'rgba(0,0,0,0.75)', color: '#e2e8f0',
          padding: '8px 12px', borderRadius: 8,
          fontFamily: 'monospace', fontSize: 11,
        }}>
          <div>engine: {ready ? '✓' : 'loading…'}</div>
          <div>model-viewer: {mvReady ? '✓' : 'loading…'}</div>
          <div>tracking: {isTracking ? '✓' : '○'}</div>
          <div>fps: {fps}</div>
          <div>facing: {facingMode}</div>
          {trackError && <div style={{ color: '#f87171' }}>track: {trackError}</div>}
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

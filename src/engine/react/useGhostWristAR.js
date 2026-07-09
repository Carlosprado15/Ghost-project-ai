import { useState, useEffect, useRef, useCallback } from 'react';
import { GhostEngine } from '../core/GhostEngine.js';
import { ensureModelViewer } from '../render/modelViewerLoader.js';

/**
 * useGhostWristAR — React hook wrapping GhostEngine.
 *
 * Returns the same shape as the former useTasksWristTracking, plus:
 *   mvReady          — boolean: model-viewer custom element registered
 *   updateFilterPreset(preset) — update filter without restarting engine
 */
export function useGhostWristAR({
  videoRef,
  enabled      = true,
  onRawFrame   = null,
  filterPreset = null,
  debug        = false,
} = {}) {
  const engineRef      = useRef(null);
  const onRawFrameRef  = useRef(onRawFrame);

  useEffect(() => { onRawFrameRef.current = onRawFrame; }, [onRawFrame]);

  const [state, setState] = useState({
    isTracking: false,
    position:   { x: 0, y: 0, z: 0 },
    rotationZ:  0,
    scale:      1,
    raw:        null,
    filtered:   null,
    landmarks:  null,   // 21 landmarks crus quando detectado
    fps:        0,
    error:      null,
    ready:      false,
    delegate:   null,   // 'GPU' | 'CPU' após init do HandLandmarker
    warning:    null,   // aviso não-fatal (ex.: fallback GPU→CPU)
    modelSource: null,  // 'local' | 'CDN' — origem do hand_landmarker.task
  });

  const [mvReady, setMvReady] = useState(
    () => !!window.customElements?.get('model-viewer')
  );
  const [mvError, setMvError] = useState(null);

  useEffect(() => {
    ensureModelViewer({ timeoutMs: 15000 })
      .then(() => setMvReady(true))
      .catch((e) => setMvError(e.message));
  }, []);

  const updateFilterPreset = useCallback((preset) => {
    engineRef.current?.updateFilterPreset(preset);
  }, []);

  // "Máquina ligada" (2026-07-05): o engine NÃO espera mais a câmera para
  // inicializar — detector (WASM + HandLandmarker) e câmera carregam em
  // PARALELO, cortando ~1-1.5s de toda abertura. O loop de tracking já
  // aguarda sozinho o vídeo ficar pronto (readyState). Trocar de câmera
  // também não recria mais o engine (menos instabilidade em mobile).
  useEffect(() => {
    let cancelled = false;

    const engine = new GhostEngine({
      onPose: (frame) => {
        if (cancelled) return;
        // merge funcional: preserva delegate/warning definidos no init
        setState(s => ({
          ...s,
          isTracking: frame.isTracking,
          position:   frame.position,
          rotationZ:  frame.rotationZ,
          scale:      frame.scale,
          raw:        frame.raw,
          filtered:   frame.filtered,
          landmarks:  frame.landmarks ?? null,
          fps:        frame.fps,
          error:      null,
          ready:      true,
        }));
      },
      onRawFrame: (raw) => { onRawFrameRef.current?.(raw); },
      filterPreset,
      debug,
    });

    engineRef.current = engine;

    engine.init()
      .then(() => {
        if (cancelled) { engine.stop(); return; }
        setState(s => ({ ...s, ready: true, delegate: engine.delegate, warning: engine.warning, modelSource: engine.modelSource }));
        engine.startLoop(() => videoRef.current);
      })
      .catch((e) => {
        if (!cancelled) setState(s => ({ ...s, error: e.message }));
      });

    return () => {
      cancelled = true;
      engine.stop();
      engineRef.current = null;
      setState(s => ({ ...s, ready: false, isTracking: false }));
    };
  // filterPreset intentionally excluded: use updateFilterPreset() for live updates
  // enabled intencionalmente fora: o engine vive independente da câmera
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoRef, debug]);

  return { ...state, mvReady, mvError, updateFilterPreset };
}

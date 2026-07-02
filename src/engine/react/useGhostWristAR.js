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
    fps:        0,
    error:      null,
    ready:      false,
  });

  const [mvReady, setMvReady] = useState(
    () => !!window.customElements?.get('model-viewer')
  );

  useEffect(() => {
    ensureModelViewer().then(() => setMvReady(true));
  }, []);

  const updateFilterPreset = useCallback((preset) => {
    engineRef.current?.updateFilterPreset(preset);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const engine = new GhostEngine({
      onPose: (frame) => {
        if (cancelled) return;
        setState({
          isTracking: frame.isTracking,
          position:   frame.position,
          rotationZ:  frame.rotationZ,
          scale:      frame.scale,
          raw:        frame.raw,
          filtered:   frame.filtered,
          fps:        frame.fps,
          error:      null,
          ready:      true,
        });
      },
      onRawFrame: (raw) => { onRawFrameRef.current?.(raw); },
      filterPreset,
      debug,
    });

    engineRef.current = engine;

    engine.init()
      .then(() => {
        if (cancelled) { engine.stop(); return; }
        setState(s => ({ ...s, ready: true }));
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, videoRef, debug]);

  return { ...state, mvReady, updateFilterPreset };
}

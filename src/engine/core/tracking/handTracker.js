import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

const WASM_CDN  = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

export class HandTracker {
  constructor({ onFrame, debug = false }) {
    this._onFrame    = onFrame;
    this._debug      = debug;
    this._landmarker = null;
    this._rafId      = null;
    this._cancelled  = false;
  }

  _log(...args) {
    if (this._debug) console.log('[HandTracker]', ...args);
  }

  async init() {
    this._cancelled = false;
    let vision;
    try {
      vision = await FilesetResolver.forVisionTasks(WASM_CDN);
    } catch (e) {
      throw new Error(`WASM load failed: ${e.message}`);
    }

    const opts = (delegate) => ({
      baseOptions: { modelAssetPath: MODEL_URL, delegate },
      runningMode: 'VIDEO',
      numHands: 1,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    let landmarker;
    try {
      landmarker = await HandLandmarker.createFromOptions(vision, opts('GPU'));
      this._log('HandLandmarker ready (GPU)');
    } catch {
      this._log('GPU delegate failed, retrying CPU');
      landmarker = await HandLandmarker.createFromOptions(vision, opts('CPU'));
      this._log('HandLandmarker ready (CPU)');
    }

    if (this._cancelled) { landmarker.close(); return; }
    this._landmarker = landmarker;
  }

  startLoop(getVideoEl) {
    const loop = () => {
      if (this._cancelled) return;
      const video = getVideoEl();
      const lm    = this._landmarker;

      if (!video || video.readyState < 2 || !lm) {
        this._rafId = requestAnimationFrame(loop);
        return;
      }

      const ts     = performance.now();
      const result = lm.detectForVideo(video, ts);
      const hands  = result?.landmarks;
      this._onFrame(hands?.length > 0 ? hands[0] : null, ts);
      this._rafId = requestAnimationFrame(loop);
    };
    this._rafId = requestAnimationFrame(loop);
  }

  stop() {
    this._cancelled = true;
    if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
    if (this._landmarker) {
      try { this._landmarker.close(); } catch (_) {}
      this._landmarker = null;
    }
  }
}

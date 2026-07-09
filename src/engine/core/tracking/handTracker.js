import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

const WASM_CDN  = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
// M069G: modelo servido localmente (public/models/) — CDN só como fallback.
// Elimina a dependência de storage.googleapis.com em redes lentas/bloqueadas.
const MODEL_LOCAL = '/models/hand_landmarker.task';
const MODEL_CDN   = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

// createFromOptions com delegate GPU pode TRAVAR (nunca resolver) em alguns
// navegadores Android — timeout transforma o travamento em erro recuperável.
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} excedeu ${ms / 1000}s`)), ms)),
  ]);
}

export class HandTracker {
  constructor({ onFrame, debug = false }) {
    this._onFrame    = onFrame;
    this._debug      = debug;
    this._landmarker = null;
    this._rafId      = null;
    this._cancelled  = false;
    this.delegate    = null;  // 'GPU' | 'CPU' após init()
    this.warning     = null;  // aviso não-fatal (ex.: fallback para CPU)
    this.modelSource = null;  // 'local' | 'CDN' após init()
  }

  _log(...args) {
    if (this._debug) console.log('[HandTracker]', ...args);
  }

  async init() {
    this._cancelled  = false;
    this.delegate    = null;
    this.warning     = null;
    this.modelSource = null;

    let vision;
    try {
      vision = await withTimeout(FilesetResolver.forVisionTasks(WASM_CDN), 30000, 'WASM MediaPipe');
    } catch (e) {
      throw new Error(`Erro: WASM MediaPipe não carregou (CDN): ${e.message}`);
    }

    // Modelo local primeiro; CDN só se o arquivo local não existir/falhar
    let modelPath = MODEL_CDN;
    try {
      const head = await fetch(MODEL_LOCAL, { method: 'HEAD' });
      if (head.ok) modelPath = MODEL_LOCAL;
    } catch (_) { /* sem servidor para o arquivo local — usa CDN */ }
    this.modelSource = modelPath === MODEL_LOCAL ? 'local' : 'CDN';
    this._log('model source:', this.modelSource);

    let landmarker;
    try {
      landmarker = await this._createLandmarker(vision, modelPath);
    } catch (e) {
      if (modelPath === MODEL_LOCAL) {
        // arquivo local corrompido/incompleto — última tentativa via CDN
        this._log('local model failed, retrying CDN:', e.message);
        this.warning     = this.warning ?? 'Aviso: modelo local falhou, usando CDN';
        this.modelSource = 'CDN';
        this.delegate    = null;
        landmarker = await this._createLandmarker(vision, MODEL_CDN);
      } else {
        throw e;
      }
    }

    if (this._cancelled) { landmarker.close(); return; }
    this._landmarker = landmarker;
  }

  async _createLandmarker(vision, modelAssetPath) {
    const opts = (delegate) => ({
      baseOptions: { modelAssetPath, delegate },
      runningMode: 'VIDEO',
      numHands: 1,
      // M069H: 0.3 (padrão 0.5) — detecta a mão mesmo com punho fechado,
      // postura natural de quem olha o relógio no pulso
      minHandDetectionConfidence: 0.3,
      minHandPresenceConfidence: 0.3,
      minTrackingConfidence: 0.5,
    });

    try {
      const lm = await withTimeout(HandLandmarker.createFromOptions(vision, opts('GPU')), 20000, 'HandLandmarker (GPU)');
      this.delegate = 'GPU';
      this._log('HandLandmarker ready (GPU)');
      return lm;
    } catch (e) {
      this._log('GPU delegate failed, retrying CPU:', e.message);
      this.warning = this.warning ?? 'Aviso: GPU delegate falhou, usando CPU';
      try {
        const lm = await withTimeout(HandLandmarker.createFromOptions(vision, opts('CPU')), 30000, 'HandLandmarker (CPU)');
        this.delegate = 'CPU';
        this._log('HandLandmarker ready (CPU)');
        return lm;
      } catch (e2) {
        throw new Error(`Erro: HandLandmarker falhou em GPU e CPU: ${e2.message}`);
      }
    }
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

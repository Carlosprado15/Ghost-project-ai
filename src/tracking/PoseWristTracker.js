/**
 * PoseWristTracker — reforço de rastreamento para quando o WristTracker
 * (baseado em MediaPipe Hands) perde a mão.
 *
 * Por quê: o MediaPipe Hands só reconhece "isso é uma mão" quando vê a
 * estrutura de dedos/nós — se a câmera mostrar só o pulso/antebraço (sem
 * dedos), ele não detecta nada, e o relógio some da tela até a mão inteira
 * aparecer de novo (2026-07-26, ~29s de espera medidos num teste real).
 *
 * Testado em 2026-07-26 com quadros reais do próprio teste: o MediaPipe Pose
 * (BlazePose, via @mediapipe/tasks-vision) detecta o pulso a partir do braço
 * (ombro→cotovelo→pulso) mesmo sem nenhum dedo visível — MAS só quando o
 * enquadramento mostra um pedaço do tronco/ombro junto; falha se a câmera
 * estiver muito próxima, só do pulso (aí quem funciona é o Hands). Os dois
 * motores são complementares, nenhum cobre tudo sozinho — por isso este
 * tracker roda só como REFORÇO, nunca no lugar do WristTracker.
 *
 * Limite honesto: sem a largura da palma (que só o Hands dá), o tamanho do
 * relógio aqui é estimado a partir do comprimento do antebraço (cotovelo→
 * pulso) — é uma aproximação, não uma medida tão precisa quanto a do Hands.
 */

import { VectorFilter, OneEuroFilter } from './OneEuroFilter.js';

const WASM_CDN     = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
const MODEL_LOCAL  = '/models/pose_landmarker.task';
const MODEL_CDN    = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

// Índices do modelo BlazePose (33 pontos)
const L_SHOULDER = 11, R_SHOULDER = 12;
const L_ELBOW    = 13, R_ELBOW    = 14;
const L_WRIST    = 15, R_WRIST    = 16;

const MIN_VISIBILITY = 0.4;

export class PoseWristTracker {
  constructor(config = {}) {
    this.config = {
      forearmSizeMultiplier: config.forearmSizeMultiplier ?? 0.55,
      minWatchSize: config.minWatchSize ?? 80,
      maxWatchSize: config.maxWatchSize ?? 220,
      watchRotationOffset: config.watchRotationOffset ?? 0,
      positionMinCutoff: config.positionMinCutoff ?? 1.2,
      positionBeta: config.positionBeta ?? 0.3,
      rotationMinCutoff: config.rotationMinCutoff ?? 0.8,
      rotationBeta: config.rotationBeta ?? 0.6,
    };

    this._landmarker = null;
    this._ready = false;
    this._loading = null;

    this.positionFilter = new VectorFilter(this.config.positionMinCutoff, this.config.positionBeta, 1.0);
    this.rotationFilter = new OneEuroFilter(this.config.rotationMinCutoff, this.config.rotationBeta, 1.0);
    this.scaleFilter    = new OneEuroFilter(this.config.rotationMinCutoff, this.config.rotationBeta, 1.0);
  }

  get ready() {
    return this._ready;
  }

  /** Carrega o modelo (assíncrono) — chamar uma vez ao abrir a câmera. */
  async init() {
    if (this._loading) return this._loading;
    this._loading = this._doInit();
    return this._loading;
  }

  async _doInit() {
    try {
      const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision');
      const vision = await FilesetResolver.forVisionTasks(WASM_CDN);

      let modelPath = MODEL_CDN;
      try {
        const head = await fetch(MODEL_LOCAL, { method: 'HEAD' });
        if (head.ok) modelPath = MODEL_LOCAL;
      } catch (_) { /* usa CDN */ }

      const opts = (delegate) => ({
        baseOptions: { modelAssetPath: modelPath, delegate },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.3,
        minPosePresenceConfidence: 0.3,
        minTrackingConfidence: 0.3,
      });

      try {
        this._landmarker = await PoseLandmarker.createFromOptions(vision, opts('GPU'));
      } catch (_) {
        this._landmarker = await PoseLandmarker.createFromOptions(vision, opts('CPU'));
      }
      this._ready = true;
    } catch (err) {
      console.warn('[PoseWristTracker] falha ao carregar — reforço de pulso indisponível:', err.message);
      this._ready = false;
    }
  }

  /**
   * Roda a detecção no frame atual e devolve a pose do relógio (mesmo
   * formato do WristTracker: {x, y, size, rotation}), ou null se não achou
   * nem o braço.
   */
  detect(videoEl, videoRect, mirrorX = false, timestamp = performance.now()) {
    if (!this._ready || !this._landmarker) return null;

    let result;
    try {
      result = this._landmarker.detectForVideo(videoEl, timestamp);
    } catch (_) {
      return null;
    }

    const pose = result?.landmarks?.[0];
    if (!pose) return null;

    // Escolhe o lado (esquerdo/direito) com maior confiança combinada
    const scoreR = (pose[R_SHOULDER]?.visibility ?? 0) + (pose[R_ELBOW]?.visibility ?? 0) + (pose[R_WRIST]?.visibility ?? 0);
    const scoreL = (pose[L_SHOULDER]?.visibility ?? 0) + (pose[L_ELBOW]?.visibility ?? 0) + (pose[L_WRIST]?.visibility ?? 0);
    const useRight = scoreR >= scoreL;

    const wrist = pose[useRight ? R_WRIST : L_WRIST];
    const elbow = pose[useRight ? R_ELBOW : L_ELBOW];
    if (!wrist || !elbow) return null;
    if ((wrist.visibility ?? 0) < MIN_VISIBILITY || (elbow.visibility ?? 0) < MIN_VISIBILITY) return null;

    const videoW = videoEl.videoWidth || videoRect.width;
    const videoH = videoEl.videoHeight || videoRect.height;
    const wristPx = this._toScreen(wrist, videoRect, mirrorX, videoW, videoH);
    const elbowPx = this._toScreen(elbow, videoRect, mirrorX, videoW, videoH);

    const forearmVecX = wristPx.x - elbowPx.x;
    const forearmVecY = wristPx.y - elbowPx.y;
    const forearmLength = Math.hypot(forearmVecX, forearmVecY) || 1;

    const rawRotation = Math.atan2(forearmVecY, forearmVecX) * (180 / Math.PI) + this.config.watchRotationOffset;
    const rawSize = Math.max(
      this.config.minWatchSize,
      Math.min(this.config.maxWatchSize, forearmLength * this.config.forearmSizeMultiplier)
    );

    const smoothedPos = this.positionFilter.filter({ x: wristPx.x, y: wristPx.y }, timestamp);
    const smoothedRotation = this._filterRotation(rawRotation, timestamp);
    const smoothedSize = this.scaleFilter.filter(rawSize, timestamp);

    return {
      x: smoothedPos.x,
      y: smoothedPos.y,
      size: smoothedSize,
      rotation: smoothedRotation,
      source: 'pose-fallback',
    };
  }

  /**
   * Filtra rotação com tratamento de wrap-around (-180/+180) — mesma técnica
   * de WristTracker._filterRotation(), que faltava aqui. Sem isso, o ângulo
   * do antebraço pode "girar" bruscamente ao cruzar a fronteira de 180°
   * (mesma classe de bug documentada em AR-KB-002/004 pro motor novo).
   */
  _filterRotation(newRotation, timestamp) {
    if (this.rotationFilter.x.lastValue === null) {
      return this.rotationFilter.filter(newRotation, timestamp);
    }

    const lastRot = this.rotationFilter.x.lastValue;
    let delta = newRotation - lastRot;

    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;

    const correctedRotation = lastRot + delta;
    return this.rotationFilter.filter(correctedRotation, timestamp);
  }

  // Mesmo cálculo de "object-fit: cover" do WristTracker._toLandmark, mas
  // usando as dimensões reais do vídeo em vez do buffer fixo do MediaPipe Hands.
  _toScreen(landmark, rect, mirrorX, videoW, videoH) {
    const scale = Math.max(rect.width / videoW, rect.height / videoH);
    const dW = videoW * scale;
    const dH = videoH * scale;
    const ox = (rect.width - dW) / 2;
    const oy = (rect.height - dH) / 2;

    let x = landmark.x * dW + ox + rect.left;
    const y = landmark.y * dH + oy + rect.top;
    if (mirrorX) x = rect.right - (landmark.x * dW + ox);
    return { x, y };
  }

  reset() {
    this.positionFilter.reset();
    this.rotationFilter.reset();
    this.scaleFilter.reset();
  }

  destroy() {
    try { this._landmarker?.close(); } catch (_) {}
    this._landmarker = null;
    this._ready = false;
    this._loading = null;
  }
}

import { HandTracker } from './tracking/handTracker.js';
import { OneEuroFilterScalar, OneEuroFilterVector3 } from './filters/OneEuroFilter.js';
import { computeWristAnchor } from './anchor/wristAnchor.js';
import { HoldLastPose } from './pose/holdLastPose.js';
import defaultPreset from '../config/defaultPreset.json';

// M069I: 1500ms (antes 1200) — com punho fechado a detecção falha por alguns
// frames; o hold estendido mantém o relógio visível nas perdas transitórias
const HOLD_POSE_MS = 1500;

// M069I: estabilização de escala — com punho fechado lm5–lm17 se aproximam e
// o relógio encolheria. Média móvel + clamp + piso mantêm o tamanho estável.
const SCALE_AVG_WINDOW = 5;     // média móvel usada como valor de escala
const SCALE_REF_WINDOW = 10;    // janela de referência para o clamp
const SCALE_DROP_LIMIT = 0.8;   // nunca cair >20% abaixo da média de referência
const SCALE_MIN        = 0.08;  // escala mínima garantida (nunca desaparece)

/**
 * GhostEngine — core AR tracking engine (no React dependency).
 *
 * Usage:
 *   const engine = new GhostEngine({ onPose, onRawFrame?, filterPreset?, debug? });
 *   await engine.init();
 *   engine.startLoop(() => videoEl);
 *   // later:
 *   engine.stop();
 *   engine.updateFilterPreset(newPreset);
 */
export class GhostEngine {
  constructor({ onPose, onRawFrame = null, filterPreset = null, debug = false } = {}) {
    this._onPose        = onPose;
    this._onRawFrame    = onRawFrame;
    this._filterPreset  = filterPreset ?? defaultPreset;
    this._debug         = debug;

    this._tracker   = null;
    this._filters   = null;
    this._hold      = new HoldLastPose(HOLD_POSE_MS);
    this._scaleHist = [];   // últimos SCALE_REF_WINDOW valores de escala

    this._frameCount = 0;
    this._lastFpsTs  = 0;
    this._fps        = 0;

    this.isReady = false;
  }

  // 'GPU' | 'CPU' | null — qual delegate do MediaPipe está ativo
  get delegate() { return this._tracker?.delegate ?? null; }

  // Aviso não-fatal do tracker (ex.: fallback GPU→CPU)
  get warning() { return this._tracker?.warning ?? null; }

  // 'local' | 'CDN' — de onde o hand_landmarker.task foi carregado
  get modelSource() { return this._tracker?.modelSource ?? null; }

  _log(...args) {
    if (this._debug) console.log('[GhostEngine]', ...args);
  }

  // M069I: escala estável com mão fechada.
  // 4) piso 0.08 → 2a) média móvel de 5 frames → 2b) clamp: se a média-5 cair
  // mais de 20% abaixo da média dos últimos 10 frames, usa a média-10.
  _stabilizeScale(rawScale) {
    const s = Math.max(rawScale, SCALE_MIN);
    this._scaleHist.push(s);
    if (this._scaleHist.length > SCALE_REF_WINDOW) this._scaleHist.shift();

    const last5 = this._scaleHist.slice(-SCALE_AVG_WINDOW);
    const avg5  = last5.reduce((a, b) => a + b, 0) / last5.length;
    const avg10 = this._scaleHist.reduce((a, b) => a + b, 0) / this._scaleHist.length;

    return avg5 < avg10 * SCALE_DROP_LIMIT ? avg10 : avg5;
  }

  _initFilters(preset) {
    const p = { ...defaultPreset, ...preset };
    this._filters = {
      pos:  new OneEuroFilterVector3(p),
      rotZ: new OneEuroFilterScalar(p),
      scl:  new OneEuroFilterScalar({ ...p, minCutoff: p.minCutoff * 0.5 }),
    };
    this._log('filters:', p);
  }

  updateFilterPreset(preset) {
    this._filterPreset = preset;
    if (this._filters) this._initFilters(preset);
  }

  async init() {
    this._initFilters(this._filterPreset);
    this._hold.reset();

    this._tracker = new HandTracker({
      onFrame: (lms, ts) => this._onFrame(lms, ts),
      debug: this._debug,
    });

    await this._tracker.init();
    this.isReady = true;
    this._log('engine ready');
  }

  startLoop(getVideoEl) {
    if (!this._tracker) throw new Error('Call init() before startLoop()');
    this._lastFpsTs = performance.now();
    this._tracker.startLoop(getVideoEl);
  }

  _onFrame(landmarks, ts) {
    this._frameCount++;
    if (ts - this._lastFpsTs >= 1000) {
      this._fps        = Math.round((this._frameCount * 1000) / (ts - this._lastFpsTs));
      this._frameCount = 0;
      this._lastFpsTs  = ts;
    }

    if (!landmarks) {
      if (this._onRawFrame) this._onRawFrame({ ts, detected: false });
      const held = this._hold.onLost(ts);
      if (held === null) this._scaleHist = [];  // perda real: recomeça histórico de escala
      this._onPose({
        ts,
        fps:       this._fps,
        detected:  false,
        isTracking: held !== null,
        position:  held?.position  ?? { x: 0, y: 0, z: 0 },
        rotationZ: held?.rotationZ ?? 0,
        scale:     held?.scale     ?? 0,
        raw:       null,
        filtered:  held ? { pos: held.position, rotZ: held.rotationZ, scale: held.scale } : null,
        landmarks: null,
      });
      return;
    }

    const anchor = computeWristAnchor(landmarks);

    if (this._onRawFrame) {
      this._onRawFrame({
        ts,
        detected: true,
        pos:   { x: anchor.x, y: anchor.y, z: anchor.z },
        rotZ:  anchor.rotZ,
        scale: anchor.scale,
      });
    }

    const stableScale = this._stabilizeScale(anchor.scale);

    const f        = this._filters;
    const filtPos  = f.pos.filter({ x: anchor.x, y: anchor.y, z: anchor.z }, ts);
    const filtRotZ = f.rotZ.filter(anchor.rotZ, ts);
    const filtScl  = f.scl.filter(stableScale, ts);

    this._hold.onDetected({ position: filtPos, rotationZ: filtRotZ, scale: filtScl }, ts);

    this._onPose({
      ts,
      fps:       this._fps,
      detected:  true,
      isTracking: true,
      position:  filtPos,
      rotationZ: filtRotZ,
      scale:     filtScl,
      raw:      { pos: { x: anchor.x, y: anchor.y, z: anchor.z }, rotZ: anchor.rotZ, scale: anchor.scale },
      filtered: { pos: filtPos, rotZ: filtRotZ, scale: filtScl },
      landmarks,   // 21 landmarks crus (normalizados 0-1) — overlay de tracking
    });
  }

  stop() {
    this.isReady = false;
    this._tracker?.stop();
    this._tracker = null;
    this._log('engine stopped');
  }
}

import { HandTracker } from './tracking/handTracker.js';
import { OneEuroFilterScalar, OneEuroFilterVector3 } from './filters/OneEuroFilter.js';
import { computeWristAnchor } from './anchor/wristAnchor.js';
import { HoldLastPose } from './pose/holdLastPose.js';
import defaultPreset from '../config/defaultPreset.json';

const HOLD_POSE_MS = 500;

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

    this._tracker = null;
    this._filters = null;
    this._hold    = new HoldLastPose(HOLD_POSE_MS);

    this._frameCount = 0;
    this._lastFpsTs  = 0;
    this._fps        = 0;

    this.isReady = false;
  }

  _log(...args) {
    if (this._debug) console.log('[GhostEngine]', ...args);
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

    const f        = this._filters;
    const filtPos  = f.pos.filter({ x: anchor.x, y: anchor.y, z: anchor.z }, ts);
    const filtRotZ = f.rotZ.filter(anchor.rotZ, ts);
    const filtScl  = f.scl.filter(anchor.scale, ts);

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
    });
  }

  stop() {
    this.isReady = false;
    this._tracker?.stop();
    this._tracker = null;
    this._log('engine stopped');
  }
}

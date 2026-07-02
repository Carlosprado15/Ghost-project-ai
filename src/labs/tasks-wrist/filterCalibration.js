// Standalone One Euro Filter for offline batch processing.
// Intentionally separate from oneEuroFilter.js (which is used in real-time).
// Works over arrays of recorded frames — does NOT read from camera.

const TWO_PI = 2 * Math.PI;

function alpha(cutoff, dt) {
  const tau = 1.0 / (TWO_PI * cutoff);
  return 1.0 / (1.0 + tau / dt);
}

class _Scalar1EF {
  constructor(minCutoff, beta, dCutoff) {
    this.minCutoff = minCutoff;
    this.beta      = beta;
    this.dCutoff   = dCutoff;
    this._x = null; this._dx = 0; this._ts = null;
  }
  step(v, ts) {
    if (this._x === null) { this._x = v; this._ts = ts; return v; }
    const dt  = Math.max((ts - this._ts) / 1000, 1e-6);
    this._ts  = ts;
    const aD  = alpha(this.dCutoff, dt);
    const dx  = (v - this._x) / dt;
    this._dx  = aD * dx + (1 - aD) * this._dx;
    const cut = this.minCutoff + this.beta * Math.abs(this._dx);
    const a   = alpha(cut, dt);
    this._x   = a * v + (1 - a) * this._x;
    return this._x;
  }
}

/**
 * Run One Euro Filter offline over an array of recorded frames.
 *
 * @param {Array} frames - Each frame: { ts, detected, pos:{x,y,z}, rotZ, scale }
 * @param {{ minCutoff, beta, dCutoff }} opts
 * @returns {Array} - Same length as frames; detected frames have filtPos/filtRotZ/filtScale.
 *   Undetected frames: { ts, detected: false, filtPos: null, filtRotZ: null, filtScale: null }
 */
export function runFilterOffline(frames, { minCutoff = 1.0, beta = 0.007, dCutoff = 1.0 } = {}) {
  const fX   = new _Scalar1EF(minCutoff, beta, dCutoff);
  const fY   = new _Scalar1EF(minCutoff, beta, dCutoff);
  const fZ   = new _Scalar1EF(minCutoff, beta, dCutoff);
  const fRot = new _Scalar1EF(minCutoff, beta, dCutoff);
  const fScl = new _Scalar1EF(minCutoff * 0.5, beta, dCutoff);

  return frames.map(fr => {
    if (!fr.detected) {
      return { ts: fr.ts, detected: false, filtPos: null, filtRotZ: null, filtScale: null };
    }
    return {
      ts:        fr.ts,
      detected:  true,
      filtPos:   { x: fX.step(fr.pos.x, fr.ts), y: fY.step(fr.pos.y, fr.ts), z: fZ.step(fr.pos.z, fr.ts) },
      filtRotZ:  fRot.step(fr.rotZ, fr.ts),
      filtScale: fScl.step(fr.scale, fr.ts),
    };
  });
}

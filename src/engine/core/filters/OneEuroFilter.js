const TWO_PI = 2 * Math.PI;

function computeAlpha(cutoff, dt) {
  const tau = 1.0 / (TWO_PI * cutoff);
  return 1.0 / (1.0 + tau / dt);
}

export class OneEuroFilterScalar {
  constructor({ minCutoff = 1.0, beta = 0.007, dCutoff = 1.0 } = {}) {
    this.minCutoff = minCutoff;
    this.beta      = beta;
    this.dCutoff   = dCutoff;
    this._x        = null;
    this._dx       = 0;
    this._lastTs   = null;
  }

  filter(value, timestampMs) {
    if (this._x === null) {
      this._x      = value;
      this._lastTs = timestampMs;
      return value;
    }
    const dt      = Math.max((timestampMs - this._lastTs) / 1000, 1e-6);
    this._lastTs  = timestampMs;
    const alphaD  = computeAlpha(this.dCutoff, dt);
    const dx      = (value - this._x) / dt;
    this._dx      = alphaD * dx + (1 - alphaD) * this._dx;
    const cutoff  = this.minCutoff + this.beta * Math.abs(this._dx);
    const alpha   = computeAlpha(cutoff, dt);
    this._x       = alpha * value + (1 - alpha) * this._x;
    return this._x;
  }

  reset() {
    this._x      = null;
    this._dx     = 0;
    this._lastTs = null;
  }
}

export class OneEuroFilterVector3 {
  constructor(opts = {}) {
    this.x = new OneEuroFilterScalar(opts);
    this.y = new OneEuroFilterScalar(opts);
    this.z = new OneEuroFilterScalar(opts);
  }

  filter({ x, y, z }, timestampMs) {
    return {
      x: this.x.filter(x, timestampMs),
      y: this.y.filter(y, timestampMs),
      z: this.z.filter(z, timestampMs),
    };
  }

  reset() {
    this.x.reset();
    this.y.reset();
    this.z.reset();
  }
}

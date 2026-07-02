export class HoldLastPose {
  constructor(holdMs = 500) {
    this.holdMs = holdMs;
    this._last  = null;
    this._ts    = 0;
  }

  onDetected(pose, ts) {
    this._last = pose;
    this._ts   = ts;
    return pose;
  }

  onLost(ts) {
    if (this._last && (ts - this._ts) < this.holdMs) return this._last;
    return null;
  }

  reset() {
    this._last = null;
    this._ts   = 0;
  }
}

// All inputs are arrays produced by runFilterOffline() or the raw recording buffer.

function stdDev(values) {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * Std-dev magnitude of wrist position (lm0 x/y/z) from STATIC test.
 * Only considers detected frames with valid filtPos.
 * @param {Array} filteredFrames - output of runFilterOffline on static log
 * @returns {number} - magnitude of [sdX, sdY, sdZ] vector
 */
export function computePositionJitter(filteredFrames) {
  const xs = [], ys = [], zs = [];
  for (const f of filteredFrames) {
    if (f.detected && f.filtPos) {
      xs.push(f.filtPos.x);
      ys.push(f.filtPos.y);
      zs.push(f.filtPos.z);
    }
  }
  if (xs.length < 2) return 0;
  const sdX = stdDev(xs), sdY = stdDev(ys), sdZ = stdDev(zs);
  return Math.sqrt(sdX ** 2 + sdY ** 2 + sdZ ** 2);
}

/**
 * Std-dev of wrist rotation angle from STATIC test.
 * @param {Array} filteredFrames - output of runFilterOffline on static log
 * @returns {number} - std dev in radians
 */
export function computeRotationJitter(filteredFrames) {
  const angles = filteredFrames
    .filter(f => f.detected && f.filtRotZ != null)
    .map(f => f.filtRotZ);
  return stdDev(angles);
}

/**
 * Std-dev of knuckle-span scale (dist lm5–lm17) from STATIC test.
 * @param {Array} filteredFrames - output of runFilterOffline on static log
 * @returns {number} - std dev in normalized units
 */
export function computeScaleJitter(filteredFrames) {
  const scales = filteredFrames
    .filter(f => f.detected && f.filtScale != null)
    .map(f => f.filtScale);
  return stdDev(scales);
}

/**
 * Estimated filter lag via normalized cross-correlation between raw and filtered x-positions.
 * Uses SLOW MOTION test data.
 *
 * @param {Array} rawFrames      - original recorded frames from slow-motion test
 * @param {Array} filteredFrames - output of runFilterOffline on slow-motion log
 * @param {number} frameIntervalMs - average ms between frames (derived from log timestamps)
 * @returns {{ lagFrames: number, lagMs: number, method: string }}
 */
export function computeEstimatedLag(rawFrames, filteredFrames, frameIntervalMs) {
  const rawX  = [];
  const filtX = [];

  for (let i = 0; i < Math.min(rawFrames.length, filteredFrames.length); i++) {
    const r = rawFrames[i];
    const f = filteredFrames[i];
    if (r.detected && r.pos && f.detected && f.filtPos) {
      rawX.push(r.pos.x);
      filtX.push(f.filtPos.x);
    }
  }

  if (rawX.length < 10) {
    return { lagFrames: 0, lagMs: 0, method: 'insufficient-data' };
  }

  // Zero-mean
  const meanR = rawX.reduce((s, v) => s + v, 0) / rawX.length;
  const meanF = filtX.reduce((s, v) => s + v, 0) / filtX.length;
  const rZm   = rawX.map(v => v - meanR);
  const fZm   = filtX.map(v => v - meanF);

  // Normalized cross-correlation: find lag τ >= 0 where raw leads filtered
  // R(τ) = Σ rawZm[t] * filtZm[t - τ]  (filter output is delayed relative to raw)
  const n = rZm.length;
  const maxLag = Math.min(15, Math.floor(n / 3));

  let bestLag = 0, bestCorr = -Infinity;
  for (let lag = 0; lag <= maxLag; lag++) {
    let sum = 0, cnt = 0;
    for (let i = lag; i < n; i++) {
      sum += rZm[i] * fZm[i - lag];
      cnt++;
    }
    const corr = cnt > 0 ? sum / cnt : 0;
    if (corr > bestCorr) { bestCorr = corr; bestLag = lag; }
  }

  return {
    lagFrames: bestLag,
    lagMs:     bestLag * frameIntervalMs,
    method:    'cross-correlation',
  };
}

/**
 * Fraction of frames where hand was detected.
 * @param {Array} frames - raw recorded frames (both static and slow-motion combined, or either)
 * @returns {number} - 0.0 to 1.0
 */
export function computeTrackingContinuity(frames) {
  if (!frames || frames.length === 0) return 0;
  const detected = frames.filter(f => f.detected).length;
  return detected / frames.length;
}

/**
 * Final composite score. Inputs are already normalized to [0,1] by the runner.
 * @param {{ normJitter, normLag, normContinuity }} normalized
 * @param {{ jitter, lag, continuity }} weights
 * @returns {number} - 0.0 to 1.0
 */
export function computeScoreFinal({ normJitter, normLag, normContinuity }, weights) {
  return (
    weights.jitter     * (1 - normJitter) +
    weights.lag        * (1 - normLag) +
    weights.continuity * normContinuity
  );
}

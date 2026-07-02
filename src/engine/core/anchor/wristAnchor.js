/**
 * computeWristAnchor
 *
 * Takes the 21 MediaPipe hand landmarks (normalized 0-1 coords) and returns
 * the anchor point for an AR wrist accessory.
 *
 * Landmarks used:
 *   lm0  = wrist
 *   lm5  = index MCP
 *   lm17 = pinky MCP
 *
 * The anchor is offset from the wrist toward the forearm (away from the palm)
 * by offsetRatio × forearm-vector-length, matching the production WristTracker
 * behaviour (watchOffsetRatio = 0.18).
 */
export function computeWristAnchor(landmarks, { offsetRatio = 0.18 } = {}) {
  const lm0  = landmarks[0];   // wrist
  const lm5  = landmarks[5];   // index MCP
  const lm17 = landmarks[17];  // pinky MCP

  // lm5→lm17 span — proxy for wrist width; used for scale and rotation
  const scale = Math.hypot(lm5.x - lm17.x, lm5.y - lm17.y);

  // Rotation: angle of the lm5–lm17 axis
  const rotZ = Math.atan2(lm17.y - lm5.y, lm17.x - lm5.x);

  // Palm center
  const pcx = (lm5.x + lm17.x) / 2;
  const pcy = (lm5.y + lm17.y) / 2;

  // Forearm vector: wrist → palm center (normalized)
  const fvx    = pcx - lm0.x;
  const fvy    = pcy - lm0.y;
  const fvLen  = Math.hypot(fvx, fvy) || 0.001;
  const fdx    = fvx / fvLen;
  const fdy    = fvy / fvLen;

  // Offset toward forearm (opposite direction)
  const offset = fvLen * offsetRatio;
  const x      = lm0.x - fdx * offset;
  const y      = lm0.y - fdy * offset;

  return { x, y, z: lm0.z ?? 0, rotZ, scale };
}

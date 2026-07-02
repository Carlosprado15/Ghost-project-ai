// Parameter grid for One Euro Filter calibration.
// dCutoff is fixed at 1.0 for this round.

export const GRID = {
  minCutoff: [0.3, 0.5, 0.7, 1.0, 1.3, 1.7, 2.0],
  beta:      [0.001, 0.003, 0.007, 0.01, 0.02, 0.04, 0.08],
  dCutoff:   [1.0],
};

export const DEFAULT_WEIGHTS = {
  jitter:     0.4,
  lag:        0.4,
  continuity: 0.2,
};

// Convenience: expand GRID into all combinations
export function buildCombinations() {
  const combos = [];
  for (const mc of GRID.minCutoff) {
    for (const b of GRID.beta) {
      for (const dc of GRID.dCutoff) {
        combos.push({ minCutoff: mc, beta: b, dCutoff: dc });
      }
    }
  }
  return combos; // 49 combinations
}

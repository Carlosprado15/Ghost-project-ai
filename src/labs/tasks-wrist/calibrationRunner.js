import { runFilterOffline } from './filterCalibration.js';
import {
  computePositionJitter,
  computeRotationJitter,
  computeScaleJitter,
  computeEstimatedLag,
  computeTrackingContinuity,
  computeScoreFinal,
} from './calibrationMetrics.js';
import { buildCombinations, DEFAULT_WEIGHTS } from './calibrationPresets.js';

function avgFrameIntervalMs(frames) {
  const detected = frames.filter(f => f.detected);
  if (detected.length < 2) return 33;
  const spans = [];
  for (let i = 1; i < detected.length; i++) spans.push(detected[i].ts - detected[i - 1].ts);
  return spans.reduce((s, v) => s + v, 0) / spans.length;
}

function normalize(values) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  return values.map(v => (range < 1e-10 ? 0.5 : (v - min) / range));
}

function fmt(n, d = 4) { return n.toFixed(d); }

function mdTable(rows, headers) {
  const sep = headers.map(h => '-'.repeat(Math.max(h.length, 6)));
  const lines = [
    '| ' + headers.join(' | ') + ' |',
    '| ' + sep.join(' | ') + ' |',
    ...rows.map(r => '| ' + r.join(' | ') + ' |'),
  ];
  return lines.join('\n');
}

/**
 * Run full calibration over staticLog and slowLog.
 *
 * @param {Array} staticLog    - frames from "Gravar teste parado"
 * @param {Array} slowLog      - frames from "Gravar teste movimento lento"
 * @param {{ jitter, lag, continuity }} weights - optional override
 * @returns {{ top5, best, all, reportMd }}
 */
export function runCalibration(staticLog, slowLog, weights = DEFAULT_WEIGHTS) {
  if (!staticLog?.length || !slowLog?.length) {
    throw new Error('Logs insuficientes. Grave os dois testes antes de rodar a calibração.');
  }

  const combos    = buildCombinations();
  const frameIntv = avgFrameIntervalMs(slowLog);
  const allFrames = [...staticLog, ...slowLog];

  const rawResults = combos.map((opts) => {
    const filtStatic = runFilterOffline(staticLog, opts);
    const filtSlow   = runFilterOffline(slowLog,   opts);

    const posJitter  = computePositionJitter(filtStatic);
    const rotJitter  = computeRotationJitter(filtStatic);
    const sclJitter  = computeScaleJitter(filtStatic);
    const jitterMean = (posJitter + rotJitter + sclJitter) / 3;

    const lagResult  = computeEstimatedLag(slowLog, filtSlow, frameIntv);
    const continuity = computeTrackingContinuity(allFrames);

    return {
      ...opts,
      posJitter, rotJitter, sclJitter, jitterMean,
      lagMs:       lagResult.lagMs,
      lagFrames:   lagResult.lagFrames,
      lagMethod:   lagResult.method,
      continuity,
    };
  });

  // Normalize columns across all 49 results
  const jNorm = normalize(rawResults.map(r => r.jitterMean));
  const lNorm = normalize(rawResults.map(r => r.lagMs));
  const cNorm = normalize(rawResults.map(r => r.continuity));

  const scored = rawResults.map((r, i) => ({
    ...r,
    normJitter:     jNorm[i],
    normLag:        lNorm[i],
    normContinuity: cNorm[i],
    score: computeScoreFinal(
      { normJitter: jNorm[i], normLag: lNorm[i], normContinuity: cNorm[i] },
      weights,
    ),
  }));

  scored.sort((a, b) => b.score - a.score);

  const top5 = scored.slice(0, 5);
  const best = top5[0];

  const reportMd = generateReport({
    staticLog, slowLog, allFrames, top5, best, scored, weights, frameIntv,
  });

  return { top5, best, all: scored, reportMd };
}

function generateReport({ staticLog, slowLog, allFrames, top5, best, scored, weights, frameIntv }) {
  const now       = new Date().toISOString();
  const statDet   = staticLog.filter(f => f.detected).length;
  const slowDet   = slowLog.filter(f => f.detected).length;
  const lagMethod = best.lagMethod === 'cross-correlation'
    ? 'cross-correlation normalizada'
    : 'proxy — média |raw−filtrado| (não ms direto)';

  const top5Rows = top5.map((r, i) => [
    `#${i + 1}`,
    fmt(r.minCutoff, 2),
    fmt(r.beta, 3),
    fmt(r.jitterMean, 5),
    r.lagMethod === 'cross-correlation' ? `${fmt(r.lagMs, 1)} ms` : `${r.lagFrames} fr (proxy)`,
    `${(r.continuity * 100).toFixed(1)}%`,
    fmt(r.score, 4),
  ]);

  const allRows = scored.map((r, i) => [
    `${i + 1}`,
    fmt(r.minCutoff, 2),
    fmt(r.beta, 3),
    fmt(r.jitterMean, 5),
    `${fmt(r.lagMs, 1)} ms`,
    `${(r.continuity * 100).toFixed(1)}%`,
    fmt(r.score, 4),
  ]);

  return `# M069B — Filter Calibration Report

**Data:** ${now}
**Combinações testadas:** ${scored.length} (minCutoff × beta, dCutoff fixo em 1.0)
**Método de lag:** ${lagMethod}
**frameInterval médio:** ${frameIntv.toFixed(1)} ms

## Dados capturados

| Teste | Frames totais | Frames detectados |
|---|---|---|
| Parado (static) | ${staticLog.length} | ${statDet} |
| Movimento lento | ${slowLog.length} | ${slowDet} |
| Total | ${allFrames.length} | ${statDet + slowDet} |

## Pesos usados no score

| Métrica | Peso |
|---|---|
| jitter | ${weights.jitter} |
| lag | ${weights.lag} |
| continuity | ${weights.continuity} |

## Top 5 combinações

${mdTable(top5Rows, ['#', 'minCutoff', 'beta', 'jitter', 'lag', 'continuidade', 'score'])}

## Melhor combinação sugerida

\`\`\`
minCutoff : ${best.minCutoff}
beta      : ${best.beta}
dCutoff   : ${best.dCutoff}
score     : ${fmt(best.score, 4)}
\`\`\`

**Jitter antes (padrão mc=1.0, beta=0.007):**
${(() => {
  const def = scored.find(r => r.minCutoff === 1.0 && r.beta === 0.007);
  return def ? `posJitter=${fmt(def.posJitter, 5)}, rotJitter=${fmt(def.rotJitter, 5)}, score=${fmt(def.score, 4)}` : '(combo padrão não encontrado na grade)';
})()}

**Jitter depois (melhor combo):**
posJitter=${fmt(best.posJitter, 5)}, rotJitter=${fmt(best.rotJitter, 5)}, score=${fmt(best.score, 4)}

**Lag estimado (melhor combo):** ${best.lagMethod === 'cross-correlation' ? `${fmt(best.lagMs, 1)} ms (${best.lagFrames} frames)` : `${best.lagFrames} frames (proxy)`}

## Recomendação final

Aplicar \`minCutoff=${best.minCutoff}, beta=${best.beta}\` como preset de sessão no lab e observar visualmente se o tremor reduziu sem atraso perceptível.

Se lag visualmente alto: reduzir beta ou aumentar minCutoff.
Se tremor ainda alto: reduzir minCutoff ou reduzir beta.

## Riscos identificados

- Continuidade de ${(best.continuity * 100).toFixed(1)}% — ${best.continuity < 0.85 ? 'ATENÇÃO: baixa. Iluminação ou ângulo do pulso afetam estabilidade do modelo.' : 'OK.'}
- Método de lag: ${lagMethod}
- Grade testada: dCutoff fixo em 1.0. Se ainda insatisfatório, testar dCutoff in [0.5, 1.0, 2.0].

## Todas as combinações

${mdTable(allRows, ['rank', 'minCutoff', 'beta', 'jitter', 'lag', 'continuidade', 'score'])}
`;
}

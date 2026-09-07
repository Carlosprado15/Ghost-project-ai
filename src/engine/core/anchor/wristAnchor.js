/**
 * computeWristAnchor
 *
 * Takes the 21 MediaPipe hand landmarks (normalized 0-1 coords) and returns
 * the anchor point for an AR wrist accessory.
 *
 * Landmarks used (todos da BASE da mão — visíveis com punho fechado):
 *   lm0  = wrist          (âncora de posição — sempre usado)
 *   lm5  = index MCP      (par primário de rotação/escala)
 *   lm17 = pinky MCP      (par primário e par de fallback)
 *   lm1  = thumb CMC      (par palmar de fallback — M069J)
 *   lm9  = middle MCP     (referência de comprimento da palma — M069J)
 *
 * The anchor is offset from the wrist toward the forearm (away from the palm)
 * by offsetRatio × forearm-vector-length, matching the production WristTracker
 * behaviour (watchOffsetRatio = 0.18).
 *
 * GARANTIA (M069H/M069J): posição, rotação e escala NUNCA dependem das pontas
 * dos dedos (lm8/12/16/20) — apenas de landmarks da base da mão. NÃO adicionar
 * dependência de pontas de dedos aqui.
 *
 * M069J — tracking com a mão rotacionada (lado palmar):
 * o MediaPipe entrega os 21 landmarks em bloco (não há confiança individual),
 * então a degradação do par lm5–lm17 é detectada por GEOMETRIA:
 *   - encurtamento: span lm5–lm17 projetado < 45% do comprimento da palma
 *     (lm0→lm9) indica pronação/rotação do pulso;
 *   - separação em z: |lm5.z − lm17.z| grande indica mão de perfil.
 * Nesses casos rotação/escala passam para o par palmar lm1–lm17, que continua
 * bem projetado quando o pulso vira. A posição segue ancorada no lm0.
 */

// M069I/M069J: offset base de rotação — o eixo dos MCPs é perpendicular à
// pulseira; o GLB precisa de rotação base para marcar "12:00" em pé no pulso.
// Ajuste fino: mude SÓ este número.
// 60 = calibrado para os GLBs ORIGINAIS (M069J) — estado que funcionava.
// NÃO zerar por causa dos normalizados: o ajuste deles será feito em missão
// separada, sem tocar no comportamento dos originais.
const ROTATION_OFFSET_DEG = 60;
// Histórico/alternativas testáveis:
// const ROTATION_OFFSET_DEG = 90;  // M069I — girou ~30° a mais no teste real
// const ROTATION_OFFSET_DEG = 45;  // alternativa
// const ROTATION_OFFSET_DEG = 0;   // estado "limpo" p/ normalizados (quebrou originais)

// M069J: ajuste aplicado SÓ quando o par de fallback lm1–lm17 está ativo
// (lm1–lm17 é maior que lm5–lm17 — normaliza a escala do par palmar):
const FALLBACK_SCALE_RATIO  = 0.85;

// M069J: limiares de degradação do par primário
const SPAN_RATIO_MIN = 0.45;  // span primário < 45% da palma → encurtado
const Z_SPLAY_MAX    = 0.08;  // |z5 − z17| acima disso → mão rotacionada

// AR-KB-005/006/008/009 (AR-004-fisico, 2026-08-28): FALLBACK_ROT_TRIM_DEG
// (constante fixa, zerada) foi REMOVIDA — não funciona porque lm1 (thumb CMC)
// tem ROM de abdução ativa de 40–70° (JOSPT 2003), então o offset angular
// entre o par primário (lm5–lm17) e o par de fallback (lm1–lm17) não é
// constante; medido no teste físico de 28/08 causou erro de ~93°/~293°.
//
// Correção: "crossover offset" dinâmico (AR-KB-005), medido no PRÓPRIO frame
// em que `degraded` transiciona de false→true (ainda dá pra medir os dois
// ângulos nesse frame) e aplicado como STEP FUNCTION enquanto degraded=true
// (bumpless transfer — AR-KB-009: o offset é estrutural/anatômico, não
// transitório, então NÃO deve decair/interpolar para 0). O estado
// (`prevDegraded`, `crossoverOffset`) precisa sobreviver entre frames; como
// esta função é stateless por design, o estado é responsabilidade do
// CHAMADOR, passado explicitamente via `anchorState` (AR-KB-006 — parâmetro
// explícito, não closure/factory: mais testável, reentrante, e a única
// mudança de estado desta função pequena não justifica o overhead de uma
// factory como a do HandTracker). Reset de anchorState em tracking loss
// longa (hold expirado) é responsabilidade do chamador — ver GhostEngine.js.

// Normaliza um ângulo em radianos para (-π, π] — mesma lógica de unwrap
// usada em D4/_unwrapRotZ (GhostEngine.js), aplicada aqui à diferença entre
// primaryAngle e fallbackAngle no frame de cruzamento.
function normalizeAngle(rad) {
  let a = rad;
  while (a > Math.PI)  a -= 2 * Math.PI;
  while (a <= -Math.PI) a += 2 * Math.PI;
  return a;
}

export function computeWristAnchor(
  landmarks,
  anchorState = {},
  { offsetRatio = 0.18, rotationOffsetDeg = ROTATION_OFFSET_DEG } = {}
) {
  const lm0  = landmarks[0];   // wrist
  const lm1  = landmarks[1];   // thumb CMC
  const lm5  = landmarks[5];   // index MCP
  const lm9  = landmarks[9];   // middle MCP
  const lm17 = landmarks[17];  // pinky MCP

  // ── Detecção de degradação do par primário (mão rotacionada) ──────────────
  const spanPrimary = Math.hypot(lm5.x - lm17.x, lm5.y - lm17.y);
  const palmLength  = Math.hypot(lm9.x - lm0.x, lm9.y - lm0.y) || 0.001;
  const zSplay      = Math.abs((lm5.z ?? 0) - (lm17.z ?? 0));
  const degraded    = spanPrimary < palmLength * SPAN_RATIO_MIN || zSplay > Z_SPLAY_MAX;

  // Par efetivo: primário lm5–lm17; palmar lm1–lm17 quando degradado
  const refA = degraded ? lm1 : lm5;
  const refB = lm17;

  // Escala: span do par efetivo (normalizado quando vem do par palmar)
  const scale = Math.hypot(refA.x - refB.x, refA.y - refB.y)
              * (degraded ? FALLBACK_SCALE_RATIO : 1);

  // ── Ângulos dos dois pares — ambos sempre computáveis (AR-KB-005) ─────────
  const primaryAngle  = Math.atan2(lm17.y - lm5.y, lm17.x - lm5.x);
  const fallbackAngle = Math.atan2(lm17.y - lm1.y, lm17.x - lm1.x);

  // Frame de cruzamento (false → true): mede o offset geométrico entre os
  // dois pares AGORA, enquanto ambos ainda são válidos, e guarda em
  // anchorState (AR-KB-005/006). Fora da transição, enquanto degraded=true,
  // reusa o offset já guardado (step function — AR-KB-009).
  if (degraded && !anchorState.prevDegraded) {
    anchorState.crossoverOffset = normalizeAngle(primaryAngle - fallbackAngle);
  }
  anchorState.prevDegraded = degraded;

  // Rotação: ângulo do par efetivo (+ crossoverOffset só quando degraded)
  // + offset base do produto.
  const effectiveAngle = degraded
    ? fallbackAngle + (anchorState.crossoverOffset ?? 0)
    : primaryAngle;
  const rotZ = effectiveAngle + (rotationOffsetDeg * Math.PI / 180);

  // Palm center do par efetivo
  const pcx = (refA.x + refB.x) / 2;
  const pcy = (refA.y + refB.y) / 2;

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

  // HUD (AR-004-fisico, 2026-08-28→29): expõe `degraded` (já calculado acima)
  // e `crossoverOffset` — em radianos, mesma unidade não-rotulada de `rotZ`
  // já retornado aqui (a conversão pra grau, quando necessária, é feita só
  // na exibição, igual já acontece com rotZ em TasksWristLab.jsx) — pra
  // dar visibilidade direta no lab de qual estado de anchorState está
  // ativo, sem precisar inferir pelos números crus de rotZ.
  return { x, y, z: lm0.z ?? 0, rotZ, scale, degraded, crossoverOffset: anchorState.crossoverOffset ?? 0 };
}

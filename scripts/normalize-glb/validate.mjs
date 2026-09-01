/**
 * validate.mjs — Validação automática dos GLBs normalizados (Ghost Project)
 *
 * Para cada CW001–CW015 em public/models/normalized/:
 *   - lê o documento com @gltf-transform/core e calcula o bounding box FINAL
 *     (getBounds aplica todas as transformações de nó, incluindo o wrapper
 *     AR_NORMALIZED do pipeline)
 *   - verifica:
 *       "Em pé"        → Y é a maior ou segunda maior dimensão
 *       "Centralizado" → centro do bbox a < 0.01 da origem (0,0,0)
 *       escala         → maior dimensão próxima do alvo 0.08 (tolerância ±10%)
 *   - gera scripts/normalize-glb/VALIDATION_REPORT.md com tabela + sugestões
 *
 * Rodar:  node scripts/normalize-glb/validate.mjs
 */

import { NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';
import { writeFileSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE    = dirname(fileURLToPath(import.meta.url));
const ROOT    = resolve(HERE, '../..');
const SRC_DIR = resolve(ROOT, 'public/models/normalized');
const OUT_MD  = resolve(HERE, 'VALIDATION_REPORT.md');

// M070D: critérios por TIPO (product-calibration-overrides.json)
//  watch    → "em pé": Y maior ou 2ª maior · alvo 0.08
//  bracelet → "loop ⊥ Y": Y é a MENOR dimensão (plano do loop horizontal) · alvo 0.07
const OVERRIDES = JSON.parse(
  readFileSync(resolve(HERE, 'product-calibration-overrides.json'), 'utf8')
);
const TARGET_MAX_DIM = { watch: 0.08, bracelet: 0.07 };
const CENTER_TOL     = 0.01;
const SCALE_TOL      = 0.10; // ±10%

// 2026-09-01: era um range fixo CW001–CW015, que ficou defasado assim que o
// catálogo cresceu (produtos novos nunca eram checados). O overrides.json já
// é a fonte única de verdade de "quais produtos existem" pro resto do
// pipeline (normalize.mjs, ProductCalibrationLab) — usar a mesma fonte aqui.
const PRODUCT_IDS = Object.keys(OVERRIDES);

// Os normalizados saem comprimidos com Draco (normalize.mjs) — sem registrar
// o decoder aqui, io.read() quebra com "Cannot read properties of undefined
// (reading 'DT_FLOAT32')" em qualquer arquivo com KHR_draco_mesh_compression.
// (2026-09-01: bug pré-existente que fazia validate.mjs falhar silenciosamente
// pra TODOS os produtos assim que a compressão Draco entrou no pipeline —
// não era específico dos 5 produtos desta rodada.)
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
});

const f = (n) => n.toFixed(4);

const rows = [];
const issues = [];

for (const id of PRODUCT_IDS) {
  try {
    const doc   = await io.read(resolve(SRC_DIR, `${id}.glb`));
    const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
    const { min, max } = getBounds(scene);

    const dim    = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
    const center = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
    const centerDist = Math.hypot(...center);
    const maxDim     = Math.max(...dim);

    const type   = OVERRIDES[id]?.type === 'bracelet' ? 'bracelet' : 'watch';
    const target = TARGET_MAX_DIM[type];

    // Orientação por tipo. Rank com tolerância 1e-6 (ruído de float não decide).
    // Produtos com status "calibrated" PULAM o critério de orientação:
    // calibração visual humana > heurística PCA/AABB. Escala e centro seguem valendo.
    const isCalibrated = OVERRIDES[id]?.status === 'calibrated';
    const yRank = dim.filter(d => d > dim[1] + 1e-6).length; // 0=maior … 2=menor
    const orientOk = isCalibrated || (type === 'bracelet' ? yRank === 2 : yRank <= 1);

    const centered = centerDist < CENTER_TOL;
    const scaleOk  = Math.abs(maxDim - target) / target <= SCALE_TOL;

    const reasons = [];
    if (!orientOk) reasons.push(type === 'bracelet'
      ? `loop não ⊥ Y (Y=${f(dim[1])} é a ${yRank + 1}ª dimensão, deveria ser a menor)`
      : `Y (${f(dim[1])}) é apenas a ${yRank + 1}ª dimensão`);
    if (!centered) reasons.push(`centro a ${f(centerDist)} da origem`);
    if (!scaleOk)  reasons.push(`maior dimensão ${f(maxDim)} fora do alvo ${target} ±10%`);

    const ok = reasons.length === 0;
    rows.push({
      id, type, dim, standing: orientOk, centered, ok,
      status: ok ? '✅ OK' : `⚠️ REVISAR (${reasons.join('; ')})`,
    });

    if (!ok) {
      const sugg = [];
      if (!orientOk) sugg.push(type === 'bracelet'
        ? `ajustar rotationDeg no overrides.json até o eixo do loop ficar em Y (usar ?lab=calibrate-product&productId=${id})`
        : `ajustar rotationDeg/flips no overrides.json (usar ?lab=calibrate-product&productId=${id})`);
      if (!centered) sugg.push(`recentralizar via offset no overrides.json: subtrair (${center.map(f).join(', ')})`);
      if (!scaleOk)  sugg.push(`ajustar "scale" no overrides.json: multiplicar por ${(target / maxDim).toFixed(4)}`);
      issues.push({ id, sugg });
    }
  } catch (e) {
    rows.push({ id, dim: [0, 0, 0], standing: false, centered: false, ok: false, status: `⚠️ REVISAR (erro: ${e.message})` });
    issues.push({ id, sugg: [`arquivo ilegível: ${e.message}`] });
  }
}

const okCount = rows.filter(r => r.ok).length;

const md = `# VALIDATION_REPORT — GLBs Normalizados
Gerado por \`node scripts/normalize-glb/validate.mjs\` em ${new Date().toISOString().slice(0, 10)}

Critérios por tipo — **watch**: Y maior ou 2ª maior (em pé), alvo 0.08 · **bracelet**: Y é a MENOR dimensão (loop ⊥ Y), alvo 0.07 · **Centralizado**: centro do bbox a < ${CENTER_TOL} da origem · escala ±${SCALE_TOL * 100}%

| Produto | Tipo | Dim X | Dim Y | Dim Z | Orientação? | Centralizado? | Status |
|---------|------|-------|-------|-------|-------------|---------------|--------|
${rows.map(r =>
  `| ${r.id} | ${r.type ?? '—'} | ${f(r.dim[0])} | ${f(r.dim[1])} | ${f(r.dim[2])} | ${r.standing ? 'Sim' : 'NÃO'} | ${r.centered ? 'Sim' : 'NÃO'} | ${r.status} |`
).join('\n')}

**Resultado: ${okCount}/${rows.length} ✅ OK · ${rows.length - okCount} ⚠️ REVISAR**
${issues.length ? `
## Sugestões de correção

${issues.map(i => `### ${i.id}\n${i.sugg.map(s => `- ${s}`).join('\n')}`).join('\n\n')}
` : ''}
> Nota de método: o bounding box é calculado transformando os cantos do AABB
> local pelo wrapper AR_NORMALIZED (método padrão do gltf-transform). Rotações
> de 45° inflam o AABB medido em relação à malha real — dimensões X/Y até ~41%
> maiores que o objeto de fato. Use os números como comparativo entre produtos.
`;

writeFileSync(OUT_MD, md, 'utf8');
console.log(md);
console.log(`Relatório salvo em ${OUT_MD}`);
if (okCount < rows.length) process.exitCode = 1;

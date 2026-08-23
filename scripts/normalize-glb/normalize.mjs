/**
 * normalize.mjs — Pipeline de normalização de GLBs para AR (Ghost Project)
 *
 * Problema: os GLBs convertidos via Tripo 3D chegam com orientação arbitrária,
 * escala incorreta e origem descentrada — cada produto se comporta diferente
 * no ancoramento AR.
 *
 * O que faz, para cada CW001–CW015 em public/models/:
 *   a) CENTRALIZAR — origem movida para o centro geométrico do bounding box
 *   b) ORIENTAR    — rotação X=-90° (Y-up do Tripo 3D → Z-up do WebGL/AR,
 *                    face do relógio para +Z)
 *   c) ESCALAR     — maior dimensão normalizada para 0.08 unidades (~8 cm,
 *                    tamanho real de relógio em coordenadas AR)
 *   d) SALVAR      — em public/models/normalized/<mesmo-nome>.glb,
 *                    SEM tocar nos originais
 *
 * Implementação: um único nó-pai "AR_NORMALIZED" com TRS envolve as raízes da
 * cena — nenhuma malha é reescrita, então KHR_mesh_quantization/texturas webp
 * dos originais passam intactos (arquivo de saída ~mesmo tamanho).
 *
 * Rodar:  node scripts/normalize-glb/normalize.mjs
 */

import { NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { draco } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { mkdirSync, statSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeMeshPCA, quatRotate } from './orientation.mjs';

const HERE      = dirname(fileURLToPath(import.meta.url));
const ROOT      = resolve(HERE, '../..');
const SRC_DIR   = resolve(ROOT, 'public/models');
const OUT_DIR   = resolve(ROOT, 'public/models/normalized');

// Alvo de escala por tipo (maior dimensão, em unidades AR ≈ metros/10... ~cm)
const TARGET_MAX_DIM = { watch: 0.08, bracelet: 0.07 };

// M070D: calibração por produto — fonte única de verdade dos ajustes manuais
// (tipo, rotações extras em graus, escala, offset, flips, status).
// Editar via lab ?lab=calibrate-product e colar aqui.
const OVERRIDES = JSON.parse(
  readFileSync(resolve(HERE, 'product-calibration-overrides.json'), 'utf8')
);
const DEFAULT_OVERRIDE = {
  type: 'watch',
  rotationDeg: { x: 0, y: 0, z: 0 },
  scale: 1.0,
  offset: { x: 0, y: 0, z: 0 },
  flip180Y: false,
  flip180Z: false,
  status: 'needs_calibration',
};

// Sem argumentos: processa os 32 produtos ativos. Com argumentos (ex:
// `node normalize.mjs CW011`): processa só os IDs passados — útil para
// iterar rápido em 1 produto.
const ACTIVE_IDS = [
  'CW001', 'CW002', 'CW003', 'CW004', 'CW005', 'CW006', 'CW007', 'CW008', 'CW009',
  'CW013', 'CW014',
  'CW016', 'CW017', 'CW018', 'CW019', 'CW020', 'CW021', 'CW022', 'CW023', 'CW024',
  'CW025', 'CW026', 'CW027', 'CW028', 'CW029', 'CW030', 'CW031', 'CW032', 'CW033',
  'CW034', 'CW035', 'CW036',
];
const argIds = process.argv.slice(2);
const PRODUCT_IDS = argIds.length ? argIds : ACTIVE_IDS;

// ── Rotações (glTF usa quaternion [x,y,z,w]) ─────────────────────────────────
// Os modelos Tripo têm orientação arbitrária — rotação fixa nunca serve para
// os 15. A orientação é 100% manual, por produto, via overrides.json
// (calibrado na tela ?lab=calibrate-product). M070H: removido o alinhamento
// PCA automático que rodava por baixo do pano — a tela de calibração nunca
// levava essa etapa em conta, então o valor salvo lá era corrompido de novo
// aqui. Overrides são agora a ÚNICA fonte de rotação, sem etapa escondida.
const quatMul = ([ax, ay, az, aw], [bx, by, bz, bw]) => [
  aw * bx + ax * bw + ay * bz - az * by,
  aw * by - ax * bz + ay * bw + az * bx,
  aw * bz + ax * by - ay * bx + az * bw,
  aw * bw - ax * bx - ay * by - az * bz,
];
const QUAT_Y_180 = [0, 1, 0, 0];
const QUAT_Z_180 = [0, 0, 1, 0];
const quatAboutAxis = (axis, deg) => {
  const half = (deg * Math.PI / 180) / 2;
  const s = Math.sin(half), c = Math.cos(half);
  return axis === 'x' ? [s, 0, 0, c] : axis === 'y' ? [0, s, 0, c] : [0, 0, s, c];
};

// Os GLBs de origem agora saem comprimidos com Draco (ver missão de
// compressão dos 32 GLBs) — sem registrar o decoder aqui, io.read() quebra
// com "Cannot read properties of undefined (reading 'DT_FLOAT32')" ao
// encontrar a extensão KHR_draco_mesh_compression.
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
  'draco3d.encoder': await draco3d.createEncoderModule(),
});

mkdirSync(OUT_DIR, { recursive: true });

const fmtMB = (bytes) => (bytes / 1024 / 1024).toFixed(2) + ' MB';

let ok = 0, failed = 0;
console.log('GLB      | tipo     | status             | ajustes          | orient | frente | dim. final (x·y·z)');
console.log('---------|----------|--------------------|------------------|--------|--------|--------------------');

for (const id of PRODUCT_IDS) {
  const srcPath = resolve(SRC_DIR, `${id}.glb`);
  const outPath = resolve(OUT_DIR, `${id}.glb`);
  try {
    const doc   = await io.read(srcPath);
    const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];

    // ── ORDEM ────────────────────────────────────────────────────────────────
    // a) rotação: SÓ o ajuste manual do overrides.json (x→y→z) + flips.
    // Removido o alinhamento PCA automático (M070H): ele rodava por baixo do
    // pano e não era considerado pela tela de calibração, então cada ajuste
    // salvo lá era corrompido de novo nesta etapa — a tela virava fonte da
    // verdade errada. Overrides agora são a ÚNICA fonte de rotação.
    const ov   = { ...DEFAULT_OVERRIDE, ...(OVERRIDES[id] ?? {}) };
    const type = ov.type === 'bracelet' ? 'bracelet' : 'watch';

    const pca = computeMeshPCA(doc); // só para o diagnóstico impresso (orient/frente)
    let rot = [0, 0, 0, 1];
    // rotações do override (graus, aplicadas em eixos de MUNDO: X→Y→Z)
    const rd = { ...DEFAULT_OVERRIDE.rotationDeg, ...(ov.rotationDeg ?? {}) };
    if (rd.x) rot = quatMul(quatAboutAxis('x', rd.x), rot);
    if (rd.y) rot = quatMul(quatAboutAxis('y', rd.y), rot);
    if (rd.z) rot = quatMul(quatAboutAxis('z', rd.z), rot);
    if (ov.flip180Y) rot = quatMul(QUAT_Y_180, rot);
    if (ov.flip180Z) rot = quatMul(QUAT_Z_180, rot);

    // diagnóstico: pós-rotação (watch: e1→Y, e3→Z · bracelet: e3→Y)
    const e1f = quatRotate(rot, pca.axes[0]);
    const e3f = quatRotate(rot, pca.axes[2]);
    const orientPct = type === 'bracelet' ? Math.abs(e3f[1]) : Math.abs(e1f[1]);
    const facePct   = type === 'bracelet' ? NaN : e3f[2];

    const wrapper = doc.createNode('AR_NORMALIZED').setRotation(rot);
    for (const child of scene.listChildren()) {
      scene.removeChild(child);
      wrapper.addChild(child);
    }
    scene.addChild(wrapper);

    // b) bounding box PÓS-rotação (mesmo método do validate.mjs)
    const b1 = getBounds(scene);
    const size   = [b1.max[0] - b1.min[0], b1.max[1] - b1.min[1], b1.max[2] - b1.min[2]];
    const center = [(b1.min[0] + b1.max[0]) / 2, (b1.min[1] + b1.max[1]) / 2, (b1.min[2] + b1.max[2]) / 2];

    // c+d) escala: alvo por tipo × multiplicador do override, no bbox pós-rotação
    const s = (TARGET_MAX_DIM[type] / Math.max(...size)) * (ov.scale ?? 1.0);
    // e) centralização por último + offset manual do override
    const off = { ...DEFAULT_OVERRIDE.offset, ...(ov.offset ?? {}) };
    wrapper.setScale([s, s, s]).setTranslation([
      -s * center[0] + (off.x ?? 0),
      -s * center[1] + (off.y ?? 0),
      -s * center[2] + (off.z ?? 0),
    ]);

    // io.read() decodifica o Draco do arquivo de origem pra malha "crua" em
    // memória — sem recomprimir aqui, o arquivo normalizado sairia sem Draco
    // (~55MB de novo, desfazendo a compressão feita nos brutos).
    await doc.transform(draco());
    await io.write(outPath, doc);

    const before = statSync(srcPath).size;
    const after  = statSync(outPath).size;
    const adjustments = [
      ov.flip180Y ? 'Y180' : '', ov.flip180Z ? 'Z180' : '',
      rd.x ? `x${rd.x}°` : '', rd.y ? `y${rd.y}°` : '', rd.z ? `z${rd.z}°` : '',
      (ov.scale ?? 1) !== 1 ? `s${ov.scale}` : '',
      (off.x || off.y || off.z) ? 'off' : '',
    ].filter(Boolean).join('+') || '—';
    console.log(
      `${id}    | ${type.padEnd(8)} | ${String(ov.status ?? '—').padEnd(18)} | ${adjustments.padEnd(16)} | ` +
      `${(orientPct * 100).toFixed(0).padStart(5)}% | ${Number.isNaN(facePct) ? '   n/a' : (facePct * 100).toFixed(0).padStart(5) + '%'} | ` +
      `${size.map(v => (v * s).toFixed(4)).join(' · ')}`
    );
    ok++;
  } catch (e) {
    console.error(`${id}    | ERRO: ${e.message}`);
    failed++;
  }
}

console.log(`\n${ok} normalizados, ${failed} falhas → ${OUT_DIR}`);
if (failed > 0) process.exitCode = 1;

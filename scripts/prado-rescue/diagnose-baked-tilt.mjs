// SÓ LEITURA — não escreve nada em public/models/normalized/, não toca no
// overrides.json. Reproduz EXATAMENTE a mesma matemática de rotação que
// normalize.mjs aplica (mesma função quatMul/quatAboutAxis, mesma ordem
// x→y→z + flips, a partir do MESMO overrides.json), só que sem escrever o
// GLB de saída — e mede, na rotação já aplicada (sem câmera, sem
// model-viewer, sem navegador envolvido), o quanto a normal do mostrador
// (e3, vindo do PCA) se desvia de apontar exatamente pra +Z. Se esse desvio
// for parecido (mesmo grau, mesma direção) em TODOS os relógios, é prova de
// um viés sistemático na própria matemática/dados — não em cada calibração
// individual.
import { NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeMeshPCA, quatRotate } from '../normalize-glb/orientation.mjs';

const HERE    = dirname(fileURLToPath(import.meta.url));
const ROOT    = resolve(HERE, '../..');
const SRC_DIR = resolve(ROOT, 'public/models');

const OVERRIDES = JSON.parse(readFileSync(resolve(ROOT, 'scripts/normalize-glb/product-calibration-overrides.json'), 'utf8'));
const DEFAULT_OVERRIDE = { type: 'watch', rotationDeg: { x: 0, y: 0, z: 0 }, scale: 1, offset: { x: 0, y: 0, z: 0 }, flip180Y: false, flip180Z: false, status: 'needs_calibration' };

const ACTIVE_IDS = [
  'CW001', 'CW002', 'CW003', 'CW004', 'CW005', 'CW006', 'CW007', 'CW008', 'CW009',
  'CW013', 'CW014',
  'CW016', 'CW017', 'CW018', 'CW019', 'CW020', 'CW021', 'CW022', 'CW023', 'CW024',
  'CW025', 'CW026', 'CW027', 'CW028', 'CW029', 'CW030', 'CW031', 'CW032', 'CW033',
  'CW034', 'CW035', 'CW036',
];

// idêntico a normalize.mjs — copiado, não importado, pra não arriscar tocar
// no arquivo original sendo investigado
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

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
});

const rows = [];
for (const id of ACTIVE_IDS) {
  const doc = await io.read(resolve(SRC_DIR, `${id}.glb`));
  const ov = { ...DEFAULT_OVERRIDE, ...(OVERRIDES[id] ?? {}) };
  const type = ov.type === 'bracelet' ? 'bracelet' : 'watch';
  const rd = { ...DEFAULT_OVERRIDE.rotationDeg, ...(ov.rotationDeg ?? {}) };

  let rot = [0, 0, 0, 1];
  if (rd.x) rot = quatMul(quatAboutAxis('x', rd.x), rot);
  if (rd.y) rot = quatMul(quatAboutAxis('y', rd.y), rot);
  if (rd.z) rot = quatMul(quatAboutAxis('z', rd.z), rot);
  if (ov.flip180Y) rot = quatMul(QUAT_Y_180, rot);
  if (ov.flip180Z) rot = quatMul(QUAT_Z_180, rot);

  const pca = computeMeshPCA(doc);
  const e1f = quatRotate(rot, pca.axes[0]); // eixo longo → deveria ir pra +Y
  const e3f = quatRotate(rot, pca.axes[2]); // normal do mostrador → deveria ir pra +Z

  // ângulo de desvio da normal do mostrador em relação ao eixo +Z puro
  const faceDeviationDeg = Math.acos(Math.min(1, Math.max(-1, Math.abs(e3f[2])))) * 180 / Math.PI;
  // decompõe o desvio em torno de X (tomba frente/trás) e de Y (gira esq/dir)
  // pra achar a DIREÇÃO do viés, não só a magnitude
  const tiltAroundX = Math.atan2(e3f[1], e3f[2]) * 180 / Math.PI; // >0 = mostrador olhando pra baixo (tomba topo pra trás) ou pra cima, depende do sinal
  const tiltAroundY = Math.atan2(e3f[0], e3f[2]) * 180 / Math.PI;

  rows.push({ id, type, status: ov.status, faceDeviationDeg, tiltAroundX, tiltAroundY });
}

console.log('id     | tipo     | status             | desvio da face vs +Z puro | tomba X (frente/trás) | gira Y (esq/dir)');
console.log('-------|----------|--------------------|---------------------------|------------------------|------------------');
for (const r of rows) {
  const dev = r.type === 'bracelet' ? 'n/a' : r.faceDeviationDeg.toFixed(1) + '°';
  const tx  = r.type === 'bracelet' ? 'n/a' : r.tiltAroundX.toFixed(1) + '°';
  const ty  = r.type === 'bracelet' ? 'n/a' : r.tiltAroundY.toFixed(1) + '°';
  console.log(`${r.id}  | ${r.type.padEnd(8)} | ${String(r.status).padEnd(18)} | ${dev.padStart(25)} | ${tx.padStart(22)} | ${ty.padStart(16)}`);
}

const watchDevs = rows.filter(r => r.type === 'watch').map(r => r.faceDeviationDeg);
const watchTiltX = rows.filter(r => r.type === 'watch').map(r => r.tiltAroundX);
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const stdev = (a) => { const m = mean(a); return Math.sqrt(mean(a.map(v => (v - m) ** 2))); };
console.log(`\nRelógios: média do desvio da face = ${mean(watchDevs).toFixed(2)}°, desvio-padrão = ${stdev(watchDevs).toFixed(2)}°`);
console.log(`Relógios: média do "tomba X" (com sinal) = ${mean(watchTiltX).toFixed(2)}°, desvio-padrão = ${stdev(watchTiltX).toFixed(2)}°`);

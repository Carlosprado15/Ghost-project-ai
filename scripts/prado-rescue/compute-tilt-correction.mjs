// SÓ CÁLCULO — não escreve em overrides.json nem em public/models/normalized/.
// Pra cada produto com medição confiável (exclui os ~9 com leitura de PCA
// ambígua ~90°), calcula a rotação corretiva exata que zera o "tomba
// frente/trás" medido, e decompõe de volta pro formato x/y/z que o
// overrides.json usa — usando a MESMA convenção (M = Rz·Ry·Rx) e a MESMA
// fórmula de decomposição (eulerPipeline) que a tela de calibração já usa,
// copiada de ProductCalibrationLab.jsx, pra garantir compatibilidade total
// com normalize.mjs sem mudar nenhum código de pipeline.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeMeshPCA, quatRotate } from '../normalize-glb/orientation.mjs';

const HERE    = dirname(fileURLToPath(import.meta.url));
const ROOT    = resolve(HERE, '../..');
const SRC_DIR = resolve(ROOT, 'public/models');
const OVERRIDES = JSON.parse(readFileSync(resolve(ROOT, 'scripts/normalize-glb/product-calibration-overrides.json'), 'utf8'));
const DEFAULT_OVERRIDE = { type: 'watch', rotationDeg: { x: 0, y: 0, z: 0 }, scale: 1, offset: { x: 0, y: 0, z: 0 }, flip180Y: false, flip180Z: false, status: 'needs_calibration' };

// Excluídos: leitura de PCA ambígua (~90°, eixo errado escolhido) medida na
// investigação anterior — não confiável pra calcular correção.
const EXCLUDED = ['CW009', 'CW013', 'CW018', 'CW019', 'CW020', 'CW026', 'CW028', 'CW032', 'CW035'];
const ACTIVE_IDS = [
  'CW001', 'CW002', 'CW003', 'CW004', 'CW005', 'CW006', 'CW007', 'CW008', 'CW009',
  'CW013', 'CW014',
  'CW016', 'CW017', 'CW018', 'CW019', 'CW020', 'CW021', 'CW022', 'CW023', 'CW024',
  'CW025', 'CW026', 'CW027', 'CW028', 'CW029', 'CW030', 'CW031', 'CW032', 'CW033',
  'CW034', 'CW035', 'CW036',
].filter(id => OVERRIDES[id]?.type !== 'bracelet' && !EXCLUDED.includes(id));

const quatMul = ([ax, ay, az, aw], [bx, by, bz, bw]) => [
  aw * bx + ax * bw + ay * bz - az * by,
  aw * by - ax * bz + ay * bw + az * bx,
  aw * bz + ax * by - ay * bx + az * bw,
  aw * bw - ax * bx - ay * by - az * bz,
];
const quatAboutAxis = (axis, deg) => {
  const half = (deg * Math.PI / 180) / 2;
  const s = Math.sin(half), c = Math.cos(half);
  return axis === 'x' ? [s, 0, 0, c] : axis === 'y' ? [0, s, 0, c] : [0, 0, s, c];
};
// idêntico a quatToMat3 em ProductCalibrationLab.jsx
const quatToMat3 = ([x, y, z, w]) => [
  [1 - 2 * (y * y + z * z), 2 * (x * y - z * w),     2 * (x * z + y * w)],
  [2 * (x * y + z * w),     1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
  [2 * (x * z - y * w),     2 * (y * z + x * w),     1 - 2 * (x * x + y * y)],
];
// idêntico a eulerPipeline em ProductCalibrationLab.jsx (M = Rz·Ry·Rx)
const rad2deg = (r) => r * 180 / Math.PI;
function eulerPipeline(M) {
  const b = Math.asin(Math.max(-1, Math.min(1, -M[2][0])));
  const a = Math.atan2(M[2][1], M[2][2]);
  const c = Math.atan2(M[1][0], M[0][0]);
  return { x: rad2deg(a), y: rad2deg(b), z: rad2deg(c) };
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
});

const results = [];
for (const id of ACTIVE_IDS) {
  const doc = await io.read(resolve(SRC_DIR, `${id}.glb`));
  const ov = { ...DEFAULT_OVERRIDE, ...(OVERRIDES[id] ?? {}) };
  const rd = { ...DEFAULT_OVERRIDE.rotationDeg, ...(ov.rotationDeg ?? {}) };

  let rot = [0, 0, 0, 1];
  if (rd.x) rot = quatMul(quatAboutAxis('x', rd.x), rot);
  if (rd.y) rot = quatMul(quatAboutAxis('y', rd.y), rot);
  if (rd.z) rot = quatMul(quatAboutAxis('z', rd.z), rot);
  if (ov.flip180Y) rot = quatMul([0, 1, 0, 0], rot);
  if (ov.flip180Z) rot = quatMul([0, 0, 1, 0], rot);

  const pca = computeMeshPCA(doc);
  const e3_before = quatRotate(rot, pca.axes[2]);
  const tiltX_before = Math.atan2(e3_before[1], e3_before[2]) * 180 / Math.PI;

  // correção: rotação extra em X, aplicada por FORA (mundo, depois de tudo),
  // que cancela exatamente o componente Y medido na normal do mostrador.
  // Sinal calibrado empiricamente: -tiltX_before DOBRAVA o desvio (testado),
  // então o sinal certo pra cancelar é +tiltX_before.
  const correction = quatAboutAxis('x', tiltX_before);
  const newRot = quatMul(correction, rot);

  const e3_after = quatRotate(newRot, pca.axes[2]);
  const tiltX_after = Math.atan2(e3_after[1], e3_after[2]) * 180 / Math.PI;

  const newEuler = eulerPipeline(quatToMat3(newRot));
  const newX = Math.round(newEuler.x * 10) / 10;
  const newY = Math.round(newEuler.y * 10) / 10;
  const newZ = Math.round(newEuler.z * 10) / 10;

  // ROUND-TRIP: reconstrói o quaternion a partir dos x/y/z arredondados
  // exatamente como normalize.mjs faria ao ler o overrides.json, e mede o
  // tombo de novo a partir DESSE quaternion reconstruído — não do newRot
  // teórico. É o que realmente vai rodar em produção, arredondamento e tudo.
  let rotRoundTrip = [0, 0, 0, 1];
  if (newX) rotRoundTrip = quatMul(quatAboutAxis('x', newX), rotRoundTrip);
  if (newY) rotRoundTrip = quatMul(quatAboutAxis('y', newY), rotRoundTrip);
  if (newZ) rotRoundTrip = quatMul(quatAboutAxis('z', newZ), rotRoundTrip);
  const e3_roundtrip = quatRotate(rotRoundTrip, pca.axes[2]);
  const tiltX_roundtrip = Math.atan2(e3_roundtrip[1], e3_roundtrip[2]) * 180 / Math.PI;

  results.push({
    id,
    old: { x: rd.x, y: rd.y, z: rd.z },
    new: { x: newX, y: newY, z: newZ },
    tiltX_before: Math.round(tiltX_before * 100) / 100,
    tiltX_after: Math.round(tiltX_after * 1000) / 1000, // teórico, sem arredondar x/y/z
    tiltX_roundtrip: Math.round(tiltX_roundtrip * 1000) / 1000, // real: reconstruído a partir dos x/y/z arredondados, do jeito que normalize.mjs vai ler
  });
}

console.log('id     | ANTES (x,y,z)              | DEPOIS (x,y,z)             | tombo antes | tombo depois (real, arredondado)');
console.log('-------|----------------------------|----------------------------|-------------|------------------------');
for (const r of results) {
  const o = `${r.old.x}, ${r.old.y}, ${r.old.z}`;
  const n = `${r.new.x}, ${r.new.y}, ${r.new.z}`;
  console.log(`${r.id}  | ${o.padEnd(26)} | ${n.padEnd(26)} | ${String(r.tiltX_before + '°').padStart(10)} | ${r.tiltX_roundtrip}°`);
}

writeFileSync(
  resolve(HERE, 'tilt-check/proposed-correction.json'),
  JSON.stringify(Object.fromEntries(results.map(r => [r.id, r])), null, 2)
);
console.log(`\n${results.length} produtos com correção calculada (excluídos por medição ambígua: ${EXCLUDED.join(', ')}).`);
console.log('Valores propostos salvos em scripts/prado-rescue/tilt-check/proposed-correction.json (arquivo NOVO, fora do pipeline — overrides.json real não foi tocado).');

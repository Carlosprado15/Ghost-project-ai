// PREVIEW — gera GLBs normalizados de teste em scripts/prado-rescue/tilt-check/preview-normalized/
// usando os x/y/z CORRIGIDOS (não os do overrides.json real), pra comparar
// visualmente antes de decidir se aplica de verdade. NÃO escreve em
// public/models/normalized/, NÃO toca em overrides.json.
import { NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { draco } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const SRC_DIR = resolve(ROOT, 'public/models');
const OUT_DIR = resolve(HERE, 'tilt-check/preview-normalized');
mkdirSync(OUT_DIR, { recursive: true });

const OVERRIDES = JSON.parse(readFileSync(resolve(ROOT, 'scripts/normalize-glb/product-calibration-overrides.json'), 'utf8'));
const proposed = JSON.parse(readFileSync(resolve(HERE, 'tilt-check/proposed-correction.json'), 'utf8'));

const TARGET_MAX_DIM = { watch: 0.08, bracelet: 0.07 };
const EXAMPLES = ['CW001', 'CW014', 'CW007']; // menor, médio, maior ajuste

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

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
  'draco3d.encoder': await draco3d.createEncoderModule(),
});

for (const id of EXAMPLES) {
  const doc = await io.read(resolve(SRC_DIR, `${id}.glb`));
  const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];
  const ov = OVERRIDES[id];
  const type = ov.type === 'bracelet' ? 'bracelet' : 'watch';
  const rd = proposed[id].new; // <-- ÚNICA diferença vs normalize.mjs real: usa o x/y/z CORRIGIDO

  let rot = [0, 0, 0, 1];
  if (rd.x) rot = quatMul(quatAboutAxis('x', rd.x), rot);
  if (rd.y) rot = quatMul(quatAboutAxis('y', rd.y), rot);
  if (rd.z) rot = quatMul(quatAboutAxis('z', rd.z), rot);
  if (ov.flip180Y) rot = quatMul([0, 1, 0, 0], rot);
  if (ov.flip180Z) rot = quatMul([0, 0, 1, 0], rot);

  const wrapper = doc.createNode('AR_NORMALIZED').setRotation(rot);
  for (const child of scene.listChildren()) { scene.removeChild(child); wrapper.addChild(child); }
  scene.addChild(wrapper);

  const b1 = getBounds(scene);
  const size = [b1.max[0] - b1.min[0], b1.max[1] - b1.min[1], b1.max[2] - b1.min[2]];
  const center = [(b1.min[0] + b1.max[0]) / 2, (b1.min[1] + b1.max[1]) / 2, (b1.min[2] + b1.max[2]) / 2];
  const s = (TARGET_MAX_DIM[type] / Math.max(...size)) * (ov.scale ?? 1);
  const off = ov.offset ?? { x: 0, y: 0, z: 0 };
  wrapper.setScale([s, s, s]).setTranslation([-s * center[0] + (off.x ?? 0), -s * center[1] + (off.y ?? 0), -s * center[2] + (off.z ?? 0)]);

  await doc.transform(draco());
  await io.write(resolve(OUT_DIR, `${id}.glb`), doc);
  console.log(`${id}: preview gerado com rotationDeg corrigido (${JSON.stringify(rd)})`);
}

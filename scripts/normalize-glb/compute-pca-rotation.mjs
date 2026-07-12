/**
 * compute-pca-rotation.mjs — calcula a rotação inicial de cada produto via PCA
 * (orientation.mjs) e escreve rotationDeg direto no overrides.json.
 *
 * Não é um passo escondido no pipeline (normalize.mjs continua só lendo o
 * overrides.json) — é uma calculadora que roda uma vez, offline, pra gerar um
 * bom PONTO DE PARTIDA em vez de girar os 11 produtos no escuro. Ambiguidade
 * de sinal da PCA (12h/6h, frente/costas) fica pro flip180Y/flip180Z manual
 * depois de olhar o render.
 *
 * Uso: node scripts/normalize-glb/compute-pca-rotation.mjs CW001 CW002 ...
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeMeshPCA, computeAlignmentQuat, quatRotate } from './orientation.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const SRC_DIR = resolve(ROOT, 'public/models');
const OVERRIDES_PATH = resolve(HERE, 'product-calibration-overrides.json');

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

function quatToEulerZYXExtrinsic(q) {
  // R = Rz * Ry * Rx  (mesma ordem de composição do normalize.mjs: x→y→z)
  const colX = quatRotate(q, [1, 0, 0]);
  const colY = quatRotate(q, [0, 1, 0]);
  const colZ = quatRotate(q, [0, 0, 1]);
  const R20 = colX[2], R21 = colY[2], R22 = colZ[2];
  const R10 = colX[1], R00 = colX[0];
  const beta = Math.asin(Math.max(-1, Math.min(1, -R20)));
  const alpha = Math.atan2(R21, R22);
  const gamma = Math.atan2(R10, R00);
  const toDeg = (r) => r * 180 / Math.PI;
  return { x: toDeg(alpha), y: toDeg(beta), z: toDeg(gamma) };
}

async function main() {
  const ids = process.argv.slice(2);
  if (!ids.length) { console.error('Uso: node compute-pca-rotation.mjs CW001 ...'); process.exit(1); }

  const overrides = JSON.parse(readFileSync(OVERRIDES_PATH, 'utf8'));

  for (const id of ids) {
    const srcPath = resolve(SRC_DIR, `${id}.glb`);
    const doc = await io.read(srcPath);
    const pca = computeMeshPCA(doc);
    const type = overrides[id]?.type === 'bracelet' ? 'bracelet' : 'watch';
    const q = computeAlignmentQuat(pca, type);
    const deg = quatToEulerZYXExtrinsic(q);
    const rounded = { x: Math.round(deg.x * 10) / 10, y: Math.round(deg.y * 10) / 10, z: Math.round(deg.z * 10) / 10 };

    overrides[id] = {
      ...overrides[id],
      rotationDeg: rounded,
      flip180Y: false,
      flip180Z: false,
      status: 'needs_calibration',
    };
    console.log(`${id} (${type}) → rotationDeg`, rounded);
  }

  writeFileSync(OVERRIDES_PATH, JSON.stringify(overrides, null, 2));
  console.log('\noverrides.json atualizado.');
}

main();

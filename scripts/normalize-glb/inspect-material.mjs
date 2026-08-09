/**
 * inspect-material.mjs — mostra os valores de material PBR de um GLB, sem
 * alterar nada. Feito pra diagnosticar o "brilho de plástico espelhado"
 * reportado no Foxbox: modelos gerados por Tripo3D costumam sair com
 * metallicFactor alto + roughnessFactor baixo, o que produz reflexo duro
 * (espelhado) em vez de metal escovado realista.
 *
 * Uso:
 *   node scripts/normalize-glb/inspect-material.mjs <arquivo.glb>
 *   node scripts/normalize-glb/inspect-material.mjs public/models/TEST-FOXBOX-RAW.glb
 */

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { resolve } from 'node:path';

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Uso: node inspect-material.mjs <arquivo.glb>');
  process.exit(1);
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(resolve(inputPath));

const materials = doc.getRoot().listMaterials();
console.log(`\n${inputPath}`);
console.log(`${materials.length} material(is) encontrado(s):\n`);

for (const mat of materials) {
  const metallicRoughnessTex = mat.getMetallicRoughnessTexture();
  console.log(`— ${mat.getName() || '(sem nome)'}`);
  console.log(`  baseColorFactor:         [${mat.getBaseColorFactor().map((v) => v.toFixed(3)).join(', ')}]`);
  console.log(`  metallicFactor:          ${mat.getMetallicFactor().toFixed(3)}`);
  console.log(`  roughnessFactor:         ${mat.getRoughnessFactor().toFixed(3)}`);
  console.log(`  metallicRoughnessTexture: ${metallicRoughnessTex ? `sim (${metallicRoughnessTex.getSize()?.join('x') ?? '?'})` : 'não'}`);
  console.log(`  emissiveFactor:          [${mat.getEmissiveFactor().map((v) => v.toFixed(3)).join(', ')}]`);
  console.log('');
}

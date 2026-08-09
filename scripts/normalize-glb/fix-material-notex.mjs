/**
 * fix-material-notex.mjs — remove a metallicRoughnessTexture e deixa só os
 * factors valendo, sem tocar no arquivo original.
 *
 * Por quê: no glTF, o canal verde da metallicRoughnessTexture guarda
 * roughness e o azul guarda metallic — os factors (metallicFactor/
 * roughnessFactor) só MULTIPLICAM em cima desses valores por pixel. O
 * TEST-FOXBOX-RAW.glb já tem roughnessFactor no teto (1.0) e ainda assim
 * fica espelhado — ou seja, a própria textura tem regiões de baixo
 * roughness (brilhantes) que nenhum ajuste de fator resolve (ver
 * fix-material.mjs e inspect-material.mjs). Removendo a textura, os
 * factors passam a ser o valor final, uniforme, em toda a superfície.
 *
 * IMPORTANTE: isso só remove o mapa de BRILHO. A baseColorTexture (cor/
 * desenho do mostrador, números, logo) é preservada — sem ela o produto
 * ficaria sem identidade visual nenhuma.
 *
 * Uso:
 *   node fix-material-notex.mjs <entrada.glb> <saida.glb>
 *   METALLIC=0.45 ROUGHNESS=0.65 node fix-material-notex.mjs <entrada.glb> <saida.glb>
 *
 * Saída: public/models/material-fixed/<nome-saida>.glb — nunca sobrescreve
 * a entrada.
 */

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, statSync } from 'node:fs';

// ── Constantes ajustáveis (sobrescrevíveis via env: METALLIC= / ROUGHNESS=) ─
// Sem textura, esses valores valem sozinhos e uniformemente em toda a
// superfície. Metal escovado real fica perto de metallic 0.3-0.5,
// roughness 0.5-0.7 — mude e rode de novo pra comparar em ?lab=material-ab.
const METALLIC  = Number(process.env.METALLIC  ?? 0.45);
const ROUGHNESS = Number(process.env.ROUGHNESS ?? 0.65);

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const OUT_DIR = resolve(ROOT, 'public/models/material-fixed');

const inputArg = process.argv[2];
const outNameArg = process.argv[3];
if (!inputArg || !outNameArg) {
  console.error('Uso: node fix-material-notex.mjs <entrada.glb> <saida.glb>');
  process.exit(1);
}

const inputPath = resolve(inputArg);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(inputPath);

console.log(`\nLendo: ${inputPath}`);
console.log(`Alvo: metallic=${METALLIC} roughness=${ROUGHNESS}`);

for (const mat of doc.getRoot().listMaterials()) {
  const hadMRTexture = Boolean(mat.getMetallicRoughnessTexture());
  const hadBaseColorTexture = Boolean(mat.getBaseColorTexture());

  console.log(`\n— ${mat.getName() || '(sem nome)'}`);
  console.log(`  metallicRoughnessTexture: ${hadMRTexture ? 'removendo' : 'não tinha'}`);
  console.log(`  baseColorTexture:         ${hadBaseColorTexture ? 'preservando' : 'não tinha'}`);

  mat.setMetallicRoughnessTexture(null);
  mat.setMetallicFactor(METALLIC);
  mat.setRoughnessFactor(ROUGHNESS);
  // baseColorTexture não é tocada — segue exatamente como estava.
}

mkdirSync(OUT_DIR, { recursive: true });
const outPath = resolve(OUT_DIR, outNameArg);
await io.write(outPath, doc);

// Confere no arquivo escrito (não só no doc em memória) que a baseColorTexture sobreviveu.
const check = await io.read(outPath);
const stillHasBaseColor = check.getRoot().listMaterials().every((m) => Boolean(m.getBaseColorTexture()));
const stillHasMRTexture = check.getRoot().listMaterials().some((m) => Boolean(m.getMetallicRoughnessTexture()));

const size = statSync(outPath).size;
console.log(`\n✅ salvo: ${outPath}`);
console.log(`   tamanho: ${(size / 1024).toFixed(1)} KB`);
console.log(`   baseColorTexture preservada no arquivo final: ${stillHasBaseColor ? 'SIM' : 'NÃO — problema!'}`);
console.log(`   metallicRoughnessTexture ainda presente: ${stillHasMRTexture ? 'SIM — remoção falhou!' : 'não (removida com sucesso)'}`);
console.log(`   original NÃO foi tocado: ${inputPath}`);

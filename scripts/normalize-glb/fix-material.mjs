/**
 * fix-material.mjs — corrige o material PBR de um GLB pra parecer metal
 * escovado em vez de plástico espelhado, sem tocar no arquivo original.
 *
 * Por quê: modelos gerados por Tripo3D costumam sair com metallicFactor
 * alto e roughnessFactor baixo — isso produz reflexo duro/espelhado em vez
 * de metal realista. Este script só ajusta o FATOR (multiplicador) do
 * material; se o material já tiver uma textura metallicRoughness (comum
 * nesses modelos), o fator multiplica em cima do valor da textura — ou
 * seja, essa correção pode não ser suficiente sozinha se a própria textura
 * já tiver regiões muito reflexivas. Ver inspect-material.mjs pra checar.
 *
 * Uso:
 *   node scripts/normalize-glb/fix-material.mjs <arquivo-de-entrada.glb> [nome-saida.glb]
 *   METALLIC_MAX=0.25 node scripts/normalize-glb/fix-material.mjs <entrada.glb> <saida.glb>
 *
 * Saída: public/models/material-fixed/<nome-saida ou mesmo-nome-da-entrada>.glb
 * — nunca sobrescreve o arquivo de entrada. Os alvos padrão (METALLIC_TARGET/
 * ROUGHNESS_TARGET abaixo) podem ser sobrescritos nessa mesma chamada via
 * variáveis de ambiente METALLIC_MAX / ROUGHNESS_MIN, sem editar o arquivo —
 * útil pra gerar variantes de comparação (ex.: TEST-FOXBOX-M025.glb).
 */

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { resolve, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, statSync } from 'node:fs';

// ── Constantes ajustáveis ────────────────────────────────────────────────
// Metal escovado realista fica em torno de metallic ~0.5-0.7 e roughness
// ~0.4-0.6. Só corrige se o valor atual estiver "pior" que o alvo (não
// força pra baixo/cima produtos que já estejam ok) — mude os números
// abaixo se o resultado ainda ficar espelhado ou ficar fosco demais.
const METALLIC_TARGET  = Number(process.env.METALLIC_MAX  ?? 0.6);  // teto: se metallicFactor > isso, reduz até aqui
const ROUGHNESS_TARGET = Number(process.env.ROUGHNESS_MIN ?? 0.55); // piso: se roughnessFactor < isso, aumenta até aqui

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const OUT_DIR = resolve(ROOT, 'public/models/material-fixed');

const inputArg = process.argv[2];
const outNameArg = process.argv[3];
if (!inputArg) {
  console.error('Uso: node fix-material.mjs <arquivo-de-entrada.glb> [nome-saida.glb]');
  process.exit(1);
}

const inputPath = resolve(inputArg);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(inputPath);

console.log(`\nLendo: ${inputPath}`);

let changed = 0;
for (const mat of doc.getRoot().listMaterials()) {
  const metallic  = mat.getMetallicFactor();
  const roughness = mat.getRoughnessFactor();
  const emissive  = mat.getEmissiveFactor();
  const hasEmissive = emissive.some((v) => v !== 0);

  console.log(`— ${mat.getName() || '(sem nome)'}`);
  console.log(`  metallic:  ${metallic.toFixed(3)} -> ${metallic > METALLIC_TARGET ? METALLIC_TARGET.toFixed(3) : metallic.toFixed(3)}`);
  console.log(`  roughness: ${roughness.toFixed(3)} -> ${roughness < ROUGHNESS_TARGET ? ROUGHNESS_TARGET.toFixed(3) : roughness.toFixed(3)}`);
  console.log(`  emissive:  [${emissive.join(', ')}] -> ${hasEmissive ? '[0, 0, 0]' : '(sem mudança)'}`);

  if (metallic > METALLIC_TARGET) { mat.setMetallicFactor(METALLIC_TARGET); changed++; }
  if (roughness < ROUGHNESS_TARGET) { mat.setRoughnessFactor(ROUGHNESS_TARGET); changed++; }
  if (hasEmissive) { mat.setEmissiveFactor([0, 0, 0]); changed++; }
}

mkdirSync(OUT_DIR, { recursive: true });
const outPath = resolve(OUT_DIR, outNameArg || basename(inputPath));
await io.write(outPath, doc);

const size = statSync(outPath).size;
console.log(`\n✅ salvo: ${outPath}`);
console.log(`   tamanho: ${(size / 1024).toFixed(1)} KB`);
console.log(`   ajustes aplicados: ${changed}`);
console.log(`   original NÃO foi tocado: ${inputPath}`);

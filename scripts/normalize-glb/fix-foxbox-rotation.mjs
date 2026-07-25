/**
 * fix-foxbox-rotation.mjs — correção pontual de orientação para o teste de
 * afiliado Shopee (public/models/TEST-FOXBOX-RAW.glb).
 *
 * Contexto: o motor ANTIGO (src/tracking/ + App_FINAL.jsx), que é o que está
 * ativo na loja hoje, NÃO lê product-calibration-overrides.json nem usa
 * public/models/normalized/*.glb. Ele aplica uma transformação FIXA e igual
 * para todos os produtos, direto em cima do arquivo bruto:
 *   camera-orbit="0deg 78deg 105%"  orientation="0deg 0deg -90deg"  scale="2 2 2"
 * (ver src/App_FINAL.jsx, <model-viewer> por volta da linha 1579).
 *
 * Este script envolve a cena do GLB bruto num nó-pai com uma rotação extra
 * (mesmo método do normalize.mjs: TRS num wrapper node, malha original
 * intocada) e SOBRESCREVE public/models/TEST-FOXBOX-RAW.glb — sempre lendo
 * a partir do backup, nunca do resultado de uma rodada anterior, para evitar
 * acumular rotação.
 *
 * IMPORTANTE — resultado da investigação de 2026-07-14: renderizando
 * TEST-FOXBOX-RAW.glb com exatamente essa transformação fixa (mesma versão
 * do model-viewer da produção, 3.4.0), o relógio já aparece corretamente em
 * pé (12 em cima, 6 embaixo, mostrador de frente, coroa à direita, pulseira
 * vertical) — bateu com a foto de referência (C:\Users\Bi\Pictures\shopee.jpg).
 * Não foi necessária nenhuma correção (rx=ry=rz=0 por padrão aqui). A
 * inclinação "torto, tipo 2:45" relatada no teste ao vivo no celular é mais
 * provável de vir do CSS `rotateZ(watch.rotation)` que RenderPipeline.js/
 * App_FINAL.jsx aplicam por cima do model-viewer, calculado a partir do
 * ângulo real do antebraço detectado por MediaPipe naquele momento
 * (src/tracking/WristTracker.js: watchRotation = atan2(...) + watchRotationOffset,
 * offset fixo -90 igual para todos os produtos) — não do arquivo .glb em si.
 * Esse mecanismo é o MESMO para todos os produtos e depende de como o pulso
 * estava posicionado no exato momento do teste, não é uma propriedade do modelo.
 *
 * Se uma nova comparação (foto real vs. render) mostrar que ainda falta
 * correção, rode:
 *   node scripts/normalize-glb/fix-foxbox-rotation.mjs <rx> <ry> <rz>
 * (graus, aplicados em eixos de mundo X→Y→Z, mesmo método do normalize.mjs).
 * Sem argumentos, roda com 0/0/0 (idempotente, sempre a partir do backup).
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { copyFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const RAW    = resolve(ROOT, 'public/models/TEST-FOXBOX-RAW.glb');
const BACKUP = resolve(ROOT, 'public/models/TEST-FOXBOX-RAW.backup.glb');

if (!existsSync(BACKUP)) {
  if (!existsSync(RAW)) throw new Error(`Nem o backup nem o raw existem: ${RAW}`);
  copyFileSync(RAW, BACKUP);
  console.log(`Backup criado: ${BACKUP}`);
}

const [, , rxArg, ryArg, rzArg] = process.argv;
const rx = Number(rxArg ?? 0);
const ry = Number(ryArg ?? 0);
const rz = Number(rzArg ?? 0);

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

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
// Sempre a partir do backup — nunca do RAW já processado, para não acumular rotação.
const doc = await io.read(BACKUP);
const scene = doc.getRoot().getDefaultScene() ?? doc.getRoot().listScenes()[0];

let rot = [0, 0, 0, 1];
if (rx) rot = quatMul(quatAboutAxis('x', rx), rot);
if (ry) rot = quatMul(quatAboutAxis('y', ry), rot);
if (rz) rot = quatMul(quatAboutAxis('z', rz), rot);

const wrapper = doc.createNode('FOXBOX_FIX').setRotation(rot);
for (const child of scene.listChildren()) {
  scene.removeChild(child);
  wrapper.addChild(child);
}
scene.addChild(wrapper);

await io.write(RAW, doc);
console.log(`rx=${rx} ry=${ry} rz=${rz} aplicado a partir do backup -> ${RAW}`);

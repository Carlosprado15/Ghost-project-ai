/**
 * generate-from-photo.mjs — gera um GLB a partir de uma foto que está no disco,
 * sem exigir que o produto exista em src/data/products.json.
 *
 * Por quê: generate-from-tripo.mjs só sabe gerar produtos do catálogo (ele
 * procura o id em products.json pra achar a foto). Produtos de teste e de
 * lojas parceiras que ainda não entraram no catálogo — o Foxbox do teste da
 * Shopee é o primeiro caso — não têm entrada lá, e não devem ter: o catálogo
 * é de outra loja. Este script cobre esse caso sem misturar as duas coisas.
 *
 * Diferença de custo em relação ao generate-from-tripo.mjs: aqui a limpeza
 * do Photoroom é OPCIONAL (--limpar). Fotos de anúncio que já vêm com fundo
 * branco e o produto de frente não precisam dela — só da padronização local
 * (1024x1024, centralizado), que é de graça.
 *
 * Uso:
 *   node scripts/normalize-glb/generate-from-photo.mjs <foto> <ID> [watch|bracelet] [--limpar]
 *
 * Exemplo:
 *   node scripts/normalize-glb/generate-from-photo.mjs C:/Users/Bi/Pictures/shopee.jpg TEST-FOXBOX-RAW watch
 *
 * Saída: public/models/<ID>.glb (o arquivo antigo é preservado em
 * public/models/_pre_tripo_regen_backup/, com sufixo de data se já houver um).
 *
 * Requer TRIPO_API_KEY em .env.local. Mesma configuração de qualidade do
 * generate-from-tripo.mjs (~60 créditos por produto).
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { standardizeOne } from './standardize-images.mjs';
import { prepareForGeneration } from './prepare-for-3d.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const MODELS_DIR = resolve(ROOT, 'public/models');
const BACKUP_DIR = resolve(MODELS_DIR, '_pre_tripo_regen_backup');
const PREPARED_DIR = resolve(HERE, 'prepared');

const TRIPO_BASE = 'https://openapi.tripo3d.ai/v3';

// Mesma config de "melhor qualidade" combinada em 2026-07-09 (ver generate-from-tripo.mjs)
const GEN_OPTIONS = {
  model: 'v3.1-20260211',
  texture: true,
  pbr: true,
  texture_quality: 'detailed',
  geometry_quality: 'detailed',
  orientation: 'align_image',
  enable_image_autofix: true,
};

function loadApiKey() {
  const content = readFileSync(resolve(ROOT, '.env.local'), 'utf8');
  for (const line of content.split('\n')) {
    const m = line.match(/^TRIPO_API_KEY=(.+)$/);
    if (m) return m[1].trim();
  }
  throw new Error('TRIPO_API_KEY não encontrada em .env.local');
}

const headers = (apiKey) => ({ Authorization: `Bearer ${apiKey}` });

async function uploadFile(apiKey, filePath) {
  const form = new FormData();
  form.append('file', new Blob([readFileSync(filePath)], { type: 'image/png' }), 'entrada.png');
  const res = await fetch(`${TRIPO_BASE}/files`, { method: 'POST', headers: headers(apiKey), body: form });
  const data = await res.json();
  if (data.code !== 0) throw new Error(`Upload falhou: ${data.message} (code ${data.code})`);
  return data.data.file_token;
}

async function submitTask(apiKey, fileToken) {
  const res = await fetch(`${TRIPO_BASE}/generation/image-to-model`, {
    method: 'POST',
    headers: { ...headers(apiKey), 'Content-Type': 'application/json' },
    body: JSON.stringify({ file: { type: 'png', file_token: fileToken }, ...GEN_OPTIONS }),
  });
  const data = await res.json();
  if (data.code !== 0) throw new Error(`Tripo submit falhou: ${data.message} (code ${data.code})`);
  return data.data.task_id;
}

async function pollTask(apiKey, taskId, { intervalMs = 4000, maxAttempts = 120 } = {}) {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(`${TRIPO_BASE}/tasks/${taskId}`, { headers: headers(apiKey) });
    const data = await res.json();
    const { status, progress = 0, output } = data.data;
    console.log(`  [${taskId}] ${status} — ${progress}%`);
    if (status === 'success') return output.model_url;
    if (['failed', 'cancelled', 'banned'].includes(status)) {
      throw new Error(`Tripo terminou com status ${status}`);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Timeout esperando a task ${taskId}`);
}

async function main() {
  const args = process.argv.slice(2);
  const limpar = args.includes('--limpar');
  const [foto, id, tipo = 'watch'] = args.filter((a) => a !== '--limpar');

  if (!foto || !id) {
    console.error('Uso: node generate-from-photo.mjs <foto> <ID> [watch|bracelet] [--limpar]');
    process.exit(1);
  }
  if (!existsSync(foto)) throw new Error(`Foto não encontrada: ${foto}`);

  const apiKey = loadApiKey();
  const destino = resolve(MODELS_DIR, `${id}.glb`);

  // Nunca perder o arquivo anterior, mesmo que ele esteja errado.
  if (existsSync(destino)) {
    mkdirSync(BACKUP_DIR, { recursive: true });
    const carimbo = new Date().toISOString().slice(0, 10);
    let backup = resolve(BACKUP_DIR, `${id}.glb`);
    if (existsSync(backup)) backup = resolve(BACKUP_DIR, `${id}.${carimbo}.glb`);
    copyFileSync(destino, backup);
    console.log(`Backup do arquivo atual: ${backup}`);
  }

  let preparada;
  if (limpar) {
    console.log('Preparando foto (limpar fundo + endireitar + padronizar)...');
    preparada = await prepareForGeneration(foto, id, tipo);
  } else {
    console.log('Padronizando foto (1024x1024, centralizada, fundo branco)...');
    mkdirSync(PREPARED_DIR, { recursive: true });
    preparada = resolve(PREPARED_DIR, `${id}.png`);
    await standardizeOne(foto, preparada);
  }
  console.log(`Foto que vai pra Tripo3D: ${preparada}`);

  console.log('Enviando...');
  const fileToken = await uploadFile(apiKey, preparada);
  const taskId = await submitTask(apiKey, fileToken);
  console.log(`Task criada: ${taskId}`);

  const modelUrl = await pollTask(apiKey, taskId);
  const res = await fetch(modelUrl);
  if (!res.ok) throw new Error(`Download do GLB falhou: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(destino, buf);
  console.log(`✅ salvo: public/models/${id}.glb (${(buf.length / 1024 / 1024).toFixed(2)} MB)`);
}

main().catch((err) => {
  console.error('❌', err.message);
  process.exit(1);
});

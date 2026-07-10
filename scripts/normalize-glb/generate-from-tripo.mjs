/**
 * generate-from-tripo.mjs — gera/repõe o GLB de um produto direto da foto real
 * cadastrada em src/data/products.json, usando a API Tripo3D (image-to-model).
 *
 * Por quê: em 2026-07-09 descobrimos que boa parte dos GLBs em public/models/
 * não correspondem ao produto real (arquivo errado, não erro de calibração).
 * Este script fecha esse buraco de vez: sempre que precisar de um modelo novo,
 * ele nasce da MESMA foto que está na loja — não depende de olho humano pra
 * "parecer certo".
 *
 * Uso:
 *   node scripts/normalize-glb/generate-from-tripo.mjs CW006 CW007 ...
 *   node scripts/normalize-glb/generate-from-tripo.mjs --all-pending   (todos os "needs_new_model")
 *
 * Requer TRIPO_API_KEY em .env.local (conta com créditos).
 * Configuração "melhor qualidade": modelo v3.1, textura HD, geometria HD,
 * orientação alinhada à foto de entrada — ~60 créditos (~US$0,60) por produto.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const MODELS_DIR = resolve(ROOT, 'public/models');
const BACKUP_DIR = resolve(MODELS_DIR, '_pre_tripo_regen_backup');
const PRODUCTS_PATH = resolve(ROOT, 'src/data/products.json');

const TRIPO_BASE = 'https://openapi.tripo3d.ai/v3';
const MODEL_VERSION = 'v3.1-20260211';

// ── Config de "melhor qualidade" (combinado com Carlinhos em 2026-07-09) ────
const GEN_OPTIONS = {
  model: MODEL_VERSION,
  texture: true,
  pbr: true,
  texture_quality: 'detailed',   // HD — +10 créditos sobre o padrão
  geometry_quality: 'detailed',  // HD — +20 créditos sobre o padrão
  orientation: 'align_image',    // alinha o modelo ao ângulo da própria foto
};

function loadApiKey() {
  const envPath = resolve(ROOT, '.env.local');
  const content = readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const m = line.match(/^TRIPO_API_KEY=(.+)$/);
    if (m) return m[1].trim();
  }
  throw new Error('TRIPO_API_KEY não encontrada em .env.local');
}

function headers(apiKey) {
  return { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
}

async function submitTask(apiKey, imageUrl) {
  const res = await fetch(`${TRIPO_BASE}/generation/image-to-model`, {
    method: 'POST',
    headers: headers(apiKey),
    body: JSON.stringify({ input: imageUrl, ...GEN_OPTIONS }),
  });
  const data = await res.json();
  if (data.code !== 0) throw new Error(`Tripo submit falhou: ${data.message} (code ${data.code})`);
  return data.data.task_id;
}

async function pollTask(apiKey, taskId, { intervalMs = 4000, maxAttempts = 90 } = {}) {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(`${TRIPO_BASE}/tasks/${taskId}`, { headers: headers(apiKey) });
    const data = await res.json();
    const { status, progress = 0, output } = data.data;
    console.log(`  [${taskId}] ${status} — ${progress}%`);
    if (status === 'success') return output.model_url;
    if (['failed', 'cancelled', 'banned'].includes(status)) {
      throw new Error(`Tripo task ${taskId} terminou com status ${status}`);
    }
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error(`Timeout esperando task ${taskId}`);
}

async function downloadGlb(url, outPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download falhou: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(outPath, buf);
  return buf.length;
}

async function generateOne(apiKey, id, imageUrl) {
  console.log(`\n=== ${id} ===`);
  const srcPath = resolve(MODELS_DIR, `${id}.glb`);

  // backup do arquivo atual (mesmo que já esteja errado — nunca perder histórico)
  if (existsSync(srcPath)) {
    mkdirSync(BACKUP_DIR, { recursive: true });
    const backupPath = resolve(BACKUP_DIR, `${id}.glb`);
    if (!existsSync(backupPath)) copyFileSync(srcPath, backupPath);
  }

  const taskId = await submitTask(apiKey, imageUrl);
  console.log(`  task criada: ${taskId}`);
  const modelUrl = await pollTask(apiKey, taskId);
  const bytes = await downloadGlb(modelUrl, srcPath);
  console.log(`  ✅ salvo em public/models/${id}.glb (${(bytes / 1024 / 1024).toFixed(2)} MB)`);
}

async function main() {
  const args = process.argv.slice(2);
  const apiKey = loadApiKey();
  const products = JSON.parse(readFileSync(PRODUCTS_PATH, 'utf8'));

  let targets;
  if (args.includes('--all-pending')) {
    // os 10 que ainda usam arquivo trocado (ver diagnóstico de 2026-07-09)
    targets = ['CW006','CW007','CW008','CW009','CW010','CW011','CW012','CW013','CW014','CW015'];
  } else if (args.length) {
    targets = args;
  } else {
    console.error('Uso: node generate-from-tripo.mjs <CW006 CW007 ...> | --all-pending');
    process.exit(1);
  }

  for (const id of targets) {
    const product = products.find(p => p.id === id);
    if (!product) { console.error(`Produto ${id} não encontrado em products.json`); continue; }
    try {
      await generateOne(apiKey, id, product.imageUrl);
    } catch (err) {
      console.error(`  ❌ ${id} falhou: ${err.message}`);
    }
  }

  console.log('\nPróximo passo: node scripts/normalize-glb/normalize.mjs (regera os normalizados)');
  console.log('Depois: script de comparação visual antes de aprovar.');
}

main();

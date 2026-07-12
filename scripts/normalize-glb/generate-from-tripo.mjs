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
 * 2026-07-11: as fotos em products.json são fotos "de vitrine" (produto no
 * pulso, com manga/fundo). Mandar isso direto pra Tripo3D faz ela reconstruir
 * a CENA INTEIRA em 3D (pulso e manga esculpidos junto com o relógio) — no
 * app real isso vira um "braço fantasma" grudado no braço de verdade do
 * cliente. Por isso, antes de gerar, a foto passa por uma limpeza automática
 * (scripts/normalize-glb/clean_bg.py, modelo u2net via rembg) que isola só o
 * produto. Isso é permanente: lojas parceiras futuras não vão mandar foto
 * pré-recortada, então essa limpeza precisa acontecer sempre, sem depender de
 * escolha manual de foto. Requer Python 3 com `pip install rembg onnxruntime`.
 * Limitação conhecida: marca d'água that fica ENCIMA do produto (não no
 * fundo) não é removida por esse método — só resolve fundo/contexto (pulso,
 * manga, mesa, etc).
 *
 * Uso:
 *   node scripts/normalize-glb/generate-from-tripo.mjs CW006 CW007 ...
 *   node scripts/normalize-glb/generate-from-tripo.mjs --all-pending   (todos os "needs_new_model")
 *   node scripts/normalize-glb/generate-from-tripo.mjs --raw CW006     (pula a limpeza, manda a foto crua)
 *
 * Requer TRIPO_API_KEY em .env.local (conta com créditos).
 * Configuração "melhor qualidade": modelo v3.1, textura HD, geometria HD,
 * orientação alinhada à foto de entrada — ~60 créditos (~US$0,60) por produto.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const MODELS_DIR = resolve(ROOT, 'public/models');
const BACKUP_DIR = resolve(MODELS_DIR, '_pre_tripo_regen_backup');
const CLEANED_DIR = resolve(HERE, 'qa-output', '_cleaned_input');
const PRODUCTS_PATH = resolve(ROOT, 'src/data/products.json');
const CLEAN_SCRIPT = resolve(HERE, 'clean_bg.py');

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
  enable_image_autofix: true,    // otimização de imagem da própria Tripo3D — sem custo extra, roda em cima da nossa limpeza local
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
  return { Authorization: `Bearer ${apiKey}` };
}

async function downloadImage(imageUrl, outPath) {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Download da foto falhou: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(outPath, buf);
}

// Isola o produto (remove pulso/manga/fundo) via clean_bg.py (rembg, modelo u2net).
function cleanImage(inPath, outPath) {
  const result = spawnSync('python', [CLEAN_SCRIPT, inPath, outPath], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`Limpeza de fundo falhou: ${result.stderr || result.error?.message}`);
  }
}

async function uploadFile(apiKey, filePath) {
  const buf = readFileSync(filePath);
  const form = new FormData();
  form.append('file', new Blob([buf], { type: 'image/png' }), 'cleaned.png');
  const res = await fetch(`${TRIPO_BASE}/files`, {
    method: 'POST',
    headers: headers(apiKey),
    body: form,
  });
  const data = await res.json();
  if (data.code !== 0) throw new Error(`Upload falhou: ${data.message} (code ${data.code})`);
  return data.data.file_token;
}

async function submitTask(apiKey, { imageUrl, fileToken }) {
  const body = fileToken
    ? { file: { type: 'png', file_token: fileToken }, ...GEN_OPTIONS }
    : { input: imageUrl, ...GEN_OPTIONS };
  const res = await fetch(`${TRIPO_BASE}/generation/image-to-model`, {
    method: 'POST',
    headers: { ...headers(apiKey), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
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

async function generateOne(apiKey, id, imageUrl, { raw = false } = {}) {
  console.log(`\n=== ${id} ===`);
  const srcPath = resolve(MODELS_DIR, `${id}.glb`);

  // backup do arquivo atual (mesmo que já esteja errado — nunca perder histórico)
  if (existsSync(srcPath)) {
    mkdirSync(BACKUP_DIR, { recursive: true });
    const backupPath = resolve(BACKUP_DIR, `${id}.glb`);
    if (!existsSync(backupPath)) copyFileSync(srcPath, backupPath);
  }

  let fileToken;
  const localMappedPath = resolve(HERE, 'fotos-limpas', `${id}.png`);
  if (!raw && existsSync(localMappedPath)) {
    // já é uma foto de fornecedor pré-limpa (2026-07-11) — só passa mais uma
    // vez pelo clean_bg.py pra garantir (idempotente) e sobe direto.
    mkdirSync(CLEANED_DIR, { recursive: true });
    const cleanPath = resolve(CLEANED_DIR, `${id}_clean.png`);
    console.log(`  usando foto de fornecedor já mapeada: fotos-limpas/${id}.png`);
    cleanImage(localMappedPath, cleanPath);
    fileToken = await uploadFile(apiKey, cleanPath);
    console.log(`  conferir em: scripts/normalize-glb/qa-output/_cleaned_input/${id}_clean.png`);
  } else if (!raw) {
    mkdirSync(CLEANED_DIR, { recursive: true });
    const rawPath = resolve(CLEANED_DIR, `${id}_raw.jpg`);
    const cleanPath = resolve(CLEANED_DIR, `${id}_clean.png`);
    console.log('  baixando foto original...');
    await downloadImage(imageUrl, rawPath);
    console.log('  limpando (removendo pulso/manga/fundo)...');
    cleanImage(rawPath, cleanPath);
    console.log('  enviando foto limpa pra Tripo3D...');
    fileToken = await uploadFile(apiKey, cleanPath);
    console.log(`  conferir em: scripts/normalize-glb/qa-output/_cleaned_input/${id}_clean.png`);
  }

  const taskId = await submitTask(apiKey, { imageUrl, fileToken });
  console.log(`  task criada: ${taskId}`);
  const modelUrl = await pollTask(apiKey, taskId);
  const bytes = await downloadGlb(modelUrl, srcPath);
  console.log(`  ✅ salvo em public/models/${id}.glb (${(bytes / 1024 / 1024).toFixed(2)} MB)`);
}

async function main() {
  const args = process.argv.slice(2);
  const raw = args.includes('--raw');
  const targetArgs = args.filter(a => a !== '--raw');
  const apiKey = loadApiKey();
  const products = JSON.parse(readFileSync(PRODUCTS_PATH, 'utf8'));

  let targets;
  if (targetArgs.includes('--all-pending')) {
    // os 10 que ainda usam arquivo trocado (ver diagnóstico de 2026-07-09)
    targets = ['CW006','CW007','CW008','CW009','CW010','CW011','CW012','CW013','CW014','CW015'];
  } else if (targetArgs.length) {
    targets = targetArgs;
  } else {
    console.error('Uso: node generate-from-tripo.mjs <CW006 CW007 ...> | --all-pending  [--raw]');
    process.exit(1);
  }

  for (const id of targets) {
    const product = products.find(p => p.id === id);
    if (!product) { console.error(`Produto ${id} não encontrado em products.json`); continue; }
    try {
      await generateOne(apiKey, id, product.imageUrl, { raw });
    } catch (err) {
      console.error(`  ❌ ${id} falhou: ${err.message}`);
    }
  }

  console.log('\nPróximo passo: node scripts/normalize-glb/normalize.mjs (regera os normalizados)');
  console.log('Depois: script de comparação visual antes de aprovar.');
}

main();

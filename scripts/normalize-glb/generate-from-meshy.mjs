/**
 * generate-from-meshy.mjs — gera/repõe o GLB de um produto usando a API Meshy
 * (alternativa gratuita/trial à Tripo3D), a partir da mesma foto real
 * cadastrada em src/data/products.json (ou de scripts/normalize-glb/fotos-limpas/<id>.png,
 * se existir — mesma prioridade de generate-from-tripo.mjs).
 *
 * Por quê este script existe (2026-08-30): Carlinhos não quer gastar crédito
 * pago da Tripo pra corrigir um produto com foto errada — a Meshy oferece
 * créditos grátis pra teste. Mesmo pipeline de preparo de imagem
 * (prepare-for-3d.mjs: limpa fundo + endireita + padroniza), só troca o
 * provedor de geração 3D no final.
 *
 * NÃO TESTADO EM PRODUÇÃO AINDA — os endpoints abaixo seguem o que já está
 * implementado em src/pipeline/providers/MeshyProvider.js (usado hoje só no
 * pipeline client-side "Ghost Pipeline Intelligence"), mas essa integração em
 * si nunca rodou de ponta a ponta. Primeira rodada real serve de teste.
 *
 * Uso:
 *   node scripts/normalize-glb/generate-from-meshy.mjs CW006
 *   node scripts/normalize-glb/generate-from-meshy.mjs CW006 CW037 CW038 CW039
 *   node scripts/normalize-glb/generate-from-meshy.mjs --raw CW006   (pula a limpeza, manda a foto crua)
 *
 * Requer MESHY_API_KEY em .env.local (NUNCA prefixo VITE_ — leitura só por
 * script Node, nunca pelo bundle do navegador, mesma regra da Tripo).
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareForGeneration } from './prepare-for-3d.mjs';
import { requireGid } from './lib/requireGid.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const MODELS_DIR = resolve(ROOT, 'public/models');
const BACKUP_DIR = resolve(MODELS_DIR, '_pre_meshy_regen_backup');
const CLEANED_DIR = resolve(HERE, 'qa-output', '_cleaned_input');
const PRODUCTS_PATH = resolve(ROOT, 'src/data/products.json');
const OVERRIDES_PATH = resolve(HERE, 'product-calibration-overrides.json');

const MESHY_BASE = 'https://api.meshy.ai/v1';

// Mesma ideia de "melhor qualidade" combinada pra Tripo (ver generate-from-tripo.mjs) —
// ajustado pros nomes de campo que a Meshy usa (ver MeshyProvider.js).
const GEN_OPTIONS = {
  enable_pbr: true,
  ai_model: 'meshy-4',
};

function loadApiKey() {
  const envPath = resolve(ROOT, '.env.local');
  const content = readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const m = line.match(/^MESHY_API_KEY=(.+)$/);
    if (m) return m[1].trim();
  }
  throw new Error('MESHY_API_KEY não encontrada em .env.local — adicione a chave antes de rodar.');
}

function headers(apiKey) {
  return { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
}

async function downloadImage(imageUrl, outPath) {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Download da foto falhou: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(outPath, buf);
}

function loadProductType(id) {
  try {
    const overrides = JSON.parse(readFileSync(OVERRIDES_PATH, 'utf8'));
    return overrides[id]?.type ?? 'watch';
  } catch {
    return 'watch';
  }
}

function fileToDataUrl(filePath) {
  const buf = readFileSync(filePath);
  const ext = filePath.toLowerCase().endsWith('.jpg') || filePath.toLowerCase().endsWith('.jpeg')
    ? 'jpeg' : 'png';
  return `data:image/${ext};base64,${buf.toString('base64')}`;
}

async function submitTask(apiKey, imageDataUrl) {
  const body = { image_url: imageDataUrl, ...GEN_OPTIONS };
  const res = await fetch(`${MESHY_BASE}/image-to-3d`, {
    method: 'POST',
    headers: headers(apiKey),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  const jobId = data.result ?? data.id;
  if (!jobId) throw new Error(`Meshy submit falhou: ${JSON.stringify(data)}`);
  return jobId;
}

async function pollTask(apiKey, jobId, { intervalMs = 5000, maxAttempts = 90 } = {}) {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(`${MESHY_BASE}/image-to-3d/${jobId}`, { headers: headers(apiKey) });
    const data = await res.json();
    const status = data.status ?? 'UNKNOWN';
    const progress = data.progress ?? 0;
    console.log(`  [${jobId}] ${status} — ${progress}%`);
    if (status === 'SUCCEEDED') {
      const url = data.model_urls?.glb;
      if (!url) throw new Error(`Meshy job ${jobId} succeeded mas sem model_urls.glb: ${JSON.stringify(data)}`);
      return url;
    }
    if (['FAILED', 'EXPIRED'].includes(status)) {
      throw new Error(`Meshy job ${jobId} terminou com status ${status}: ${JSON.stringify(data)}`);
    }
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error(`Timeout esperando job ${jobId}`);
}

async function downloadGlb(url, outPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download do GLB falhou: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(outPath, buf);
  return buf.length;
}

async function generateOne(apiKey, id, imageUrl, { raw = false } = {}) {
  console.log(`\n=== ${id} (via Meshy) ===`);
  const srcPath = resolve(MODELS_DIR, `${id}.glb`);

  if (existsSync(srcPath)) {
    mkdirSync(BACKUP_DIR, { recursive: true });
    const backupPath = resolve(BACKUP_DIR, `${id}.glb`);
    if (!existsSync(backupPath)) copyFileSync(srcPath, backupPath);
  }

  let preparedPath;
  if (!raw) {
    const type = loadProductType(id);
    const localMappedPath = resolve(HERE, 'fotos-limpas', `${id}.png`);
    let srcForPrep = localMappedPath;
    if (existsSync(localMappedPath)) {
      console.log(`  usando foto já mapeada: fotos-limpas/${id}.png`);
    } else {
      mkdirSync(CLEANED_DIR, { recursive: true });
      srcForPrep = resolve(CLEANED_DIR, `${id}_raw.jpg`);
      console.log('  baixando foto original...');
      await downloadImage(imageUrl, srcForPrep);
    }
    console.log(`  preparando (limpar fundo, endireitar, centralizar, padronizar — tipo: ${type})...`);
    preparedPath = await prepareForGeneration(srcForPrep, id, type);
    console.log(`  conferir em: scripts/normalize-glb/prepared/${id}.png`);
  } else {
    mkdirSync(CLEANED_DIR, { recursive: true });
    preparedPath = resolve(CLEANED_DIR, `${id}_raw.jpg`);
    await downloadImage(imageUrl, preparedPath);
  }

  const dataUrl = fileToDataUrl(preparedPath);
  const jobId = await submitTask(apiKey, dataUrl);
  console.log(`  job criado: ${jobId}`);
  const modelUrl = await pollTask(apiKey, jobId);
  const bytes = await downloadGlb(modelUrl, srcPath);
  console.log(`  ✅ salvo em public/models/${id}.glb (${(bytes / 1024 / 1024).toFixed(2)} MB)`);
}

async function main() {
  const args = process.argv.slice(2);
  const raw = args.includes('--raw');
  const targetArgs = args.filter(a => a !== '--raw');
  if (!targetArgs.length) {
    console.error('Uso: node generate-from-meshy.mjs <CW006 ...> [--raw]');
    process.exit(1);
  }
  const apiKey = loadApiKey();
  const products = JSON.parse(readFileSync(PRODUCTS_PATH, 'utf8'));

  for (const id of targetArgs) {
    const product = products.find(p => p.id === id);
    if (!product) { console.error(`Produto ${id} não encontrado em products.json`); continue; }
    try {
      // Trava de identidade (02/09/2026, resposta à confusão CW006/CW007):
      // não gera nada sem GID da Shopify confirmado primeiro.
      requireGid(id, products);
      await generateOne(apiKey, id, product.imageUrl, { raw });
    } catch (err) {
      console.error(`  ❌ ${id} falhou: ${err.message}`);
    }
  }

  console.log('\nPróximo passo: node scripts/normalize-glb/normalize.mjs <ids> (regera os normalizados)');
  console.log('Depois: node scripts/normalize-glb/qa-compare.mjs <ids> pra conferir contra a foto real.');
}

main();

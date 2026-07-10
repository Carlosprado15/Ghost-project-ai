/**
 * qa-compare.mjs — checagem visual automática: compara o render 3D atual de
 * cada produto com a foto real cadastrada em products.json, lado a lado.
 *
 * Por quê: em 2026-07-09 descobrimos (manualmente, depois de muita insistência
 * do Carlinhos) que a maioria dos GLBs não era o produto certo. Esse script
 * automatiza a parte mecânica dessa checagem (baixar foto real + tirar print
 * do 3D + montar lado a lado) — o veredito final ainda é visual (humano ou
 * Claude), mas o trabalho de reunir as provas deixa de ser manual.
 *
 * Requer: servidor do laboratório rodando (`npm run lab:m069b`) na porta 5173.
 *
 * Uso:
 *   node scripts/normalize-glb/qa-compare.mjs CW006 CW007 ...
 *   node scripts/normalize-glb/qa-compare.mjs --all   (todos os 15)
 *
 * Saída: scripts/normalize-glb/qa-output/qa-compare.html (abrir no navegador)
 */

import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const PRODUCTS_PATH = resolve(ROOT, 'src/data/products.json');
const OUT_DIR = resolve(HERE, 'qa-output');
const LAB_URL = 'https://localhost:5173';

const ALL_IDS = Array.from({ length: 15 }, (_, i) => `CW${String(i + 1).padStart(3, '0')}`);

async function fetchRef(url, outPath) {
  if (existsSync(outPath)) return;
  const res = await fetch(url);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(outPath, buf);
}

async function shootClean(browser, id, outPath) {
  const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 900, height: 720 } });
  await page.goto(`${LAB_URL}/?lab=calibrate-product&productId=${id}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('model-viewer', { timeout: 15000 });
  await page.waitForTimeout(2200);
  await page.screenshot({ path: outPath, clip: { x: 30, y: 60, width: 620, height: 620 } });
  await page.close();
}

async function main() {
  const args = process.argv.slice(2);
  const targets = args.includes('--all') ? ALL_IDS : (args.length ? args : ALL_IDS);

  mkdirSync(OUT_DIR, { recursive: true });
  const products = JSON.parse(readFileSync(PRODUCTS_PATH, 'utf8'));

  const browser = await chromium.launch();
  const rows = [];
  for (const id of targets) {
    const product = products.find(p => p.id === id);
    if (!product) { console.error(`${id}: não encontrado em products.json`); continue; }

    console.log(`${id} — baixando referência e tirando print...`);
    const ext = (product.imageUrl.match(/\.(\w+)(\?|$)/)?.[1] ?? 'jpg').replace('jpeg', 'jpg');
    const refPath = resolve(OUT_DIR, `${id}_ref.${ext}`);
    await fetchRef(product.imageUrl, refPath);

    const shotPath = resolve(OUT_DIR, `${id}_3d.png`);
    await shootClean(browser, id, shotPath);

    rows.push({ id, title: product.title, refPath, shotPath });
  }
  await browser.close();

  const html = `<html><body style="margin:0;background:#111;padding:16px;font-family:sans-serif">
  <h2 style="color:#eee">QA — ${new Date().toISOString().slice(0,10)}</h2>
  <div style="display:flex;flex-direction:column;gap:12px">
  ${rows.map(r => `<div style="display:flex;gap:10px;align-items:flex-start">
    <div style="width:320px;text-align:center">
      <img src="${pathToFileURL(r.refPath).href}" style="width:320px;height:320px;object-fit:contain;background:#161616;border:1px solid #333" />
      <div style="color:#ccc;font-size:12px">${r.id} — foto real</div>
    </div>
    <div style="width:320px;text-align:center">
      <img src="${pathToFileURL(r.shotPath).href}" style="width:320px;height:320px;object-fit:contain;background:#161616;border:1px solid #333" />
      <div style="color:#ccc;font-size:12px">${r.id} — 3D atual</div>
    </div>
    <div style="color:#ddd;font-size:13px;max-width:260px;padding-top:8px">${r.title}</div>
  </div>`).join('\n')}
  </div>
  </body></html>`;

  const htmlPath = resolve(OUT_DIR, 'qa-compare.html');
  writeFileSync(htmlPath, html);
  console.log(`\nAbrir: ${htmlPath}`);
}

main();

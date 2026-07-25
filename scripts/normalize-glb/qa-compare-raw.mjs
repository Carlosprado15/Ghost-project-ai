/**
 * qa-compare-raw.mjs — checagem visual dos GLBs BRUTOS (public/models/CWXXX.glb)
 * usando exatamente a mesma config de render do motor ao vivo (App_FINAL.jsx):
 * camera-orbit="0deg 78deg 105%", orientation="0deg 0deg -90deg", scale="2 2 2".
 *
 * Diferente de qa-compare.mjs (que usa a lab de calibração e o arquivo normalized),
 * este script serve o .glb bruto direto e monta o model-viewer manualmente com a
 * config de produção, pra validar visualmente antes/depois da compressão.
 *
 * Uso: node scripts/normalize-glb/qa-compare-raw.mjs CW001 CW002 ...
 * Saída: scripts/normalize-glb/qa-output/qa-compare-raw.html
 */
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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

// Nota: usamos uma página real servida pelo mesmo host (public/_qa-raw.html), não
// page.setContent() com src remoto — model-viewer faz fetch() do .glb, e um documento
// com origin "null" (setContent/data URL) é bloqueado por CORS ao buscar localhost:5173.
async function shoot(browser, glbPath, outPath) {
  const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 600, height: 600 } });
  await page.goto(`${LAB_URL}/_qa-raw.html?src=${encodeURIComponent(glbPath)}&t=${Date.now()}`, { waitUntil: 'load' });
  await page.waitForSelector('model-viewer', { timeout: 15000 });
  await page.waitForFunction(() => {
    const mv = document.querySelector('model-viewer');
    return mv && mv.loaded;
  }, { timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await page.screenshot({ path: outPath });
  await page.close();
}

async function main() {
  const args = process.argv.slice(2);
  const targets = args.includes('--all') ? ALL_IDS : (args.length ? args : ALL_IDS);
  const suffix = args.includes('--suffix') ? args[args.indexOf('--suffix') + 1] : 'raw';

  mkdirSync(OUT_DIR, { recursive: true });
  const products = JSON.parse(readFileSync(PRODUCTS_PATH, 'utf8'));

  const browser = await chromium.launch();
  const rows = [];
  for (const id of targets) {
    const product = products.find(p => p.id === id);
    if (!product) { console.error(`${id}: não encontrado em products.json`); continue; }

    console.log(`${id} — baixando referência e renderizando GLB bruto (${suffix})...`);
    const ext = (product.imageUrl.match(/\.(\w+)(\?|$)/)?.[1] ?? 'jpg').replace('jpeg', 'jpg');
    const refPath = resolve(OUT_DIR, `${id}_ref.${ext}`);
    await fetchRef(product.imageUrl, refPath);

    const shotPath = resolve(OUT_DIR, `${id}_${suffix}.png`);
    await shoot(browser, `/models/${id}.glb`, shotPath);

    rows.push({ id, title: product.title, refPath, shotPath });
  }
  await browser.close();

  const html = `<html><body style="margin:0;background:#111;padding:16px;font-family:sans-serif">
  <h2 style="color:#eee">QA bruto (${suffix}) — ${new Date().toISOString().slice(0,10)}</h2>
  <div style="display:flex;flex-direction:column;gap:12px">
  ${rows.map(r => `<div style="display:flex;gap:10px;align-items:flex-start">
    <div style="width:320px;text-align:center">
      <img src="${pathToFileURL(r.refPath).href}" style="width:320px;height:320px;object-fit:contain;background:#161616;border:1px solid #333" />
      <div style="color:#ccc;font-size:12px">${r.id} — foto real</div>
    </div>
    <div style="width:320px;text-align:center">
      <img src="${pathToFileURL(r.shotPath).href}" style="width:320px;height:320px;object-fit:contain;background:#161616;border:1px solid #333" />
      <div style="color:#ccc;font-size:12px">${r.id} — 3D (${suffix})</div>
    </div>
    <div style="color:#ddd;font-size:13px;max-width:260px;padding-top:8px">${r.title}</div>
  </div>`).join('\n')}
  </div>
  </body></html>`;

  const htmlPath = resolve(OUT_DIR, `qa-compare-${suffix}.html`);
  writeFileSync(htmlPath, html);
  console.log(`\nAbrir: ${htmlPath}`);
}

main();

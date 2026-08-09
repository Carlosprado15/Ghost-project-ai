/**
 * verify-model.mjs — gate automático "essa foto real bate com esse render 3D?"
 *
 * Por quê: em 2026-07-09 descobrimos, só de tanto o Carlinhos insistir pra
 * olharmos com atenção, que vários produtos tinham o GLB TROCADO (modelo 3D
 * de um produto diferente do da foto real da loja). Isso foi achado 100% no
 * olho humano. Este script automatiza essa checagem — sem IA, sem chamada de
 * API paga, só aritmética de pixel (ver lib/verify-vision.mjs) — pra pegar
 * esse tipo de erro sem depender de alguém reparar por acaso de novo.
 *
 * O que faz, por produto:
 *   1) baixa (ou reaproveita) a foto real de src/data/products.json
 *   2) abre o laboratório de calibração (?lab=calibrate-product) e tira 36
 *      prints girando a câmera em torno do produto (12 ângulos × 3 alturas
 *      de câmera — fotos de produto real nem sempre são de frente, então
 *      variar a altura também aumenta a chance de achar o ângulo certo)
 *   3) separa objeto de fundo em cada imagem (foto real + 36 prints) e
 *      recorta/centraliza tudo num canvas padrão, pra poder comparar
 *   4) pra cada ângulo, mede: sobreposição de silhueta (IoU), formato
 *      (momentos de Hu), layout de cor (grade de cor média por região —
 *      capta ONDE cada cor está, não só quanto tem) e cor geral — soma tudo
 *      num placar e fica com o MELHOR ângulo (o que mais parece a foto)
 *   5) gera um veredito (PASS / REVIEW / FAIL) a partir do placar do melhor
 *      ângulo, mais um aviso de "baixa confiança" quando a própria foto real
 *      é difícil de separar do fundo (ex.: produto no pulso, fundo com
 *      estampa) — nesses casos o placar pode enganar, então o script avisa
 *      em vez de fingir certeza.
 *
 * Limite honesto (ver THRESHOLDS abaixo): o placar de produtos CERTOS e
 * ERRADOS se sobrepõe bastante — isso não é um gate binário confiável
 * sozinho, é uma ferramenta de TRIAGEM: ordena por placar, aponta os casos
 * mais suspeitos primeiro e monta o comparativo visual pronto (comparison.png)
 * pra humano confirmar rápido. Só confia PASS sozinho pros placares mais altos.
 *
 * Requer: laboratório rodando (`npm run lab:m069b`, porta 5173) — mesma
 * exigência do qa-compare.mjs, que já faz a parte de baixar a foto/tirar
 * print e provou que dá certo. Atenção: se outro worktree/checkout deste
 * repo também tiver um `npm run dev`/`lab:m069b` rodando, ele pode ocupar a
 * porta 5173 primeiro e este script acaba falando com ELE em vez do
 * checkout atual — confira com `netstat -ano | grep 5173` qual processo/
 * pasta está de fato respondendo antes de confiar no resultado.
 *
 * Uso:
 *   node scripts/normalize-glb/verify-model.mjs CW006 CW007 ...
 *   node scripts/normalize-glb/verify-model.mjs --all      (todos com GLB normalizado)
 *
 * Saída: scripts/normalize-glb/verify-output/<id>/result.json + comparison.png
 *        scripts/normalize-glb/verify-output/summary.json + report.html
 */

import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import pixelmatch from 'pixelmatch';
import sharp from 'sharp';
import {
  canonicalizeImage, canonicalToPng, maskIoU, colorSimilarity, edgeSimilarity, huMoments, huSimilarity,
  colorLayoutSimilarity,
} from './lib/verify-vision.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const PRODUCTS_PATH = resolve(ROOT, 'src/data/products.json');
const OVERRIDES_PATH = resolve(HERE, 'product-calibration-overrides.json');
const OUT_DIR = resolve(HERE, 'verify-output');
const REF_CACHE_DIR = resolve(HERE, 'qa-output'); // reaproveita fotos já baixadas pelo qa-compare.mjs
const LAB_URL = 'https://localhost:5173';

const ANGLES_DEG = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
// Fotos reais de produto não são todas tiradas na mesma elevação de câmera
// (algumas de frente, outras de cima olhando pra baixo) — variar phi além de
// girar theta dá mais chance de achar o ângulo que realmente bate com a foto.
const PHI_DEG_OPTIONS = [65, 78, 90];
const CANVAS_SIZE = 384;

// ── pesos do placar combinado. IoU sozinha discrimina mal formas diferentes
// já centralizadas no mesmo canvas (um círculo e um retângulo centralizados
// se sobrepõem bastante mesmo sendo objetos diferentes) — por isso os
// momentos de Hu (forma) e o layout de cor (ONDE cada cor está na imagem,
// não só quanto de cada cor tem) entram com peso relevante: são os sinais
// que realmente separam "mesmo contorno/mesmo arranjo" de "parecido só na
// área ocupada ou na cor média". A similaridade de borda (Sobel) se mostrou
// pouco discriminante na prática (ficava sempre ~0,85 mesmo pra produtos
// claramente diferentes) — entra só como diagnóstico no relatório, com peso
// zero no placar. ────────────────────────────────────────────────────────
const WEIGHTS = { iou: 0.28, shape: 0.22, layout: 0.35, edge: 0, color: 0.15 };

// ── limiares PASS/REVIEW/FAIL — calibrados rodando o script nos 15 produtos
// reais do catálogo e comparando cada placar com o veredito visual humano
// (eu mesmo olhei as 15 comparison.png). Achado importante desse calibração:
// os placares de produtos CERTOS e produtos ERRADOS ficam numa faixa que se
// SOBREPÕE bastante (~0,40 a ~0,66 pros dois grupos) — não existe um único
// corte que separe perfeitamente "é o produto certo" de "é outro produto".
// Por isso o limiar de PASS foi colocado ALTO de propósito (só passa sozinho
// o que é uma sobra bem clara) e REVIEW é o veredito "padrão" pra maioria dos
// casos — a ferramenta prioriza NUNCA deixar passar sozinho um produto errado
// (like CW006, que era uma troca clara de modelo e ficava em 0,557 — por
// isso o corte de PASS é 0,62, não 0,55) a mesmo custo de mandar produtos
// certos pra revisão manual (mais seguro errar mandando revisar de novo um
// que já tava certo do que deixar passar um errado sozinho). ───────────────
const THRESHOLDS = { pass: 0.62, review: 0.45 };

function combinedScore({ iou, shape, layout, edge, color }) {
  return WEIGHTS.iou * iou + WEIGHTS.shape * shape + WEIGHTS.layout * layout + WEIGHTS.edge * edge + WEIGHTS.color * color;
}

async function fetchRef(url, outPath) {
  if (existsSync(outPath)) return;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`falha ao baixar foto real: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(outPath, buf);
}

/** Abre o laboratório de calibração pra um produto e tira os prints (theta × phi). */
async function shootAngles(browser, id) {
  const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 1000, height: 800 } });
  await page.goto(`${LAB_URL}/?lab=calibrate-product&productId=${id}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('model-viewer', { timeout: 15000 });
  await page.waitForTimeout(2000); // carregamento do GLB + primeira renderização

  const shots = [];
  for (const phi of PHI_DEG_OPTIONS) {
    for (const theta of ANGLES_DEG) {
      await page.evaluate(({ theta, phi }) => {
        const el = document.querySelector('model-viewer');
        el.cameraOrbit = `${theta}deg ${phi}deg 105%`;
        el.jumpCameraToGoal();
      }, { theta, phi });
      await page.waitForTimeout(180);
      const mv = await page.$('model-viewer');
      const buffer = await mv.screenshot();
      shots.push({ theta, phi, buffer });
    }
  }
  await page.close();
  return shots;
}

/** Monta o canvas canônico (cor+máscara+forma) de todos os prints de uma vez. */
async function canonicalizeAll(shots) {
  const out = [];
  for (const { theta, phi, buffer } of shots) {
    const canon = await canonicalizeImage(buffer);
    const hu = huMoments(canon.mask, canon.canvasSize);
    out.push({ theta, phi, ...canon, hu });
  }
  return out;
}

/** Compara a foto real (já canônica) com um print (já canônico); devolve as métricas. */
function compareCanon(ref, shot) {
  const iou = maskIoU(ref.mask, shot.mask);
  const shape = huSimilarity(ref.hu, shot.hu);
  const layout = colorLayoutSimilarity(ref.color, ref.mask, shot.color, shot.mask, CANVAS_SIZE);
  const color = colorSimilarity(ref.color, ref.mask, shot.color, shot.mask);
  const edge = edgeSimilarity(ref.color, ref.mask, shot.color, shot.mask, CANVAS_SIZE);
  return { iou, shape, layout, color, edge, score: combinedScore({ iou, shape, layout, edge, color }) };
}

/** Concatena 3 canvases canônicos (ref | melhor render | diff) numa única PNG. */
async function buildComparisonPng(refColor, shotColor, diffBuffer) {
  const gap = 8;
  const w = CANVAS_SIZE, h = CANVAS_SIZE;
  const totalW = w * 3 + gap * 2;
  const canvas = sharp({ create: { width: totalW, height: h, channels: 3, background: { r: 17, g: 17, b: 17 } } });
  const refPng = await canonicalToPng(refColor, CANVAS_SIZE);
  const shotPng = await canonicalToPng(shotColor, CANVAS_SIZE);
  const diffPng = await sharp(diffBuffer, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
  return canvas.composite([
    { input: refPng, left: 0, top: 0 },
    { input: shotPng, left: w + gap, top: 0 },
    { input: diffPng, left: (w + gap) * 2, top: 0 },
  ]).png().toBuffer();
}

function verdictFor(score, { refLowConfidence }) {
  let verdict;
  if (score >= THRESHOLDS.pass) verdict = 'PASS';
  else if (score >= THRESHOLDS.review) verdict = 'REVIEW';
  else verdict = 'FAIL';
  if (refLowConfidence && verdict !== 'FAIL') verdict = `${verdict}_LOW_CONFIDENCE`;
  return verdict;
}

/**
 * A foto real é "difícil de confiar" quando a separação objeto/fundo não deu
 * uma mancha central razoável (ex.: produto no pulso encostado em roupa
 * estampada, sem contraste — ver README). Sinais simples e baratos:
 *   - fração de primeiro plano muito pequena (quase nada sobrou) ou muito
 *     grande (o "objeto" detectado é quase a imagem toda — provavelmente
 *     fundo colado);
 *   - bounding box encostando em 3+ bordas da imagem de trabalho (a mancha
 *     "vazou" até a moldura, sinal de que o fundo foi confundido com o objeto).
 */
function isLowConfidenceRef(ref, workDims) {
  if (!ref.bbox) return true;
  if (ref.foregroundFrac < 0.03 || ref.foregroundFrac > 0.65) return true;
  const { minX, minY, maxX, maxY } = ref.bbox;
  const { width, height } = workDims;
  const touches = [minX <= 1, minY <= 1, maxX >= width - 2, maxY >= height - 2].filter(Boolean).length;
  return touches >= 3;
}

async function verifyOne(browser, id, product) {
  const dir = resolve(OUT_DIR, id);
  mkdirSync(dir, { recursive: true });

  const ext = (product.imageUrl.match(/\.(\w+)(\?|$)/)?.[1] ?? 'jpg').replace('jpeg', 'jpg');
  const refPath = resolve(REF_CACHE_DIR, `${id}_ref.${ext}`); // reaproveita cache do qa-compare.mjs se existir
  mkdirSync(REF_CACHE_DIR, { recursive: true });
  await fetchRef(product.imageUrl, refPath);

  const refCanon = await canonicalizeImage(refPath, { canvasSize: CANVAS_SIZE });
  refCanon.hu = huMoments(refCanon.mask, refCanon.canvasSize);
  const lowConfidence = isLowConfidenceRef(refCanon, refCanon.workDims);

  const shots = await shootAngles(browser, id);
  const shotsCanon = await canonicalizeAll(shots);

  const perAngle = shotsCanon.map((shot) => ({ theta: shot.theta, phi: shot.phi, ...compareCanon(refCanon, shot) }));
  perAngle.sort((a, b) => b.score - a.score);
  const best = perAngle[0];
  const bestShotCanon = shotsCanon.find((s) => s.theta === best.theta && s.phi === best.phi);

  const verdict = verdictFor(best.score, { refLowConfidence: lowConfidence });

  // diff visual (pixelmatch) entre a foto real e o melhor ângulo, só pro relatório
  const refRGBA = await sharp(await canonicalToPng(refCanon.color, CANVAS_SIZE)).ensureAlpha().raw().toBuffer();
  const shotRGBA = await sharp(await canonicalToPng(bestShotCanon.color, CANVAS_SIZE)).ensureAlpha().raw().toBuffer();
  const diffBuffer = Buffer.alloc(CANVAS_SIZE * CANVAS_SIZE * 4);
  const diffPixels = pixelmatch(refRGBA, shotRGBA, diffBuffer, CANVAS_SIZE, CANVAS_SIZE, { threshold: 0.25 });

  const comparisonPng = await buildComparisonPng(refCanon.color, bestShotCanon.color, diffBuffer);
  writeFileSync(resolve(dir, 'comparison.png'), comparisonPng);

  const result = {
    id,
    title: product.title,
    verdict,
    bestAngle: best.theta,
    bestPhi: best.phi,
    score: round(best.score),
    scores: { iou: round(best.iou), shape: round(best.shape), layout: round(best.layout), edge: round(best.edge), color: round(best.color) },
    diffPixelFrac: round(diffPixels / (CANVAS_SIZE * CANVAS_SIZE)),
    refForegroundFrac: round(refCanon.foregroundFrac),
    refLowConfidence: lowConfidence,
    overrideStatus: (JSON.parse(readFileSync(OVERRIDES_PATH, 'utf8'))[id]?.status) ?? null,
    perAngle: perAngle.map((a) => ({ theta: a.theta, phi: a.phi, score: round(a.score), iou: round(a.iou), shape: round(a.shape), layout: round(a.layout), edge: round(a.edge), color: round(a.color) })),
    generatedAt: new Date().toISOString(),
  };
  writeFileSync(resolve(dir, 'result.json'), JSON.stringify(result, null, 2));
  return result;
}

function round(n) { return Math.round(n * 1000) / 1000; }

export function buildSummaryHtml(rows) {
  const verdictColor = (v) => v.startsWith('PASS') ? '#4ade80' : v.startsWith('REVIEW') ? '#facc15' : '#f87171';
  return `<html><body style="margin:0;background:#111;padding:16px;font-family:sans-serif">
  <h2 style="color:#eee">verify-model — ${new Date().toISOString().slice(0, 10)}</h2>
  <table style="color:#ddd;border-collapse:collapse;font-size:13px;margin-bottom:20px">
    <tr style="text-align:left;color:#94a3b8"><th>id</th><th>veredito</th><th>placar</th><th>IoU</th><th>forma</th><th>layout cor</th><th>cor</th><th>ângulo</th><th>status override</th><th>obs</th></tr>
    ${rows.map(r => `<tr>
      <td style="padding:4px 10px">${r.id}</td>
      <td style="padding:4px 10px;color:${verdictColor(r.verdict)};font-weight:700">${r.verdict}</td>
      <td style="padding:4px 10px">${r.score}</td>
      <td style="padding:4px 10px">${r.scores.iou}</td>
      <td style="padding:4px 10px">${r.scores.shape}</td>
      <td style="padding:4px 10px">${r.scores.layout}</td>
      <td style="padding:4px 10px">${r.scores.color}</td>
      <td style="padding:4px 10px">${r.bestAngle}° / ${r.bestPhi}°</td>
      <td style="padding:4px 10px">${r.overrideStatus ?? '—'}</td>
      <td style="padding:4px 10px;color:#facc15">${r.refLowConfidence ? '⚠️ foto difícil de segmentar' : ''}</td>
    </tr>`).join('\n')}
  </table>
  <div style="display:flex;flex-direction:column;gap:14px">
  ${rows.map(r => `<div>
    <div style="color:#ccc;font-size:13px;margin-bottom:4px">${r.id} — ${r.title} — <b style="color:${verdictColor(r.verdict)}">${r.verdict}</b> (placar ${r.score}, ângulo ${r.bestAngle}°)</div>
    <img src="${pathToFileURL(resolve(OUT_DIR, r.id, 'comparison.png')).href}" style="max-width:100%;border:1px solid #333" />
    <div style="color:#666;font-size:11px">esquerda: foto real · meio: melhor ângulo do 3D · direita: diferença (pixelmatch)</div>
  </div>`).join('\n')}
  </div>
  </body></html>`;
}

async function main() {
  const args = process.argv.slice(2);
  mkdirSync(OUT_DIR, { recursive: true });
  const products = JSON.parse(readFileSync(PRODUCTS_PATH, 'utf8'));
  const overrides = JSON.parse(readFileSync(OVERRIDES_PATH, 'utf8'));

  // "--all" = todo produto que já tem um GLB normalizado gerado de verdade
  // (na prática, os que não estão parados em "needs_new_model" no overrides).
  const allIds = products
    .filter((p) => overrides[p.id] && overrides[p.id].status !== 'needs_new_model')
    .map((p) => p.id);
  const targets = args.includes('--all') ? allIds : (args.length ? args : allIds);

  const browser = await chromium.launch();
  const rows = [];
  for (const id of targets) {
    const product = products.find((p) => p.id === id);
    if (!product) { console.error(`${id}: não encontrado em products.json`); continue; }
    process.stdout.write(`${id} — girando câmera e comparando... `);
    try {
      const result = await verifyOne(browser, id, product);
      console.log(`${result.verdict} (placar ${result.score}, melhor ângulo ${result.bestAngle}°)`);
      rows.push(result);
    } catch (e) {
      console.log(`ERRO: ${e.message}`);
      rows.push({ id, title: product.title, verdict: 'ERROR', score: 0, scores: { iou: 0, shape: 0, layout: 0, edge: 0, color: 0 }, bestAngle: 0, bestPhi: 0, overrideStatus: overrides[id]?.status ?? null, refLowConfidence: false, error: e.message });
    }
  }
  await browser.close();

  writeFileSync(resolve(OUT_DIR, 'summary.json'), JSON.stringify(rows, null, 2));
  writeFileSync(resolve(OUT_DIR, 'report.html'), buildSummaryHtml(rows.filter(r => r.verdict !== 'ERROR')));

  console.log('\n--- resumo ---');
  for (const r of rows) console.log(`${r.id.padEnd(6)} ${String(r.verdict).padEnd(20)} placar=${r.score}  override=${r.overrideStatus ?? '—'}`);
  console.log(`\nRelatório: ${resolve(OUT_DIR, 'report.html')}`);
}

// só roda sozinho quando chamado direto (`node verify-model.mjs ...`) — não
// quando outro script importa este arquivo (ex.: pra reaproveitar buildSummaryHtml)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();

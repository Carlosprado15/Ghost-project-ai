/**
 * check-identity.mjs — Etapa 1 do pipeline de catálogo (lado script).
 *
 * A parte DETERMINÍSTICA da checagem de identidade e entrada — o que é conta,
 * não julgamento. O agente `ghost-catalog-identity` roda isto primeiro e depois
 * adiciona a camada semântica (olhar a foto, comparar formato físico com o
 * título, aplicar a regra "formato físico, não conteúdo de tela").
 *
 * Verifica, contra os 3 casos-mãe já vividos no projeto:
 *   1. ÂNCORA          — todo produto tem `ghostId` bem-formado (Camada 1)
 *   2. COLISÃO DE REF  — 2+ produtos apontando pra mesma platformRef  [bug CW006/CW007]
 *   3. COLISÃO DE URL  — 2+ produtos com a mesma imageUrl de referência
 *   4. FOTO REAPROVEITADA — foto de referência quase idêntica à de outro produto
 *                          (hash perceptual)                          [foto errada CW017]
 *   5. FOTO AUSENTE    — não existe scripts/normalize-glb/fotos-limpas/<id>.png
 *   6. SEM PLATAFORMA  — sem platformRef bem-formada e sem gtin (hoje: 31 produtos)
 *
 * Vereditos: OK / ATENÇÃO / FALHA.
 *   - FALHA  -> trava a etapa seguinte. Exit code 2.
 *   - ATENÇÃO-> passa, mas marca a peça pra olho humano antes de publicar. Exit 0.
 *
 * Rodar:
 *   node scripts/normalize-glb/check-identity.mjs            # catálogo todo
 *   node scripts/normalize-glb/check-identity.mjs CW017      # um produto (+ contexto do catálogo)
 *   node scripts/normalize-glb/check-identity.mjs --products <caminho.json> [--photos <pasta>]
 *
 * As flags --products / --photos existem pra rodar contra fixtures de teste
 * sem tocar no catálogo real.
 */

import { existsSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadProducts, PRODUCTS_PATH, ROOT,
  hasAnchor, getPlatformRefs, isPlatformRefWellFormed,
  findPlatformRefCollisions, findImageUrlCollisions,
} from './lib/identity.mjs';
import { findReusedPhotos } from './lib/imagehash.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

// ── args ───────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
function optVal(name) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : null;
}
const productsPath = optVal('--products') ? resolve(optVal('--products')) : PRODUCTS_PATH;
const photosDir = optVal('--photos')
  ? resolve(optVal('--photos'))
  : resolve(ROOT, 'scripts/normalize-glb/fotos-limpas');
const targetId = argv.find((a) => /^CW\d+$/i.test(a) || /^gp_[0-9a-f]{12}$/.test(a)) || null;
// MAD numa miniatura 16x16 cinza. Do catálogo real (03/09): par mais próximo = 12.0,
// mediana = 106. Arquivo literalmente reaproveitado dá ~0.
const PHOTO_THRESHOLDS = { identical: 4, suspicious: 10 };

// ── carrega ────────────────────────────────────────────────────────────────
const products = loadProducts(productsPath);

// mapa id -> caminho de foto (só as que existem)
const photoFiles = {};
if (existsSync(photosDir)) {
  const present = new Set(readdirSync(photosDir));
  for (const p of products) {
    const fname = `${p.id}.png`;
    if (present.has(fname)) photoFiles[p.id] = join(photosDir, fname);
  }
}
const dupMap = Object.keys(photoFiles).length
  ? await findReusedPhotos(photoFiles, PHOTO_THRESHOLDS)
  : {};

// ── colisões (nível catálogo) ──────────────────────────────────────────────
const refCollisions = findPlatformRefCollisions(products);
const urlCollisions = findImageUrlCollisions(products);
const refCollisionIds = new Set(refCollisions.flatMap((g) => g.ids));
const urlCollisionIds = new Set(urlCollisions.flatMap((g) => g.ids));

// ── avalia produto a produto ───────────────────────────────────────────────
/** @type {Record<string,{verdict:string, findings:string[]}>} */
const perProduct = {};
for (const p of products) {
  const findings = [];
  let verdict = 'OK';
  const fail = (m) => { findings.push(`FALHA · ${m}`); verdict = 'FALHA'; };
  const warn = (m) => { findings.push(`ATENÇÃO · ${m}`); if (verdict !== 'FALHA') verdict = 'ATENÇÃO'; };

  // 1. âncora
  if (!hasAnchor(p)) fail('sem ghostId bem-formado (Camada 1 ausente) — rode migrate-identity-layer.mjs');

  // 2. colisão de platformRef
  if (refCollisionIds.has(p.id)) {
    const g = refCollisions.find((x) => x.ids.includes(p.id));
    fail(`platformRef ${g.ref} compartilhada com ${g.ids.filter((i) => i !== p.id).join(', ')} — dois ids, um produto só (padrão CW006/CW007)`);
  }

  // 3. colisão de imageUrl
  if (urlCollisionIds.has(p.id)) {
    const g = urlCollisions.find((x) => x.ids.includes(p.id));
    fail(`imageUrl idêntica à de ${g.ids.filter((i) => i !== p.id).join(', ')} — provável produto duplicado`);
  }

  // 4. foto reaproveitada — a MESMA imagem de demo em produtos diferentes
  const dup = dupMap[p.id];
  if (dup && dup.identical.length) {
    const list = dup.identical.map((n) => `${n.id} (MAD ${n.mad})`).join(', ');
    fail(`foto de referência é o MESMO arquivo de ${list} — imagem de demo reaproveitada; uma delas está errada (padrão foto errada CW017)`);
  } else if (dup && dup.suspicious.length) {
    const list = dup.suspicious.map((n) => `${n.id} (MAD ${n.mad})`).join(', ');
    warn(`foto de referência muito parecida com ${list} — confira se não é a mesma imagem de demo`);
  }

  // 5. foto ausente
  if (!photoFiles[p.id]) warn(`sem foto de referência em fotos-limpas/${p.id}.png`);

  // 6. sem identidade de plataforma (hoje: lote de 31 pendente — ver 31-produtos-sem-gid)
  const wellFormed = getPlatformRefs(p).filter(isPlatformRefWellFormed);
  const hasGtin = typeof p.gtin === 'string' && /^\d{8,14}$/.test(p.gtin);
  if (!wellFormed.length && !hasGtin) {
    warn('sem platformRef/gtin — identidade só pela âncora (lote pendente)');
  } else if (!wellFormed.length && hasGtin) {
    warn('só gtin, sem platformRef — Camada 3 sozinha; confirmar loja antes de publicar');
  }

  perProduct[p.id] = { verdict, findings };
}

// ── saída ──────────────────────────────────────────────────────────────────
const ids = targetId ? [targetId] : products.map((p) => p.id);
const counts = { OK: 0, 'ATENÇÃO': 0, FALHA: 0 };
for (const id of products.map((p) => p.id)) counts[perProduct[id]?.verdict || 'FALHA']++;

const lines = [];
lines.push('# IDENTITY_CHECK_REPORT — Etapa 1 (identidade e entrada)');
lines.push(`Gerado por \`node scripts/normalize-glb/check-identity.mjs\` em ${new Date().toISOString().slice(0, 10)}`);
lines.push(`Fonte: \`${productsPath === PRODUCTS_PATH ? 'src/data/products.json' : productsPath}\`` +
  (Object.keys(photoFiles).length ? ` · fotos: \`${photosDir}\`` : ' · (sem pasta de fotos)'));
lines.push('');
lines.push(`**Catálogo: ${products.length} produtos — ${counts.OK} OK · ${counts['ATENÇÃO']} ATENÇÃO · ${counts.FALHA} FALHA**`);
lines.push('');

if (refCollisions.length || urlCollisions.length) {
  lines.push('## Colisões no nível do catálogo');
  for (const g of refCollisions) lines.push(`- 🔴 platformRef \`${g.ref}\` → ${g.ids.join(', ')}`);
  for (const g of urlCollisions) lines.push(`- 🔴 imageUrl \`${g.imageUrl}\` → ${g.ids.join(', ')}`);
  lines.push('');
}

lines.push('## Por produto');
lines.push('');
lines.push('| Produto | Veredito | Achados |');
lines.push('|---|---|---|');
for (const id of ids) {
  const r = perProduct[id];
  if (!r) { lines.push(`| ${id} | — | produto não encontrado |`); continue; }
  const mark = r.verdict === 'OK' ? '✅ OK' : r.verdict === 'ATENÇÃO' ? '⚠️ ATENÇÃO' : '🔴 FALHA';
  lines.push(`| ${id} | ${mark} | ${r.findings.length ? r.findings.join('<br>') : '—'} |`);
}
lines.push('');
lines.push('> FALHA trava a Etapa 2. ATENÇÃO passa, mas bloqueia a publicação até um humano liberar.');
lines.push('> A checagem semântica (foto bate com o produto? formato físico, não conteúdo de tela) é do agente `ghost-catalog-identity`, não deste script.');

const report = lines.join('\n') + '\n';
const outPath = resolve(HERE, 'IDENTITY_CHECK_REPORT.md');
if (productsPath === PRODUCTS_PATH) writeFileSync(outPath, report, 'utf8');

// console
console.log(report);
if (productsPath === PRODUCTS_PATH) console.log(`Relatório salvo em ${outPath}`);

const anyFail = ids.some((id) => perProduct[id]?.verdict === 'FALHA');
process.exit(anyFail ? 2 : 0);

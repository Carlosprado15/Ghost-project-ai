/**
 * audit-gid-coverage.mjs — auditoria retroativa da trava de identidade (Parte 1 do QA automático)
 *
 * Roda contra o catálogo inteiro e reporta quais produtos ainda não têm
 * GID da Shopify registrado (`shopifyGid` em products.json) — ou seja,
 * quais ainda dependeriam de nome de arquivo/id local pra identidade,
 * o exato ponto cego que causou a confusão do CW006/CW007.
 *
 * Rodar: node scripts/normalize-glb/audit-gid-coverage.mjs
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hasGid } from './lib/requireGid.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const PRODUCTS_PATH = resolve(ROOT, 'src/data/products.json');

const products = JSON.parse(readFileSync(PRODUCTS_PATH, 'utf8'));

const withGid = [];
const withoutGid = [];

for (const p of products) {
  if (hasGid(p.id, products)) {
    withGid.push(p);
  } else {
    withoutGid.push(p);
  }
}

console.log(`Catálogo: ${products.length} produtos`);
console.log(`Com GID registrado:    ${withGid.length}`);
console.log(`SEM GID (bloqueados):  ${withoutGid.length}\n`);

if (withoutGid.length) {
  console.log('Produtos SEM GID (pipeline rejeitaria gerar/calibrar/publicar hoje):');
  for (const p of withoutGid) {
    console.log(`  ${p.id} — ${p.title}`);
  }
}

if (withGid.length) {
  console.log('\nProdutos JÁ com GID confirmado:');
  for (const p of withGid) {
    console.log(`  ${p.id} — ${p.shopifyGid}`);
  }
}

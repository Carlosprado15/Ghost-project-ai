/**
 * migrate-identity-layer.mjs — adiciona a Camada de Identidade ao products.json.
 *
 * Idempotente: rodar de novo NÃO regenera ghostId já existente, NÃO duplica
 * platformRefs, NÃO mexe em nada que já esteja preenchido. Seguro rodar quantas
 * vezes quiser.
 *
 * O que faz, por produto:
 *   - `ghostId`      : cria se não existir (`gp_` + 12 hex, imutável a partir daí)
 *   - `platformRefs` : cria como [] se não existir; se houver `shopifyGid` legado
 *                      e ele ainda não estiver na lista, migra pra dentro como
 *                      { platform:'shopify', store:'clickwear', id:<gid> }
 *   - `gtin`         : cria como null (slot reservado — Camada 3, preencher só
 *                      quando a 2ª loja parceira entrar)
 *
 * NÃO remove `shopifyGid` (decisão: "ao lado, sem migrar" — o campo legado
 * continua e os helpers leem os dois; limpeza futura, separada).
 * NÃO renomeia `id` (CW00X) nem toca em arquivo de modelo/foto.
 *
 * Rodar:  node scripts/normalize-glb/migrate-identity-layer.mjs [--dry]
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { PRODUCTS_PATH, GHOST_ID_RE, mintGhostId } from './lib/identity.mjs';

const DRY = process.argv.includes('--dry');

const raw = readFileSync(PRODUCTS_PATH, 'utf8');
const products = JSON.parse(raw);

const used = new Set(products.map((p) => p.ghostId).filter((g) => GHOST_ID_RE.test(g || '')));
const changes = [];

for (const p of products) {
  const before = JSON.stringify(p);

  if (!GHOST_ID_RE.test(p.ghostId || '')) {
    p.ghostId = mintGhostId(used);
    used.add(p.ghostId);
    changes.push(`${p.id}: +ghostId ${p.ghostId}`);
  }

  if (!Array.isArray(p.platformRefs)) p.platformRefs = [];
  if (p.shopifyGid && !p.platformRefs.some((r) => r.id === p.shopifyGid)) {
    p.platformRefs.push({ platform: 'shopify', store: 'clickwear', id: p.shopifyGid });
    changes.push(`${p.id}: shopifyGid -> platformRefs`);
  }

  if (!('gtin' in p)) {
    p.gtin = null;
    changes.push(`${p.id}: +gtin (reservado, null)`);
  }

  // Ordena as chaves pra saída estável e legível: identidade primeiro.
  const ordered = {};
  const order = ['id', 'ghostId', 'title', 'sku', 'gtin', 'price', 'imageUrl', 'handle',
    'status', 'modelUrl', 'arScale', 'platformRefs', 'shopifyGid'];
  for (const k of order) if (k in p) ordered[k] = p[k];
  for (const k of Object.keys(p)) if (!(k in ordered)) ordered[k] = p[k];
  Object.keys(p).forEach((k) => delete p[k]);
  Object.assign(p, ordered);

  if (JSON.stringify(p) !== before && !changes.some((c) => c.startsWith(`${p.id}:`))) {
    changes.push(`${p.id}: reordenado`);
  }
}

console.log(`Catálogo: ${products.length} produtos`);
if (!changes.length) {
  console.log('Nada a fazer — Camada de Identidade já está aplicada.');
  process.exit(0);
}
console.log(`\n${changes.length} mudança(s):`);
for (const c of changes) console.log(`  ${c}`);

if (DRY) {
  console.log('\n--dry: nada gravado.');
  process.exit(0);
}

const eol = raw.includes('\r\n') ? '\r\n' : '\n';
const out = JSON.stringify(products, null, 2).replace(/\n/g, eol) + eol;
writeFileSync(PRODUCTS_PATH, out, 'utf8');
console.log(`\nGravado em ${PRODUCTS_PATH} (EOL preservado: ${eol === '\r\n' ? 'CRLF' : 'LF'})`);

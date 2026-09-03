/**
 * identity.mjs — Camada de identidade do catálogo, agnóstica de plataforma.
 *
 * Decisão de arquitetura de 03/09/2026 (ver docs/CATALOG_IDENTITY_NOTES.md e o
 * desenho aprovado por Carlos). São TRÊS camadas, em ordem de confiança:
 *
 *   Camada 1 — ghostId       : âncora própria do Ghost Project. Opaca, gerada
 *                              uma vez, imutável, nunca reciclada. É a única
 *                              identidade que não muda se o produto for
 *                              renomeado, re-fotografado ou sair do ar.
 *   Camada 2 — platformRefs[] : referência por plataforma/loja (Shopify hoje,
 *                              Shopee/outras amanhã). LISTA, não campo único —
 *                              a mesma peça pode existir em várias lojas.
 *   Camada 3 — gtin          : código de barras físico global (EAN/UPC).
 *                              Plano B: só entra quando a Camada 2 não resolve.
 *
 * O `id` local (CW00X) CONTINUA sendo a chave de conveniência em todo o resto
 * do projeto — não foi renomeado nada. O ghostId fica AO LADO dele.
 *
 * Nada aqui chama serviço externo. É tudo leitura de products.json + aritmética.
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(HERE, '../../..');
export const PRODUCTS_PATH = resolve(ROOT, 'src/data/products.json');

/** Formato da âncora: `gp_` + 12 hex. Sem significado, não sequencial. */
export const GHOST_ID_RE = /^gp_[0-9a-f]{12}$/;

/** Formato aceito de id de plataforma por plataforma conhecida. */
const PLATFORM_REF_SHAPES = {
  shopify: /^gid:\/\/shopify\/Product\/\d+$/,
  shopee: /^\d{6,}$/, // id numérico do item na Shopee — formato provisório, ajustar quando a 1ª loja Shopee entrar
};

export function loadProducts(path = PRODUCTS_PATH) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

/** Acha um produto por `id` local (CW00X) OU por `ghostId`. */
export function getProduct(key, products) {
  return products.find((p) => p.id === key || p.ghostId === key) || null;
}

/**
 * Referências de plataforma NORMALIZADAS de um produto.
 * Inclui o campo legado `shopifyGid` (compat — enquanto ele existir em
 * products.json, conta como uma platformRef de Shopify da loja clickwear).
 * @returns {Array<{platform:string, store:string, id:string, legacy?:boolean}>}
 */
export function getPlatformRefs(product) {
  if (!product) return [];
  const refs = Array.isArray(product.platformRefs) ? [...product.platformRefs] : [];
  if (product.shopifyGid && !refs.some((r) => r.id === product.shopifyGid)) {
    refs.push({ platform: 'shopify', store: 'clickwear', id: product.shopifyGid, legacy: true });
  }
  return refs;
}

/** String da referência primária do produto, ou null. */
export function primaryPlatformRef(product) {
  const refs = getPlatformRefs(product);
  return refs.length ? refs[0].id : null;
}

/** Uma platformRef está bem-formada para a plataforma dela? */
export function isPlatformRefWellFormed(ref) {
  if (!ref || typeof ref.id !== 'string' || !ref.platform) return false;
  const shape = PLATFORM_REF_SHAPES[ref.platform];
  return shape ? shape.test(ref.id) : ref.id.length > 0;
}

/** Camada 1 presente e válida? */
export function hasAnchor(product) {
  return !!product && typeof product.ghostId === 'string' && GHOST_ID_RE.test(product.ghostId);
}

/**
 * O produto tem identidade estável o suficiente pra gerar/calibrar/publicar?
 * Exige âncora (Camada 1) E (pelo menos uma platformRef bem-formada OU um gtin).
 */
export function hasStableIdentity(product) {
  if (!hasAnchor(product)) return false;
  const hasRef = getPlatformRefs(product).some(isPlatformRefWellFormed);
  const hasGtin = typeof product.gtin === 'string' && /^\d{8,14}$/.test(product.gtin);
  return hasRef || hasGtin;
}

/**
 * DUAS ou mais entradas apontando pra MESMA referência de plataforma.
 * Foi exatamente o bug CW006/CW007 (dois ids, um produto só).
 * @returns {Array<{ref:string, platform:string, ids:string[]}>}
 */
export function findPlatformRefCollisions(products) {
  const byRef = new Map();
  for (const p of products) {
    for (const ref of getPlatformRefs(p)) {
      const key = `${ref.platform}::${ref.id}`;
      if (!byRef.has(key)) byRef.set(key, { ref: ref.id, platform: ref.platform, ids: [] });
      byRef.get(key).ids.push(p.id);
    }
  }
  return [...byRef.values()].filter((g) => g.ids.length > 1);
}

/**
 * DUAS ou mais entradas compartilhando a MESMA imageUrl de referência —
 * sinal forte de produto duplicado no catálogo.
 * @returns {Array<{imageUrl:string, ids:string[]}>}
 */
export function findImageUrlCollisions(products) {
  const byUrl = new Map();
  for (const p of products) {
    if (!p.imageUrl) continue;
    const key = p.imageUrl.split('?')[0]; // ignora sufixo de versão do CDN
    if (!byUrl.has(key)) byUrl.set(key, { imageUrl: key, ids: [] });
    byUrl.get(key).ids.push(p.id);
  }
  return [...byUrl.values()].filter((g) => g.ids.length > 1);
}

/** Gera uma âncora nova. Não determinístico de propósito. */
export function mintGhostId(existing = new Set()) {
  let id;
  do {
    let hex = '';
    for (let i = 0; i < 12; i++) hex += Math.floor(Math.random() * 16).toString(16);
    id = `gp_${hex}`;
  } while (existing.has(id));
  return id;
}

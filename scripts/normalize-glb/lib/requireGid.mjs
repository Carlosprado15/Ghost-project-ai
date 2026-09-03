/**
 * requireGid.mjs — trava de identidade na entrada do pipeline.
 *
 * Decisão de 02/09/2026 (confusão CW006/CW007, ver docs/CATALOG_IDENTITY_NOTES.md):
 * nenhum produto é gerado, calibrado ou publicado sem identidade estável.
 *
 * Atualizado em 03/09/2026: a trava agora entende a Camada de Identidade
 * completa (ver lib/identity.mjs) — âncora `ghostId` + `platformRefs[]` +
 * `gtin`. O campo legado `shopifyGid` continua valendo como uma platformRef
 * de Shopify (compat). O nome `requireGid`/`hasGid` foi mantido pra não quebrar
 * os callers (generate-from-tripo.mjs, generate-from-meshy.mjs, audit-gid-coverage.mjs).
 *
 * Uso, dentro de qualquer script que processe um produto:
 *   import { requireGid } from './lib/requireGid.mjs';
 *   const products = JSON.parse(readFileSync(PRODUCTS_PATH, 'utf8'));
 *   requireGid(id, products); // lança se faltar identidade estável
 */

import {
  getProduct,
  hasAnchor,
  hasStableIdentity,
  getPlatformRefs,
  isPlatformRefWellFormed,
} from './identity.mjs';

/**
 * @param {string} id - id local do produto (ex.: "CW006") ou ghostId
 * @param {Array} products - conteúdo de products.json já carregado
 * @returns {string} a referência de plataforma primária (ou "gtin:<n>" se só houver GTIN)
 * @throws {Error} se o produto não existir ou não tiver identidade estável
 */
export function requireGid(id, products) {
  const product = getProduct(id, products);
  if (!product) {
    throw new Error(
      `[requireGid] ${id}: produto não encontrado em products.json — não é possível confirmar identidade.`
    );
  }
  if (!hasAnchor(product)) {
    throw new Error(
      `[requireGid] ${id}: falta a âncora (ghostId) da Camada de Identidade. ` +
      `Rode: node scripts/normalize-glb/migrate-identity-layer.mjs`
    );
  }
  if (!hasStableIdentity(product)) {
    throw new Error(
      `[requireGid] ${id}: tem ghostId mas nenhuma referência de plataforma ` +
      `(platformRefs) bem-formada nem gtin. Não gerar/calibrar/publicar sem ` +
      `confirmar identidade via GID primeiro — ver docs/CATALOG_IDENTITY_NOTES.md ` +
      `(obter via Claude Chat, acesso direto à API da Shopify).`
    );
  }
  const ref = getPlatformRefs(product).find(isPlatformRefWellFormed);
  return ref ? ref.id : `gtin:${product.gtin}`;
}

/**
 * Versão silenciosa pra auditoria em lote — não lança.
 * @returns {boolean} true se o produto tem identidade estável
 */
export function hasGid(id, products) {
  try {
    requireGid(id, products);
    return true;
  } catch {
    return false;
  }
}

// Aliases com o nome novo, mais claro. Mesma implementação.
export { requireGid as requireStableIdentity, hasGid as hasStableIdentityById };

/**
 * requireGid.mjs — trava de identidade na entrada do pipeline
 *
 * Decisão de 02/09/2026, resposta direta à confusão CW006/CW007 (ver
 * docs/CATALOG_IDENTITY_NOTES.md): nenhum produto pode ser gerado,
 * calibrado ou publicado sem um GID da Shopify (identificador
 * estável, `gid://shopify/Product/<numero>`) associado em
 * `src/data/products.json` (`shopifyGid`). Nome de arquivo e `id`
 * local (CW00X) já provaram não ser confiáveis sozinhos.
 *
 * Uso, dentro de qualquer script que processe um produto:
 *   import { requireGid } from './lib/requireGid.mjs';
 *   const products = JSON.parse(readFileSync(PRODUCTS_PATH, 'utf8'));
 *   requireGid(id, products); // lança erro se faltar — não deixa passar
 */

/**
 * @param {string} id - ID local do produto (ex.: "CW006")
 * @param {Array<{id: string, shopifyGid?: string}>} products - conteúdo de products.json já carregado
 * @throws {Error} se o produto não existir ou não tiver shopifyGid
 */
export function requireGid(id, products) {
  const product = products.find((p) => p.id === id);
  if (!product) {
    throw new Error(
      `[requireGid] ${id}: produto não encontrado em products.json — não é possível confirmar identidade.`
    );
  }
  if (!product.shopifyGid || !/^gid:\/\/shopify\/Product\/\d+$/.test(product.shopifyGid)) {
    throw new Error(
      `[requireGid] ${id}: falta ID estável (shopifyGid) em products.json. ` +
      `Não gerar/calibrar/publicar sem confirmar identidade via GID primeiro — ` +
      `ver docs/CATALOG_IDENTITY_NOTES.md pra como obter (Claude Chat, acesso direto à API da Shopify).`
    );
  }
  return product.shopifyGid;
}

/**
 * Versão "silenciosa" pra auditoria em lote — não lança, só retorna se falta ou não.
 * @param {string} id
 * @param {Array<{id: string, shopifyGid?: string}>} products
 * @returns {boolean} true se tem GID válido
 */
export function hasGid(id, products) {
  try {
    requireGid(id, products);
    return true;
  } catch {
    return false;
  }
}

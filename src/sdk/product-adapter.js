import productsData from '../data/products.json';

// Incrementar esta versão força browsers e CDN a baixar novamente os GLBs
const MODEL_CACHE_VERSION = 'v029';

let _activeProduct = null;
const _generatedModels = {};

function _lookupModelUrl(productId) {
  if (!productId) return null;
  if (_generatedModels[productId]) return _generatedModels[productId];
  const product = productsData.find(
    p => p.id === productId || p.handle === productId
  );
  const url = product?.modelUrl ?? null;
  // Adiciona versão para invalidar cache de CDN/browser entre deploys
  return url ? `${url}?${MODEL_CACHE_VERSION}` : null;
}

function _resolveModelUrl(productId, overrideUrl) {
  if (overrideUrl) return overrideUrl;
  // Usa apenas o parâmetro explícito 'modelUrl' como override
  // Parâmetros genéricos (model, url, file, glb) foram removidos pois
  // poderiam coincidir acidentalmente com parâmetros de URLs de loja
  const params = new URLSearchParams(window.location.search);
  const urlModel = params.get('modelUrl') || null;
  return urlModel || _lookupModelUrl(productId);
}

export const ProductAdapter = {
  fromUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const productId = params.get('productId');
    return {
      productId: productId ?? null,
      modelUrl: _resolveModelUrl(productId, null),
      productUrl: params.get('productUrl') ?? null,
      cartUrl: params.get('cartUrl') ?? null,
      productName: params.get('productName') ?? null,
      productImage: params.get('productImage') ?? null,
      storeMode: productId !== null && productId !== '',
    };
  },

  fromParams({ productId, modelUrl, productUrl, cartUrl, storeId, metadata } = {}) {
    return {
      productId: productId ?? null,
      modelUrl: modelUrl || _lookupModelUrl(productId),
      productUrl: productUrl ?? null,
      cartUrl: cartUrl ?? null,
      storeId: storeId ?? null,
      metadata: metadata ?? {},
      productName: null,
      productImage: null,
      storeMode: !!productId,
    };
  },

  setActive(product) {
    _activeProduct = product;
  },

  cacheGeneratedModel(productId, url) {
    if (productId && url) _generatedModels[productId] = url;
  },

  getActive() {
    return _activeProduct ?? this.fromUrlParams();
  },

  isStoreMode() {
    return this.getActive().storeMode;
  },
};

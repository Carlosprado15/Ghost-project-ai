import productsData from '../data/products.json';

let _activeProduct = null;
const _generatedModels = {};

function _lookupModelUrl(productId) {
  if (!productId) return null;
  if (_generatedModels[productId]) return _generatedModels[productId];
  const product = productsData.find(
    p => p.id === productId || p.handle === productId
  );
  return product?.modelUrl ?? null;
}

function _resolveModelUrl(productId, overrideUrl) {
  if (overrideUrl) return overrideUrl;
  const params = new URLSearchParams(window.location.search);
  const urlModel =
    params.get('modelUrl') ||
    params.get('glb') ||
    params.get('gltf') ||
    params.get('file') ||
    params.get('model') ||
    params.get('url');
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

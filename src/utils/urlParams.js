export function getProductId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("productId");
}

export function getImageUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("imageUrl");
}

export function getProductUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("productUrl");
}

export function getEmbeddedParam() {
  const params = new URLSearchParams(window.location.search);
  return params.get("embedded") === "true";
}

export function getModelUrl() {
  const params = new URLSearchParams(window.location.search);
  const productId = getProductId();

  if (productId) {
    const productsData = require('../data/products.json');
    const product = productsData.find(p => p.id === productId);
    if (product && product.modelUrl) {
      return product.modelUrl;
    }
  }

  return params.get("modelUrl") || '/relogio.glb';
}
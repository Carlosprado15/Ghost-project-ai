import productsData from "../data/products.json";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EMBEDDED STORE MODE - URL PARAMETERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function getProductId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("productId");
}

export function getProductName() {
  const params = new URLSearchParams(window.location.search);
  return params.get("productName");
}

export function getProductImage() {
  const params = new URLSearchParams(window.location.search);
  return params.get("productImage");
}

export function getImageUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("imageUrl");
}

export function getProductUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("productUrl");
}

export function getCartUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("cartUrl");
}

export function getEmbeddedParam() {
  const params = new URLSearchParams(window.location.search);
  return params.get("embedded") === "true";
}

// Detecta se está em Store Mode (modo integrado)
export function isStoreMode() {
  const productId = getProductId();
  return productId !== null && productId !== '';
}

// Obtém informações completas do produto
export function getProductInfo() {
  const productId = getProductId();
  
  if (!productId) return null;
  
  // Busca no products.json
  const product = productsData.find(p => p.id === productId);
  
  // Retorna dados do produto com override de parâmetros da URL
  return {
    id: productId,
    name: getProductName() || product?.title || productId,
    image: getProductImage() || product?.imageUrl || null,
    modelUrl: product?.modelUrl || null,
    productUrl: getProductUrl() || null,
    cartUrl: getCartUrl() || null
  };
}

export function getModelUrl(productId) {
  const params = new URLSearchParams(window.location.search);
  
  // Se productId foi passado, busca no products.json
  if (productId) {
    const product = productsData.find(p => p.id === productId);
    if (product && product.modelUrl) {
      return product.modelUrl;
    }
  }

  // Tenta obter modelUrl diretamente dos parâmetros da URL
  const urlModel = params.get("modelUrl") || 
    params.get("glb") ||
    params.get("gltf") ||
    params.get("file") ||
    params.get("model") ||
    params.get("url");
  
  if (urlModel) {
    return urlModel;
  }

  if (productsData && productsData.length > 0) {
    return productsData[0].modelUrl;
  }
  return null;
}

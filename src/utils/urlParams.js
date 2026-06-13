import productsData from "../data/products.json";

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

  // Fallback: se não há productId nem modelUrl, usa o primeiro produto do JSON
  if (productsData && productsData.length > 0) {
    return productsData[0].modelUrl;
  }

  return null;
}


export function getModelUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('modelUrl');
}

export function getProductUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('productUrl');
}


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




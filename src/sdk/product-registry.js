
export const ProductRegistry = (() => {
  const products = [];

  const registerProduct = (product) => {
    products.push(product);
  };

  const removeProduct = (productId) => {
    // TODO: Implement product removal by ID
    // products = products.filter(p => p.id !== productId);
  };

  const listProducts = () => {
    return [...products];
  };

  const getProductById = (productId) => {
    // TODO: Implement product lookup by ID
    // return products.find(p => p.id === productId);
  };

  return {
    registerProduct,
    removeProduct,
    listProducts,
    getProductById,
  };
})();

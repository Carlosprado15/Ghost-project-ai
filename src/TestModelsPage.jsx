import React, { useState, useEffect } from 'react';
import productsData from './data/products.json';

const TestModelsPage = ({ onSelectProduct, onBack }) => {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    // Filter products to only include CW001-CW015
    const filteredProducts = productsData.filter(product => {
      const productIdNum = parseInt(product.id.replace('CW', ''), 10);
      return productIdNum >= 1 && productIdNum <= 15;
    });
    setProducts(filteredProducts);
  }, []);

  return (
    <div className="test-models-page">
      <h1>TEST MODELS</h1>
      <div className="product-list">
        {products.map(product => (
          <button key={product.id} onClick={() => {
            window.history.pushState({}, '', `?productId=${product.id}`);
            onSelectProduct(product.id);
          }}>
            {product.id}
          </button>
        ))}
      </div>
      <button className="back-btn" onClick={onBack}>
        ← Voltar
      </button>
    </div>
  );
};

export default TestModelsPage;
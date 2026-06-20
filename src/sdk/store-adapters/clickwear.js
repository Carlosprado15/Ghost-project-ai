export const ClickWearAdapter = {
  STORE_ID: 'clickwear',
  DEFAULT_PRODUCT_ID: 'CW001',
  DEFAULT_MODEL_PATH: '/models/CW001.glb',

  getDefaultProduct() {
    return {
      productId: this.DEFAULT_PRODUCT_ID,
      modelUrl: this.DEFAULT_MODEL_PATH,
      productUrl: null,
      cartUrl: null,
      storeId: this.STORE_ID,
      storeMode: false,
    };
  },
};

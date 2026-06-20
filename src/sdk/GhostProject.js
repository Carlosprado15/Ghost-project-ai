import { ProductAdapter } from './product-adapter';
import { GhostEvents } from './ghost-events';

export const GhostProject = {
  open({ productId, modelUrl, productUrl, cartUrl, storeId, metadata } = {}) {
    const product = ProductAdapter.fromParams({ productId, modelUrl, productUrl, cartUrl, storeId, metadata });
    ProductAdapter.setActive(product);
    GhostEvents.emit('onOpen', product);
  },

  on(event, callback) {
    GhostEvents.on(event, callback);
    return this;
  },

  off(event, callback) {
    GhostEvents.off(event, callback);
    return this;
  },

  _emit(event, data) {
    GhostEvents.emit(event, data);
  },
};

/**
 * LocalStorageAssetRepository — implementação concreta do AssetRepository.
 *
 * Persiste ProductAssets via localStorage.
 * Chave de índice: ghost_assets_index → [productId1, productId2, ...]
 * Chave de item:   ghost_asset_{productId} → JSON do ProductAsset
 */

import { AssetRepository } from './AssetRepository.js';
import { ProductAsset }    from './ProductAsset.js';
import { AssetStatus }     from './AssetStatus.js';

const LS_INDEX = 'ghost_assets_index';
const LS_KEY   = (id) => `ghost_asset_${id}`;

export class LocalStorageAssetRepository extends AssetRepository {

  async save(asset) {
    try {
      const json = JSON.stringify(asset.toJSON());
      localStorage.setItem(LS_KEY(asset.productId), json);

      const index = this._readIndex();
      if (!index.includes(asset.productId)) {
        index.push(asset.productId);
        localStorage.setItem(LS_INDEX, JSON.stringify(index));
      }
    } catch (_) {}
  }

  async load(storeId) {
    return this.findByStore(storeId);
  }

  async remove(productId) {
    try {
      localStorage.removeItem(LS_KEY(productId));
      const index = this._readIndex().filter(id => id !== productId);
      localStorage.setItem(LS_INDEX, JSON.stringify(index));
      return true;
    } catch (_) {
      return false;
    }
  }

  async findById(productId) {
    try {
      const raw = localStorage.getItem(LS_KEY(productId));
      return raw ? this._deserialize(JSON.parse(raw)) : null;
    } catch (_) {
      return null;
    }
  }

  async findByStore(storeId) {
    const index  = this._readIndex();
    const assets = [];
    for (const id of index) {
      const asset = await this.findById(id);
      if (asset && (!storeId || asset.storeId === storeId)) {
        assets.push(asset);
      }
    }
    return assets;
  }

  async findBySKU(storeId, sku) {
    const assets = await this.findByStore(storeId);
    return assets.find(a => a.sku === sku) ?? null;
  }

  _readIndex() {
    try {
      return JSON.parse(localStorage.getItem(LS_INDEX) || '[]');
    } catch (_) {
      return [];
    }
  }

  _deserialize(data) {
    const asset = new ProductAsset({
      productId:    data.productId,
      storeId:      data.storeId    ?? 'ghost',
      sku:          data.sku        ?? data.productId,
      name:         data.name       ?? '',
      brand:        data.brand      ?? '',
      category:     data.category   ?? '',
      images:       data.images     ?? [],
      glbModel:     data.glbModel   ?? null,
      previewImage: data.previewImage ?? null,
      thumbnail:    data.thumbnail  ?? null,
      metadata:     data.metadata   ?? {},
    });
    asset.status    = data.status    ?? AssetStatus.PENDING;
    asset.createdAt = data.createdAt ?? asset.createdAt;
    asset.updatedAt = data.updatedAt ?? asset.updatedAt;
    return asset;
  }
}

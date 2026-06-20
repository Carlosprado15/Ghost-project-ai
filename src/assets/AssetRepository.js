/**
 * ASSET REPOSITORY — GHOST PROJECT AI
 *
 * Interface de persistência de ProductAssets.
 * Sem banco. Sem Firebase. Sem localStorage.
 *
 * Implementações futuras poderão usar:
 *   - LocalStorageRepository
 *   - IndexedDBRepository
 *   - FirestoreRepository
 *   - SupabaseRepository
 */

export class AssetRepository {
  /**
   * Persiste um ProductAsset.
   * @param {import('./ProductAsset.js').ProductAsset} asset
   * @returns {Promise<void>}
   */
  async save(asset) {
    throw new Error(`${this.constructor.name} must implement save()`);
  }

  /**
   * Carrega todos os assets de uma loja.
   * @param {string} storeId
   * @returns {Promise<import('./ProductAsset.js').ProductAsset[]>}
   */
  async load(storeId) {
    throw new Error(`${this.constructor.name} must implement load()`);
  }

  /**
   * Remove um asset pelo productId.
   * @param {string} productId
   * @returns {Promise<boolean>} true se removido
   */
  async remove(productId) {
    throw new Error(`${this.constructor.name} must implement remove()`);
  }

  /**
   * Busca um asset pelo productId.
   * @param {string} productId
   * @returns {Promise<import('./ProductAsset.js').ProductAsset|null>}
   */
  async findById(productId) {
    throw new Error(`${this.constructor.name} must implement findById()`);
  }

  /**
   * Busca todos os assets de uma loja.
   * @param {string} storeId
   * @returns {Promise<import('./ProductAsset.js').ProductAsset[]>}
   */
  async findByStore(storeId) {
    throw new Error(`${this.constructor.name} must implement findByStore()`);
  }

  /**
   * Busca um asset pelo SKU dentro de uma loja.
   * @param {string} storeId
   * @param {string} sku
   * @returns {Promise<import('./ProductAsset.js').ProductAsset|null>}
   */
  async findBySKU(storeId, sku) {
    throw new Error(`${this.constructor.name} must implement findBySKU()`);
  }
}

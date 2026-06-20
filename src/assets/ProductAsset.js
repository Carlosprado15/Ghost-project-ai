/**
 * PRODUCT ASSET — GHOST PROJECT AI
 *
 * Representa um produto completo com todos os seus ativos digitais.
 * Unidade central do pipeline: Imagem → Validação → Fila → IA 3D → GLB → Preview → Publicação → Scanner.
 */

import { AssetStatus } from './AssetStatus.js';

export class ProductAsset {
  /**
   * @param {Object} params
   * @param {string}   params.productId
   * @param {string}   params.storeId
   * @param {string}   params.sku
   * @param {string}   params.name
   * @param {string}   params.brand
   * @param {string}   params.category
   * @param {string[]} [params.images]        - URLs das imagens de entrada
   * @param {string}   [params.glbModel]      - URL do modelo GLB gerado
   * @param {string}   [params.previewImage]  - URL da imagem de preview
   * @param {string}   [params.thumbnail]     - URL do thumbnail
   * @param {Object}   [params.metadata]      - Dados extras (dimensões, peso, etc.)
   */
  constructor({
    productId,
    storeId,
    sku,
    name,
    brand,
    category,
    images      = [],
    glbModel    = null,
    previewImage = null,
    thumbnail   = null,
    metadata    = {},
  }) {
    this.productId    = productId;
    this.storeId      = storeId;
    this.sku          = sku;
    this.name         = name;
    this.brand        = brand;
    this.category     = category;
    this.images       = images;
    this.glbModel     = glbModel;
    this.previewImage = previewImage;
    this.thumbnail    = thumbnail;
    this.metadata     = metadata;

    this.status    = AssetStatus.PENDING;
    this.createdAt = new Date().toISOString();
    this.updatedAt = new Date().toISOString();
  }

  /**
   * Atualiza o status e registra o timestamp de modificação.
   * @param {string} status - Valor de AssetStatus
   */
  setStatus(status) {
    this.status    = status;
    this.updatedAt = new Date().toISOString();
  }

  /**
   * Atualiza campos parciais do asset.
   * @param {Partial<ProductAsset>} fields
   */
  update(fields) {
    const allowed = ['name', 'brand', 'category', 'images', 'glbModel', 'previewImage', 'thumbnail', 'metadata'];
    for (const key of allowed) {
      if (key in fields) this[key] = fields[key];
    }
    this.updatedAt = new Date().toISOString();
  }

  /** @returns {boolean} */
  isReady() {
    return this.status === AssetStatus.READY;
  }

  toJSON() {
    return {
      productId:    this.productId,
      storeId:      this.storeId,
      sku:          this.sku,
      name:         this.name,
      brand:        this.brand,
      category:     this.category,
      images:       this.images,
      glbModel:     this.glbModel,
      previewImage: this.previewImage,
      thumbnail:    this.thumbnail,
      status:       this.status,
      createdAt:    this.createdAt,
      updatedAt:    this.updatedAt,
      metadata:     this.metadata,
    };
  }
}

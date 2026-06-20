/**
 * PipelineStrategy — motor de decisão inteligente do pipeline de geração 3D.
 *
 * Responsabilidades:
 *  - Decidir qual provider utilizar para cada imagem (delegando ao ProviderSelector)
 *  - Decidir quando tentar novamente após um erro transiente
 *  - Decidir quando reutilizar o cache em vez de gerar novamente
 *  - Decidir quando comprimir o modelo antes de entregar ao consumidor
 *
 * Esta classe é o único ponto de política do pipeline: alterar regras de negócio
 * (retry budget, threshold de compressão, habilitação de cache) requer apenas
 * mudar esta classe, sem tocar providers, cache ou validator.
 */

export class PipelineStrategy {
  /**
   * @param {object} [options]
   * @param {number}  [options.maxRetries=2]                  - Tentativas máximas por erro transiente
   * @param {boolean} [options.cacheEnabled=true]             - Habilitar reutilização de cache
   * @param {number}  [options.compressionThresholdBytes=10MB] - Tamanho mínimo para comprimir
   */
  constructor(options = {}) {
    this.maxRetries = options.maxRetries ?? 2;
    this.cacheEnabled = options.cacheEnabled ?? true;
    this.compressionThresholdBytes = options.compressionThresholdBytes ?? 10 * 1024 * 1024;

    // Padrões de erro que justificam nova tentativa
    this._retryablePatterns = [
      /network/i,
      /timeout/i,
      /rate.?limit/i,
      /\b5\d{2}\b/, // HTTP 5xx
    ];
  }

  /**
   * Escolhe o provider mais adequado para a imagem dada.
   * Não conhece nomes de providers — delega inteiramente ao ProviderSelector.
   *
   * @param {object} imageInfo - Metadados da imagem { type, size, name? }
   * @param {import('./ProviderSelector.js').ProviderSelector} providerSelector
   * @returns {import('./providers/BaseProvider.js').BaseProvider}
   */
  chooseProvider(imageInfo, providerSelector) {
    return providerSelector.select(imageInfo);
  }

  /**
   * Decide se o pipeline deve tentar novamente após um erro.
   *
   * @param {Error|string} error   - Erro capturado
   * @param {number}       attempt - Número da tentativa atual (0-based)
   * @returns {boolean}
   */
  shouldRetry(error, attempt = 0) {
    if (attempt >= this.maxRetries) return false;
    const message = String(error?.message ?? error);
    return this._retryablePatterns.some((pattern) => pattern.test(message));
  }

  /**
   * Decide se o cache deve ser consultado para o hash fornecido.
   *
   * @param {string} imageHash
   * @returns {boolean}
   */
  shouldUseCache(imageHash) {
    if (!this.cacheEnabled) return false;
    if (!imageHash || imageHash === 'null') return false;
    return true;
  }

  /**
   * Decide se o modelo deve ser comprimido antes de ser entregue.
   * Modelos grandes aumentam o tempo de carregamento no AR viewer.
   *
   * @param {{ sizeBytes?: number, url?: string }} modelInfo
   * @returns {boolean}
   */
  shouldCompress(modelInfo = {}) {
    const { sizeBytes = 0 } = modelInfo;
    return sizeBytes > this.compressionThresholdBytes;
  }
}

/**
 * ProviderSelector — registro e seleção automática de providers de geração 3D.
 *
 * Responsabilidades:
 *  - Manter um registro de todos os providers disponíveis (Meshy, Tripo, futuros)
 *  - Selecionar automaticamente o melhor provider com base em prioridade e contexto
 *  - Isolar completamente o restante do sistema dos nomes e detalhes de cada provider
 *
 * Nomes de providers (Meshy, Tripo, etc.) jamais devem aparecer fora desta camada.
 * Para adicionar um novo provider: apenas chamar register() — zero alterações no pipeline.
 */

export class ProviderSelector {
  constructor() {
    /**
     * Lista de entradas ordenada por prioridade decrescente.
     * @type {Array<{ provider: import('./providers/BaseProvider.js').BaseProvider, priority: number }>}
     */
    this._registry = [];
  }

  /**
   * Registra um provider para uso pelo pipeline.
   * Providers com maior priority são preferidos na seleção automática.
   *
   * @param {import('./providers/BaseProvider.js').BaseProvider} provider
   * @param {number} [priority=0] - Prioridade relativa (maior = preferido)
   * @returns {this} Para encadeamento: selector.register(a).register(b)
   */
  register(provider, priority = 0) {
    if (!provider || typeof provider.submitImage !== 'function') {
      throw new Error('[ProviderSelector] Provider must implement BaseProvider interface.');
    }
    this._registry.push({ provider, priority });
    this._registry.sort((a, b) => b.priority - a.priority);
    console.log(`[ProviderSelector] Registered provider "${provider.name}" (priority ${priority})`);
    return this;
  }

  /**
   * Seleciona o melhor provider disponível para a imagem fornecida.
   * Critério atual: provider de maior prioridade registrado.
   * Critérios futuros: health check, custo estimado, tipo de imagem.
   *
   * @param {object} [imageInfo={}] - Metadados da imagem (type, size, etc.)
   * @returns {import('./providers/BaseProvider.js').BaseProvider}
   */
  select(imageInfo = {}) {
    if (this._registry.length === 0) {
      throw new Error('[ProviderSelector] No providers registered. Call register() before run().');
    }
    const chosen = this._registry[0].provider;
    console.log(`[ProviderSelector] Selected provider "${chosen.name}"`);
    return chosen;
  }

  /**
   * Retorna todos os providers registrados (cópia imutável).
   * @returns {Array<import('./providers/BaseProvider.js').BaseProvider>}
   */
  getAll() {
    return this._registry.map(({ provider }) => provider);
  }

  /** Retorna o número de providers registrados. */
  count() {
    return this._registry.length;
  }
}

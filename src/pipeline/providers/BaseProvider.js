/**
 * BaseProvider — contrato base e utilitários compartilhados para providers de geração 3D.
 *
 * Cada provider concreto (Meshy, Tripo, etc.) deve estender esta classe.
 * O ImageToModelPipeline depende exclusivamente desta interface.
 *
 * Implementações compartilhadas:
 *  - validateModel(): carrega o GLB via GLTFLoader e verifica scene/meshes/nodes
 *  - _fetchWithRetry(): HTTP com retry, backoff exponencial e timeout por AbortController
 *  - _backoffDelay(): delay para 429 e 5xx
 *  - _delay(): sleep utilitário
 */

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class BaseProvider {
  /**
   * @param {string} name   - Identificador legível do provider (ex: "meshy", "tripo")
   * @param {object} config - Configurações específicas (apiKey, baseUrl, timeouts, etc.)
   */
  constructor(name, config = {}) {
    if (new.target === BaseProvider) {
      throw new Error('BaseProvider é abstrato e não pode ser instanciado diretamente.');
    }
    this.name         = name;
    this.config       = config;
    this.maxRetries   = config.maxRetries   ?? 3;
    this.timeoutMs    = config.timeoutMs    ?? 120_000;
    this.retryDelayMs = config.retryDelayMs ?? 1_000;
  }

  /**
   * Envia imagem ao provider e retorna o jobId criado.
   * @param {Blob|File|string} image
   * @param {object} options
   * @returns {Promise<string>} jobId
   */
  async submitImage(image, options = {}) {
    throw new Error(`${this.name}.submitImage() não implementado.`);
  }

  /**
   * Retorna status, progresso e URL do modelo (quando disponível).
   * @param {string} jobId
   * @returns {Promise<{ status: string, progress: number, modelUrl?: string }>}
   */
  async getJobStatus(jobId) {
    throw new Error(`${this.name}.getJobStatus() não implementado.`);
  }

  /**
   * Retorna a URL do GLB gerado após conclusão do job.
   * @param {string} jobId
   * @returns {Promise<{ url: string, blob?: Blob }>}
   */
  async downloadModel(jobId) {
    throw new Error(`${this.name}.downloadModel() não implementado.`);
  }

  /**
   * Cancela um job em andamento.
   * @param {string} jobId
   * @returns {Promise<boolean>}
   */
  async cancelJob(jobId) {
    throw new Error(`${this.name}.cancelJob() não implementado.`);
  }

  /**
   * Valida o arquivo GLB retornado pelo provider usando THREE.GLTFLoader.
   *
   * Verifica:
   *  - URL presente e não-vazia
   *  - Arquivo GLB carregável (formato válido)
   *  - scene existente no GLTF
   *  - ao menos um node na cena
   *  - ao menos uma mesh na cena
   *
   * @param {string} modelUrl - URL pública do GLB
   * @returns {Promise<{ valid: boolean, errors: string[] }>}
   */
  async validateModel(modelUrl) {
    if (!modelUrl || typeof modelUrl !== 'string') {
      return { valid: false, errors: ['Model URL ausente ou inválida'] };
    }

    return new Promise((resolve) => {
      const loader = new GLTFLoader();

      loader.load(
        modelUrl,
        (gltf) => {
          const errors = [];

          if (!gltf.scene) {
            errors.push('GLB não contém scene');
          }

          let nodeCount = 0;
          let meshCount = 0;

          gltf.scene?.traverse((child) => {
            nodeCount++;
            if (child.isMesh) meshCount++;
          });

          if (nodeCount === 0) errors.push('GLB sem nodes na scene');
          if (meshCount === 0) errors.push('GLB sem meshes na scene');

          console.log(
            `[${this.name}] validateModel — nodes: ${nodeCount}, meshes: ${meshCount}, ` +
            `válido: ${errors.length === 0}`
          );

          resolve({ valid: errors.length === 0, errors });
        },
        null, // progress — não utilizado aqui
        (err) => {
          const msg = err?.message ?? String(err);
          resolve({ valid: false, errors: [`Falha ao carregar GLB: ${msg}`] });
        }
      );
    });
  }

  // ─── Utilitários HTTP compartilhados ───────────────────────────────────────

  /**
   * Executa fetch com retry automático, timeout e tratamento de erros HTTP.
   *
   * Sem retry (terminais): 401 Unauthorized, 403 Forbidden, 404 Not Found
   * Com retry + backoff: 429 Rate Limit, 500 Internal Error, 503 Unavailable
   *
   * @param {string}      url
   * @param {RequestInit} init
   * @param {number}      [attempt=0]
   * @returns {Promise<Response>}
   */
  async _fetchWithRetry(url, init, attempt = 0) {
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), this.timeoutMs);

    let response;
    try {
      response = await fetch(url, { ...init, signal: controller.signal });
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error(`[${this.name}] Timeout após ${this.timeoutMs}ms — ${url}`);
      }
      throw new Error(`[${this.name}] Erro de rede: ${err.message}`);
    } finally {
      clearTimeout(timeoutId);
    }

    if (response.ok) return response;

    const { status } = response;

    // Erros terminais — falha imediata sem retry
    if (status === 401) throw new Error(`[${this.name}] 401 Unauthorized — verifique a API key`);
    if (status === 403) throw new Error(`[${this.name}] 403 Forbidden — sem permissão`);
    if (status === 404) throw new Error(`[${this.name}] 404 Not Found — ${url}`);

    // Erros transientes — retry com backoff exponencial
    const isRetryable = status === 429 || status === 500 || status === 503;
    if (isRetryable && attempt < this.maxRetries) {
      const delay = this._backoffDelay(attempt, status);
      console.warn(`[${this.name}] HTTP ${status} — retry ${attempt + 1}/${this.maxRetries} em ${delay}ms`);
      await this._delay(delay);
      return this._fetchWithRetry(url, init, attempt + 1);
    }

    const body = await response.text().catch(() => '');
    throw new Error(`[${this.name}] HTTP ${status}: ${body.slice(0, 300)}`);
  }

  _backoffDelay(attempt, status) {
    if (status === 429) return Math.min(5_000 * (attempt + 1), 30_000);
    return Math.min(this.retryDelayMs * Math.pow(2, attempt), 15_000);
  }

  _delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

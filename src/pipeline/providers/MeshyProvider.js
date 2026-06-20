/**
 * MeshyProvider — integração real com a API Meshy.ai (image-to-3d).
 *
 * Fluxo:
 *   submitImage()  →  POST /v1/image-to-3d  →  jobId
 *   getJobStatus() →  GET  /v1/image-to-3d/{id}  →  { status, progress }
 *   downloadModel() →  GET  /v1/image-to-3d/{id}  →  model_urls.glb
 *   cancelJob()    →  DELETE /v1/image-to-3d/{id}
 *   validateModel() →  herdado de BaseProvider (THREE.GLTFLoader)
 *
 * Configuração: definir VITE_MESHY_API_KEY no arquivo .env.local
 * Documentação: https://docs.meshy.ai
 */

import { BaseProvider } from './BaseProvider.js';

const BASE_URL = 'https://api.meshy.ai/v1';

export class MeshyProvider extends BaseProvider {
  /**
   * @param {object} [config]
   * @param {string}  [config.apiKey]            - Sobrescreve VITE_MESHY_API_KEY
   * @param {string}  [config.baseUrl]           - Sobrescreve URL base da API
   * @param {boolean} [config.enablePbr=true]    - Materiais PBR
   * @param {string}  [config.aiModel='meshy-4'] - Modelo de IA
   * @param {number}  [config.maxRetries=3]
   * @param {number}  [config.timeoutMs=120000]
   */
  constructor(config = {}) {
    super('meshy', config);
    this.baseUrl   = config.baseUrl   || BASE_URL;
    this.apiKey    = config.apiKey    || import.meta.env.VITE_MESHY_API_KEY || null;
    this.enablePbr = config.enablePbr ?? true;
    this.aiModel   = config.aiModel   ?? 'meshy-4';
  }

  /**
   * Converte imagem para URL/base64 e cria um job de geração na Meshy.
   * Retorna o jobId para polling.
   *
   * @param {Blob|File|string} image
   * @param {object} [options] - Sobrescreve enablePbr, aiModel por chamada
   * @returns {Promise<string>} jobId
   */
  async submitImage(image, options = {}) {
    console.log('[MeshyProvider] Upload iniciado');

    const imageUrl = await this._toImageUrl(image);
    const body = {
      image_url:  imageUrl,
      enable_pbr: options.enablePbr ?? this.enablePbr,
      ai_model:   options.aiModel   ?? this.aiModel,
    };

    const response = await this._fetchWithRetry(`${this.baseUrl}/image-to-3d`, {
      method:  'POST',
      headers: this._headers(),
      body:    JSON.stringify(body),
    });

    const data  = await response.json();
    const jobId = data.result ?? data.id;

    if (!jobId) throw new Error('[MeshyProvider] API não retornou um jobId válido');

    console.log(`[MeshyProvider] Job criado: ${jobId}`);
    return jobId;
  }

  /**
   * Consulta o status do job. Mapeado para o formato interno do pipeline.
   * Status Meshy: PENDING | IN_PROGRESS | SUCCEEDED | FAILED | EXPIRED
   *
   * @param {string} jobId
   * @returns {Promise<{ status: string, progress: number }>}
   */
  async getJobStatus(jobId) {
    const response = await this._fetchWithRetry(`${this.baseUrl}/image-to-3d/${jobId}`, {
      method:  'GET',
      headers: this._headers(),
    });

    const data     = await response.json();
    const status   = data.status   ?? 'UNKNOWN';
    const progress = data.progress ?? 0;

    console.log(`[MeshyProvider] Progresso: ${progress}% — ${status}`);
    return { status, progress };
  }

  /**
   * Obtém a URL do GLB após SUCCEEDED.
   * Reutiliza o endpoint de status que já contém model_urls.
   *
   * @param {string} jobId
   * @returns {Promise<{ url: string, blob: null }>}
   */
  async downloadModel(jobId) {
    console.log(`[MeshyProvider] Download iniciado — job: ${jobId}`);

    const response = await this._fetchWithRetry(`${this.baseUrl}/image-to-3d/${jobId}`, {
      method:  'GET',
      headers: this._headers(),
    });

    const data = await response.json();
    const url  = data.model_urls?.glb;

    if (!url) {
      throw new Error(`[MeshyProvider] GLB URL ausente no job ${jobId}. Status: ${data.status}`);
    }

    return { url, blob: null };
  }

  /**
   * Solicita cancelamento do job.
   * DELETE pode não existir em todos os planos — falha silenciosa.
   *
   * @param {string} jobId
   * @returns {Promise<boolean>}
   */
  async cancelJob(jobId) {
    console.log(`[MeshyProvider] Cancelamento solicitado — job: ${jobId}`);
    try {
      await this._fetchWithRetry(`${this.baseUrl}/image-to-3d/${jobId}`, {
        method:  'DELETE',
        headers: this._headers(),
      });
    } catch (err) {
      console.warn(`[MeshyProvider] Cancel indisponível: ${err.message}`);
    }
    return true;
  }

  // ─── Privados ──────────────────────────────────────────────────────────────

  _headers() {
    if (!this.apiKey) {
      throw new Error('[MeshyProvider] VITE_MESHY_API_KEY não definida no .env.local');
    }
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  /** Converte File/Blob para base64 data URL. Strings passam sem conversão. */
  async _toImageUrl(image) {
    if (typeof image === 'string') return image;

    if (image instanceof Blob || image instanceof File) {
      return new Promise((resolve, reject) => {
        const reader   = new FileReader();
        reader.onload  = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('[MeshyProvider] Falha ao ler arquivo de imagem'));
        reader.readAsDataURL(image);
      });
    }

    throw new Error(
      `[MeshyProvider] Tipo de imagem não suportado: ${Object.prototype.toString.call(image)}`
    );
  }
}

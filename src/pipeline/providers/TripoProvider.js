/**
 * TripoProvider — integração real com a API Tripo3D v3 (image-to-model).
 *
 * Fluxo:
 *   submitImage()   →  [upload file → file_token]  →  POST /generation/image-to-model  →  task_id
 *   getJobStatus()  →  GET /tasks/{id}  →  { status, progress }
 *   downloadModel() →  GET /tasks/{id}  →  output.model_url (GLB URL)
 *   cancelJob()     →  DELETE /tasks/{id} (falha silenciosa)
 *   validateModel() →  herdado de BaseProvider (THREE.GLTFLoader)
 *
 * Status Tripo: queued | running | success | failed | cancelled | banned | unknown
 *
 * Configuração: passar { apiKey } no construtor a partir de código
 * servidor/CLI (ex: scripts/normalize-glb/generate-from-tripo.mjs). NUNCA
 * ler a chave de import.meta.env.VITE_* aqui — isso a grava em texto puro
 * no bundle enviado ao navegador (ver incidente de segurança 2026-07-09).
 * Documentação: https://platform.tripo3d.ai/docs (API v3, migrada em 2026-07-09 — a
 * v2/openapi antiga usada por este provider foi descontinuada)
 */

import { BaseProvider } from './BaseProvider.js';

const BASE_URL = 'https://openapi.tripo3d.ai/v3';
const DEFAULT_MODEL_VERSION = 'v3.0-20250812';

// Mapeamento de status Tripo → formato interno (igual ao Meshy)
const STATUS_MAP = {
  queued:    'PENDING',
  running:   'IN_PROGRESS',
  success:   'SUCCEEDED',
  failed:    'FAILED',
  cancelled: 'CANCELLED',
  banned:    'FAILED',
  unknown:   'UNKNOWN',
};

export class TripoProvider extends BaseProvider {
  /**
   * @param {object} [config]
   * @param {string}  [config.apiKey]        - Sobrescreve VITE_TRIPO_API_KEY
   * @param {string}  [config.baseUrl]       - Sobrescreve URL base da API
   * @param {number}  [config.maxRetries=3]
   * @param {number}  [config.timeoutMs=120000]
   */
  constructor(config = {}) {
    super('tripo', config);
    this.baseUrl = config.baseUrl || BASE_URL;
    // SEGURANÇA (2026-07-09): nunca ler a chave de import.meta.env aqui.
    // Qualquer VITE_* referenciado em código alcançável pelo bundle do
    // navegador é gravado em texto puro no JS final — visível a qualquer
    // visitante da loja. A chave só deve ser passada em config.apiKey por
    // quem chama este provider a partir de um ambiente servidor/CLI.
    this.apiKey  = config.apiKey || null;
  }

  /**
   * Envia a imagem para a Tripo e cria uma task image_to_model.
   *
   * - File/Blob:  faz upload multipart → obtém file_token → cria task
   * - URL pública: passa diretamente via file.url na task
   * - data URL (base64): converte para Blob e faz upload
   *
   * @param {Blob|File|string} image
   * @returns {Promise<string>} task_id
   */
  async submitImage(image, options = {}) {
    console.log('[TripoProvider] Upload iniciado');

    let input;
    if (typeof image === 'string' && image.startsWith('http')) {
      // URL pública — passa diretamente como `input`
      input = image;
    } else {
      // File, Blob ou data URL — upload multipart primeiro, usa o file_token retornado
      const blob = await this._toBlob(image);
      const ext  = this._extFromBlob(blob);
      input = await this._uploadFile(blob, ext);
    }

    const response = await this._fetchWithRetry(`${this.baseUrl}/generation/image-to-model`, {
      method:  'POST',
      headers: this._headers(),
      body:    JSON.stringify({
        input,
        model:           options.modelVersion  ?? DEFAULT_MODEL_VERSION,
        texture:         options.texture       ?? true,
        pbr:             options.pbr           ?? true,
        texture_quality: options.textureQuality ?? 'standard',
      }),
    });

    const data   = await response.json();
    const taskId = data?.data?.task_id;

    if (!taskId) throw new Error('[TripoProvider] API não retornou um task_id válido');

    console.log(`[TripoProvider] Job criado: ${taskId}`);
    return taskId;
  }

  /**
   * Consulta o status da task e mapeia para o formato interno.
   *
   * @param {string} taskId
   * @returns {Promise<{ status: string, progress: number }>}
   */
  async getJobStatus(taskId) {
    const response = await this._fetchWithRetry(`${this.baseUrl}/tasks/${taskId}`, {
      method:  'GET',
      headers: this._headers(),
    });

    const data     = await response.json();
    const raw      = data?.data?.status ?? 'unknown';
    const status   = STATUS_MAP[raw] ?? 'UNKNOWN';
    const progress = data?.data?.progress ?? 0;

    console.log(`[TripoProvider] Progresso: ${progress}% — ${raw} → ${status}`);
    return { status, progress };
  }

  /**
   * Obtém a URL do GLB após conclusão da task.
   *
   * @param {string} taskId
   * @returns {Promise<{ url: string, blob: null }>}
   */
  async downloadModel(taskId) {
    console.log(`[TripoProvider] Download iniciado — task: ${taskId}`);

    const response = await this._fetchWithRetry(`${this.baseUrl}/tasks/${taskId}`, {
      method:  'GET',
      headers: this._headers(),
    });

    const data = await response.json();
    const url  = data?.data?.output?.model_url;

    if (!url) {
      throw new Error(
        `[TripoProvider] GLB URL ausente na task ${taskId}. Status: ${data?.data?.status}`
      );
    }

    return { url, blob: null };
  }

  /**
   * Solicita cancelamento da task.
   * A Tripo não garante endpoint de cancel — falha silenciosa.
   *
   * @param {string} taskId
   * @returns {Promise<boolean>}
   */
  async cancelJob(taskId) {
    console.log(`[TripoProvider] Cancelamento solicitado — task: ${taskId}`);
    try {
      await this._fetchWithRetry(`${this.baseUrl}/tasks/${taskId}`, {
        method:  'DELETE',
        headers: this._headers(),
      });
    } catch (err) {
      console.warn(`[TripoProvider] Cancel indisponível: ${err.message}`);
    }
    return true;
  }

  // ─── Privados ──────────────────────────────────────────────────────────────

  _headers() {
    if (!this.apiKey) {
      throw new Error('[TripoProvider] apiKey não fornecida — chamadas ao Tripo3D só devem ser feitas por um servidor/CLI que injete config.apiKey, nunca via variável VITE_* embutida no bundle do navegador');
    }
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Faz upload de um arquivo de imagem e retorna o file_token da Tripo.
   * Utiliza Content-Type multipart/form-data (sem o header explícito — fetch define o boundary).
   */
  async _uploadFile(blob, ext) {
    const form = new FormData();
    form.append('file', blob, `image.${ext}`);

    const uploadHeaders = { Authorization: `Bearer ${this.apiKey}` };

    const response = await this._fetchWithRetry(`${this.baseUrl}/upload/file`, {
      method:  'POST',
      headers: uploadHeaders,
      body:    form,
    });

    const data  = await response.json();
    const token = data?.data?.image_token;

    if (!token) throw new Error('[TripoProvider] Upload não retornou image_token');
    return token;
  }

  /** Converte File/Blob/data-URL para Blob. */
  async _toBlob(image) {
    if (image instanceof Blob || image instanceof File) return image;

    if (typeof image === 'string' && image.startsWith('data:')) {
      const res  = await fetch(image);
      return res.blob();
    }

    throw new Error(
      `[TripoProvider] Tipo de imagem não suportado para upload: ${Object.prototype.toString.call(image)}`
    );
  }

  /** Extrai extensão a partir de um Blob/File (png, jpg, webp). */
  _extFromBlob(blob) {
    const mime = blob.type || '';
    if (mime.includes('png'))  return 'png';
    if (mime.includes('webp')) return 'webp';
    if (blob instanceof File && blob.name) {
      const ext = blob.name.split('.').pop().toLowerCase();
      if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) return ext === 'jpeg' ? 'jpg' : ext;
    }
    return 'jpg';
  }

  /** Extrai extensão a partir de uma URL pública. */
  _extFromUrl(url) {
    try {
      const path = new URL(url).pathname;
      const ext  = path.split('.').pop().toLowerCase();
      if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) return ext === 'jpeg' ? 'jpg' : ext;
    } catch (_) {}
    return 'jpg';
  }
}

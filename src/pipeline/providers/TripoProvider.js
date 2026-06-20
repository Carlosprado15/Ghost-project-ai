/**
 * TripoProvider — integração real com a API Tripo3D (image-to-model).
 *
 * Fluxo:
 *   submitImage()   →  [upload file → file_token]  →  POST /task  →  task_id
 *   getJobStatus()  →  GET /task/{id}  →  { status, progress }
 *   downloadModel() →  GET /task/{id}  →  output.model (GLB URL)
 *   cancelJob()     →  DELETE /task/{id} (falha silenciosa)
 *   validateModel() →  herdado de BaseProvider (THREE.GLTFLoader)
 *
 * Status Tripo: queued | running | success | failed | cancelled | unknown
 *
 * Configuração: definir VITE_TRIPO_API_KEY no arquivo .env.local
 * Documentação: https://platform.tripo3d.ai/docs
 */

import { BaseProvider } from './BaseProvider.js';

const BASE_URL = 'https://api.tripo3d.ai/v2/openapi';

// Mapeamento de status Tripo → formato interno (igual ao Meshy)
const STATUS_MAP = {
  queued:    'PENDING',
  running:   'IN_PROGRESS',
  success:   'SUCCEEDED',
  failed:    'FAILED',
  cancelled: 'CANCELLED',
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
    this.apiKey  = config.apiKey  || import.meta.env.VITE_TRIPO_API_KEY || null;
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

    let filePayload;

    if (typeof image === 'string' && image.startsWith('http')) {
      // URL pública — passa diretamente para a task
      const ext = this._extFromUrl(image);
      filePayload = { type: ext, url: image };
    } else {
      // File, Blob ou data URL — upload multipart primeiro
      const blob      = await this._toBlob(image);
      const ext       = this._extFromBlob(blob);
      const fileToken = await this._uploadFile(blob, ext);
      filePayload = { type: ext, file_token: fileToken };
    }

    const response = await this._fetchWithRetry(`${this.baseUrl}/task`, {
      method:  'POST',
      headers: this._headers(),
      body:    JSON.stringify({ type: 'image_to_model', file: filePayload }),
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
    const response = await this._fetchWithRetry(`${this.baseUrl}/task/${taskId}`, {
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

    const response = await this._fetchWithRetry(`${this.baseUrl}/task/${taskId}`, {
      method:  'GET',
      headers: this._headers(),
    });

    const data = await response.json();
    const url  = data?.data?.output?.model;

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
      await this._fetchWithRetry(`${this.baseUrl}/task/${taskId}`, {
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
      throw new Error('[TripoProvider] VITE_TRIPO_API_KEY não definida no .env.local');
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

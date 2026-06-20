/**
 * ImageToModelPipeline — orquestrador central do Ghost Pipeline Intelligence.
 *
 * Fluxo:
 *   Imagem → PipelineValidator → PipelineCache → ProviderSelector (fallback automático) →
 *   Provider → PipelineValidator → PipelineCache → modelUrl
 *
 * Provider fallback: tenta todos os providers registrados em ordem de prioridade.
 * O usuário nunca vê o nome do provider — falha silenciosa e troca automática.
 */

import { PipelineValidator } from './PipelineValidator.js';
import { PipelineCache }    from './PipelineCache.js';
import { PipelineStrategy } from './PipelineStrategy.js';
import { ProviderSelector } from './ProviderSelector.js';

export const PipelineState = Object.freeze({
  IDLE:       'IDLE',
  VALIDATING: 'VALIDATING',
  UPLOADING:  'UPLOADING',
  GENERATING: 'GENERATING',
  DOWNLOADING:'DOWNLOADING',
  READY:      'READY',
  ERROR:      'ERROR',
});

export class ImageToModelPipeline {
  /**
   * @param {object}  [options]
   * @param {PipelineValidator}  [options.validator]
   * @param {PipelineCache}      [options.cache]
   * @param {PipelineStrategy}   [options.strategy]
   * @param {ProviderSelector}   [options.providerSelector]
   * @param {BaseProvider}       [options.provider]
   * @param {BaseProvider[]}     [options.providers]
   * @param {number}  [options.pollIntervalMs=3000]
   * @param {number}  [options.maxPollAttempts=60]
   */
  constructor(options = {}) {
    this.validator        = options.validator        ?? new PipelineValidator();
    this.cache            = options.cache            ?? new PipelineCache();
    this.strategy         = options.strategy         ?? new PipelineStrategy();
    this.providerSelector = options.providerSelector ?? new ProviderSelector();

    this.pollIntervalMs   = options.pollIntervalMs   ?? 3000;
    this.maxPollAttempts  = options.maxPollAttempts  ?? 60;

    this.state            = PipelineState.IDLE;
    this._currentJobId    = null;
    this._currentProvider = null;
    this._abortRequested  = false;

    if (options.provider) {
      this.providerSelector.register(options.provider, 0);
    }
    if (Array.isArray(options.providers)) {
      options.providers.forEach((p, i) =>
        this.providerSelector.register(p, options.providers.length - i)
      );
    }
  }

  /**
   * Executa o pipeline completo com fallback automático entre providers.
   *
   * @param {Blob|File|string} image
   * @param {object}   [options]
   * @param {function(state: string, progress: number): void} [options.onProgress]
   * @param {object}   [options.providerOptions]
   * @returns {Promise<string>} modelUrl — URL do GLB validado
   */
  async run(image, options = {}) {
    const { onProgress, providerOptions = {} } = options;
    this._abortRequested = false;

    try {
      console.log('[ImageToModelPipeline] Pipeline iniciado');

      // ── 1. Validar imagem de entrada ──────────────────────────────────────
      this._transition(PipelineState.VALIDATING, 0, onProgress);
      const imageValidation = this.validator.validateImage(image);
      if (!imageValidation.valid) {
        throw new Error(`Imagem inválida: ${imageValidation.errors.join(', ')}`);
      }

      // ── 2. Verificar cache (SHA-256) ──────────────────────────────────────
      const imageHash = await this._computeHash(image);
      if (this.strategy.shouldUseCache(imageHash) && this.cache.has(imageHash)) {
        console.log(`[ImageToModelPipeline] Cache hit — hash: ${imageHash}`);
        const cached = this.cache.get(imageHash);
        this._transition(PipelineState.READY, 100, onProgress);
        return cached.model;
      }

      // ── 3. Tentar providers em ordem de prioridade (fallback automático) ──
      const providers = this.providerSelector.getAll();
      if (providers.length === 0) {
        throw new Error('[ImageToModelPipeline] Nenhum provider registrado.');
      }

      const imageInfo = this._extractImageInfo(image);
      let lastError   = null;

      for (const provider of providers) {
        if (this._abortRequested) break;

        try {
          const modelUrl = await this._runWithProvider(
            provider, image, imageInfo, imageHash, providerOptions, onProgress
          );
          this._transition(PipelineState.READY, 100, onProgress);
          this._currentJobId    = null;
          this._currentProvider = null;
          console.log(`[ImageToModelPipeline] Pipeline concluído via "${provider.name}"`);
          return modelUrl;
        } catch (err) {
          lastError = err;
          console.warn(
            `[ImageToModelPipeline] Provider "${provider.name}" falhou: ${err.message}. ` +
            `${providers.indexOf(provider) < providers.length - 1 ? 'Tentando próximo...' : 'Sem mais providers.'}`
          );
        }
      }

      throw lastError ?? new Error('Todos os providers falharam.');

    } catch (err) {
      console.error(`[ImageToModelPipeline] Erro: ${err.message}`);
      this._transition(PipelineState.ERROR, 0, onProgress);
      throw err;
    }
  }

  /**
   * Solicita cancelamento do job ativo.
   */
  async cancel() {
    this._abortRequested = true;
    if (this._currentJobId && this._currentProvider) {
      await this._currentProvider.cancelJob(this._currentJobId).catch(() => {});
      this._currentJobId    = null;
      this._currentProvider = null;
    }
    this.state = PipelineState.IDLE;
    return true;
  }

  getState() {
    return this.state;
  }

  // ---------------------------------------------------------------------------

  async _runWithProvider(provider, image, imageInfo, imageHash, providerOptions, onProgress) {
    this._currentProvider = provider;

    // Upload
    this._transition(PipelineState.UPLOADING, 10, onProgress);
    const jobId = await provider.submitImage(image, providerOptions);
    this._currentJobId = jobId;

    // Polling
    this._transition(PipelineState.GENERATING, 20, onProgress);
    await this._pollUntilDone(provider, jobId, onProgress);

    // Download
    this._transition(PipelineState.DOWNLOADING, 80, onProgress);
    const { url: modelUrl } = await provider.downloadModel(jobId);

    // Validar GLB
    this._transition(PipelineState.VALIDATING, 90, onProgress);
    const glbValidation = await provider.validateModel(modelUrl);
    if (!glbValidation.valid) {
      throw new Error(`Modelo inválido: ${glbValidation.errors.join(', ')}`);
    }

    // Cache
    this.cache.save(imageHash, modelUrl);

    return modelUrl;
  }

  async _pollUntilDone(provider, jobId, onProgress) {
    const DONE = new Set(['SUCCEEDED', 'success', 'COMPLETED', 'completed']);
    const FAIL = new Set(['FAILED', 'failed', 'ERROR', 'error', 'CANCELLED', 'cancelled']);

    for (let attempt = 0; attempt < this.maxPollAttempts; attempt++) {
      if (this._abortRequested) throw new Error('Pipeline cancelado pelo usuário.');

      const { status, progress } = await provider.getJobStatus(jobId);

      if (DONE.has(status)) {
        onProgress?.(PipelineState.GENERATING, 75);
        return;
      }
      if (FAIL.has(status)) {
        throw new Error(`Provider reportou falha no job ${jobId}: ${status}`);
      }

      const mapped = 20 + Math.min((progress ?? attempt * 2), 55);
      onProgress?.(PipelineState.GENERATING, mapped);

      await this._delay(this.pollIntervalMs);
    }

    throw new Error(`Timeout: job ${jobId} não concluiu em ${this.maxPollAttempts} tentativas.`);
  }

  /**
   * SHA-256 via SubtleCrypto (real content-addressable hash).
   * Fallback para identificador baseado em metadados se SubtleCrypto indisponível.
   */
  async _computeHash(image) {
    if (!image) return 'null';

    try {
      let buffer;

      if (image instanceof Blob || image instanceof File) {
        buffer = await image.arrayBuffer();
      } else if (typeof image === 'string') {
        buffer = new TextEncoder().encode(image.slice(0, 4096));
      } else {
        return `unknown_${Date.now()}`;
      }

      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray  = Array.from(new Uint8Array(hashBuffer));
      return 'sha_' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    } catch (_) {
      // SubtleCrypto indisponível (não-HTTPS em dev)
      if (image instanceof Blob || image instanceof File) {
        return `blob_${image.size}_${image.type}_${image instanceof File ? image.lastModified : ''}`;
      }
      if (typeof image === 'string') {
        let h = 5381;
        const limit = Math.min(image.length, 2048);
        for (let i = 0; i < limit; i++) {
          h = (((h << 5) + h) ^ image.charCodeAt(i)) >>> 0;
        }
        return `str_${h.toString(16)}_${image.length}`;
      }
      return `unknown_${Date.now()}`;
    }
  }

  _extractImageInfo(image) {
    if (typeof image === 'string') return { type: 'url',  size: image.length };
    if (image instanceof File)    return { type: 'file', size: image.size, name: image.name };
    if (image instanceof Blob)    return { type: 'blob', size: image.size };
    return { type: 'unknown' };
  }

  _transition(newState, progress, onProgress) {
    this.state = newState;
    console.log(`[ImageToModelPipeline] → ${newState} (${progress}%)`);
    onProgress?.(newState, progress);
  }

  _delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

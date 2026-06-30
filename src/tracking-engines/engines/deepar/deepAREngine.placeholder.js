import {
  createEngineDescriptor,
  GHOST_ENGINE_CATEGORIES,
  GHOST_ENGINE_STATUS,
  GHOST_ENGINE_RUNTIME,
} from '../../types.js';

const DEEPAR_CDN_URL = 'https://cdn.jsdelivr.net/npm/deepar/js/deepar.esm.js';

/**
 * Cria uma sessão DeepAR via CDN dynamic import.
 * NÃO requer npm install. SDK carregado sob demanda.
 *
 * @param {object} options
 * @param {string}      options.licenseKey    - VITE_DEEPAR_LICENSE_KEY
 * @param {HTMLElement} options.previewElement - Elemento DOM onde DeepAR renderiza
 * @param {string}      options.effectUrl      - URL do efeito DeepAR
 * @param {string}      [options.facingMode]   - 'environment' | 'user' (default: 'environment')
 * @returns {Promise<{ vendor, runtime, instance, stop }>}
 */
export async function createDeepARWebCdnSession({
  licenseKey,
  previewElement,
  effectUrl,
  facingMode = 'environment',
} = {}) {
  if (!licenseKey)     throw new Error('[deepar] licenseKey é obrigatório');
  if (!previewElement) throw new Error('[deepar] previewElement é obrigatório');

  // Dynamic import via CDN — Vite não bundla URLs absolutas
  const deeparMod = await import(/* @vite-ignore */ DEEPAR_CDN_URL);

  const deepAR = await deeparMod.initialize({
    licenseKey,
    previewElement,
    effect: effectUrl,
    additionalOptions: {
      cameraConfig: { facingMode },
    },
  });

  return {
    vendor:   'DeepAR',
    runtime:  'web-cdn',
    instance: deepAR,
    stop: async () => {
      try {
        if (typeof deepAR.shutdown === 'function') await deepAR.shutdown();
      } catch (_) {}
      try { previewElement.innerHTML = ''; } catch (_) {}
    },
  };
}

export const deepAREngine = createEngineDescriptor({
  id:       'deepar-wrist-placeholder',
  name:     'DeepAR Wrist Try-On (M068A)',
  category: GHOST_ENGINE_CATEGORIES.WRIST,
  status:   GHOST_ENGINE_STATUS.CANDIDATE,
  vendor:   'DeepAR (deepar.ai)',
  supportedProducts: ['watch', 'bracelet', 'ring'],
  runtimes: [
    GHOST_ENGINE_RUNTIME.WEB_MOBILE,
    GHOST_ENGINE_RUNTIME.IOS_SAFARI,
    GHOST_ENGINE_RUNTIME.ANDROID_CHROME,
  ],
  supportsOwn3DModels:       true,
  supportsWhiteLabel:        true,
  supportsShopifyEmbedded:   false, // needs-vendor-confirmation
  requiresCommercialLicense: true,
  notes: [
    'M068A: lab criado em ?lab=deepar. Usa CDN dynamic import — sem npm install.',
    'Exige VITE_DEEPAR_LICENSE_KEY configurada no .env.local.',
    'Efeito inicial de smoke test: aviators (não é wrist/watch ainda).',
    'createDeepARWebCdnSession() exportada para uso direto no lab.',
    'Wrist/watch real depende de M068B — buscar efeito oficial DeepAR para watches.',
    'NÃO integrar no scanner principal sem aprovação pelo avaliador objetivo do M066.',
    'supportsShopifyEmbedded: needs-vendor-confirmation (iframe CORS/CSP).',
  ].join(' | '),
  createSession: async (options = {}) => {
    return createDeepARWebCdnSession(options);
  },
});

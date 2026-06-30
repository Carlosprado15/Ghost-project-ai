import {
  createEngineDescriptor,
  GHOST_ENGINE_CATEGORIES,
  GHOST_ENGINE_STATUS,
  GHOST_ENGINE_RUNTIME,
} from '../../types.js';

export const viewerEngine = createEngineDescriptor({
  id:       'viewer-engine',
  name:     'model-viewer / Scene Viewer / AR Quick Look',
  category: GHOST_ENGINE_CATEGORIES.VIEWER,
  status:   GHOST_ENGINE_STATUS.READY,
  vendor:   'Google / Apple (open source)',
  supportedProducts: ['all-3d-products', 'furniture', 'decor', 'objects', 'watches-360'],
  runtimes: [
    GHOST_ENGINE_RUNTIME.WEB_MOBILE,
    GHOST_ENGINE_RUNTIME.IOS_SAFARI,
    GHOST_ENGINE_RUNTIME.ANDROID_CHROME,
    GHOST_ENGINE_RUNTIME.SHOPIFY_EMBEDDED,
  ],
  supportsOwn3DModels:       true,
  supportsWhiteLabel:        true,
  supportsShopifyEmbedded:   true,
  requiresCommercialLicense: false,
  notes: [
    'READY. Já em produção no Ghost Project — 15/15 produtos Click & Wear funcionando.',
    'Representa: model-viewer (web), Scene Viewer (Android) e AR Quick Look (iOS).',
    'Serve para: 360° interativo, visualização 3D e AR de ambiente (móveis, objetos, decoração).',
    'NÃO resolve tracking corporal: não posiciona produtos automaticamente no corpo humano.',
    'Integrado via <model-viewer> element. Ver src/App_FINAL.jsx para uso atual.',
    'Free / open source. Sem licença comercial. Sem lock-in. Ghost Score: 9/10.',
    'Manter como engine primário para VIEWER e ROOM enquanto motores corporais estão em POC.',
  ].join(' | '),
  createSession: async (config = {}) => {
    return {
      engineId: 'viewer-engine',
      status:   'ready',
      modelSrc: config.modelSrc ?? null,
      poster:   config.poster   ?? null,
      message:  'Use <model-viewer> element com src={modelSrc}. Ver App_FINAL.jsx para referência.',
    };
  },
});

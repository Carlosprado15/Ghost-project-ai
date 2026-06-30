import {
  createEngineDescriptor,
  GHOST_ENGINE_CATEGORIES,
  GHOST_ENGINE_STATUS,
  GHOST_ENGINE_RUNTIME,
} from '../../types.js';

export const legacyMediaPipeEngine = createEngineDescriptor({
  id:       'legacy-mediapipe',
  name:     'MediaPipe Hands (Legacy)',
  category: GHOST_ENGINE_CATEGORIES.WRIST,
  status:   GHOST_ENGINE_STATUS.LEGACY,
  vendor:   'Google',
  supportedProducts: ['watch', 'bracelet'],
  runtimes: [
    GHOST_ENGINE_RUNTIME.WEB_MOBILE,
    GHOST_ENGINE_RUNTIME.ANDROID_CHROME,
    GHOST_ENGINE_RUNTIME.SHOPIFY_EMBEDDED,
  ],
  supportsOwn3DModels:       true,
  supportsWhiteLabel:        true,
  supportsShopifyEmbedded:   true,
  requiresCommercialLicense: false,
  notes: [
    'Usado como motor inicial do Ghost Project (M051–M058).',
    'Múltiplas iterações de calibração não produziram tracking estável de pulso.',
    'Projetado para reconhecimento de gestos — não para wrist try-on.',
    'Landmark[0] (base do pulso) é geometricamente impreciso para ancoragem de relógio.',
    'Sem suporte a oclusão: relógio sobreposto à pele diminui a confiança do modelo.',
    'Revertido em M058 após piora no teste real no celular.',
    'Código atual em src/tracking/WristTracker.js deve ser mantido intacto como legado.',
    'NÃO usar como solução principal de produção.',
  ].join(' | '),
  createSession: async () => {
    throw new Error(
      '[legacy-mediapipe] Engine em modo LEGACY. ' +
      'Use os labs isolados (?lab=webarrocks etc.) para testes de tracking. ' +
      'Para produção, aguardar POC DeepAR (M068).'
    );
  },
});

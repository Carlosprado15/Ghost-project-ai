import {
  createEngineDescriptor,
  GHOST_ENGINE_CATEGORIES,
  GHOST_ENGINE_STATUS,
  GHOST_ENGINE_RUNTIME,
} from '../../types.js';

export const banubaEngine = createEngineDescriptor({
  id:       'banuba-placeholder',
  name:     'Banuba AR (Placeholder)',
  category: GHOST_ENGINE_CATEGORIES.BODY,
  status:   GHOST_ENGINE_STATUS.CANDIDATE,
  vendor:   'Banuba',
  supportedProducts: ['clothing', 'bags', 'accessories', 'makeup', 'hair'],
  runtimes: [
    GHOST_ENGINE_RUNTIME.WEB_MOBILE,
    GHOST_ENGINE_RUNTIME.IOS_SAFARI,
    GHOST_ENGINE_RUNTIME.ANDROID_CHROME,
  ],
  supportsOwn3DModels:       false, // needs-vendor-confirmation
  supportsWhiteLabel:        true,
  supportsShopifyEmbedded:   false, // needs-vendor-confirmation
  requiresCommercialLicense: true,
  notes: [
    'Fallback recomendado para categorias body e face quando Perfect Corp não for viável.',
    'Boa cobertura para roupas, acessórios corporais, maquiagem e cabelo.',
    'Wrist/relógio: needs-vendor-confirmation — qualidade para watch try-on não verificada.',
    'Forte para e-commerce e Shopify (confirmar CSP/iframe embedding antes de POC).',
    'Pricing: enterprise on request.',
    'supportsOwn3DModels: needs-vendor-confirmation.',
    'NÃO integrar sem confirmação de compatibilidade com GLB e pipeline Ghost Project.',
    'Avaliar após Perfect Corp e DeepAR terem respostas definidas.',
  ].join(' | '),
  createSession: async () => {
    throw new Error(
      'Banuba engine is a placeholder. Requires commercial license and vendor confirmation. ' +
      'Wrist tracking quality and own-GLB support need vendor confirmation before POC.'
    );
  },
});

import {
  createEngineDescriptor,
  GHOST_ENGINE_CATEGORIES,
  GHOST_ENGINE_STATUS,
  GHOST_ENGINE_RUNTIME,
} from '../../types.js';

export const mirrarEngine = createEngineDescriptor({
  id:       'mirrar-wrist-placeholder',
  name:     'MIRRAR Wrist/Jewelry (Placeholder)',
  category: GHOST_ENGINE_CATEGORIES.WRIST,
  status:   GHOST_ENGINE_STATUS.CANDIDATE,
  vendor:   'MIRRAR',
  supportedProducts: ['watch', 'bracelet', 'ring', 'jewelry'],
  runtimes: [
    GHOST_ENGINE_RUNTIME.WEB_MOBILE,
    // IOS_SAFARI, ANDROID_CHROME: needs-vendor-confirmation
  ],
  supportsOwn3DModels:       false, // needs-vendor-confirmation
  supportsWhiteLabel:        false, // needs-vendor-confirmation
  supportsShopifyEmbedded:   false, // needs-vendor-confirmation
  requiresCommercialLicense: true,
  notes: [
    'Foco declarado em watches e jewelry — possível demo comercial rápida para o pitch Click & Wear.',
    'ATENÇÃO: parece ser mais plataforma/SaaS do que engine plugável via SDK.',
    'Modelo de integração técnica não confirmado — pode exigir hospedagem na plataforma MIRRAR.',
    'Se for SaaS e não SDK: incompatível com arquitetura plugável do Ghost Project.',
    'supportsOwn3DModels: needs-vendor-confirmation.',
    'supportsWhiteLabel: needs-vendor-confirmation.',
    'Web/mobile/iOS/Android: needs-vendor-confirmation.',
    'Avaliar como alternativa ao DeepAR somente se POC DeepAR (M068) não produzir resultado aceitável.',
    'Critério de descarte: se não oferecer SDK isolado integrável no app Ghost.',
  ].join(' | '),
  createSession: async () => {
    throw new Error(
      'MIRRAR engine is a placeholder. Integration model and SDK availability need vendor confirmation. ' +
      'Evaluate only after DeepAR POC (M068) results are known.'
    );
  },
});

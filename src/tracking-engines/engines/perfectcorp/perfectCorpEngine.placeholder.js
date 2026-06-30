import {
  createEngineDescriptor,
  GHOST_ENGINE_CATEGORIES,
  GHOST_ENGINE_STATUS,
  GHOST_ENGINE_RUNTIME,
} from '../../types.js';

export const perfectCorpEngine = createEngineDescriptor({
  id:       'perfectcorp-placeholder',
  name:     'Perfect Corp YouCam (Placeholder)',
  category: GHOST_ENGINE_CATEGORIES.FACE,
  status:   GHOST_ENGINE_STATUS.CANDIDATE,
  vendor:   'Perfect Corp',
  supportedProducts: ['glasses', 'earrings', 'makeup', 'watch', 'hat', 'hair', 'bracelet'],
  runtimes: [
    GHOST_ENGINE_RUNTIME.WEB_MOBILE,
    GHOST_ENGINE_RUNTIME.IOS_SAFARI,
    GHOST_ENGINE_RUNTIME.ANDROID_CHROME,
  ],
  supportsOwn3DModels:       false, // needs-vendor-confirmation
  supportsWhiteLabel:        false, // needs-vendor-confirmation
  supportsShopifyEmbedded:   false, // needs-vendor-confirmation
  requiresCommercialLicense: true,
  notes: [
    'MELHOR CANDIDATO para produção e pitch de investidor — multi-categoria confirmada.',
    'Usado por marcas como L\'Oréal, Pandora, marcas de joias e relógios de luxo.',
    'Cobertura: face, wrist, body — maior breadth de qualquer candidato avaliado.',
    'Pricing: enterprise on request — exige contato comercial antes de qualquer POC.',
    'Lock-in risk ALTO: ecossistema proprietário, migração futura é custosa.',
    'supportsOwn3DModels: needs-vendor-confirmation (pode exigir formatos proprietários).',
    'supportsWhiteLabel: needs-vendor-confirmation.',
    'NÃO integrar sem licença comercial confirmada e clareza sobre GLB próprios.',
    'Prioridade de contato comercial: APÓS validação da POC DeepAR (M068).',
  ].join(' | '),
  createSession: async () => {
    throw new Error(
      'Perfect Corp engine is a placeholder. Requires commercial license and vendor contact. ' +
      'Do not integrate until commercial terms and own-GLB support are confirmed.'
    );
  },
});

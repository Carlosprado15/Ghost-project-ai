import {
  createEngineDescriptor,
  GHOST_ENGINE_CATEGORIES,
  GHOST_ENGINE_STATUS,
  GHOST_ENGINE_RUNTIME,
} from '../../types.js';

export const deepAREngine = createEngineDescriptor({
  id:       'deepar-wrist-placeholder',
  name:     'DeepAR Wrist Try-On (Placeholder)',
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
    'PRIMEIRA POC TÉCNICA RECOMENDADA para wrist try-on no Ghost Project.',
    'SDK JS disponível publicamente (deepar.js) — documentação em developers.deepar.ai.',
    'Suporta modelos GLB próprios — compatível com o pipeline de assets do Ghost Project.',
    'Custo: planos publicados no site ($19–$500/mês) — sem necessidade de contato comercial para POC.',
    'supportsShopifyEmbedded: needs-vendor-confirmation (iframe CORS/CSP).',
    'NÃO instalar SDK neste placeholder — aguardar M068.',
    'NÃO integrar no scanner principal sem validação objetiva (critério base: M066 — detectionRate >= 70%).',
    'Próximo passo: M068 — POC isolada em rota ?lab=deepar, sem alterar App_FINAL.jsx.',
  ].join(' | '),
  createSession: async () => {
    throw new Error(
      'DeepAR wrist engine is a placeholder. SDK integration not installed yet. ' +
      'Run M068 to create the isolated POC lab at ?lab=deepar.'
    );
  },
});

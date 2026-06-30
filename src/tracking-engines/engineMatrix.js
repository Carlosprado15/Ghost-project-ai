/**
 * Ghost Project — Tracking Engine Layer
 * engineMatrix.js — Matriz comparativa de todos os candidatos avaliados.
 *
 * Convenções:
 *   true                       = confirmado positivo
 *   false                      = confirmado negativo
 *   'needs-vendor-confirmation' = não verificado — requer contato ou POC
 *
 * ghostScore: 0–10
 *   Considera: qualidade de tracking, compatibilidade GLB/white-label/Shopify,
 *   custo, lock-in risk, poc difficulty, status atual no Ghost Project.
 *
 * NÃO INVENTAR CERTEZA ABSOLUTA.
 * Quando dados comerciais não foram confirmados, usar 'needs-vendor-confirmation'.
 */

export const ENGINE_MATRIX = [
  {
    id:            'perfectcorp',
    name:          'Perfect Corp (YouCam)',
    officialUrl:   'https://www.perfectcorp.com/business',
    categories:    ['face', 'wrist', 'body'],
    wrist:          true,
    face:           true,
    body:           'needs-vendor-confirmation',
    foot:           false,
    room:           false,
    viewer:         false,
    webMobile:      true,
    iosSafari:      true,
    androidChrome:  true,
    shopifyEmbedded:'needs-vendor-confirmation',
    own3DModels:    'needs-vendor-confirmation',
    whiteLabel:     'needs-vendor-confirmation',
    demoAvailable:  true,
    costProfile:    'enterprise — pricing on request',
    lockInRisk:     'high',
    pocDifficulty:  'medium',
    ghostScore:     8,
    verdict:
      'Melhor candidato para produção e pitch de investidor. ' +
      'Multi-categoria confirmada. Usado por L\'Oréal, Pandora, marcas de luxo. ' +
      'Exige contato comercial. Lock-in alto. Prioridade: após DeepAR POC.',
  },
  {
    id:            'deepar',
    name:          'DeepAR',
    officialUrl:   'https://www.deepar.ai',
    categories:    ['wrist', 'face'],
    wrist:          true,
    face:           true,
    body:           false,
    foot:           false,
    room:           false,
    viewer:         false,
    webMobile:      true,
    iosSafari:      true,
    androidChrome:  true,
    shopifyEmbedded:'needs-vendor-confirmation',
    own3DModels:    true,
    whiteLabel:     true,
    demoAvailable:  true,
    costProfile:    '$19–$500/mês (planos publicados no site)',
    lockInRisk:     'medium',
    pocDifficulty:  'low',
    ghostScore:     7,
    verdict:
      'Primeira POC técnica recomendada para wrist try-on. ' +
      'SDK JS disponível, preço acessível, suporta GLB próprio. ' +
      'Sem necessidade de contato comercial para iniciar POC. ' +
      'Próximo passo: M068 — lab isolado ?lab=deepar.',
  },
  {
    id:            'banuba',
    name:          'Banuba',
    officialUrl:   'https://www.banuba.com',
    categories:    ['face', 'body', 'wrist'],
    wrist:          'needs-vendor-confirmation',
    face:           true,
    body:           true,
    foot:           'needs-vendor-confirmation',
    room:           false,
    viewer:         false,
    webMobile:      true,
    iosSafari:      true,
    androidChrome:  true,
    shopifyEmbedded:'needs-vendor-confirmation',
    own3DModels:    'needs-vendor-confirmation',
    whiteLabel:     true,
    demoAvailable:  true,
    costProfile:    'enterprise — pricing on request',
    lockInRisk:     'medium',
    pocDifficulty:  'medium',
    ghostScore:     6,
    verdict:
      'Fallback sólido para multi-categoria (face/body). ' +
      'Qualidade wrist/relógio não confirmada. ' +
      'Avaliar após Perfect Corp e DeepAR terem respostas definidas.',
  },
  {
    id:            'mirrar',
    name:          'MIRRAR',
    officialUrl:   'https://mirrar.com',
    categories:    ['wrist', 'face'],
    wrist:          true,
    face:           true,
    body:           false,
    foot:           false,
    room:           false,
    viewer:         false,
    webMobile:      'needs-vendor-confirmation',
    iosSafari:      'needs-vendor-confirmation',
    androidChrome:  'needs-vendor-confirmation',
    shopifyEmbedded:'needs-vendor-confirmation',
    own3DModels:    'needs-vendor-confirmation',
    whiteLabel:     'needs-vendor-confirmation',
    demoAvailable:  true,
    costProfile:    'needs-vendor-confirmation',
    lockInRisk:     'medium',
    pocDifficulty:  'medium',
    ghostScore:     5,
    verdict:
      'Possível demo comercial rápida para watches/jewelry. ' +
      'Parece ser mais plataforma SaaS do que engine plugável — ' +
      'modelo de integração técnica não confirmado. ' +
      'Avaliar após DeepAR POC (M068).',
  },
  {
    id:            'model-viewer',
    name:          'model-viewer / Scene Viewer / AR Quick Look',
    officialUrl:   'https://modelviewer.dev',
    categories:    ['viewer', 'room'],
    wrist:          false,
    face:           false,
    body:           false,
    foot:           false,
    room:           true,
    viewer:         true,
    webMobile:      true,
    iosSafari:      true,
    androidChrome:  true,
    shopifyEmbedded:true,
    own3DModels:    true,
    whiteLabel:     true,
    demoAvailable:  true,
    costProfile:    'free / open source',
    lockInRisk:     'low',
    pocDifficulty:  'low',
    ghostScore:     9,
    verdict:
      'READY. Já em produção no Ghost Project — 15/15 produtos Click & Wear. ' +
      'Melhor custo-benefício do portfólio. Free/open source. Sem lock-in. ' +
      'Limitação: não resolve tracking corporal (wrist/face/body).',
  },
  {
    id:            'mediapipe-legacy',
    name:          'MediaPipe Hands (Google)',
    officialUrl:   'https://mediapipe.dev',
    categories:    ['wrist'],
    wrist:          true,
    face:           false,
    body:           false,
    foot:           false,
    room:           false,
    viewer:         false,
    webMobile:      true,
    iosSafari:      false,
    androidChrome:  true,
    shopifyEmbedded:true,
    own3DModels:    true,
    whiteLabel:     true,
    demoAvailable:  true,
    costProfile:    'free / open source',
    lockInRisk:     'low',
    pocDifficulty:  'low',
    ghostScore:     3,
    verdict:
      'LEGACY. Projetado para gestos, não para try-on de relógio. ' +
      'Múltiplas iterações (M051–M058) falharam em produção real. ' +
      'Manter como lab legacy. NÃO usar como motor principal.',
  },
  {
    id:            'webarrocks-hand',
    name:          'WebAR.rocks.hand (MIT)',
    officialUrl:   'https://github.com/WebAR-rocks/WebAR.rocks.hand',
    categories:    ['wrist'],
    wrist:          true,
    face:           false,
    body:           false,
    foot:           false,
    room:           false,
    viewer:         false,
    webMobile:      true,
    iosSafari:      false,
    androidChrome:  true,
    shopifyEmbedded:'needs-vendor-confirmation',
    own3DModels:    true,
    whiteLabel:     true,
    demoAvailable:  true,
    costProfile:    'free / MIT license',
    lockInRisk:     'low',
    pocDifficulty:  'medium',
    ghostScore:     2,
    verdict:
      'EXPERIMENTAL. M066 reprovou com 0% taxa de detecção usando NN_WRISTBACK_45, ' +
      'câmera traseira, 45 frames coletados. ' +
      'Causa pode ser configuração, iluminação ou modelo errado para o setup. ' +
      'Não recomendar nova POC antes de investigar causa raiz. ' +
      'Lab permanece em ?lab=webarrocks para referência.',
  },
];

/**
 * Ghost Project — Tracking Engine Layer
 * types.js — Contratos e constantes base para a camada plugável de engines.
 *
 * NÃO IMPORTAR NADA DAQUI NO APP PRINCIPAL AINDA.
 * Esta é a fundação isolada — sem integração com App_FINAL.jsx.
 */

/** Categorias de tracking engine do Ghost Project */
export const GHOST_ENGINE_CATEGORIES = Object.freeze({
  WRIST:  'wrist',   // relógios, pulseiras, anéis
  FACE:   'face',    // óculos, brincos, maquiagem, cabelo, chapéus
  BODY:   'body',    // roupas, bolsas, acessórios corporais
  FOOT:   'foot',    // tênis, sandálias
  ROOM:   'room',    // móveis, decoração, objetos no ambiente
  VIEWER: 'viewer',  // 3D/360° sem tracking corporal
});

/** Status de maturidade do engine no Ghost Project */
export const GHOST_ENGINE_STATUS = Object.freeze({
  LEGACY:       'legacy',       // funcionou em lab, não aprovado para produção
  EXPERIMENTAL: 'experimental', // spike realizado, resultado inconclusivo
  CANDIDATE:    'candidate',    // avaliado na matriz, POC pendente
  READY:        'ready',        // validado e utilizável em produção
  DISABLED:     'disabled',     // desativado por decisão técnica/comercial
});

/** Runtimes onde o engine pode operar */
export const GHOST_ENGINE_RUNTIME = Object.freeze({
  WEB_MOBILE:       'web-mobile',
  IOS_SAFARI:       'ios-safari',
  ANDROID_CHROME:   'android-chrome',
  SHOPIFY_EMBEDDED: 'shopify-embedded',
  NATIVE_IOS:       'native-ios',
  NATIVE_ANDROID:   'native-android',
});

/**
 * Cria um descriptor de engine padronizado.
 *
 * @param {object} config
 * @param {string}   config.id                       ID único do engine (ex: 'deepar-wrist-placeholder')
 * @param {string}   config.name                     Nome legível humano
 * @param {string}   config.category                 Um valor de GHOST_ENGINE_CATEGORIES
 * @param {string}   config.status                   Um valor de GHOST_ENGINE_STATUS
 * @param {string}   config.vendor                   Empresa ou projeto responsável
 * @param {string[]} config.supportedProducts        Tipos de produto suportados pelo engine
 * @param {string[]} config.runtimes                 Valores de GHOST_ENGINE_RUNTIME suportados
 * @param {boolean}  config.supportsOwn3DModels      Aceita modelos GLB próprios do Ghost Project?
 * @param {boolean}  config.supportsWhiteLabel       Opera sem branding visível do vendor?
 * @param {boolean}  config.supportsShopifyEmbedded  Funciona em iframe Shopify embedded?
 * @param {boolean}  config.requiresCommercialLicense Exige licença comercial para uso?
 * @param {string}   config.notes                    Contexto, histórico e decisões relevantes
 * @param {function} config.createSession            Função que inicia uma sessão AR (async)
 * @returns {Readonly<object>}
 */
export function createEngineDescriptor(config) {
  const required = ['id', 'name', 'category', 'status', 'vendor', 'createSession'];
  for (const key of required) {
    if (config[key] === undefined) {
      throw new Error(`createEngineDescriptor: campo obrigatório ausente — "${key}"`);
    }
  }
  return Object.freeze({
    id:                        config.id,
    name:                      config.name,
    category:                  config.category,
    status:                    config.status,
    vendor:                    config.vendor,
    supportedProducts:         config.supportedProducts         ?? [],
    runtimes:                  config.runtimes                  ?? [],
    supportsOwn3DModels:       config.supportsOwn3DModels       ?? false,
    supportsWhiteLabel:        config.supportsWhiteLabel        ?? false,
    supportsShopifyEmbedded:   config.supportsShopifyEmbedded   ?? false,
    requiresCommercialLicense: config.requiresCommercialLicense ?? false,
    notes:                     config.notes                     ?? '',
    createSession:             config.createSession,
  });
}

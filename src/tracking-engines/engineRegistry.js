/**
 * Ghost Project — Tracking Engine Layer
 * engineRegistry.js — Registro central de engines disponíveis.
 *
 * NÃO IMPORTAR NADA DAQUI NO APP PRINCIPAL AINDA.
 */

import { GHOST_ENGINE_CATEGORIES } from './types.js';
import { legacyMediaPipeEngine }   from './engines/legacy-mediapipe/legacyMediaPipeEngine.js';
import { deepAREngine }            from './engines/deepar/deepAREngine.placeholder.js';
import { perfectCorpEngine }       from './engines/perfectcorp/perfectCorpEngine.placeholder.js';
import { banubaEngine }            from './engines/banuba/banubaEngine.placeholder.js';
import { mirrarEngine }            from './engines/mirrar/mirrarEngine.placeholder.js';
import { viewerEngine }            from './engines/viewer/viewerEngine.js';

// Mapa interno — id → descriptor
const _registry = new Map();

function _seed() {
  [
    legacyMediaPipeEngine,
    deepAREngine,
    perfectCorpEngine,
    banubaEngine,
    mirrarEngine,
    viewerEngine,
  ].forEach(engine => _registry.set(engine.id, engine));
}

_seed();

/**
 * Registra um engine externo dinamicamente.
 * @param {object} engine - Descriptor criado com createEngineDescriptor()
 */
export function registerEngine(engine) {
  if (!engine?.id) throw new Error('registerEngine: engine.id é obrigatório');
  _registry.set(engine.id, engine);
}

/**
 * @param {string} id
 * @returns {object|null}
 */
export function getEngineById(id) {
  return _registry.get(id) ?? null;
}

/**
 * @param {string} category - Valor de GHOST_ENGINE_CATEGORIES
 * @returns {object[]}
 */
export function getEnginesByCategory(category) {
  return Array.from(_registry.values()).filter(e => e.category === category);
}

/**
 * @returns {object[]}
 */
export function getAllEngines() {
  return Array.from(_registry.values());
}

/**
 * Retorna o engine recomendado para uma categoria.
 *
 * Regras:
 * - WRIST → deepar-wrist-placeholder (1ª POC técnica recomendada; MediaPipe é LEGACY; WebAR.rocks reprovado M066)
 * - FACE  → perfectcorp-placeholder  (melhor candidato multi-categoria para produção/investidor)
 * - BODY  → banuba-placeholder       (fallback mais sólido para body/face e-commerce)
 * - FOOT  → banuba-placeholder       (melhor candidato disponível; wrist/watch quality needs-vendor-confirmation)
 * - ROOM  → viewer-engine            (ambiente/decoração; READY)
 * - VIEWER→ viewer-engine            (3D/360°; READY; em produção)
 *
 * @param {string} category
 * @returns {object|null}
 */
export function getRecommendedEngineForCategory(category) {
  const recommended = {
    [GHOST_ENGINE_CATEGORIES.WRIST]:  'deepar-wrist-placeholder',
    [GHOST_ENGINE_CATEGORIES.FACE]:   'perfectcorp-placeholder',
    [GHOST_ENGINE_CATEGORIES.BODY]:   'banuba-placeholder',
    [GHOST_ENGINE_CATEGORIES.FOOT]:   'banuba-placeholder',
    [GHOST_ENGINE_CATEGORIES.ROOM]:   'viewer-engine',
    [GHOST_ENGINE_CATEGORIES.VIEWER]: 'viewer-engine',
  };
  const id = recommended[category];
  return id ? (getEngineById(id) ?? null) : null;
}

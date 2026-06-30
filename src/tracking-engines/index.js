/**
 * Ghost Project — Tracking Engine Layer
 * index.js — Ponto de entrada da camada plugável de engines.
 *
 * IMPORTANTE: NÃO importar este módulo no App_FINAL.jsx ainda.
 * Esta fundação é isolada — integração com o scanner principal
 * só ocorre após validação objetiva de um engine (critério M066).
 *
 * Uso futuro (em lab isolado):
 *   import { getRecommendedEngineForCategory, GHOST_ENGINE_CATEGORIES } from '../tracking-engines';
 *   const engine = getRecommendedEngineForCategory(GHOST_ENGINE_CATEGORIES.WRIST);
 *   const session = await engine.createSession({ modelSrc: '/models/cw001.glb' });
 */

export {
  GHOST_ENGINE_CATEGORIES,
  GHOST_ENGINE_STATUS,
  GHOST_ENGINE_RUNTIME,
  createEngineDescriptor,
} from './types.js';

export {
  registerEngine,
  getEngineById,
  getEnginesByCategory,
  getAllEngines,
  getRecommendedEngineForCategory,
} from './engineRegistry.js';

export { ENGINE_MATRIX } from './engineMatrix.js';

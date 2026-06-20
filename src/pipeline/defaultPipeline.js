/**
 * defaultPipeline — factory que monta o Ghost Pipeline Intelligence pronto para uso.
 *
 * Ordem de providers: Meshy (primário) → Tripo (fallback automático).
 * O usuário nunca escolhe provider — o pipeline tenta na ordem de prioridade.
 */

import { MeshyProvider }        from './providers/MeshyProvider.js';
import { TripoProvider }        from './providers/TripoProvider.js';
import { ProviderSelector }     from './ProviderSelector.js';
import { ImageToModelPipeline } from './ImageToModelPipeline.js';
import { PipelineStrategy }     from './PipelineStrategy.js';
import { PipelineCache }        from './PipelineCache.js';
import { PipelineValidator }    from './PipelineValidator.js';

/**
 * @param {object} [options]
 * @param {object} [options.meshy]    - Config repassada ao MeshyProvider
 * @param {object} [options.tripo]    - Config repassada ao TripoProvider
 * @param {object} [options.strategy] - Config repassada ao PipelineStrategy
 * @param {object} [options.pipeline] - Config adicional do ImageToModelPipeline
 * @returns {ImageToModelPipeline}
 */
export function createDefaultPipeline(options = {}) {
  const meshy  = new MeshyProvider(options.meshy ?? {});
  const tripo  = new TripoProvider(options.tripo ?? {});
  const selector = new ProviderSelector();

  selector.register(meshy, 10);
  selector.register(tripo, 5);

  return new ImageToModelPipeline({
    validator:        new PipelineValidator(),
    cache:            new PipelineCache(),
    strategy:         new PipelineStrategy(options.strategy ?? {}),
    providerSelector: selector,
    ...(options.pipeline ?? {}),
  });
}

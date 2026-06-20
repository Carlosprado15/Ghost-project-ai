/**
 * PipelineValidator — valida entradas e saídas do pipeline de geração 3D.
 *
 * Responsabilidades:
 *  - Verificar que a imagem de entrada é utilizável antes de enviar ao provider
 *  - Verificar que o modelo GLB retornado é estruturalmente válido
 *  - Validar dimensões físicas do modelo (escala plausível para AR)
 *  - Verificar que os materiais são compatíveis com Three.js/WebGL
 *
 * Nesta versão todos os métodos retornam valores simulados sem dependências externas.
 * A validação real (GLTFLoader, análise de bytes) será adicionada em missão futura.
 */

export class PipelineValidator {
  /**
   * Valida a imagem de entrada antes de enviá-la ao provider.
   *
   * @param {Blob|File|string} image - Imagem (Blob, File ou URL/base64)
   * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
   */
  validateImage(image) {
    const errors = [];
    const warnings = [];

    if (!image) {
      return { valid: false, errors: ['Image is required'], warnings };
    }

    if (typeof image === 'string') {
      if (image.trim().length === 0) {
        errors.push('Image URL or base64 string is empty');
      } else if (image.startsWith('data:') && !image.startsWith('data:image/')) {
        warnings.push('Data URL does not appear to be an image MIME type');
      }
    } else if (image instanceof Blob || image instanceof File) {
      if (image.size === 0) {
        errors.push('Image file is empty (0 bytes)');
      }
      if (image.size > 50 * 1024 * 1024) {
        warnings.push('Image exceeds 50 MB — generation may be slow or rejected');
      }
      if (image instanceof File && image.name) {
        const ext = image.name.split('.').pop().toLowerCase();
        const supported = ['jpg', 'jpeg', 'png', 'webp'];
        if (!supported.includes(ext)) {
          warnings.push(`Extension ".${ext}" may not be supported; prefer jpg/png`);
        }
      }
    } else {
      errors.push(`Unsupported image type: ${Object.prototype.toString.call(image)}`);
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Valida a estrutura básica de um arquivo GLB retornado pelo provider.
   *
   * @param {string|Blob} model - URL ou Blob do modelo GLB
   * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
   */
  validateGLB(model) {
    if (!model) {
      return { valid: false, errors: ['Model output is missing'], warnings: [] };
    }
    // [STUB] Validação real requer GLTFLoader — simulada como válida
    return { valid: true, errors: [], warnings: [] };
  }

  /**
   * Valida que as dimensões do modelo são plausíveis para uso em AR de pulso.
   * Intervalo esperado: 0.01m – 0.5m em cada eixo.
   *
   * @param {object} model - Objeto com metadados do modelo (url, blob, boundingBox)
   * @returns {{ valid: boolean, errors: string[], warnings: string[], dimensions: object }}
   */
  validateDimensions(model) {
    // [STUB] Retorna dimensões simuladas de um relógio de pulso típico
    return {
      valid: true,
      errors: [],
      warnings: [],
      dimensions: { width: 0.04, height: 0.01, depth: 0.04 }, // metros
    };
  }

  /**
   * Verifica se os materiais do modelo são compatíveis com Three.js/WebGL.
   * Verifica: presença de PBR, texturas embutidas, transparência.
   *
   * @param {object} model - Objeto com metadados do modelo
   * @returns {{ valid: boolean, errors: string[], warnings: string[], materialCount: number }}
   */
  validateMaterials(model) {
    // [STUB] Retorna validação simulada de materiais PBR
    return {
      valid: true,
      errors: [],
      warnings: [],
      materialCount: 1,
    };
  }
}

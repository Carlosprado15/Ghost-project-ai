/**
 * model3DPromptBuilder.js — gera o comando estruturado (prompt) que acompanha
 * a imagem na geração 3D via Tripo/Meshy, garantindo que todo modelo saia com
 * o mesmo padrão de orientação, escala e proporção.
 *
 * Módulo isolado (2026-07-14): só monta o payload { image, prompt }, não
 * chama nenhuma API nem altera o pipeline existente. Integração com
 * Tripo/Meshy fica pra quem consumir isso depois.
 */

const STANDARD_PROMPT = `TASK:
Convert this 2D product image into a clean, production-ready 3D model for AR try-on.

OBJECT TYPE:
Wrist watch (wearable product)

INPUT IMAGE:
[image]

INSTRUCTIONS:

1. ORIENTATION
- Ensure the watch is facing forward
- Align the 12h–6h axis vertically
- Do not tilt or rotate arbitrarily

2. GEOMETRY
- Preserve real-world proportions
- Do not exaggerate thickness
- Maintain realistic strap curvature

3. SCALE
- Normalize to real-world wrist scale
- Avoid oversized or miniature models

4. DEPTH ESTIMATION
- Keep the watch body slightly raised from the strap
- Maintain realistic separation between layers (glass, dial, case)

5. SYMMETRY
- Ensure left/right symmetry of the watch
- Avoid distortion from perspective

6. CLEAN MODEL
- Remove background completely
- Do not include environment artifacts
- Focus only on the product

7. OUTPUT REQUIREMENTS
- Format: GLB
- Center model at origin (0,0,0)
- Align vertical axis (Y-up)
- Optimize for real-time rendering (low to mid poly)

GOAL:
Produce a stable, correctly oriented 3D model suitable for wrist-based AR try-on.

DO NOT:
- Add artistic interpretation
- Change design details
- Modify proportions creatively`;

/**
 * @param {string} imagePath - caminho da imagem já selecionada e padronizada
 * @returns {{ image: string, prompt: string }}
 */
export function build3DGenerationPrompt(imagePath) {
  if (!imagePath || typeof imagePath !== 'string') {
    throw new Error('build3DGenerationPrompt: imagePath precisa ser uma string não vazia');
  }
  return { image: imagePath, prompt: STANDARD_PROMPT };
}

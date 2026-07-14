/**
 * prepare-for-3d.mjs — passo obrigatório antes de qualquer geração 3D
 * (Tripo ou Meshy): sempre limpa fundo, endireita o produto de frente pra
 * câmera, centraliza e padroniza pra 1024x1024 fundo branco.
 *
 * Combina clean-photoroom.mjs (remove fundo/mão/prop + reposiciona via IA)
 * com standardize-images.mjs (moldura final consistente). Decidido em
 * 2026-07-14: fixar essas 4 tarefas como etapa automática e sempre-ligada
 * do pipeline, não mais uma limpeza manual caso a caso.
 *
 * Uso:
 *   node scripts/normalize-glb/prepare-for-3d.mjs <entrada> <id> [watch|bracelet]
 *   (salva em scripts/normalize-glb/prepared/<id>.png)
 *
 * Requer PHOTOROOM_API_KEY em .env.local (chave de produção).
 */
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { cleanWithPhotoroom } from './clean-photoroom.mjs';
import { standardizeOne } from './standardize-images.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const PREPARED_DIR = resolve(HERE, 'prepared');

export async function prepareForGeneration(srcPath, id, type = 'watch') {
  mkdirSync(PREPARED_DIR, { recursive: true });
  const photoroomOut = resolve(PREPARED_DIR, `${id}_step1_photoroom.png`);
  const finalOut = resolve(PREPARED_DIR, `${id}.png`);

  await cleanWithPhotoroom(srcPath, photoroomOut, type);
  await standardizeOne(photoroomOut, finalOut);

  return finalOut;
}

// ── CLI ───────────────────────────────────────────────────────────────────
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , inPath, id, type] = process.argv;
  if (!inPath || !id) {
    console.error('Uso: node scripts/normalize-glb/prepare-for-3d.mjs <entrada> <id> [watch|bracelet]');
    process.exit(1);
  }
  const outPath = await prepareForGeneration(inPath, id, type ?? 'watch');
  console.log(`✅ ${outPath}`);
}

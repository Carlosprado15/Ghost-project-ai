/**
 * test-image-selector.mjs — teste local de src/pipeline/imageSelector.js.
 * Recebe uma pasta com várias fotos do mesmo produto e mostra qual seria
 * escolhida automaticamente pra geração 3D.
 *
 * Uso:
 *   node scripts/normalize-glb/test-image-selector.mjs <pasta-com-fotos>
 */
import { readdirSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { selectBestImage } from '../../src/pipeline/imageSelector.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const EXT_RE = /\.(jpe?g|png|webp)$/i;

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const inputArg = process.argv[2];
  if (!inputArg) {
    console.error('Uso: node scripts/normalize-glb/test-image-selector.mjs <pasta-com-fotos>');
    process.exit(1);
  }
  const dir = resolve(HERE, '../..', inputArg);
  const files = readdirSync(dir).filter((f) => EXT_RE.test(f)).map((f) => join(dir, f));
  if (files.length === 0) {
    console.error(`Nenhuma imagem encontrada em ${dir}`);
    process.exit(1);
  }

  console.log(`Analisando ${files.length} fotos em ${dir}...`);
  const chosen = await selectBestImage(files);
  console.log(`\n✅ Escolhida: ${chosen}`);
}

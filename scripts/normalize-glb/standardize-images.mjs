/**
 * standardize-images.mjs — padroniza um lote de fotos de produto pra
 * 1024x1024 antes de mandar pra geração 3D (Tripo/Meshy).
 *
 * Redimensiona o produto pra caber dentro do quadro sem distorcer (mantém
 * proporção original), centraliza, e preenche o espaço restante com fundo
 * branco. Não recorta nada do produto.
 *
 * Uso:
 *   node scripts/normalize-glb/standardize-images.mjs <pasta-entrada> [pasta-saida]
 *
 * Se <pasta-saida> não for informada, cria "processed" dentro da pasta de
 * entrada.
 */
import sharp from 'sharp';
import { readdirSync, mkdirSync } from 'node:fs';
import { resolve, join, parse } from 'node:path';
import { pathToFileURL } from 'node:url';

const SIZE = 1024;
const EXT_RE = /\.(jpe?g|png|webp|tiff?|bmp|avif)$/i;

export async function standardizeOne(inPath, outPath) {
  await sharp(inPath)
    .resize(SIZE, SIZE, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 1 },
      withoutEnlargement: false,
    })
    .flatten({ background: '#ffffff' })
    .png({ compressionLevel: 9, quality: 100 })
    .toFile(outPath);
}

async function run(inputDir, outputDir) {
  const files = readdirSync(inputDir).filter((f) => EXT_RE.test(f));
  if (files.length === 0) {
    console.error(`Nenhuma imagem encontrada em ${inputDir}`);
    process.exit(1);
  }

  mkdirSync(outputDir, { recursive: true });

  console.log(`Processando ${files.length} imagens → ${outputDir}\n`);

  let ok = 0;
  const failed = [];

  for (const file of files) {
    const inPath = join(inputDir, file);
    const outPath = join(outputDir, `${parse(file).name}.png`);
    try {
      await standardizeOne(inPath, outPath);
      console.log(`  ✅ ${file} → ${parse(file).name}.png`);
      ok++;
    } catch (err) {
      console.error(`  ❌ ${file}: ${err.message}`);
      failed.push(file);
    }
  }

  console.log(`\n${ok}/${files.length} imagens padronizadas em ${outputDir}`);
  if (failed.length > 0) {
    console.log(`Falharam: ${failed.join(', ')}`);
    process.exit(1);
  }
}

// ── CLI ───────────────────────────────────────────────────────────────────
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , inputArg, outputArg] = process.argv;
  if (!inputArg) {
    console.error('Uso: node scripts/normalize-glb/standardize-images.mjs <pasta-entrada> [pasta-saida]');
    process.exit(1);
  }
  const inputDir = resolve(inputArg);
  const outputDir = resolve(outputArg ?? join(inputDir, 'processed'));
  await run(inputDir, outputDir);
}

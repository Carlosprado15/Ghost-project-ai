/**
 * clean-photoroom.mjs — limpa e reposiciona a foto de um produto via API da
 * Photoroom (Edit with AI) ANTES de mandar pra Tripo3D.
 *
 * Por quê (2026-07-11): tentamos limpeza local (rembg) e cálculo de rotação
 * por PCA depois da geração 3D — os dois têm limite (rembg não separa
 * produto de prop tocando; PCA não decide sozinha quando mostrador e
 * pulseira são do mesmo tamanho). A Photoroom resolve os dois de uma vez,
 * ANTES da geração 3D: remove fundo/mão/prop E já reposiciona o produto
 * (mostrador de frente, pulseira aberta) usando IA generativa por texto.
 * Testado em CW009 (Bee Sister) com sucesso total.
 *
 * Uso:
 *   node scripts/normalize-glb/clean-photoroom.mjs <entrada> <saida.png> <watch|bracelet>
 *
 * Requer PHOTOROOM_API_KEY em .env.local (chave de PRODUÇÃO, sem prefixo
 * "sandbox_" — chave sandbox marca d'água no resultado).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');

const PROMPTS = {
  watch: 'Remove any background, hands, wrists, and props. Lay the watch flat and fully open — the strap must NOT be joined in a closed loop — with the dial facing directly toward the camera, straight-on and centered, on a plain white background.',
  bracelet: 'Remove any background, hands, wrists, and props, keeping the bracelet as a closed loop (like it is resting flat), viewed so the opening/clasp is visible, centered, on a plain white background.',
};

export function loadPhotoroomKey() {
  const content = readFileSync(resolve(ROOT, '.env.local'), 'utf8');
  for (const line of content.split('\n')) {
    const m = line.match(/^PHOTOROOM_API_KEY=(.+)$/);
    if (m) {
      const key = m[1].trim();
      if (key.startsWith('sandbox_')) {
        console.warn('  ⚠️  chave sandbox_ detectada — resultado vai sair com marca d\'água. Use a chave de produção.');
      }
      return key;
    }
  }
  throw new Error('PHOTOROOM_API_KEY não encontrada em .env.local');
}

export async function cleanWithPhotoroom(inPath, outPath, type = 'watch') {
  const apiKey = loadPhotoromKeySafe();
  const buf = readFileSync(inPath);
  const form = new FormData();
  form.append('imageFile', new Blob([buf]), 'input.png');
  form.append('removeBackground', 'true');
  form.append('editWithAI.mode', 'ai.auto');
  form.append('editWithAI.prompt', PROMPTS[type] ?? PROMPTS.watch);

  const res = await fetch('https://image-api.photoroom.com/v2/edit', {
    method: 'POST',
    headers: { 'x-api-key': apiKey },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Photoroom falhou (${res.status}): ${text}`);
  }
  const outBuf = Buffer.from(await res.arrayBuffer());
  writeFileSync(outPath, outBuf);
  return outBuf.length;
}

// pequeno alias pra evitar duplicar a leitura da chave em cada chamada
function loadPhotoromKeySafe() {
  return loadPhotoroomKey();
}

// ── CLI ───────────────────────────────────────────────────────────────────
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , inPath, outPath, type] = process.argv;
  if (!inPath || !outPath) {
    console.error('Uso: node clean-photoroom.mjs <entrada> <saida.png> <watch|bracelet>');
    process.exit(1);
  }
  const bytes = await cleanWithPhotoroom(inPath, outPath, type ?? 'watch');
  console.log(`✅ ${outPath} (${(bytes / 1024).toFixed(0)} KB)`);
}

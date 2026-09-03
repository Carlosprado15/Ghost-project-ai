/**
 * imagehash.mjs — comparação perceptual de imagem, sem IA e sem serviço externo.
 *
 * Objetivo estreito: pegar "a MESMA foto de demo reaproveitada em produtos
 * diferentes" — o padrão por trás da confusão CW006/CW007 e da foto errada do
 * CW017 (a imagem genérica do relógio-astronauta colada em 3 produtos).
 * Comparar imageUrl exata não pega (URLs de CDN diferem).
 *
 * NÃO é pra medir "esses dois relógios são parecidos" — catálogo de relógio
 * preto em fundo branco é todo parecido. É pra medir "isto é literalmente o
 * mesmo arquivo de imagem". Por isso a métrica principal é diferença de pixel
 * (MAD) numa miniatura 16x16 em tons de cinza: arquivo reaproveitado dá MAD
 * perto de 0; fotos diferentes do mesmo tipo de produto ficam acima de ~12.
 */

import sharp from 'sharp';

const SIG_SIZE = 16;

/** Miniatura 16x16 em cinza como Uint8Array de 256 valores. */
export async function thumbnailSignature(file) {
  const { data } = await sharp(file)
    .greyscale()
    .resize(SIG_SIZE, SIG_SIZE, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return data;
}

/** Diferença média absoluta entre duas assinaturas (0 = idêntico, 255 = oposto). */
export function madDistance(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
  return s / a.length;
}

/**
 * Para cada arquivo, acha os vizinhos mais próximos por MAD.
 * @param {Record<string,string>} filesById  { CW006: '/caminho/CW006.png', ... }
 * @param {{ identical:number, suspicious:number }} thresholds
 *   identical  — MAD <= disto: é o mesmo arquivo (FALHA)
 *   suspicious — MAD <= disto: parecido demais, olho humano (ATENÇÃO)
 */
export async function findReusedPhotos(filesById, thresholds = { identical: 4, suspicious: 10 }) {
  const ids = Object.keys(filesById);
  const sigs = {};
  for (const id of ids) {
    try { sigs[id] = await thumbnailSignature(filesById[id]); }
    catch { sigs[id] = null; }
  }
  const result = {};
  for (const a of ids) {
    if (!sigs[a]) { result[a] = { neighbors: [], identical: [], suspicious: [] }; continue; }
    const neighbors = ids
      .filter((b) => b !== a && sigs[b])
      .map((b) => ({ id: b, mad: +madDistance(sigs[a], sigs[b]).toFixed(1) }))
      .sort((x, y) => x.mad - y.mad);
    result[a] = {
      neighbors: neighbors.slice(0, 3),
      identical: neighbors.filter((n) => n.mad <= thresholds.identical),
      suspicious: neighbors.filter((n) => n.mad > thresholds.identical && n.mad <= thresholds.suspicious),
    };
  }
  return result;
}

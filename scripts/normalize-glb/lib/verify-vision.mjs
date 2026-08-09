/**
 * verify-vision.mjs — visão computacional "clássica" (sem IA/API) usada pelo
 * verify-model.mjs para comparar a foto real de um produto com os prints do
 * render 3D em vários ângulos.
 *
 * Nada aqui usa machine learning nem chama serviço nenhum — é tudo aritmética
 * de pixel (sharp para redimensionar/ler/escrever, e um "preenchimento por
 * inundação" escrito à mão para separar objeto do fundo). Por quê essa
 * abordagem: pedido explícito do dono do projeto (zero custo por checagem,
 * zero risco de licença — ver product-calibration-overrides.json e o combinado
 * da sessão de 2026-07-25 sobre não usar bibliotecas AGPL de remoção de fundo).
 *
 * Pipeline por imagem (foto real OU print do 3D, o mesmo código serve pros
 * dois — a foto real tem fundo "sujo"/variado, o print do 3D tem fundo liso
 * escuro da página do laboratório; o preenchimento por inundação a partir da
 * borda lida bem com ambos):
 *   1) reduzir para uma resolução de trabalho (mais rápido, sem perder forma)
 *   2) separar objeto do fundo por "inundação" a partir da borda da imagem
 *      (region growing em cadeia: cada pixel novo é comparado ao pixel vizinho
 *      que o descobriu, não a uma cor fixa — assim acompanha fundos com
 *      gradiente/textura e só para onde há um contraste real)
 *   3) limpar ruído (manchas pequenas desconectadas do objeto principal)
 *   4) recortar na caixa do objeto, centralizar e redimensionar pra um
 *      canvas quadrado padrão — cor e máscara sempre com a MESMA geometria
 *   5) calcular as métricas de comparação (IoU da silhueta, borda/Sobel, cor)
 */

import sharp from 'sharp';

// ── 1) leitura em resolução de trabalho ─────────────────────────────────────

/**
 * Lê uma imagem (arquivo ou Buffer) e devolve pixels RGB crus numa resolução
 * de trabalho limitada (mais rápido pro flood-fill, sem perder a forma geral).
 */
export async function loadWorkingRGB(input, { maxSize = 480 } = {}) {
  const img = sharp(input).rotate(); // aplica orientação EXIF se houver
  const resized = img.resize({ width: maxSize, height: maxSize, fit: 'inside', withoutEnlargement: false });
  const { data, info } = await resized.removeAlpha().toColorspace('srgb').raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

// ── 2) fundo por inundação a partir da borda (region growing em cadeia) ────

function colorDist(data, ia, ib) {
  const dr = data[ia] - data[ib];
  const dg = data[ia + 1] - data[ib + 1];
  const db = data[ia + 2] - data[ib + 2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * Devolve uma máscara Uint8Array (1 = fundo, 0 = possível objeto) inundando
 * a partir de todos os pixels da borda. Tolerância "em cadeia": compara cada
 * pixel candidato ao vizinho que o descobriu (acompanha gradientes suaves),
 * mas também limita o quanto a cor pode ter "andado" desde a semente da
 * borda mais próxima (evita que um gradiente muito longo acabe engolindo o
 * objeto inteiro).
 */
export function floodFillBackground(data, width, height, { stepTolerance = 20, driftTolerance = 70 } = {}) {
  const n = width * height;
  const bg = new Uint8Array(n); // 1 = já classificado como fundo
  const seedIdx = new Int32Array(n).fill(-1); // pixel semente (índice de cor) que originou esta região
  const qx = new Int32Array(n);
  const qy = new Int32Array(n);
  let qHead = 0, qTail = 0;

  const push = (x, y, seed) => {
    const p = y * width + x;
    if (bg[p]) return;
    bg[p] = 1;
    seedIdx[p] = seed;
    qx[qTail] = x; qy[qTail] = y; qTail++;
  };

  for (let x = 0; x < width; x++) { push(x, 0, (0 * width + x) * 3); push(x, height - 1, ((height - 1) * width + x) * 3); }
  for (let y = 0; y < height; y++) { push(0, y, (y * width + 0) * 3); push(width - 1, y, (y * width + (width - 1)) * 3); }

  const dxs = [1, -1, 0, 0];
  const dys = [0, 0, 1, -1];

  while (qHead < qTail) {
    const x = qx[qHead], y = qy[qHead];
    const p = y * width + x;
    const pi = p * 3;
    const seed = seedIdx[p];
    qHead++;
    for (let d = 0; d < 4; d++) {
      const nx = x + dxs[d], ny = y + dys[d];
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const np = ny * width + nx;
      if (bg[np]) continue;
      const ni = np * 3;
      if (colorDist(data, pi, ni) <= stepTolerance && colorDist(data, seed, ni) <= driftTolerance) {
        push(nx, ny, seed);
      }
    }
  }
  reclassifyEnclosedBackgroundHoles(data, width, height, bg, { holeTolerance: 26 });
  return bg;
}

/**
 * Preenche "buracos" — pixels de cor de fundo que ficaram presos DENTRO do
 * objeto e que a inundação a partir da borda nunca alcança porque não há
 * nenhum caminho de pixels conectados até a borda da imagem (ex.: o vão
 * vazio no meio de uma pulseira fechada, ou o espaço entre pulseira e
 * relógio quando a foto mostra o laço fechado — nesses casos o "buraco" é
 * cercado pelo próprio objeto, então nunca é alcançado por inundação normal).
 * Sem isso, esses buracos ficam contados como "objeto" e inflam a máscara
 * (ex.: uma pulseira em laço vira um círculo cheio em vez de um anel).
 *
 * Como resolve, sem depender de conectividade: estima a cor típica do fundo
 * (média dos pixels já classificados como fundo pela inundação) e reclassifica
 * QUALQUER pixel ainda não-fundo cuja cor esteja bem perto dessa média — não
 * importa se está "preso" ou não. Como o limiar é mais apertado que o da
 * inundação em cadeia, o risco de comer pedaço de objeto (que por acaso tenha
 * cor parecida com o fundo) é pequeno na prática dos nossos fundos lisos
 * (fundo do laboratório) ou razoavelmente uniformes (fotos de produto em
 * estúdio) — não tenta resolver fundos muito texturizados/variados.
 */
function reclassifyEnclosedBackgroundHoles(data, width, height, bg, { holeTolerance = 26 } = {}) {
  const n = width * height;
  let sumR = 0, sumG = 0, sumB = 0, count = 0;
  for (let p = 0; p < n; p++) {
    if (!bg[p]) continue;
    const i = p * 3;
    sumR += data[i]; sumG += data[i + 1]; sumB += data[i + 2];
    count++;
  }
  if (count === 0) return;
  const ref = [sumR / count, sumG / count, sumB / count];
  for (let p = 0; p < n; p++) {
    if (bg[p]) continue;
    const i = p * 3;
    const dr = data[i] - ref[0], dg = data[i + 1] - ref[1], db = data[i + 2] - ref[2];
    if (Math.sqrt(dr * dr + dg * dg + db * db) <= holeTolerance) bg[p] = 1;
  }
}

// ── 3) limpeza: descarta manchas de "objeto" pequenas demais ───────────────

/** Rotula componentes conexos (4-vizinhança) de uma máscara binária (1 = interesse). */
function labelComponents(mask, width, height) {
  const n = width * height;
  const labels = new Int32Array(n).fill(-1);
  const sizes = [];
  const stackX = new Int32Array(n);
  const stackY = new Int32Array(n);
  let nextLabel = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      if (!mask[p] || labels[p] !== -1) continue;
      let sp = 0;
      stackX[sp] = x; stackY[sp] = y; sp++;
      labels[p] = nextLabel;
      let size = 0;
      while (sp > 0) {
        sp--;
        const cx = stackX[sp], cy = stackY[sp];
        size++;
        const neigh = [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]];
        for (const [nx, ny] of neigh) {
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const np = ny * width + nx;
          if (!mask[np] || labels[np] !== -1) continue;
          labels[np] = nextLabel;
          stackX[sp] = nx; stackY[sp] = ny; sp++;
        }
      }
      sizes.push(size);
      nextLabel++;
    }
  }
  return { labels, sizes };
}

/**
 * A partir da máscara de fundo (1 = fundo), monta a máscara de OBJETO
 * (1 = objeto). Duas etapas:
 *  1) descarta manchas conexas menores que minAreaFrac (ruído fino: reflexo,
 *     poeira, texto pequeno);
 *  2) de tudo que sobrou, escolhe a mancha "principal" por um placar de
 *     área × centralidade (o produto nas fotos do catálogo é sempre o maior
 *     objeto perto do centro) e mantém só ela + qualquer mancha vizinha cujo
 *     centro caia dentro da caixa da principal expandida em 20% (reconecta
 *     pedaços do mesmo objeto que ficaram separados — ex.: elos de pulseira
 *     com vão de fundo entre eles).
 * Por quê: fundos "sujos" das fotos reais de fornecedor (roupa listrada,
 * tecido xadrez, textura de madeira) têm ALTO contraste interno, então o
 * flood-fill da borda não consegue atravessá-los e eles sobram como manchas
 * de "objeto" falsas — sem esse filtro de centralidade, uma foto de pulso
 * com manga listrada vira uma máscara da manga, não do relógio.
 */
export function cleanForegroundMask(bgMask, width, height, { minAreaFrac = 0.0015 } = {}) {
  const n = width * height;
  const fg = new Uint8Array(n);
  for (let i = 0; i < n; i++) fg[i] = bgMask[i] ? 0 : 1;

  const { labels, sizes } = labelComponents(fg, width, height);
  const minArea = minAreaFrac * n;
  const numLabels = sizes.length;

  // bbox + centroide de cada componente que passou no filtro de área mínima
  const bb = Array.from({ length: numLabels }, () => ({ minX: width, minY: height, maxX: -1, maxY: -1, sumX: 0, sumY: 0, count: 0 }));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const lbl = labels[y * width + x];
      if (lbl < 0 || sizes[lbl] < minArea) continue;
      const b = bb[lbl];
      if (x < b.minX) b.minX = x; if (x > b.maxX) b.maxX = x;
      if (y < b.minY) b.minY = y; if (y > b.maxY) b.maxY = y;
      b.sumX += x; b.sumY += y; b.count++;
    }
  }

  const cx = width / 2, cy = height / 2;
  const diag = Math.hypot(width, height);
  let bestLbl = -1, bestScore = -Infinity;
  for (let lbl = 0; lbl < numLabels; lbl++) {
    if (sizes[lbl] < minArea) continue;
    const b = bb[lbl];
    const gx = b.sumX / b.count, gy = b.sumY / b.count;
    const distFrac = Math.hypot(gx - cx, gy - cy) / diag; // 0 (centro) .. ~0.7 (canto)
    const score = sizes[lbl] * Math.exp(-3 * distFrac); // penaliza forte quanto mais longe do centro
    if (score > bestScore) { bestScore = score; bestLbl = lbl; }
  }

  const clean = new Uint8Array(n);
  if (bestLbl === -1) return clean; // nada passou no filtro de área

  const main = bb[bestLbl];
  const padX = (main.maxX - main.minX) * 0.2, padY = (main.maxY - main.minY) * 0.2;
  const exp = { minX: main.minX - padX, maxX: main.maxX + padX, minY: main.minY - padY, maxY: main.maxY + padY };
  const keep = new Set([bestLbl]);
  for (let lbl = 0; lbl < numLabels; lbl++) {
    if (sizes[lbl] < minArea || keep.has(lbl)) continue;
    const b = bb[lbl];
    const gx = b.sumX / b.count, gy = b.sumY / b.count;
    if (gx >= exp.minX && gx <= exp.maxX && gy >= exp.minY && gy <= exp.maxY) keep.add(lbl);
  }

  for (let i = 0; i < n; i++) {
    const lbl = labels[i];
    if (lbl >= 0 && keep.has(lbl)) clean[i] = 1;
  }
  return clean;
}

/** Caixa delimitadora (bounding box) de uma máscara binária; null se vazia. */
export function bboxOfMask(mask, width, height) {
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!mask[y * width + x]) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  return { minX, minY, maxX, maxY };
}

// ── 4) recorte + centralização num canvas quadrado padrão ──────────────────

/**
 * Recorta a cor e a máscara na mesma bbox, redimensiona (vizinho-mais-próximo,
 * pra manter cor e máscara com geometria idêntica) e centraliza num canvas
 * canvasSize×canvasSize com uma margem — cor e máscara resultantes SEMPRE
 * alinhadas pixel a pixel entre si e entre imagens diferentes.
 */
export function composeCanonical(data, width, height, mask, bbox, { canvasSize = 384, marginFrac = 0.08 } = {}) {
  const color = new Uint8Array(canvasSize * canvasSize * 3).fill(230); // fundo neutro claro só p/ visual
  const canonMask = new Uint8Array(canvasSize * canvasSize);

  const contentW = bbox.maxX - bbox.minX + 1;
  const contentH = bbox.maxY - bbox.minY + 1;
  const inner = canvasSize * (1 - 2 * marginFrac);
  const scale = Math.min(inner / contentW, inner / contentH);
  const destW = Math.max(1, Math.round(contentW * scale));
  const destH = Math.max(1, Math.round(contentH * scale));
  const offsetX = Math.floor((canvasSize - destW) / 2);
  const offsetY = Math.floor((canvasSize - destH) / 2);

  for (let dy = 0; dy < destH; dy++) {
    const sy = Math.min(height - 1, bbox.minY + Math.floor(dy / scale));
    for (let dx = 0; dx < destW; dx++) {
      const sx = Math.min(width - 1, bbox.minX + Math.floor(dx / scale));
      const sp = sy * width + sx;
      const dp = (offsetY + dy) * canvasSize + (offsetX + dx);
      canonMask[dp] = mask[sp];
      const si = sp * 3, di = dp * 3;
      color[di] = data[si]; color[di + 1] = data[si + 1]; color[di + 2] = data[si + 2];
    }
  }
  return { color, mask: canonMask, canvasSize };
}

/**
 * Função de conveniência: recebe uma imagem (arquivo/Buffer) e devolve
 * {color, mask, canvasSize, foregroundFrac} já no canvas canônico.
 */
export async function canonicalizeImage(input, opts = {}) {
  const { maxSize = 480, stepTolerance = 20, driftTolerance = 70, minAreaFrac = 0.0015, canvasSize = 384, marginFrac = 0.08 } = opts;
  const { data, width, height } = await loadWorkingRGB(input, { maxSize });
  const bg = floodFillBackground(data, width, height, { stepTolerance, driftTolerance });
  const fg = cleanForegroundMask(bg, width, height, { minAreaFrac });
  const bbox = bboxOfMask(fg, width, height);
  const foregroundFrac = fg.reduce((a, b) => a + b, 0) / (width * height);
  const workDims = { width, height };
  if (!bbox) {
    // nada detectado como objeto — devolve canvas vazio (verdict vai acusar isso)
    const empty = new Uint8Array(canvasSize * canvasSize * 3).fill(230);
    return { color: empty, mask: new Uint8Array(canvasSize * canvasSize), canvasSize, foregroundFrac: 0, bbox: null, workDims };
  }
  const canon = composeCanonical(data, width, height, fg, bbox, { canvasSize, marginFrac });
  return { ...canon, foregroundFrac, bbox, workDims };
}

// ── 5) métricas de comparação ───────────────────────────────────────────────

/** Intersection-over-Union de duas máscaras binárias do mesmo tamanho. */
export function maskIoU(maskA, maskB) {
  let inter = 0, union = 0;
  for (let i = 0; i < maskA.length; i++) {
    const a = maskA[i], b = maskB[i];
    if (a || b) union++;
    if (a && b) inter++;
  }
  if (union === 0) return 0;
  return inter / union;
}

/** Histograma de cor grosseiro (8 bins/canal) dentro da máscara, normalizado. */
function colorHistogram(color, mask, bins = 8) {
  const hist = new Float64Array(bins * bins * bins);
  let count = 0;
  const step = 256 / bins;
  for (let p = 0; p < mask.length; p++) {
    if (!mask[p]) continue;
    const i = p * 3;
    const rb = Math.min(bins - 1, Math.floor(color[i] / step));
    const gb = Math.min(bins - 1, Math.floor(color[i + 1] / step));
    const bb = Math.min(bins - 1, Math.floor(color[i + 2] / step));
    hist[(rb * bins + gb) * bins + bb]++;
    count++;
  }
  if (count > 0) for (let i = 0; i < hist.length; i++) hist[i] /= count;
  return hist;
}

/** Similaridade de cor (0..1) por interseção de histograma dentro das máscaras. */
export function colorSimilarity(colorA, maskA, colorB, maskB) {
  const ha = colorHistogram(colorA, maskA);
  const hb = colorHistogram(colorB, maskB);
  let inter = 0;
  for (let i = 0; i < ha.length; i++) inter += Math.min(ha[i], hb[i]);
  return inter; // histogramas normalizados somam ~1, interseção fica em 0..1
}

/**
 * Descritor de "layout de cor" (grade de cor média por região, técnica
 * clássica — mesma ideia do Color Layout Descriptor do MPEG-7). Um
 * histograma de cor sozinho não vê ONDE cada cor está: uma tela preta
 * retangular no meio de um smartwatch e um metal cinza uniforme numa
 * pulseira redonda podem ter histogramas parecidos, mas o ARRANJO espacial
 * da cor é bem diferente — essa grade capta isso sem precisar de IA.
 */
function colorLayout(color, mask, canvasSize, grid = 8) {
  const cell = canvasSize / grid;
  const vec = new Float64Array(grid * grid * 3);
  for (let gy = 0; gy < grid; gy++) {
    for (let gx = 0; gx < grid; gx++) {
      let r = 0, g = 0, b = 0, count = 0;
      const x0 = Math.floor(gx * cell), x1 = Math.floor((gx + 1) * cell);
      const y0 = Math.floor(gy * cell), y1 = Math.floor((gy + 1) * cell);
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const p = y * canvasSize + x;
          if (!mask[p]) continue;
          const i = p * 3;
          r += color[i]; g += color[i + 1]; b += color[i + 2]; count++;
        }
      }
      const idx = (gy * grid + gx) * 3;
      if (count > 0) { vec[idx] = r / count; vec[idx + 1] = g / count; vec[idx + 2] = b / count; }
      else { vec[idx] = -1; vec[idx + 1] = -1; vec[idx + 2] = -1; } // célula vazia (fora do objeto)
    }
  }
  return vec;
}

/** Similaridade (0..1) de layout de cor — só compara células onde AMBOS têm objeto. */
export function colorLayoutSimilarity(colorA, maskA, colorB, maskB, canvasSize, grid = 8) {
  const va = colorLayout(colorA, maskA, canvasSize, grid);
  const vb = colorLayout(colorB, maskB, canvasSize, grid);
  let sumDist = 0, cells = 0;
  for (let c = 0; c < grid * grid; c++) {
    const i = c * 3;
    if (va[i] < 0 || vb[i] < 0) continue; // célula vazia em pelo menos uma das duas — não compara
    const dr = va[i] - vb[i], dg = va[i + 1] - vb[i + 1], db = va[i + 2] - vb[i + 2];
    sumDist += Math.sqrt(dr * dr + dg * dg + db * db);
    cells++;
  }
  if (cells === 0) return 0;
  const meanDist = sumDist / cells; // 0..~441 (diagonal do cubo RGB)
  return Math.max(0, 1 - meanDist / 180);
}

/** Escala de cinza simples (BT.601) a partir do buffer RGB. */
function toGray(color, canvasSize) {
  const n = canvasSize * canvasSize;
  const gray = new Float32Array(n);
  for (let p = 0; p < n; p++) {
    const i = p * 3;
    gray[p] = 0.299 * color[i] + 0.587 * color[i + 1] + 0.114 * color[i + 2];
  }
  return gray;
}

/** Magnitude de borda via Sobel 3x3. */
function sobelMagnitude(gray, canvasSize) {
  const mag = new Float32Array(canvasSize * canvasSize);
  const at = (x, y) => gray[Math.min(canvasSize - 1, Math.max(0, y)) * canvasSize + Math.min(canvasSize - 1, Math.max(0, x))];
  for (let y = 0; y < canvasSize; y++) {
    for (let x = 0; x < canvasSize; x++) {
      const gx = -at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1)
        + at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1);
      const gy = -at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1)
        + at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1);
      mag[y * canvasSize + x] = Math.sqrt(gx * gx + gy * gy);
    }
  }
  return mag;
}

/**
 * Similaridade de borda (0..1): compara os mapas de Sobel de A e B dentro da
 * união das duas silhuetas (normalizados pra magnitude máxima de cada um,
 * pra não penalizar diferença de contraste/exposição entre foto e render).
 */
export function edgeSimilarity(colorA, maskA, colorB, maskB, canvasSize) {
  const grayA = toGray(colorA, canvasSize), grayB = toGray(colorB, canvasSize);
  const magA = sobelMagnitude(grayA, canvasSize), magB = sobelMagnitude(grayB, canvasSize);
  let maxA = 1e-6, maxB = 1e-6;
  for (let i = 0; i < magA.length; i++) { if (magA[i] > maxA) maxA = magA[i]; if (magB[i] > maxB) maxB = magB[i]; }
  let count = 0, diffSum = 0;
  for (let i = 0; i < magA.length; i++) {
    if (!maskA[i] && !maskB[i]) continue;
    diffSum += Math.abs(magA[i] / maxA - magB[i] / maxB);
    count++;
  }
  if (count === 0) return 0;
  return 1 - Math.min(1, diffSum / count);
}

// ── forma: momentos invariantes de Hu ───────────────────────────────────────
// A IoU sozinha discrimina mal formas bem diferentes quando ambas já estão
// centralizadas/escaladas pro mesmo canvas (um retângulo centralizado e um
// círculo centralizado se sobrepõem bastante mesmo sendo formas diferentes).
// Os 7 momentos de Hu são a ferramenta clássica de visão computacional pra
// "essa silhueta tem o mesmo formato que aquela?" — invariantes a translação,
// escala e rotação, sem precisar de nenhum modelo/IA.
function rawMoment(mask, canvasSize, p, q) {
  let m = 0;
  for (let y = 0; y < canvasSize; y++) {
    for (let x = 0; x < canvasSize; x++) {
      if (!mask[y * canvasSize + x]) continue;
      m += (p === 0 ? 1 : x ** p) * (q === 0 ? 1 : y ** q);
    }
  }
  return m;
}

/** Devolve os 7 momentos de Hu (já em escala log, sinal preservado) de uma máscara binária. */
export function huMoments(mask, canvasSize) {
  const m00 = rawMoment(mask, canvasSize, 0, 0);
  if (m00 < 4) return null; // máscara vazia demais pra ter forma confiável
  const m10 = rawMoment(mask, canvasSize, 1, 0);
  const m01 = rawMoment(mask, canvasSize, 0, 1);
  const xc = m10 / m00, yc = m01 / m00;

  const mu = (p, q) => {
    let s = 0;
    for (let y = 0; y < canvasSize; y++) {
      for (let x = 0; x < canvasSize; x++) {
        if (!mask[y * canvasSize + x]) continue;
        s += (x - xc) ** p * (y - yc) ** q;
      }
    }
    return s;
  };
  const norm = (p, q) => mu(p, q) / m00 ** (1 + (p + q) / 2);

  const n20 = norm(2, 0), n02 = norm(0, 2), n11 = norm(1, 1);
  const n30 = norm(3, 0), n03 = norm(0, 3), n12 = norm(1, 2), n21 = norm(2, 1);

  // Usamos só os 3 invariantes de Hu que são SEMPRE ≥ 0 (somas de quadrados:
  // h1 = espalhamento geral, h2 = quão alongado/assimétrico em X vs Y,
  // h4 = assimetria de 3ª ordem em módulo). Os outros 4 (h3, h5, h6, h7)
  // trocam de sinal e, pra formas com bastante simetria (uma pulseira ou
  // relógio redondo, bem comuns aqui), ficam pertinho de zero — nesse
  // regime log(quase-zero) vira instável e pequenas diferenças de pixel
  // fazem o valor "pular" de muito negativo pra muito positivo, o que
  // destruía a comparação (formas praticamente iguais pareciam "diferentes
  // ao extremo"). Os 3 que sobraram não têm esse problema (nunca são
  // negativos, log fica bem-comportado) e ainda captam bem "é essa forma?".
  const h1 = n20 + n02;
  const h2 = (n20 - n02) ** 2 + 4 * n11 ** 2;
  const h4 = (n30 + n12) ** 2 + (n21 + n03) ** 2;

  const FLOOR = 1e-8;
  const log = (v) => Math.log10(Math.max(v, FLOOR));
  return [h1, h2, h4].map(log);
}

/** Similaridade de forma (0..1) a partir da distância entre dois vetores de Hu (h1,h2,h4). */
export function huSimilarity(huA, huB) {
  if (!huA || !huB) return 0;
  let dist = 0;
  for (let i = 0; i < huA.length; i++) dist += Math.abs(huA[i] - huB[i]);
  return Math.exp(-0.22 * dist); // decaimento suave: formas idênticas → 1, bem diferentes → perto de 0
}

/** Serializa um canvas RGB canônico como PNG (Buffer), via sharp. */
export async function canonicalToPng(color, canvasSize) {
  return sharp(Buffer.from(color), { raw: { width: canvasSize, height: canvasSize, channels: 3 } })
    .png().toBuffer();
}

/** Serializa uma máscara binária (0/1) como PNG cinza (Buffer), via sharp. */
export async function maskToPng(mask, canvasSize) {
  const buf = Buffer.alloc(canvasSize * canvasSize);
  for (let i = 0; i < mask.length; i++) buf[i] = mask[i] ? 255 : 0;
  return sharp(buf, { raw: { width: canvasSize, height: canvasSize, channels: 1 } }).png().toBuffer();
}

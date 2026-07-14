/**
 * imageSelector.js — escolhe automaticamente, entre várias fotos do mesmo
 * produto, a melhor candidata pra geração 3D (GLB). As demais continuam
 * disponíveis só pra vitrine.
 *
 * Módulo isolado (2026-07-14): não é chamado por nada ainda, não altera o
 * pipeline de geração existente. Roda em Node (usa `sharp` e o filesystem)
 * — NÃO é importável pelo bundle do navegador, então nunca deve ser
 * importado por código de src/ fora de scripts/tooling Node.
 *
 * Critérios (0–1 cada, sem serviços externos, tudo via análise de pixel):
 *  - background (peso 0.3): quão uniforme é a borda da imagem
 *  - center     (peso 0.2): quão perto do centro está o produto
 *  - size       (peso 0.2): produto ocupando 50–80% da área
 *  - orientation(peso 0.2): simetria horizontal da silhueta (proxy pra "de frente")
 *  - quality    (peso 0.1): nitidez (variância de Laplaciano) + contraste
 */
import sharp from 'sharp';

const WEIGHTS = { background: 0.3, center: 0.2, size: 0.2, orientation: 0.2, quality: 0.1 };

const ANALYSIS_SIZE = 320;          // maior dimensão pra análise — rápido e suficiente pra heurística
const BORDER_FRACTION = 0.06;       // espessura da faixa de borda amostrada, em % da menor dimensão
const FOREGROUND_DIFF_THRESHOLD = 28; // distância de cor (0–255) pra considerar um pixel "produto" quando não há alpha
const OCCUPANCY_TARGET = [0.5, 0.8];
const BG_STDEV_MAX = 40;            // desvio-padrão de cor acima do qual o fundo é considerado "sujo" (score 0)
const BLUR_VARIANCE_MAX = 800;      // variância de Laplaciano acima da qual a imagem é considerada "nítida" (score 1)
const CONTRAST_STDEV_MAX = 70;      // desvio-padrão de luminância acima do qual o contraste é considerado ótimo (score 1)

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

function colorDistance(r1, g1, b1, r2, g2, b2) {
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

/**
 * Um PNG pode ter canal alfa sem ter transparência de verdade (muitos
 * editores exportam alfa 100% opaco por padrão). Só tratamos o alfa como
 * sinal de "fundo já removido" se uma fração relevante dos pixels for
 * realmente transparente — senão caímos no método de distância de cor.
 */
function hasRealTransparency(data, width, height) {
  const total = width * height;
  let transparent = 0;
  for (let p = 0; p < total; p++) {
    if (data[p * 4 + 3] < 200) transparent++;
  }
  return transparent / total > 0.02;
}

/** Carrega a imagem em RGBA cru, reduzida pra ANALYSIS_SIZE (mantendo proporção). */
async function loadAnalysisBuffer(path) {
  const meta = await sharp(path).metadata();
  const { data, info } = await sharp(path)
    .resize(ANALYSIS_SIZE, ANALYSIS_SIZE, { fit: 'inside', withoutEnlargement: false })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const useAlpha = meta.hasAlpha && hasRealTransparency(data, info.width, info.height);
  return { data, width: info.width, height: info.height, useAlpha };
}

/** Estima a cor de fundo a partir dos 4 cantos (usado quando não há transparência real). */
function estimateBackgroundColor(data, width, height) {
  const samplePoints = [
    [0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1],
  ];
  let r = 0, g = 0, b = 0;
  for (const [x, y] of samplePoints) {
    const i = (y * width + x) * 4;
    r += data[i]; g += data[i + 1]; b += data[i + 2];
  }
  return { r: r / 4, g: g / 4, b: b / 4 };
}

/** Máscara booleana (Uint8Array) de pixels "produto" (true) vs "fundo" (false). */
function buildForegroundMask({ data, width, height, useAlpha }) {
  const mask = new Uint8Array(width * height);
  if (useAlpha) {
    for (let p = 0; p < width * height; p++) {
      mask[p] = data[p * 4 + 3] > 128 ? 1 : 0;
    }
  } else {
    const bg = estimateBackgroundColor(data, width, height);
    for (let p = 0; p < width * height; p++) {
      const i = p * 4;
      const dist = colorDistance(data[i], data[i + 1], data[i + 2], bg.r, bg.g, bg.b);
      mask[p] = dist > FOREGROUND_DIFF_THRESHOLD ? 1 : 0;
    }
  }
  return mask;
}

function boundingBox(mask, width, height) {
  let minX = width, maxX = -1, minY = height, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x]) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null; // nenhum pixel de produto detectado
  return { minX, maxX, minY, maxY };
}

function scoreCenter(bbox, width, height) {
  if (!bbox) return 0;
  const cx = (bbox.minX + bbox.maxX) / 2;
  const cy = (bbox.minY + bbox.maxY) / 2;
  const dist = Math.hypot(cx - width / 2, cy - height / 2);
  const maxDist = Math.hypot(width / 2, height / 2);
  return clamp01(1 - dist / maxDist);
}

function scoreOccupancy(bbox, width, height) {
  if (!bbox) return 0;
  const area = (bbox.maxX - bbox.minX + 1) * (bbox.maxY - bbox.minY + 1);
  const occupancy = area / (width * height);
  const [lo, hi] = OCCUPANCY_TARGET;
  if (occupancy >= lo && occupancy <= hi) return 1;
  if (occupancy < lo) return clamp01((occupancy - 0.1) / (lo - 0.1));
  return clamp01((1 - occupancy) / (1 - hi));
}

/** Uniformidade da faixa de borda da imagem (fora do produto). Alfa transparente = fundo perfeito. */
function scoreBackground({ data, width, height, useAlpha }) {
  const borderPx = Math.max(2, Math.round(Math.min(width, height) * BORDER_FRACTION));
  const isBorder = (x, y) => x < borderPx || y < borderPx || x >= width - borderPx || y >= height - borderPx;

  if (useAlpha) {
    let transparent = 0, total = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!isBorder(x, y)) continue;
        total++;
        if (data[(y * width + x) * 4 + 3] < 20) transparent++;
      }
    }
    return total === 0 ? 0 : transparent / total;
  }

  let sumR = 0, sumG = 0, sumB = 0, n = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!isBorder(x, y)) continue;
      const i = (y * width + x) * 4;
      sumR += data[i]; sumG += data[i + 1]; sumB += data[i + 2];
      n++;
    }
  }
  if (n === 0) return 0;
  const meanR = sumR / n, meanG = sumG / n, meanB = sumB / n;
  let varSum = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!isBorder(x, y)) continue;
      const i = (y * width + x) * 4;
      varSum += (data[i] - meanR) ** 2 + (data[i + 1] - meanG) ** 2 + (data[i + 2] - meanB) ** 2;
    }
  }
  const stdev = Math.sqrt(varSum / (n * 3));
  return clamp01(1 - stdev / BG_STDEV_MAX);
}

/**
 * Proxy pra "produto de frente pra câmera": compara a silhueta com o seu
 * próprio espelho horizontal (IoU). Fotos frontais tendem a ser mais
 * simétricas; ângulos extremos quebram a simetria. É uma aproximação —
 * produtos com coroa/botão de um só lado nunca chegam a IoU 1.0 mesmo de
 * frente, mas ainda distingue bem "de frente" de "de lado".
 */
function scoreOrientation(mask, width, height, bbox) {
  if (!bbox) return 0;
  let intersection = 0, union = 0;
  for (let y = bbox.minY; y <= bbox.maxY; y++) {
    for (let x = bbox.minX; x <= bbox.maxX; x++) {
      const mirroredX = width - 1 - x;
      const a = mask[y * width + x];
      const b = mask[y * width + mirroredX];
      if (a || b) union++;
      if (a && b) intersection++;
    }
  }
  return union === 0 ? 0 : intersection / union;
}

/** Nitidez (variância de Laplaciano) + contraste (desvio-padrão de luminância). */
async function scoreQuality(path) {
  const laplacian = {
    width: 3, height: 3,
    kernel: [0, 1, 0, 1, -4, 1, 0, 1, 0],
  };
  const gray = sharp(path).resize(ANALYSIS_SIZE, ANALYSIS_SIZE, { fit: 'inside' }).grayscale();

  const stats = await gray.clone().stats();
  const contrastStdev = stats.channels[0].stdev;
  const contrastScore = clamp01(contrastStdev / CONTRAST_STDEV_MAX);

  const edges = await gray.clone().convolve(laplacian).raw().toBuffer({ resolveWithObject: true });
  const { data } = edges;
  let mean = 0;
  for (let i = 0; i < data.length; i++) mean += data[i];
  mean /= data.length;
  let variance = 0;
  for (let i = 0; i < data.length; i++) variance += (data[i] - mean) ** 2;
  variance /= data.length;
  const blurScore = clamp01(variance / BLUR_VARIANCE_MAX);

  return (blurScore + contrastScore) / 2;
}

/**
 * Analisa uma imagem e retorna o score final (0–1) e o detalhamento por critério.
 * @param {string} path
 */
export async function scoreImage(path) {
  const buffer = await loadAnalysisBuffer(path);
  const mask = buildForegroundMask(buffer);
  const bbox = boundingBox(mask, buffer.width, buffer.height);

  const scores = {
    background: scoreBackground(buffer),
    center: scoreCenter(bbox, buffer.width, buffer.height),
    size: scoreOccupancy(bbox, buffer.width, buffer.height),
    orientation: scoreOrientation(mask, buffer.width, buffer.height, bbox),
    quality: await scoreQuality(path),
  };

  const total =
    scores.background * WEIGHTS.background +
    scores.center * WEIGHTS.center +
    scores.size * WEIGHTS.size +
    scores.orientation * WEIGHTS.orientation +
    scores.quality * WEIGHTS.quality;

  return { path, score: total, scores };
}

/**
 * Escolhe a melhor imagem entre várias fotos do mesmo produto.
 * @param {string[]} images - caminhos de arquivo
 * @returns {Promise<string>} caminho da imagem escolhida
 */
export async function selectBestImage(images) {
  if (!images || images.length === 0) {
    throw new Error('selectBestImage: nenhuma imagem fornecida');
  }

  const results = [];
  for (const path of images) {
    try {
      results.push(await scoreImage(path));
    } catch (err) {
      console.warn(`[imageSelector] falha ao analisar ${path}: ${err.message}`);
    }
  }

  if (results.length === 0) {
    throw new Error('selectBestImage: nenhuma imagem pôde ser analisada');
  }

  results.sort((a, b) => b.score - a.score);

  console.log('\n[IMAGE SCORE]');
  results.slice(0, 3).forEach((r, i) => {
    console.log(`${i + 1}. ${r.path} → ${r.score.toFixed(2)}`);
  });

  return results[0].path;
}

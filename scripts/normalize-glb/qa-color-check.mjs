/**
 * qa-color-check.mjs — checagem automática de COR: compara a cor média do
 * produto na foto real (products.json) com a cor média do produto no render
 * 3D atual (public/models/normalized/<ID>.glb), e sinaliza divergência.
 *
 * É a Parte 2 do QA automático de catálogo — extensão de qa-compare.mjs (que
 * só monta a comparação lado a lado pra um humano olhar). Este script tira
 * um veredito objetivo (número), pensado pra pegar o tipo de erro que já
 * aconteceu de verdade no catálogo: CW005/CW017/CW028/CW032/CW033 saíram do
 * gerador 3D com a cor errada (ex.: dourado virou prateado).
 *
 * ---------------------------------------------------------------------------
 * MÉTODO (v2 — comparação por MATIZ/HUE, não RGB completo; ver histórico
 * abaixo do porquê):
 *
 * 1. Foto real: baixa (com cache local, mesmo padrão de qa-compare.mjs) e
 *    calcula a cor média RGB de um RECORTE CENTRAL da imagem (não segmentação
 *    de verdade — é uma aproximação: a maioria das fotos de produto do
 *    catálogo tem fundo branco/claro e o produto centralizado, então um
 *    recorte central tende a conter muito mais pixel de produto que de fundo).
 *    LIMITAÇÃO CONHECIDA: se o produto real for pequeno/fino dentro do frame
 *    (ex.: uma pulseira fina, foto com bastante fundo sobrando), o recorte
 *    central ainda pode incluir bastante fundo branco e enviesar a cor média
 *    pra mais clara do que o produto de fato é. É uma heurística v1 — não
 *    tenta segmentar o objeto de verdade.
 *
 * 2. Render 3D: abre o GLB normalizado no <model-viewer> (via
 *    public/_qa-color.html), mesmo ângulo/câmera já usado em outros scripts
 *    do projeto (camera-orbit="0deg 78deg 105%"), contra um fundo sólido
 *    conhecido (#161616, sem sombra — a sombra do model-viewer contaminaria
 *    a exclusão de fundo abaixo). Aqui a precisão é de verdade, não
 *    aproximação: qualquer pixel do screenshot cuja distância euclidiana até
 *    a cor de fundo conhecida seja menor que BG_MATCH_TOLERANCE é descartado
 *    como fundo; a média é só dos pixels que sobraram (produto de verdade).
 *
 * 3. v1 (histórico — NÃO usado mais): distância euclidiana simples entre as
 *    duas médias RGB (escala 0-441). Rodada real em 2026-09-02 contra os 35
 *    produtos do catálogo: 20/35 sinalizados como DIVERGENTE, mas a maioria
 *    era FALSO ALARME — a iluminação de foto de estúdio real é sistemati-
 *    camente diferente do brilho do render 3D, mesmo quando a cor em si está
 *    correta (ex.: CW033, já corrigido e visualmente perfeito, deu distância
 *    206 num limiar de 60 só por causa dessa diferença de brilho geral).
 *
 * 4. v2 (atual): converte as duas médias RGB pra HSV e compara SÓ o canal H
 *    (matiz/hue, 0-360°) — é o componente de cor que não muda com brilho ou
 *    exposição (só S/saturação e V/valor mudam com iluminação diferente; H é
 *    o mais estável entre foto de estúdio e render 3D). A distância entre
 *    hues é CIRCULAR (0° e 359° são visualmente quase iguais) — ver
 *    `hueDistance()`, que sempre retorna 0-180.
 *
 *    CASO DE BORDA — cor quase sem saturação (preto/branco/cinza): hue é
 *    tecnicamente indefinido/instável nesse caso (ruído de poucos pixels
 *    pode fazer o hue calculado "pular" muito, mesmo sendo a mesma cor
 *    neutra) — comparar hue diretamente aqui daria veredito não confiável.
 *    Duas ideias mais simples foram tentadas e descartadas depois de rodar
 *    contra o catálogo real (ver `classifyColorMatch()` pro raciocínio
 *    completo e comentários no código):
 *      - exigir saturação boa NOS DOIS lados → maioria dos produtos (relógio
 *        prateado/preto com mostrador escuro) ficava marcada como "neutra"
 *        o tempo todo, mesmo sendo bem coloridos de verdade — a foto real
 *        sistematicamente lê saturação mais baixa por causa do recorte
 *        central incluir bastante fundo branco.
 *      - exigir saturação boa só no RENDER (mais confiável, já que o fundo
 *        dele é removido por exclusão exata, não recorte aproximado) →
 *        eliminava esse problema, mas criava um novo: relógios com case
 *        prateado/preto + um detalhe colorido pequeno (mostrador, coroa)
 *        têm saturação MÉDIA baixa quando você calcula a média de cor do
 *        objeto INTEIRO, mesmo estando com a cor certa — 3 falsos alarmes
 *        confirmados (CW023/CW024/CW025, todos visualmente corretos).
 *    A regra final: só trata a cor como "sem sinal confiável de hue" quando
 *    OS DOIS LADOS (real e render) lêem saturação baixa ao mesmo tempo — se
 *    qualquer um dos dois capturou saturação de verdade (mesmo que diluída/
 *    parcial), já dá pra comparar hue normalmente contra
 *    DIVERGENCE_THRESHOLD_HUE. Só quando nenhum dos dois lados sobra sinal
 *    nenhum é que o script retorna "⚠️ COR NEUTRA (confira visualmente)" em
 *    vez de OK/DIVERGENTE — sem tentar decidir sozinho.
 * ---------------------------------------------------------------------------
 *
 * Requer: servidor do laboratório rodando (`npm run lab:m069b`) na porta 5173
 * (o <model-viewer> precisa buscar o .glb do mesmo host que serve a página,
 * senão CORS bloqueia — mesma razão de qa-compare-raw.mjs usar uma página
 * estática servida por http em vez de page.setContent()).
 *
 * Uso:
 *   node scripts/normalize-glb/qa-color-check.mjs CW001 CW002 ...
 *   node scripts/normalize-glb/qa-color-check.mjs --all
 *
 *   # apontar um ID pra um arquivo .glb específico em vez do normalized/ID.glb
 *   # padrão (útil pra testar um arquivo antigo/backup sem tocar no catálogo
 *   # real — o arquivo é copiado TEMPORARIAMENTE pra dentro de
 *   # public/models/normalized/ pra poder ser servido por http, e apagado no
 *   # finally, aconteça o que acontecer):
 *   node scripts/normalize-glb/qa-color-check.mjs "CW017=C:\caminho\CW017_antigo.glb"
 *
 * Saída: console + scripts/normalize-glb/qa-output/COLOR_CHECK_REPORT.md
 */

import { chromium } from 'playwright';
import sharp from 'sharp';
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const PRODUCTS_PATH = resolve(ROOT, 'src/data/products.json');
const OVERRIDES_PATH = resolve(HERE, 'product-calibration-overrides.json');
const OUT_DIR = resolve(HERE, 'qa-output');
const REPORT_PATH = resolve(HERE, 'COLOR_CHECK_REPORT.md');
const LAB_URL = 'https://localhost:5173';

// ---------------------------------------------------------------------------
// Constantes ajustáveis — mexer aqui se o veredito estiver saindo errado.
// ---------------------------------------------------------------------------

// Fração central da foto real usada como aproximação da região do produto.
// 0.57 = recorte de 57% de largura/altura, centralizado (heurística v1, ver
// nota de método no topo do arquivo).
const CENTER_CROP_FRACTION = 0.57;

// Cor de fundo sólida conhecida usada no render de controle. TEM QUE bater
// com o CSS de public/_qa-color.html — se mudar um, mudar o outro.
const RENDER_BG_HEX = '#161616';

// Distância euclidiana (escala 0-441) abaixo da qual um pixel do RENDER é
// considerado "fundo" e descartado antes de calcular a cor média do produto.
const BG_MATCH_TOLERANCE = 30;

// v1 (histórico, não usado mais no veredito — mantido só de referência/debug,
// ver dist3() mais abaixo). Distância euclidiana RGB (escala 0-441) acima da
// qual o produto seria sinalizado como DIVERGENTE pelo método antigo.
const DIVERGENCE_THRESHOLD_RGB_LEGACY = 60;

// v2 (atual) — comparação por matiz (hue, canal H do HSV, escala 0-360°,
// distância circular 0-180 — ver hueDistance()). Acima disso, DIVERGENTE.
// Valor conservador inicial (~14% da distância máxima possível de 180°,
// mesma proporção do limiar v1 em relação a 441.7) — ajustar aqui conforme
// falsos positivos/negativos aparecerem no uso real.
const DIVERGENCE_THRESHOLD_HUE = 25;

// Saturação (canal S do HSV, escala 0-1) abaixo da qual uma cor é
// considerada "neutra" (preto/branco/cinza) — hue não é confiável nesse
// regime (ver nota de método no topo do arquivo). 0.12 é conservador: cores
// com um mínimo de croma real (dourado bem claro, prateado com leve tom)
// ainda ficam acima disso e continuam sendo comparadas por hue normalmente.
const SATURATION_NEUTRAL_THRESHOLD = 0.12;

const CAMERA_ORBIT = '0deg 78deg 105%'; // só documentativo — o ângulo real está fixo em public/_qa-color.html

// ---------------------------------------------------------------------------

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

// v1 legacy, mantido só pra debug/comparação no console — não decide mais o
// veredito (ver DIVERGENCE_THRESHOLD_HUE / classifyColorMatch()).
function dist3(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function fmtRgb([r, g, b]) {
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

// RGB (0-255 cada canal) → HSV. h em graus [0,360), s e v em [0,1].
function rgbToHsv([r, g, b]) {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const d = max - min;
  const v = max;
  const s = max === 0 ? 0 : d / max;
  let h = 0;
  if (d !== 0) {
    switch (max) {
      case rn: h = ((gn - bn) / d) % 6; break;
      case gn: h = (bn - rn) / d + 2; break;
      default: h = (rn - gn) / d + 4; break;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s, v };
}

// Distância circular entre dois hues (graus) — 0-180. 0° e 359° têm
// distância 1, não 359 (é isso que "circular" quer dizer aqui).
function hueDistance(h1, h2) {
  const d = Math.abs(h1 - h2);
  return Math.min(d, 360 - d);
}

function fmtHsv({ h, s, v }) {
  return `H${Math.round(h)}° S${Math.round(s * 100)}% V${Math.round(v * 100)}%`;
}

// Decide o veredito final a partir das duas cores médias RGB (real e
// render). Ver nota de método no topo do arquivo pro raciocínio completo do
// caso "cor neutra".
function classifyColorMatch(realRgb, renderRgb) {
  const real = rgbToHsv(realRgb);
  const render = rgbToHsv(renderRgb);
  const hDist = hueDistance(real.h, render.h);
  const rgbDistLegacy = dist3(realRgb, renderRgb); // só informativo/debug

  // GATE: só confia em hue quando PELO MENOS UM dos dois lados mostra
  // saturação de verdade. Por quê "pelo menos um" e não "os dois" nem "só o
  // render" (as duas versões anteriores deste script, descartadas depois de
  // rodar contra o catálogo real — ver histórico abaixo):
  //
  // - A saturação da FOTO REAL sub-estima sistematicamente a cor real do
  //   produto: o recorte central quase sempre pega bastante fundo branco
  //   junto (ver nota de método no topo do arquivo), e misturar qualquer cor
  //   com fundo branco DILUI a saturação medida — mas matematicamente
  //   PRESERVA o hue quase exatamente (mistura proporcional e igual nos 3
  //   canais não muda a razão entre eles, contanto que nenhum canal já
  //   esteja saturado em 255; confirmado batendo o cálculo à mão: hue
  //   idêntico antes/depois de diluir 85% de um azul-marinho com branco,
  //   saturação caindo de 67% pra 4%). Ou seja, mesmo quando a saturação da
  //   foto real lê baixo, o hue dela continua sendo um sinal utilizável.
  //
  // - A saturação do RENDER, por sua vez, sub-estima a cor em produtos onde
  //   a cor de verdade ocupa só uma PARTE PEQUENA do objeto (ex.: relógio
  //   todo prateado/preto com só o mostrador ou um detalhe colorido) — a
  //   média de cor de TODO o objeto é dominada pela área neutra (metal/
  //   plástico preto), mesmo quando esse detalhe colorido está certinho no
  //   render. Descoberto rodando este script contra CW023/CW024/CW025 (3
  //   relógios com case prateado/preto + detalhe colorido pequeno,
  //   visualmente corretos nos dois lados) — uma versão anterior deste
  //   script que exigia OBRIGATORIAMENTE saturação do render pra confiar em
  //   qualquer cor gerou falso alarme nos 3, porque a média do render inteiro
  //   tem saturação baixa mesmo estando certo.
  //
  // Por isso: se qualquer um dos dois lados capturou um sinal de cor de
  // verdade (mesmo que diluído/parcial), já dá pra comparar hue. Só quando
  // OS DOIS lêem sem saturação nenhuma é que não sobra nenhum sinal de cor
  // confiável pra comparar — aí sim o script não decide sozinho.
  const maxSat = Math.max(real.s, render.s);
  if (maxSat < SATURATION_NEUTRAL_THRESHOLD) {
    return {
      category: 'LOW_CONFIDENCE_NEUTRAL',
      verdict: '⚠️ COR NEUTRA (confira visualmente)',
      hueDistance: hDist, real, render, rgbDistLegacy,
      note: 'render e foto real têm saturação baixa (preto/branco/cinza) — matiz não é confiável aqui, comparação por hue foi pulada de propósito.',
    };
  }

  const divergent = hDist > DIVERGENCE_THRESHOLD_HUE;
  return {
    category: divergent ? 'DIVERGENT' : 'OK',
    verdict: divergent ? '🔴 DIVERGENTE' : '✅ OK',
    hueDistance: hDist, real, render, rgbDistLegacy,
    note: null,
  };
}

async function fetchRef(url, outPath) {
  if (existsSync(outPath)) return;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download falhou (${res.status}) para ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(outPath, buf);
}

// Cor média do recorte central da foto real. flatten() achata transparência
// (se houver, ex. PNG) sobre branco — mesma suposição de fundo claro que
// justifica o recorte central em primeiro lugar.
async function centralCropMeanColor(imgPath, fraction) {
  const meta = await sharp(imgPath).metadata();
  const cropW = Math.max(1, Math.round(meta.width * fraction));
  const cropH = Math.max(1, Math.round(meta.height * fraction));
  const left = Math.round((meta.width - cropW) / 2);
  const top = Math.round((meta.height - cropH) / 2);
  const stats = await sharp(imgPath)
    .flatten({ background: '#ffffff' })
    .extract({ left, top, width: cropW, height: cropH })
    .stats();
  return [stats.channels[0].mean, stats.channels[1].mean, stats.channels[2].mean];
}

// Cor média dos pixels do render que NÃO são fundo (distância até bgRgb
// maior que tolerance). Retorna também a cobertura (fração de pixels
// considerados "produto") — útil pra desconfiar do resultado se der ~0%
// (provável sinal de que o modelo não carregou / renderizou em branco).
async function renderMeanColorExcludingBg(imgPath, bgRgb, tolerance) {
  const { data, info } = await sharp(imgPath).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const channels = info.channels;
  const total = info.width * info.height;
  let sumR = 0, sumG = 0, sumB = 0, count = 0;
  for (let i = 0; i < total; i++) {
    const o = i * channels;
    const r = data[o], g = data[o + 1], b = data[o + 2];
    const d = Math.hypot(r - bgRgb[0], g - bgRgb[1], b - bgRgb[2]);
    if (d > tolerance) { sumR += r; sumG += g; sumB += b; count++; }
  }
  if (count === 0) return { mean: null, coverage: 0 };
  return { mean: [sumR / count, sumG / count, sumB / count], coverage: count / total };
}

// Página estática reaproveitada dos dois caminhos abaixo (caso normal via
// servidor do lab, caso override via servidor efêmero) — lida uma vez do
// disco pra não duplicar o HTML em dois lugares.
const QA_COLOR_HTML = readFileSync(resolve(ROOT, 'public/_qa-color.html'), 'utf8');

async function waitAndShoot(page, url, outPath) {
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForSelector('model-viewer', { timeout: 15000 });
  await page.waitForFunction(() => {
    const mv = document.querySelector('model-viewer');
    return mv && mv.loaded;
  }, { timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(1200);
  await page.screenshot({ path: outPath });
}

// Caso normal (sem override): o arquivo já existe em public/models/normalized/
// e o próprio servidor do lab (vite) já o serve — nada pra criar/limpar.
async function shootColor(browser, id, outPath) {
  const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width: 600, height: 600 } });
  const url = `${LAB_URL}/_qa-color.html?src=${encodeURIComponent(`/models/normalized/${id}.glb`)}&t=${Date.now()}`;
  await waitAndShoot(page, url, outPath);
  await page.close();
}

// Caso override (id=caminho, usado pra testar arquivos de backup/antigos sem
// tocar no catálogo real): NÃO escreve dentro de public/ — isso já causou um
// crash real do servidor do lab (vite/chokidar no Windows lança EBUSY quando
// o arquivo some rápido demais depois de criado dentro de uma pasta que o
// vite está observando; ver histórico deste script). Em vez disso, sobe um
// servidorzinho HTTP efêmero, só pra essa checagem, servindo um diretório
// temporário do SISTEMA (fora do repositório, o vite nunca fica sabendo que
// ele existe) com uma cópia do GLB + a mesma página _qa-color.html. Sempre
// derruba o servidor e apaga o diretório temporário no finally.
async function shootColorOverride(browser, id, srcAbsPath, outPath) {
  const tmpDir = mkdtempSync(resolve(tmpdir(), 'ghost-qa-color-'));
  let server;
  try {
    copyFileSync(srcAbsPath, resolve(tmpDir, `${id}.glb`));
    writeFileSync(resolve(tmpDir, '_qa-color.html'), QA_COLOR_HTML, 'utf8');

    const MIME = { '.glb': 'model/gltf-binary', '.html': 'text/html; charset=utf-8' };
    server = createServer((req, res) => {
      try {
        const urlPath = decodeURIComponent(req.url.split('?')[0]);
        const filePath = resolve(tmpDir, '.' + urlPath);
        if (!filePath.startsWith(tmpDir)) throw new Error('path fora do diretório temporário');
        const data = readFileSync(filePath);
        res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] ?? 'application/octet-stream' });
        res.end(data);
      } catch {
        res.writeHead(404);
        res.end('not found');
      }
    });
    const port = await new Promise((res, rej) => {
      server.on('error', rej);
      server.listen(0, '127.0.0.1', () => res(server.address().port));
    });

    const page = await browser.newPage({ viewport: { width: 600, height: 600 } });
    const url = `http://127.0.0.1:${port}/_qa-color.html?src=${encodeURIComponent(`/${id}.glb`)}&t=${Date.now()}`;
    await waitAndShoot(page, url, outPath);
    await page.close();
  } finally {
    if (server) await new Promise((res) => server.close(res));
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

// "CW017=C:\caminho\arquivo.glb" → { id: 'CW017', srcOverride: 'C:\caminho\arquivo.glb' }
// "CW017" → { id: 'CW017', srcOverride: null }
// (usa '=' como separador, não ':', porque paths do Windows já têm ':' na letra de unidade)
function parseArg(arg) {
  const idx = arg.indexOf('=');
  if (idx === -1) return { id: arg, srcOverride: null };
  return { id: arg.slice(0, idx), srcOverride: arg.slice(idx + 1) };
}

async function main() {
  const overrides = JSON.parse(readFileSync(OVERRIDES_PATH, 'utf8'));
  const ALL_IDS = Object.keys(overrides);

  const argv = process.argv.slice(2);
  const useAll = argv.includes('--all');
  const rawArgs = argv.filter(a => a !== '--all');
  const targets = (useAll || rawArgs.length === 0)
    ? ALL_IDS.map(id => ({ id, srcOverride: null }))
    : rawArgs.map(parseArg);

  mkdirSync(OUT_DIR, { recursive: true });
  const products = JSON.parse(readFileSync(PRODUCTS_PATH, 'utf8'));
  const bgRgb = hexToRgb(RENDER_BG_HEX);

  const browser = await chromium.launch();
  const rows = [];

  for (const { id, srcOverride } of targets) {
    const product = products.find(p => p.id === id);
    if (!product) {
      console.error(`${id}: não encontrado em products.json`);
      rows.push({ id, error: 'não encontrado em products.json' });
      continue;
    }

    console.log(`${id} — checando cor${srcOverride ? ` (override: ${srcOverride})` : ''}...`);
    try {
      const ext = (product.imageUrl.match(/\.(\w+)(\?|$)/)?.[1] ?? 'jpg').replace('jpeg', 'jpg');
      const refPath = resolve(OUT_DIR, `${id}_ref.${ext}`);
      await fetchRef(product.imageUrl, refPath);
      const realMean = await centralCropMeanColor(refPath, CENTER_CROP_FRACTION);

      const shotPath = resolve(OUT_DIR, `${id}_colorcheck${srcOverride ? '_override' : ''}.png`);
      if (srcOverride) {
        const abs = resolve(srcOverride);
        if (!existsSync(abs)) throw new Error(`arquivo override não encontrado: ${abs}`);
        await shootColorOverride(browser, id, abs, shotPath);
      } else {
        await shootColor(browser, id, shotPath);
      }

      const { mean: renderMean, coverage } = await renderMeanColorExcludingBg(shotPath, bgRgb, BG_MATCH_TOLERANCE);

      if (!renderMean) {
        rows.push({ id, title: product.title, error: 'render só tem pixel de fundo — modelo não carregou ou está fora de quadro' });
        continue;
      }

      const match = classifyColorMatch(realMean, renderMean);
      rows.push({
        id, title: product.title, srcOverride,
        realMean, renderMean, coverage, ...match,
      });
    } catch (e) {
      rows.push({ id, title: product?.title, error: e.message });
    }
  }

  await browser.close();

  // ---- relatório ----
  const okRows = rows.filter(r => !r.error);
  const divergentRows = okRows.filter(r => r.category === 'DIVERGENT');
  const neutralRows = okRows.filter(r => r.category === 'LOW_CONFIDENCE_NEUTRAL');
  const passRows = okRows.filter(r => r.category === 'OK');
  const errorRows = rows.filter(r => r.error);

  const tableLines = rows.map(r => {
    if (r.error) return `| ${r.id} | — | — | — | — | ⚠️ ERRO (${r.error}) |`;
    const note = r.note ? ` <br><sub>${r.note}</sub>` : '';
    return `| ${r.id}${r.srcOverride ? ' *(override)*' : ''} | ${fmtRgb(r.realMean)}<br><sub>${fmtHsv(r.real)}</sub> | ${fmtRgb(r.renderMean)}<br><sub>${fmtHsv(r.render)}</sub> | ${r.hueDistance.toFixed(1)}° | ${(r.coverage * 100).toFixed(1)}% | ${r.verdict}${note} |`;
  });

  const md = `# COLOR_CHECK_REPORT — QA automático de cor (Parte 2)
Gerado por \`node scripts/normalize-glb/qa-color-check.mjs\` em ${new Date().toISOString().slice(0, 10)}

## v2 — comparação por matiz (hue)

Compara a cor média do produto na FOTO REAL (recorte central, aproximação —
ver nota de método no topo de \`qa-color-check.mjs\`) com a cor média do
produto no RENDER 3D atual (\`public/models/normalized/<ID>.glb\`, fundo
sólido conhecido subtraído por exclusão de cor — precisão real, não
aproximação).

**v2 compara só o MATIZ (hue, canal H do HSV, 0-360°)**, não RGB completo —
hue não muda com diferença de brilho/exposição entre foto de estúdio e
render 3D, que era a causa da maioria dos falsos alarmes da v1 (ver seção
"v1 — histórico" abaixo). Distância de hue é circular, escala 0-180°.

**Limiar de divergência atual: ${DIVERGENCE_THRESHOLD_HUE}°** (constante \`DIVERGENCE_THRESHOLD_HUE\`
no topo do script — ajustar lá se necessário). Cores com saturação abaixo de
${SATURATION_NEUTRAL_THRESHOLD} (escala 0-1) são tratadas como "neutras"
(preto/branco/cinza) — ver \`SATURATION_NEUTRAL_THRESHOLD\` e a nota de método
sobre esse caso de borda no topo do script. Tolerância de exclusão de fundo
do render: ${BG_MATCH_TOLERANCE}. Recorte central da foto real: ${(CENTER_CROP_FRACTION * 100).toFixed(0)}%.

| Produto | Cor real (recorte central) | Cor render (fundo excluído) | Distância de hue | Cobertura produto no render | Veredito |
|---|---|---|---|---|---|
${tableLines.join('\n')}

**Resultado: ${passRows.length}/${okRows.length} ✅ OK · ${divergentRows.length} 🔴 DIVERGENTE · ${neutralRows.length} ⚠️ COR NEUTRA (confira visualmente)${errorRows.length ? ` · ${errorRows.length} ⚠️ ERRO` : ''}**

> Nota de método (recorte central da foto real): aproximação v1, não é
> segmentação de verdade — assume fundo claro/branco e produto centralizado,
> como é o padrão das fotos de catálogo usadas hoje. Pode enviesar pra mais
> claro em produtos finos/pequenos dentro do frame. Nota de método (fundo do
> render): aqui a exclusão é exata, por distância de cor até o fundo sólido
> conhecido (${RENDER_BG_HEX}) — não é aproximação.
>
> "⚠️ COR NEUTRA" não é um erro nem um OK automático — é um aviso de que o
> script não confia na própria resposta pra esse produto (as duas cores são
> preto/branco/cinza, e matiz não é um sinal confiável nesse regime). Precisa
> de um olhar humano rápido, não é pra ser tratado como falha de pipeline.

## v1 — histórico (RGB completo, substituído em 2026-09-02)

A primeira versão deste script comparava a distância euclidiana RGB completa
(escala 0-441, limiar 60) em vez de só o matiz. Rodada real contra os 35
produtos do catálogo em 2026-09-02: **15/35 ✅ OK · 20 🔴 DIVERGENTE**, mas a
maioria dos 20 "divergentes" era falso alarme causado só por diferença de
brilho entre foto de estúdio e render (ex.: CW001 por causa de foto de estilo
de vida, CW005 por causa do selo "100% ORIGINAL" na foto, CW033 já corrigido
e visualmente perfeito deu distância 206 só de brilho). Ver comparação
completa (v1 vs v2, taxa de falso alarme, confirmação dos 2 erros grosseiros
reais que a v1 pegou certo) no relatório da sessão que trocou pra hue.
`;

  writeFileSync(REPORT_PATH, md, 'utf8');
  console.log('\n' + md);
  console.log(`Relatório salvo em ${REPORT_PATH}`);
  if (divergentRows.length > 0 || errorRows.length > 0) process.exitCode = 1;
}

main();

/**
 * mapNormalizedToCoverPercent (D2 — AR-004)
 *
 * O MediaPipe entrega landmarks normalizados (0-1) relativos ao FRAME DE
 * VÍDEO CRU (ex.: 1280x720). O elemento <video> na tela usa CSS
 * `object-fit: cover`, que corta e escala o vídeo pra preencher o
 * container sem distorcer. Um mapeamento direto "landmark * 100%" só bate
 * com a posição real quando o aspect ratio do vídeo coincide com o aspect
 * ratio do elemento na tela — quase nunca acontece em celular (retrato).
 *
 * Portado de src/tracking/PoseWristTracker.js, método `_toScreen()` — a
 * versão mais correta do motor legado, porque usa videoWidth/videoHeight
 * REAIS do elemento de vídeo em vez de constantes fixas (a versão mais
 * simples, WristTracker.js `_toLandmark()`, usa MP_W=1280/MP_H=720 fixos).
 *
 * Diferença deste porte: o legado devolve pixels absolutos de página
 * (soma rect.left/rect.top, porque posiciona elementos com left/top em
 * px). Os consumidores do motor moderno (GhostWristARView, TasksWristLab)
 * posicionam a caixa do GLB com left/top em % dentro de um container do
 * MESMO tamanho do <video> (position:absolute; inset:0) — por isso aqui o
 * resultado já sai em % (0-100) relativo ao próprio elemento de vídeo, sem
 * precisar somar rect.left/rect.top.
 *
 * Decisão de onde colocar esta correção (D2, ver AR-004/README.md):
 * nos CONSUMIDORES (aqui), não em wristAnchor.js — o cálculo de âncora do
 * motor (`computeWristAnchor`) não tem acesso ao elemento <video> real nem
 * ao layout CSS do container (isso é uma preocupação só da camada React),
 * e o valor normalizado 0-1 que ele devolve hoje já é consumido em espaço
 * normalizado por outras ferramentas (ex.: `calibrationMetrics.js`, que
 * mede jitter em `raw.pos`/`filtered.pos`) — mudar esse contrato ali
 * quebraria essas ferramentas. Corrigir só na hora de desenhar (aqui) é a
 * mudança mais localizada e reversível.
 */
export function mapNormalizedToCoverPercent(nx, ny, videoEl) {
  const videoW = videoEl?.videoWidth;
  const videoH = videoEl?.videoHeight;
  const rect   = videoEl?.getBoundingClientRect?.();

  if (!videoW || !videoH || !rect || !rect.width || !rect.height) {
    // Dados insuficientes (ex.: vídeo ainda sem metadata carregada) —
    // mesmo comportamento direto de antes desta correção, como fallback.
    return { xPct: nx * 100, yPct: ny * 100 };
  }

  const scale = Math.max(rect.width / videoW, rect.height / videoH);
  const dW = videoW * scale;
  const dH = videoH * scale;
  const ox = (rect.width - dW) / 2;
  const oy = (rect.height - dH) / 2;

  const xPx = nx * dW + ox;
  const yPx = ny * dH + oy;

  return { xPct: (xPx / rect.width) * 100, yPct: (yPx / rect.height) * 100 };
}

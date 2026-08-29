#!/usr/bin/env node
// AR-004-fisico — captura remota de rotZ/scale/isTracking/fps via Chrome DevTools
// Protocol (CDP), sem editar nenhum arquivo de código-fonte do motor.
//
// POR QUE ISSO EXISTE: o motor (`src/engine/`) e o lab
// (`src/labs/tasks-wrist/TasksWristLab.jsx`) não têm nenhum console.log por
// frame de rotZ/scale/isTracking/fps — esses valores só existem como estado React,
// desenhados no HUD na tela. Sem poder editar o código-fonte fora de um
// experimento registrado (regra do CLAUDE.md), a única forma de capturar
// esses valores quadro a quadro é ler o texto já renderizado do HUD, via
// injeção de um pequeno script no CONTEXTO DA PÁGINA (não no disco, não no
// bundle) usando `Runtime.evaluate` do CDP. Isso é execução remota temporária
// de debug, não uma mudança de código.
//
// LIMITAÇÃO CONHECIDA: a amostragem é por polling do DOM (padrão
// SAMPLE_INTERVAL_MS abaixo), não por hook direto no callback onPose do
// motor. Ou seja, é "a cada mudança relevante visível no HUD", não
// garantidamente "a cada frame do MediaPipe" — se o React não re-renderizar
// entre duas leituras, o valor value pode repetir. Isso é aceitável para o
// objetivo (girar o pulso pela fronteira ±180° e ver se o valor de rotZ salta
// ou é contínuo), mas não é uma métrica de FPS do motor em si (essa métrica
// já vem separada do campo "fps" mostrado no próprio HUD, que É lido pelo
// script e registrado por amostra).
//
// PRÉ-REQUISITO NO HUD: o painel "▼ HUD" (topo-esquerda) precisa estar
// aberto (é o padrão) e o modo ② ou ③ selecionado — o campo rotZ só é
// desenhado nesses dois modos (ver TasksWristLab.jsx linhas ~833-859). No
// modo ① (padrão ao abrir a página, sem ?auto=1) rotZ não aparece; fps e
// isTracking aparecem sempre (rodapé comum do HUD).
//
// USO (só quando o Carlos confirmar TRACKING verde na tela e mandar o sinal
// de início — este script NÃO abre nada no celular sozinho):
//
//   node scripts/prado-rescue/capture-console-live.mjs [--duration=30] [--out=caminho.txt] [--port=9222] [--interval=150]
//
//   --duration  segundos de captura; se omitido, roda até Ctrl+C
//   --out       caminho do arquivo de saída (padrão: ver OUT_DEFAULT abaixo)
//   --port      porta local do adb forward pro chrome_devtools_remote (padrão 9222)
//   --interval  intervalo de amostragem em ms (padrão 150ms)
//
// Se nenhuma aba em https://localhost:5173/?lab=tasks-wrist for encontrada,
// o script avisa e encerra — não fica tentando de novo sozinho, não trava.

import { writeFileSync, appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(dirname(__dirname));

const args = process.argv.slice(2);
function argVal(name, def) {
  const pref = `--${name}=`;
  const hit = args.find(a => a.startsWith(pref));
  return hit ? hit.slice(pref.length) : def;
}

const PORT             = Number(argVal('port', '9222'));
const DURATION_S       = argVal('duration', null); // null = até Ctrl+C
const SAMPLE_INTERVAL_MS = Number(argVal('interval', '150'));
// --round=<n> evita sobrescrever rodadas anteriores (ex.: fisico-metrics-live.txt
// da rodada 1, já com dado numérico válido, gravado em 2026-08-28). Rodada 1 não
// tinha esse sufixo (arquivo legado, não renomear); a partir da rodada 2 em
// diante, cada rodada nova usa seu próprio prefixo "fisico-rodadaN-".
const ROUND             = argVal('round', '2');
const OUT_DEFAULT       = `${REPO_ROOT}/docs/prado-rescue/evidence/AR-004/fisico-rodada${ROUND}-metrics-live.txt`;
const OUT_PATH          = argVal('out', OUT_DEFAULT);
const URL_MATCH         = 'lab=tasks-wrist';
const HOST_MATCH        = 'localhost:5173';

function nowIso() {
  return new Date().toISOString();
}

async function findTargetTab() {
  const res = await fetch(`http://localhost:${PORT}/json/list`);
  if (!res.ok) throw new Error(`CDP /json/list retornou HTTP ${res.status}`);
  const list = await res.json();
  const matches = list.filter(t =>
    t.type === 'page' &&
    typeof t.url === 'string' &&
    t.url.includes(HOST_MATCH) &&
    t.url.includes(URL_MATCH)
  );
  if (matches.length === 0) return undefined;
  if (matches.length === 1) return matches[0];

  // Mais de uma aba bate com a URL — pode ser sessão nova recarregada sem
  // fechar a antiga. IDs do CDP no Android são atribuídos de forma
  // crescente por ordem de criação, então o maior id numérico é a aba mais
  // recente. Se não vier numérico por algum motivo, usa a última da lista
  // como fallback (heurística, não garantia absoluta do protocolo CDP).
  console.warn(`[AR-004] ATENÇÃO: ${matches.length} abas encontradas em https://${HOST_MATCH}/?${URL_MATCH}:`);
  matches.forEach(t => console.warn(`  - id=${t.id}  title="${t.title}"`));
  const numeric = matches.every(t => /^\d+$/.test(t.id));
  const chosen = numeric
    ? matches.reduce((a, b) => (Number(b.id) > Number(a.id) ? b : a))
    : matches[matches.length - 1];
  console.warn(`[AR-004] Usando a mais recente: id=${chosen.id}. Se estiver errado, feche a aba antiga manualmente e rode de novo.`);
  return chosen;
}

// ── Cliente CDP mínimo via WebSocket nativo do Node (>=22) ─────────────────
function connectCdp(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let nextId = 1;
    const pending = new Map();

    ws.addEventListener('open', () => resolve({ ws, send }));
    ws.addEventListener('error', (e) => reject(new Error(`WebSocket CDP falhou: ${e.message || e}`)));
    ws.addEventListener('message', (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.id != null && pending.has(msg.id)) {
        const { resolve: res, reject: rej } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) rej(new Error(msg.error.message || 'CDP error'));
        else res(msg.result);
      }
    });

    function send(method, params = {}) {
      const id = nextId++;
      return new Promise((res, rej) => {
        pending.set(id, { resolve: res, reject: rej });
        ws.send(JSON.stringify({ id, method, params }));
      });
    }
  });
}

// Script injetado no contexto da página. Idempotente (não reinstala se já existir).
const INSTALL_COLLECTOR_EXPR = `
(function() {
  if (window.__AR004_CAP__) return 'already-installed';
  window.__AR004_CAP__ = { log: [] };
  function readHud() {
    try {
      const text = document.body.innerText || '';
      const rot = text.match(/rotZ:\\s*(-?\\d+\\.?\\d*)°/);
      const scl = text.match(/scale:\\s*(-?\\d+\\.?\\d*)/);
      const fps = text.match(/fps:\\s*(\\d+)/);
      const trk = text.match(/isTracking:\\s*(true|false)/i);
      window.__AR004_CAP__.log.push({
        t: Date.now(),
        rotZ: rot ? Number(rot[1]) : null,
        scale: scl ? Number(scl[1]) : null,
        fps: fps ? Number(fps[1]) : null,
        isTracking: trk ? (trk[1].toLowerCase() === 'true') : null,
      });
    } catch (e) {
      window.__AR004_CAP__.log.push({ t: Date.now(), error: String(e) });
    }
  }
  window.__AR004_CAP__.timer = setInterval(readHud, ${SAMPLE_INTERVAL_MS});
  return 'installed';
})()
`;

const DRAIN_EXPR = `JSON.stringify(window.__AR004_CAP__ ? window.__AR004_CAP__.log.splice(0) : [])`;
const STOP_EXPR  = `(function(){ if (window.__AR004_CAP__ && window.__AR004_CAP__.timer) { clearInterval(window.__AR004_CAP__.timer); window.__AR004_CAP__.timer = null; } return 'stopped'; })()`;

async function main() {
  console.log(`[AR-004] Procurando aba do Chrome Android em https://${HOST_MATCH}/?${URL_MATCH} (via CDP porta ${PORT})...`);
  const target = await findTargetTab().catch(e => {
    console.error(`[AR-004] Não consegui falar com o CDP na porta ${PORT}: ${e.message}`);
    console.error(`[AR-004] Confirme que 'adb forward tcp:${PORT} localabstract:chrome_devtools_remote' está ativo (adb forward --list).`);
    process.exit(1);
  });

  if (!target) {
    console.log(`[AR-004] Nenhuma aba encontrada ainda em https://${HOST_MATCH}/?${URL_MATCH}.`);
    console.log(`[AR-004] Isso é esperado se o Carlos ainda não abriu o link no Chrome do celular. Rode este script de novo depois que ele confirmar TRACKING verde na tela.`);
    console.log(`[AR-004] (mecanismo ARMADO, não fica tentando de novo sozinho)`);
    process.exit(0);
  }

  console.log(`[AR-004] Aba encontrada: ${target.url}`);
  const { send } = await connectCdp(target.webSocketDebuggerUrl);

  await send('Runtime.enable');
  const installResult = await send('Runtime.evaluate', { expression: INSTALL_COLLECTOR_EXPR, returnByValue: true });
  console.log(`[AR-004] Coletor: ${installResult?.result?.value ?? '(sem retorno)'}`);

  const dir = dirname(OUT_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(OUT_PATH, `# AR-004-fisico — captura live rotZ/scale/isTracking/fps via CDP\n# início: ${nowIso()}\n# amostragem: a cada ${SAMPLE_INTERVAL_MS}ms (polling do HUD renderizado, não hook direto no motor)\n# formato: <timestamp_iso> rotZ=<graus|null> scale=<n|null> fps=<n|null> isTracking=<true|false|null>\n`);

  let totalLines = 0;
  const drainOnce = async () => {
    const result = await send('Runtime.evaluate', { expression: DRAIN_EXPR, returnByValue: true });
    const entries = JSON.parse(result?.result?.value ?? '[]');
    if (entries.length === 0) return;
    const lines = entries.map(e => {
      const ts = new Date(e.t).toISOString();
      if (e.error) return `${ts} ERROR=${e.error}`;
      return `${ts} rotZ=${e.rotZ ?? 'null'} scale=${e.scale ?? 'null'} fps=${e.fps ?? 'null'} isTracking=${e.isTracking ?? 'null'}`;
    }).join('\n') + '\n';
    appendFileSync(OUT_PATH, lines);
    totalLines += entries.length;
  };

  const drainTimer = setInterval(drainOnce, 500);

  const stop = async () => {
    clearInterval(drainTimer);
    await drainOnce();
    await send('Runtime.evaluate', { expression: STOP_EXPR }).catch(() => {});
    console.log(`[AR-004] Captura encerrada. ${totalLines} amostras gravadas em ${OUT_PATH}`);
    process.exit(0);
  };

  process.on('SIGINT', stop);

  if (DURATION_S) {
    console.log(`[AR-004] Gravando por ${DURATION_S}s... (Ctrl+C encerra antes se precisar)`);
    setTimeout(stop, Number(DURATION_S) * 1000);
  } else {
    console.log(`[AR-004] Gravando até Ctrl+C...`);
  }
}

main().catch(e => {
  console.error(`[AR-004] Erro fatal: ${e.message}`);
  process.exit(1);
});

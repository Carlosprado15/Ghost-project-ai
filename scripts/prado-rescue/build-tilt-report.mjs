import { readFileSync, writeFileSync } from 'node:fs';

const TILES_DIR = 'C:/Users/Bi/Documents/Ghost-project-ai/scripts/prado-rescue/tilt-check/tiles';
const OUT = 'C:/Users/Bi/Documents/Ghost-project-ai/scripts/prado-rescue/tilt-check/report.html';

// status: 'reto' | 'tombado' | 'conferir'  (classificação visual, ver conversa)
const PRODUCTS = [
  { id: 'CW001', status: 'reto' },
  { id: 'CW002', status: 'reto' },
  { id: 'CW003', status: 'reto' },
  { id: 'CW004', status: 'reto' },
  { id: 'CW005', status: 'reto' },
  { id: 'CW006', status: 'tombado' },
  { id: 'CW007', status: 'conferir' },
  { id: 'CW008', status: 'reto' },
  { id: 'CW009', status: 'reto' },
  { id: 'CW013', status: 'conferir' },
  { id: 'CW014', status: 'tombado' },
  { id: 'CW016', status: 'tombado' },
  { id: 'CW017', status: 'tombado' },
  { id: 'CW018', status: 'tombado' },
  { id: 'CW019', status: 'tombado' },
  { id: 'CW020', status: 'reto' },
  { id: 'CW021', status: 'tombado' },
  { id: 'CW022', status: 'tombado' },
  { id: 'CW023', status: 'tombado' },
  { id: 'CW024', status: 'tombado' },
  { id: 'CW025', status: 'tombado' },
  { id: 'CW026', status: 'tombado' },
  { id: 'CW027', status: 'tombado' },
  { id: 'CW028', status: 'reto' },
  { id: 'CW029', status: 'reto' },
  { id: 'CW030', status: 'tombado' },
  { id: 'CW031', status: 'tombado' },
  { id: 'CW032', status: 'reto' },
  { id: 'CW033', status: 'reto' },
  { id: 'CW034', status: 'tombado' },
  { id: 'CW035', status: 'reto' },
  { id: 'CW036', status: 'conferir' },
];

const b64 = (id) => readFileSync(`${TILES_DIR}/${id}.png`, 'base64');

const counts = PRODUCTS.reduce((acc, p) => { acc[p.status] = (acc[p.status] || 0) + 1; return acc; }, {});

const label = { reto: 'reto', tombado: 'tombado pra frente', conferir: 'conferir' };

const tiles = PRODUCTS.map((p) => `
  <figure class="tile ${p.status}">
    <img src="data:image/png;base64,${b64(p.id)}" alt="${p.id}" width="220" height="220" loading="lazy" />
    <figcaption>
      <span class="id">${p.id}</span>
      <span class="badge">${label[p.status]}</span>
    </figcaption>
  </figure>`).join('\n');

const html = `<!doctype html>
<title>Diagnóstico de Inclinação</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Libre+Franklin:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  :root {
    --ground: #f5f3ee;
    --surface: #ffffff;
    --surface-2: #ece8e0;
    --line: #ddd7c9;
    --ink: #1b1f24;
    --muted: #5b6572;
    --accent: #3d6d8f;
    --ok: #1f7a53;
    --ok-bg: #e3f3ec;
    --warn: #a1650c;
    --warn-bg: #faedd9;
    --uncertain: #5b6572;
    --uncertain-bg: #e9e9e9;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --ground: #0d1117;
      --surface: #161b22;
      --surface-2: #1c232c;
      --line: #2a323c;
      --ink: #e6edf3;
      --muted: #8b98a5;
      --accent: #7fb0d4;
      --ok: #56c497;
      --ok-bg: #123527;
      --warn: #eeae52;
      --warn-bg: #3a2a11;
      --uncertain: #9aa4af;
      --uncertain-bg: #232a32;
    }
  }
  :root[data-theme="dark"] {
    --ground: #0d1117;
    --surface: #161b22;
    --surface-2: #1c232c;
    --line: #2a323c;
    --ink: #e6edf3;
    --muted: #8b98a5;
    --accent: #7fb0d4;
    --ok: #56c497;
    --ok-bg: #123527;
    --warn: #eeae52;
    --warn-bg: #3a2a11;
    --uncertain: #9aa4af;
    --uncertain-bg: #232a32;
  }

  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--ground);
    color: var(--ink);
    font-family: 'Libre Franklin', system-ui, sans-serif;
    line-height: 1.55;
  }
  main {
    max-width: 980px;
    margin: 0 auto;
    padding: 56px 24px 80px;
  }
  .eyebrow {
    font-family: 'IBM Plex Mono', ui-monospace, monospace;
    font-size: 12.5px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--accent);
    margin: 0 0 10px;
  }
  h1 {
    font-size: clamp(28px, 4vw, 38px);
    font-weight: 800;
    margin: 0 0 18px;
    text-wrap: balance;
    letter-spacing: -0.01em;
  }
  .lede {
    font-size: 17px;
    color: var(--ink);
    max-width: 66ch;
    margin: 0 0 8px;
  }
  .lede + .lede { margin-top: 14px; }
  .muted { color: var(--muted); }

  .stats {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    margin: 32px 0 40px;
  }
  .stat {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 12px 18px;
    border-radius: 10px;
    background: var(--surface);
    border: 1px solid var(--line);
  }
  .stat .n {
    font-family: 'IBM Plex Mono', monospace;
    font-variant-numeric: tabular-nums;
    font-size: 22px;
    font-weight: 600;
  }
  .stat .l { font-size: 13.5px; color: var(--muted); }
  .stat.tombado .n { color: var(--warn); }
  .stat.reto .n { color: var(--ok); }
  .stat.conferir .n { color: var(--uncertain); }

  h2 {
    font-size: 15px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--muted);
    font-weight: 600;
    margin: 44px 0 18px;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 14px;
  }
  .tile {
    margin: 0;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 12px;
    overflow: hidden;
    border-top: 3px solid var(--line);
  }
  .tile.reto { border-top-color: var(--ok); }
  .tile.tombado { border-top-color: var(--warn); }
  .tile.conferir { border-top-color: var(--uncertain); }
  .tile img {
    display: block;
    width: 100%;
    height: auto;
    aspect-ratio: 1 / 1;
    background: var(--surface-2);
    object-fit: contain;
  }
  .tile figcaption {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 6px;
    padding: 8px 10px 10px;
  }
  .tile .id {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 12.5px;
    font-weight: 600;
  }
  .tile .badge {
    font-size: 10.5px;
    padding: 3px 7px;
    border-radius: 999px;
    font-weight: 600;
    white-space: nowrap;
  }
  .tile.reto .badge { color: var(--ok); background: var(--ok-bg); }
  .tile.tombado .badge { color: var(--warn); background: var(--warn-bg); }
  .tile.conferir .badge { color: var(--uncertain); background: var(--uncertain-bg); }

  .note {
    margin-top: 48px;
    padding: 20px 22px;
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 12px;
    font-size: 15px;
  }
  .note h3 {
    margin: 0 0 10px;
    font-size: 14px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--muted);
  }
  .note ul { margin: 8px 0 0; padding-left: 20px; }
  .note li { margin: 6px 0; }

  .next {
    margin-top: 32px;
    font-size: 16px;
  }
</style>

<main>
  <p class="eyebrow">Ghost Project · Laboratório de Calibração</p>
  <h1>32 produtos, mesma câmera, lado a lado</h1>
  <p class="lede">Testei se o "tombado pra frente" que você está vendo é a câmera do laboratório enganando o olho, ou se é a peça mesmo. <strong>Não é a câmera</strong> — comparei o mesmo relógio em dois ângulos de câmera diferentes e ele ficou igual nos dois. Se fosse a câmera, todos os 32 produtos apareceriam tombados do mesmo jeito. Não é isso que acontece.</p>
  <p class="lede muted">O que encontrei: bem mais da metade dos relógios de mostrador redondo aparecem tombados; os quadrados/digitais e as pulseiras, quase todos retos. Isso aponta pra um problema real na calibração desses relógios específicos — não um bug único que afeta tudo igual.</p>

  <div class="stats">
    <div class="stat reto"><span class="n">${counts.reto || 0}</span><span class="l">retos</span></div>
    <div class="stat tombado"><span class="n">${counts.tombado || 0}</span><span class="l">tombados pra frente</span></div>
    <div class="stat conferir"><span class="n">${counts.conferir || 0}</span><span class="l">duvidosos, dá pra olhar de novo</span></div>
  </div>

  <h2>Os 32, um por um</h2>
  <div class="grid">
    ${tiles}
  </div>

  <div class="note">
    <h3>O que já foi descartado</h3>
    <ul>
      <li>Câmera do laboratório: testei o mesmo arquivo calibrado em dois ângulos de câmera diferentes (o padrão da tela e um de frente pura) — o resultado foi idêntico nos dois. Não é isso.</li>
      <li>Recarregar a página ao salvar: já confirmado antes que não perde o que você ajustou na tela.</li>
    </ul>
    <h3 style="margin-top:18px">O que ainda não sei</h3>
    <ul>
      <li>Por que a mesma etapa de calibração funciona bem pra alguns relógios (ficam retos) e não pra outros (ficam tombados) — se é imprecisão ao ajustar no olho, ou algum efeito colateral do jeito que o eixo de "tombar frente/trás" é lido e salvo.</li>
    </ul>
  </div>

  <p class="next">Não mexi em nada. Me diz se essa lista bate com o que você está vendo — aí decidimos juntos se vale investigar a causa a fundo ou aceitar como está.</p>
</main>
`;

writeFileSync(OUT, html, 'utf-8');
console.log('Relatório salvo em', OUT, `(${(html.length / 1024 / 1024).toFixed(2)} MB)`);

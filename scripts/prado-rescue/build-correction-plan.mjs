import { readFileSync, writeFileSync } from 'node:fs';

const HERE = 'C:/Users/Bi/Documents/Ghost-project-ai/scripts/prado-rescue';
const proposed = JSON.parse(readFileSync(`${HERE}/tilt-check/proposed-correction.json`, 'utf-8'));
const OUT = `${HERE}/tilt-check/correction-plan.html`;

const EXCLUDED = ['CW009', 'CW013', 'CW018', 'CW019', 'CW020', 'CW026', 'CW028', 'CW032', 'CW035'];
const BRACELETS = ['CW002', 'CW003', 'CW004', 'CW005'];
const EXAMPLES = [
  { id: 'CW001', size: 'menor ajuste', tilt: '1.4°' },
  { id: 'CW014', size: 'ajuste médio', tilt: '6.8°' },
  { id: 'CW007', size: 'maior ajuste', tilt: '16.2°' },
];

const b64 = (p) => readFileSync(p, 'base64');
const rows = Object.values(proposed).sort((a, b) => a.tiltX_before - b.tiltX_before);

const fmt = (v) => `${v.x}, ${v.y}, ${v.z}`;

const tableRows = rows.map((r) => `
  <tr>
    <td class="mono">${r.id}</td>
    <td class="mono muted">${fmt(r.old)}</td>
    <td class="mono">${fmt(r.new)}</td>
    <td class="mono num">${r.tiltX_before}°</td>
  </tr>`).join('\n');

const exampleFigs = EXAMPLES.map((ex) => `
  <div class="example">
    <div class="example-head">
      <span class="id">${ex.id}</span>
      <span class="tag">${ex.size} · desvio medido ${ex.tilt}</span>
    </div>
    <div class="pair">
      <figure>
        <img src="data:image/png;base64,${b64(`${HERE}/tilt-check/before-after/${ex.id}-hoje.png`)}" alt="${ex.id} hoje" />
        <figcaption>hoje <span class="muted">— câmera 75°, rotação atual</span></figcaption>
      </figure>
      <figure class="after">
        <img src="data:image/png;base64,${b64(`${HERE}/tilt-check/before-after/${ex.id}-depois.png`)}" alt="${ex.id} depois" />
        <figcaption>proposto <span class="muted">— câmera 90°, rotação corrigida</span></figcaption>
      </figure>
    </div>
  </div>`).join('\n');

const html = `<!doctype html>
<title>Plano de Correção do Tombo</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Libre+Franklin:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  :root {
    --ground: #f5f3ee; --surface: #ffffff; --surface-2: #ece8e0; --line: #ddd7c9;
    --ink: #1b1f24; --muted: #5b6572; --accent: #3d6d8f;
    --ok: #1f7a53; --ok-bg: #e3f3ec; --warn: #a1650c; --warn-bg: #faedd9;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --ground: #0d1117; --surface: #161b22; --surface-2: #1c232c; --line: #2a323c;
      --ink: #e6edf3; --muted: #8b98a5; --accent: #7fb0d4;
      --ok: #56c497; --ok-bg: #123527; --warn: #eeae52; --warn-bg: #3a2a11;
    }
  }
  :root[data-theme="dark"] {
    --ground: #0d1117; --surface: #161b22; --surface-2: #1c232c; --line: #2a323c;
    --ink: #e6edf3; --muted: #8b98a5; --accent: #7fb0d4;
    --ok: #56c497; --ok-bg: #123527; --warn: #eeae52; --warn-bg: #3a2a11;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--ground); color: var(--ink); font-family: 'Libre Franklin', system-ui, sans-serif; line-height: 1.55; }
  main { max-width: 980px; margin: 0 auto; padding: 56px 24px 90px; }
  .eyebrow { font-family: 'IBM Plex Mono', monospace; font-size: 12.5px; letter-spacing: .08em; text-transform: uppercase; color: var(--accent); margin: 0 0 10px; }
  h1 { font-size: clamp(28px,4vw,38px); font-weight: 800; margin: 0 0 18px; text-wrap: balance; letter-spacing: -.01em; }
  h2 { font-size: 15px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); font-weight: 600; margin: 44px 0 16px; }
  p.lede { font-size: 17px; max-width: 70ch; margin: 0 0 14px; }
  .muted { color: var(--muted); }
  .step { display: flex; gap: 14px; padding: 16px 0; border-top: 1px solid var(--line); }
  .step:last-child { border-bottom: 1px solid var(--line); }
  .step .n { font-family: 'IBM Plex Mono', monospace; color: var(--accent); font-weight: 600; flex: 0 0 22px; }
  .step .t { font-weight: 600; }
  .step .d { color: var(--muted); font-size: 14.5px; margin-top: 3px; }

  .examples { display: flex; flex-direction: column; gap: 28px; }
  .example { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 18px; }
  .example-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 12px; }
  .example-head .id { font-family: 'IBM Plex Mono', monospace; font-weight: 700; font-size: 15px; }
  .example-head .tag { font-size: 12.5px; color: var(--muted); }
  .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .pair img { width: 100%; border-radius: 10px; background: var(--surface-2); display: block; }
  .pair figcaption { font-size: 13px; text-align: center; margin-top: 8px; font-weight: 600; }
  .pair .after figcaption { color: var(--ok); }

  table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
  thead th { text-align: left; padding: 8px 10px; color: var(--muted); font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; border-bottom: 1px solid var(--line); }
  tbody td { padding: 7px 10px; border-bottom: 1px solid var(--line); }
  .mono { font-family: 'IBM Plex Mono', monospace; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .table-wrap { overflow-x: auto; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; }
  .table-wrap table { min-width: 520px; }

  .note { margin-top: 20px; padding: 18px 20px; background: var(--warn-bg); border: 1px solid var(--warn); border-radius: 12px; font-size: 14.5px; color: var(--ink); }
  .note strong { color: var(--warn); }
  .ask { margin-top: 44px; font-size: 17px; font-weight: 600; }
</style>
<main>
  <p class="eyebrow">Ghost Project · Laboratório de Calibração</p>
  <h1>Plano: corrigir o tombo sem refazer nada</h1>
  <p class="lede">Sua ideia estava certa na causa (câmera do laboratório) e na direção (compensar o ângulo medido). Só ajustei um detalhe: o desvio não é ~15° igual pra todo mundo — varia de 0,6° até 16,2° dependendo do produto. Um offset único de 15° corrigiria certo quem já está perto de 16°, mas <strong>pioraria</strong> quem só tinha 1° ou 2° de desvio, tombando pro lado errado. Por isso calculei a correção exata de cada produto, usando a medição que já tinha.</p>

  <h2>O plano, em 4 passos</h2>
  <div class="step"><span class="n">1</span><div><div class="t">Consertar a câmera padrão do laboratório (phi 75° → 90°)</div><div class="d">Uma linha de código em ProductCalibrationLab.jsx. É a causa raiz — sem isso, a próxima calibração manual volta a introduzir o mesmo viés.</div></div></div>
  <div class="step"><span class="n">2</span><div><div class="t">Aplicar a correção calculada em 19 dos 32 produtos</div><div class="d">Só nos relógios em que a medição foi confiável. Valores exatos na tabela abaixo — nada de olho, é matemática em cima do que já foi medido.</div></div></div>
  <div class="step"><span class="n">3</span><div><div class="t">Renormalizar esses 19 (rodar normalize.mjs neles)</div><div class="d">Gera os .glb finais com a rotação corrigida. Original em public/models/ não é tocado, só o normalized/.</div></div></div>
  <div class="step"><span class="n">4</span><div><div class="t">Você confere e só então eu commito</div><div class="d">Nada disso foi feito ainda — nem o overrides.json real, nem os .glb normalizados oficiais foram tocados.</div></div></div>

  <h2>3 exemplos reais (arquivo de teste, fora da pasta oficial)</h2>
  <div class="examples">
    ${exampleFigs}
  </div>

  <h2>Os 19 produtos — de/para</h2>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Produto</th><th>rotationDeg hoje</th><th>rotationDeg proposto</th><th>desvio medido</th></tr></thead>
      <tbody>${tableRows}</tbody>
    </table>
  </div>

  <div class="note">
    <strong>Fora desta correção automática:</strong> ${EXCLUDED.join(', ')} — minha ferramenta de medição deu uma leitura ambígua nesses (relógios com tela/mostrador grande demais confundem o cálculo). Não toquei neles; precisam de olho humano, não da fórmula. As pulseiras (${BRACELETS.join(', ')}) não entram nessa correção — o problema é específico do mostrador de relógio.
    <br><br>
    Em alguns casos o novo ângulo de giro (o "y") fica bem perto de 90° — testei o arredondamento pra 1 casa decimal e o resultado continua batendo (erro menor que 0,04°), então não é motivo pra preocupação agora, só uma zona mais sensível se alguém for ajustar esse produto à mão de novo no futuro.
  </div>

  <p class="ask">Não mexi no overrides.json real nem nos .glb oficiais. Aprova os 19 valores acima pra eu aplicar, renormalizar e te mostrar o resultado final antes do commit?</p>
</main>
`;

writeFileSync(OUT, html, 'utf-8');
console.log('salvo em', OUT, `(${(html.length / 1024 / 1024).toFixed(2)} MB)`);

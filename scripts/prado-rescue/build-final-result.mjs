import { readFileSync, writeFileSync } from 'node:fs';

const HERE = 'C:/Users/Bi/Documents/Ghost-project-ai/scripts/prado-rescue';
const OUT = `${HERE}/tilt-check/final-result.html`;
const b64 = (p) => readFileSync(p, 'base64');

const EXAMPLES = [
  { id: 'CW001', size: 'menor ajuste', tilt: '1.4°' },
  { id: 'CW014', size: 'ajuste médio', tilt: '6.8°' },
  { id: 'CW007', size: 'maior ajuste', tilt: '16.2°' },
];

const exampleFigs = EXAMPLES.map((ex) => `
  <div class="example">
    <div class="example-head">
      <span class="id">${ex.id}</span>
      <span class="tag">${ex.size} · desvio medido ${ex.tilt}</span>
    </div>
    <div class="pair">
      <figure>
        <img src="data:image/png;base64,${b64(`${HERE}/tilt-check/before-after/${ex.id}-hoje.png`)}" alt="${ex.id} antes" />
        <figcaption>antes <span class="muted">— arquivo antigo</span></figcaption>
      </figure>
      <figure class="after">
        <img src="data:image/png;base64,${b64(`${HERE}/tilt-check/final-result/${ex.id}-oficial-corrigido.png`)}" alt="${ex.id} depois" />
        <figcaption>depois <span class="muted">— arquivo oficial, já corrigido</span></figcaption>
      </figure>
    </div>
  </div>`).join('\n');

const html = `<!doctype html>
<title>Correção Aplicada</title>
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
  main { max-width: 940px; margin: 0 auto; padding: 56px 24px 90px; }
  .eyebrow { font-family: 'IBM Plex Mono', monospace; font-size: 12.5px; letter-spacing: .08em; text-transform: uppercase; color: var(--ok); margin: 0 0 10px; }
  h1 { font-size: clamp(28px,4vw,38px); font-weight: 800; margin: 0 0 18px; text-wrap: balance; letter-spacing: -.01em; }
  h2 { font-size: 15px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); font-weight: 600; margin: 44px 0 16px; }
  p.lede { font-size: 17px; max-width: 70ch; margin: 0 0 14px; }
  .muted { color: var(--muted); }

  .stats { display: flex; gap: 10px; flex-wrap: wrap; margin: 28px 0 8px; }
  .stat { display: flex; align-items: baseline; gap: 8px; padding: 12px 18px; border-radius: 10px; background: var(--surface); border: 1px solid var(--line); }
  .stat .n { font-family: 'IBM Plex Mono', monospace; font-variant-numeric: tabular-nums; font-size: 20px; font-weight: 600; color: var(--ok); }
  .stat .l { font-size: 13.5px; color: var(--muted); }

  .examples { display: flex; flex-direction: column; gap: 28px; }
  .example { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 18px; }
  .example-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 12px; }
  .example-head .id { font-family: 'IBM Plex Mono', monospace; font-weight: 700; font-size: 15px; }
  .example-head .tag { font-size: 12.5px; color: var(--muted); }
  .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .pair img { width: 100%; border-radius: 10px; background: var(--surface-2); display: block; }
  .pair figcaption { font-size: 13px; text-align: center; margin-top: 8px; font-weight: 600; }
  .pair .after figcaption { color: var(--ok); }

  .note { margin-top: 32px; padding: 18px 20px; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; font-size: 14.5px; }
  .note h3 { margin: 0 0 8px; font-size: 13px; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); }
  .note ul { margin: 6px 0 0; padding-left: 20px; }
  .note li { margin: 5px 0; }
  .ask { margin-top: 36px; font-size: 17px; font-weight: 600; }
</style>
<main>
  <p class="eyebrow">Aplicado — aguardando revisão antes do commit</p>
  <h1>Os 19 já estão corrigidos no disco</h1>
  <p class="lede">Ambas as capturas abaixo são do arquivo real: a "antes" é o que estava salvo até há pouco, a "depois" é o mesmo arquivo já sobrescrito com a correção — na câmera de 75° que o laboratório usa HOJE (ainda não mexi nesse código). Ou seja: já melhora sozinho, mesmo antes de trocar a câmera padrão.</p>

  <div class="stats">
    <div class="stat"><span class="n">19</span><span class="l">produtos corrigidos e renormalizados</span></div>
    <div class="stat"><span class="n">100%</span><span class="l">"frente" nos 19, confirmado pelo próprio normalize.mjs</span></div>
    <div class="stat"><span class="n">0</span><span class="l">commits feitos — nada foi publicado</span></div>
  </div>

  <h2>3 exemplos, arquivo real</h2>
  <div class="examples">
    ${exampleFigs}
  </div>

  <div class="note">
    <h3>O que exatamente mudou no disco</h3>
    <ul>
      <li><code>scripts/normalize-glb/product-calibration-overrides.json</code> — rotationDeg atualizado nos 19 produtos.</li>
      <li><code>public/models/normalized/{19 produtos}.glb</code> — regerados com a rotação corrigida.</li>
      <li>Nada mais foi tocado: os 9 de leitura ambígua (que você já conferiu e confirmou perfeitos) e as 4 pulseiras ficaram exatamente como estavam.</li>
      <li>Câmera padrão do laboratório (75°→90°) — <strong>ainda não alterada</strong>, era o passo 1 do plano original; posso fazer também, mas não fiz sem confirmar com você primeiro.</li>
    </ul>
  </div>

  <p class="ask">Nada foi commitado ainda. Confere os 3 exemplos e me diz: aprova o commit desses 19 + overrides.json? E quer que eu já ajuste a câmera padrão do laboratório também (passo 1), ou prefere deixar pra depois?</p>
</main>
`;

writeFileSync(OUT, html, 'utf-8');
console.log('salvo em', OUT, `(${(html.length / 1024 / 1024).toFixed(2)} MB)`);

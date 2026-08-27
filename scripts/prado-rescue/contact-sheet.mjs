// Contact sheet — os 32 produtos calibrados, todos na mesma câmera padrão
// do laboratório (sem orbit manual, igual o Carlinhos vê ao abrir cada um),
// lado a lado numa imagem só, pra checar visualmente se o "tombo pra
// frente" é um padrão sistemático ou pontual em alguns produtos.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = 'https://localhost:5173';
const IDS = [
  'CW001','CW002','CW003','CW004','CW005','CW006','CW007','CW008','CW009',
  'CW013','CW014','CW016','CW017','CW018','CW019','CW020','CW021','CW022',
  'CW023','CW024','CW025','CW026','CW027','CW028','CW029','CW030','CW031',
  'CW032','CW033','CW034','CW035','CW036',
];

const cells = IDS.map((id) => `
  <div style="display:flex;flex-direction:column;align-items:center">
    <model-viewer src="${BASE}/models/normalized/${id}.glb"
      environment-image="neutral" shadow-intensity="0.9" exposure="1.2" tone-mapping="neutral"
      style="width:220px;height:220px;background:#0b0f14"></model-viewer>
    <div style="color:#e2e8f0;font:12px monospace;margin-top:2px">${id}</div>
  </div>`).join('\n');

const html = `<!doctype html><html><body style="margin:0;background:#0b0f14">
<script type="module" src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js"></script>
<div id="grid" style="display:grid;grid-template-columns:repeat(8,220px);gap:6px;padding:10px">
${cells}
</div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1820, height: 1160 } }).then(c => c.newPage());
page.on('pageerror', (err) => console.log('[pageerror]', err.message));
await page.goto(`${BASE}/`);
await page.setContent(html);
try {
  await page.waitForFunction(() => {
    const mvs = [...document.querySelectorAll('model-viewer')];
    return mvs.length > 0 && mvs.every((mv) => mv.loaded);
  }, { timeout: 120000 });
} catch {
  const pending = await page.evaluate(() =>
    [...document.querySelectorAll('model-viewer')].filter((mv) => !mv.loaded).map((mv) => mv.src));
  console.log('AINDA CARREGANDO (não travou o script, seguindo assim mesmo):', pending);
}
await page.waitForTimeout(1000);

const out = 'C:/Users/Bi/Documents/Ghost-project-ai/scripts/prado-rescue/tilt-check/contact-sheet.png';
await page.screenshot({ path: out, fullPage: true });
console.log('salvo em', out);

// Também salva um recorte individual de cada produto (mesmo enquadramento),
// pra montar um relatório visual com uma etiqueta por peça.
mkdirSync('C:/Users/Bi/Documents/Ghost-project-ai/scripts/prado-rescue/tilt-check/tiles', { recursive: true });
const mvHandles = await page.$$('model-viewer');
for (let i = 0; i < mvHandles.length; i++) {
  await mvHandles[i].screenshot({ path: `C:/Users/Bi/Documents/Ghost-project-ai/scripts/prado-rescue/tilt-check/tiles/${IDS[i]}.png` });
}
console.log('tiles individuais salvos em tilt-check/tiles/');
await browser.close();

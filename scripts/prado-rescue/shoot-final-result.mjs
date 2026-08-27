// Captura o resultado REAL já aplicado (public/models/normalized/ oficial,
// já sobrescrito com a correção) na câmera ATUAL do laboratório (75°, ainda
// não mudei esse código) — prova que a correção nos dados já resolve sozinha,
// mesmo sem a mudança de câmera planejada.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = 'https://localhost:5173';
const OUT = 'C:/Users/Bi/Documents/Ghost-project-ai/scripts/prado-rescue/tilt-check/final-result';
mkdirSync(OUT, { recursive: true });
const EXAMPLES = ['CW001', 'CW014', 'CW007'];

const browser = await chromium.launch();
const page = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 640, height: 640 } }).then(c => c.newPage());
await page.goto(`${BASE}/`);

for (const id of EXAMPLES) {
  await page.setContent(`<!doctype html><html><body style="margin:0;background:#0b0f14">
  <script type="module" src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js"></script>
  <model-viewer id="mv" src="${BASE}/models/normalized/${id}.glb?v=${Date.now()}" camera-orbit="0deg 75deg auto"
    environment-image="neutral" shadow-intensity="0.9" exposure="1.2" tone-mapping="neutral"
    style="width:640px;height:640px;background:#0b0f14"></model-viewer>
  </body></html>`);
  await page.waitForFunction(() => document.querySelector('#mv')?.loaded, { timeout: 20000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${id}-oficial-corrigido.png` });
  console.log(`${id}: capturado do arquivo oficial já corrigido`);
}
await browser.close();

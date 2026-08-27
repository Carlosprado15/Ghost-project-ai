// Screenshots "hoje" (arquivo real, câmera padrão atual phi=75) vs "depois"
// (arquivo com rotação corrigida, câmera padrão proposta phi=90), pros 3
// exemplos escolhidos. Não altera nada — só lê e fotografa.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = 'https://localhost:5173';
const OUT = 'C:/Users/Bi/Documents/Ghost-project-ai/scripts/prado-rescue/tilt-check/before-after';
mkdirSync(OUT, { recursive: true });
const EXAMPLES = ['CW001', 'CW014', 'CW007'];

const shoot = async (page, src, cameraOrbit, outPath) => {
  await page.setContent(`<!doctype html><html><body style="margin:0;background:#0b0f14">
  <script type="module" src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js"></script>
  <model-viewer id="mv" src="${src}" camera-orbit="${cameraOrbit}"
    environment-image="neutral" shadow-intensity="0.9" exposure="1.2" tone-mapping="neutral"
    style="width:640px;height:640px;background:#0b0f14"></model-viewer>
  </body></html>`);
  await page.waitForFunction(() => document.querySelector('#mv')?.loaded, { timeout: 20000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: outPath });
};

const browser = await chromium.launch();
const page = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 640, height: 640 } }).then(c => c.newPage());
await page.goto(`${BASE}/`);

for (const id of EXAMPLES) {
  await shoot(page, `${BASE}/models/normalized/${id}.glb`, '0deg 75deg auto', `${OUT}/${id}-hoje.png`);
  await shoot(page, `${BASE}/scripts/prado-rescue/tilt-check/preview-normalized/${id}.glb`, '0deg 90deg auto', `${OUT}/${id}-depois.png`);
  console.log(`${id}: hoje + depois capturados`);
}
await browser.close();

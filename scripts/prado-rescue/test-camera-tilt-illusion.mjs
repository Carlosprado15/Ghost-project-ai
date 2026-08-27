// Diagnóstico avulso — confirma se o "tombo pra frente" que o Carlinhos vê no
// laboratório é ilusão da câmera padrão (phi=75°, olhando de cima) ou um erro
// real de calibração nos dados. Compara o MESMO arquivo já calibrado
// (public/models/normalized/CW002.glb, status "pass") em duas câmeras:
// a padrão do laboratório (phi=75°) e uma câmera de frente pura (phi=90°).
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = 'https://localhost:5173';
const OUT = 'C:/Users/Bi/Documents/Ghost-project-ai/scripts/prado-rescue/tilt-check';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 900, height: 900 } }).then(c => c.newPage());
await page.goto(`${BASE}/`);

await page.setContent(`<!doctype html><html><body style="margin:0;background:#0b0f14">
<script type="module" src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js"></script>
<model-viewer id="mv" src="${BASE}/models/normalized/CW001.glb" camera-controls
  environment-image="neutral" shadow-intensity="0.9" exposure="1.2" tone-mapping="neutral"
  style="width:900px;height:900px;background:#0b0f14"></model-viewer>
</body></html>`);

await page.waitForFunction(() => document.querySelector('#mv')?.loaded, { timeout: 15000 });
await page.waitForTimeout(500);

// 1) câmera padrão do laboratório (o que o Carlinhos vê hoje: phi=75°)
await page.screenshot({ path: `${OUT}/1-camera-padrao-phi75.png` });

// 2) câmera de frente pura, nível do olho (phi=90°) — referência sem ilusão
await page.evaluate(() => {
  const mv = document.querySelector('#mv');
  mv.cameraOrbit = '0deg 90deg auto';
  mv.jumpCameraToGoal();
});
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/2-camera-nivel-phi90.png` });

console.log('Screenshots salvos em', OUT);
await browser.close();

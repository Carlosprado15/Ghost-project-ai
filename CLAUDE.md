# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## REGRA DE LINGUAGEM — COMPATIBILIDADE UNIVERSAL (LOCKED, D001)

O Ghost Project TEM QUE rodar em qualquer aparelho mobile — qualquer
Android, qualquer iOS. Isso não é uma meta, é um requisito travado
(LOCKED). Nenhuma decisão de arquitetura, correção ou teste pode assumir
ou depender de características específicas de um único aparelho.

O Motorola Razr 40 é, e deve ser referido sempre como, o "APARELHO DE
TESTE ATUAL" — nunca como "o aparelho do Ghost Project", "o alvo", ou
qualquer linguagem que sugira que o projeto é feito para ele
especificamente. É simplesmente o único hardware físico disponível para
teste agora.

Toda vez que um resultado de teste ou uma correção for reportada, use
obrigatoriamente esta frase de enquadramento: "Testado no aparelho de
teste atual (Razr 40) — ainda não validado em outros aparelhos. Ghost
Project deve funcionar em qualquer Android/iOS."

Nenhuma correção pode ser considerada "pronta" ou "resolvida" com base
em teste em um único aparelho. Um resultado PASS no Razr 40 é evidência
parcial, nunca confirmação de compatibilidade universal.

## Prado Engine Control Tower — implementação condicional

No início de TODA sessão, leia docs/prado-rescue/READY_FOR_PRADO_ENGINE.md.

Se todos os itens estiverem marcados [x], implemente automaticamente,
sem esperar autorização adicional, a seguinte arquitetura:

1. Migre docs/prado-rescue/ para docs/prado-engine/, preservando todo o
   histórico existente (BASELINE.md, evidence/AR-XXX/, scripts/) — não
   apague nada, apenas reorganize.
2. Renomeie CURRENT_STATE.md para STATE.md dentro de docs/prado-engine/,
   mantendo todo o conteúdo já registrado.
3. Crie docs/prado-engine/DECISIONS.md com status ACTIVE / LOCKED /
   SUPERSEDED / REJECTED para decisões arquiteturais do projeto. Primeiro
   registro obrigatório:
   D001 — O motor de AR deve rodar em qualquer Android ou iOS, não apenas
   no aparelho de teste atual. Status: LOCKED.
4. Crie docs/prado-engine/FAILURES.md — log de tentativas malsucedidas,
   cada uma referenciando sua pasta de evidência correspondente.
5. Generalize o padrão de evidência: novas tarefas fora do escopo
   específico de AR passam a usar docs/prado-engine/evidence/GP-XXX/
   (mesmo formato do AR-XXX: README, arquivos, evidências, resultado).
   Tarefas de debug do motor AR continuam usando o subagente ar-rescue
   e o padrão AR-XXX normalmente, agora dentro de docs/prado-engine/evidence/.
6. Regra dos 2 falhas (já em vigor para o motor AR) passa a valer para
   qualquer tarefa do projeto: 2 tentativas falhas com a mesma hipótese
   exigem STRATEGY_INVALIDATED e aprovação explícita de Carlos antes de
   uma terceira tentativa.
7. Nenhuma alteração em arquivo fora do escopo da tarefa. Toda tarefa
   experimental roda em branch própria; merge para main só após validação
   com evidência registrada.
8. Ao final da implementação, atualize STATE.md com o resultado e reporte
   a Carlos: arquivos criados, arquivos migrados, e qualquer risco de
   regressão encontrado.

Se algum item do checklist em READY_FOR_PRADO_ENGINE.md ainda estiver
pendente, NÃO implemente nada disso — apenas informe a Carlos quais itens
faltam, e prossiga normalmente com a tarefa que ele pediu na sessão.

## What this is

Ghost Project AI — an AR try-on experience (watches/bracelets) embedded into Shopify product pages. A visitor points their phone camera at their wrist; the app tracks the hand and renders a 3D `.glb` model of the product anchored to it. Stack: React 18 + Vite 8, Three.js / `<model-viewer>` for rendering, MediaPipe for hand tracking, `@gltf-transform` for the GLB calibration pipeline.

## Commands

```bash
npm run dev          # main dev server, vite.config.ts, https via @vitejs/plugin-basic-ssl, 0.0.0.0:5173
npm run build         # production build (vite build)
npm run preview       # preview the production build
npm run lab:m069b     # dev server for the calibration/tracking labs, vite.config.lab.mjs, https via mkcert (trusted cert — needed for camera access on mobile without a warning)
```

No test runner or linter is configured. There is no `api/` folder / Vercel serverless functions — this deploys as a static SPA; `vercel.json` only sets CORS/cache headers for `/ghost-sdk.js`, `/gsdk.js`, and `/models/*`.

GLB calibration pipeline (see `scripts/normalize-glb/`):
```bash
node scripts/normalize-glb/normalize.mjs [CW001 CW002 ...]   # no args = all 15; regenerates public/models/normalized/ from public/models/ + product-calibration-overrides.json
node scripts/normalize-glb/validate.mjs                      # geometric sanity check (orientation/centering) of the normalized output
node scripts/normalize-glb/qa-compare.mjs [CW006 ...] | --all # downloads each product's real photo from products.json and screenshots the current 3D render side-by-side (requires lab:m069b running on :5173)
node scripts/normalize-glb/generate-from-tripo.mjs <ids...> | --all-pending  # (re)generates a product's GLB from its real photo via the Tripo3D API — requires TRIPO_API_KEY in .env.local
node scripts/normalize-glb/prepare-for-3d.mjs <entrada> <id> [watch|bracelet]  # standalone entry point for the mandatory pre-3D image prep (see below); generate-from-tripo.mjs already calls this automatically
```

**Mandatory pre-3D image prep (decided 2026-07-14).** Before any photo is sent to Tripo/Meshy for GLB generation, it must go through `scripts/normalize-glb/prepare-for-3d.mjs`, which chains two steps: `clean-photoroom.mjs` (removes background/hands/props and repositions the product to face the camera straight-on, via the Photoroom API — costs a small amount per image) then `standardize-images.mjs`'s `standardizeOne()` (pads to a centered 1024x1024 white canvas, no distortion, via `sharp`). `generate-from-tripo.mjs` always calls this now — it is not an optional/manual step. `standardize-images.mjs` can still be run standalone as a CLI batch tool (`node scripts/normalize-glb/standardize-images.mjs <pasta-entrada> [pasta-saida]`) when you just need to pad a folder of images without the Photoroom step. **Not yet wired into `src/pipeline/` (the live customer-facing "Ghost Pipeline Intelligence" upload flow)** — that runs client-side with no backend to safely call the Photoroom API key from, so this prep currently only covers the catalog/batch generation path, not customer-uploaded photos.

## Debug do motor AR

Para qualquer investigação, diagnóstico ou debug do motor AR (tracking,
calibração, wrist positioning, GLB, performance/FPS, testes em dispositivo
real), sempre delegue ao subagente `ar-rescue` em vez de investigar
diretamente nesta sessão principal.

Antes de qualquer investigação ou mudança no motor AR, leitura obrigatória
de `docs/ar-research/INDEX.md` e `docs/ar-research/SYNTHESIS.md` — base de
pesquisa acumulativa (papers, documentação oficial, benchmarks) que
sustenta decisões de arquitetura do motor, mantida separada da evidência
medida em `docs/prado-rescue/`.
- Consultar também docs/ar-research/EXPERTS.md para abordagens de
especialistas relevantes ao problema em investigação.

### Servidor local pra teste físico — usar Monitor, não ficar checando

Toda vez que subir um servidor local pra um teste físico no celular
(`npm run dev`, `npm run lab:m069b`, capturas de evidência AR-XXX/GP-XXX
etc.), usar a ferramenta de Monitor pra observar o log/processo em vez de
ficar checando repetidamente se algo deu errado. O Monitor fica de olho
e só avisa quando acontece algo relevante de verdade (erro, crash,
travamento) — não a cada poucos segundos.

## Ambiente Windows — bug de path do Git Bash com ADB

**Sintoma:** qualquer argumento passado para `adb.exe` que comece com `/`
(ex.: `/sdcard/screen.png`, `/data/data/com.termux/files/home/...`) é
silenciosamente reescrito pelo Git Bash/MSYS para um caminho Windows sem
sentido (ex.: `C:/Program Files/Git/sdcard/screen.png`) antes de chegar ao
`adb`, quebrando qualquer comando `adb shell`/`adb push`/`adb pull` que
referencie um path do próprio Android.

**Causa:** MSYS2 (a camada POSIX por trás do Git Bash) faz conversão
automática de path em qualquer argumento parecido com um path Unix,
mesmo quando o destino é remoto (o sistema de arquivos do Android, não do
Windows).

**Correção:** exportar `MSYS_NO_PATHCONV=1` no mesmo bloco de comando antes
de qualquer chamada `adb` que use paths do Android:

```bash
export MSYS_NO_PATHCONV=1
adb shell screencap -p /sdcard/screen.png
adb pull /sdcard/screen.png ./screen.png
```

Isso já foi redescoberto mais de uma vez em sessões diferentes (setup do
Termux no celular, scripts do `ar-rescue`) — sempre incluir esse export ao
escrever qualquer comando `adb` novo neste projeto, para não perder tempo
re-diagnosticando o mesmo bug.

**Bug relacionado, específico do aparelho de teste (Motorola razr 40):**
`adb shell screenrecord` sem `--display-id` explícito falha com
`INVALID_LAYER_STACK`, porque é um flip phone com duas telas físicas
(interna + externa) e o `screenrecord` não escolhe a tela certa sozinho.
Descobrir o display correto via `adb shell dumpsys SurfaceFlinger
--display-id` e passar `--display-id` explicitamente
(`scripts/prado-rescue/capture-video.sh` já faz isso automaticamente).

## Architecture

### Three parallel/competing tracking implementations — do not confuse them

This is the single most important thing to know before touching tracking code:

- **`src/tracking/`** — legacy, **currently live in production**. `WristTracker.js` / `RenderPipeline.js` / `PrecisionFitController.js`, imported directly by `App_FINAL.jsx`. Loads MediaPipe's old `Hands` solution from a CDN via a hand-rolled script loader (see `window.Hands`/`window.Camera` globals in `vite-env.d.ts`), not the modern `@mediapipe/tasks-vision` API.
- **`src/engine/`** — the modern rewrite ("GhostEngine", extracted from the legacy code). Entry point `src/engine/core/GhostEngine.js` (plain JS, no React): `init()` → `startLoop(getVideoEl)` → per-frame `onPose` callback → `stop()`. Uses `@mediapipe/tasks-vision` HandLandmarker (`core/tracking/handTracker.js`), One-Euro filters (`core/filters/`), wrist anchoring (`core/anchor/wristAnchor.js`), hold-last-pose on brief tracking loss (`core/pose/holdLastPose.js`), and tuning presets in `config/*.json`. `react/useGhostWristAR.js` + `react/GhostWristARView.jsx` wrap it for React. **Only consumed by `src/labs/tasks-wrist/TasksWristLab.jsx` (`?lab=tasks-wrist`) — `App_FINAL.jsx` does not use it.** Promoting this to production means wiring it into `App_FINAL.jsx` in place of `src/tracking/`; that has not happened yet.
- **`src/tracking-engines/`** — an unrelated, not-yet-integrated vendor-evaluation scaffold (see its own `README.md`) for comparing candidate AR SDKs (DeepAR, Perfect Corp, Banuba, MIRRAR) against the current approach. `types.js`/`engineRegistry.js`/`engineMatrix.js` define the comparison contract; most `engines/*` entries are placeholders whose `createSession()` intentionally throws. Only reachable via isolated labs (`?lab=deepar`, `?lab=webarrocks`); nothing here is wired into `App_FINAL.jsx`.

### `App_FINAL.jsx` — the live store component

~2000 lines, default export `App()`. The whole customer-facing experience: camera/UI state machine, `src/tracking/` consumption, `<model-viewer>` rendering, the "Ghost Pipeline Intelligence" image-to-3D flow (see below), B2B contact modal, QR handoff, embedded-mode (iframe/Shopify) detection, precision-fit calibration offset, and performance metrics. Routed to by default in `src/main.tsx` when no `?lab=` query param matches.

### `src/pipeline/` — image-to-3D generation ("Ghost Pipeline Intelligence")

`ImageToModelPipeline.js` orchestrates: validate image → check cache (SHA-256) → try registered providers in priority order with automatic fallback (`ProviderSelector`) → poll job → download GLB → validate GLB. State machine: `IDLE → VALIDATING → UPLOADING → GENERATING → DOWNLOADING → READY/ERROR`. Providers (`providers/TripoProvider.js`, `providers/MeshyProvider.js`) both extend `BaseProvider.js` (shared retry/backoff/GLTFLoader-validation logic). `defaultPipeline.js` is the factory (`createDefaultPipeline()`) used by `App_FINAL.jsx`, registering Meshy as primary and Tripo as fallback.

**Security constraint — do not read API keys via `import.meta.env.VITE_*` in these providers.** Any `VITE_`-prefixed env var referenced anywhere in code reachable by the client bundle is compiled to a literal string in the shipped JS and is extractable by any site visitor via devtools (confirmed by grepping `dist/assets/*.js` after a build). `TripoProvider`/`MeshyProvider` only accept `apiKey` via constructor `config` now; the real keys (`TRIPO_API_KEY`, `MESHY_API_KEY` in `.env.local`, deliberately **not** `VITE_`-prefixed) are only ever read by Node scripts (e.g. `scripts/normalize-glb/generate-from-tripo.mjs`, which parses `.env.local` directly), never by browser-bundled code. `VITE_DEEPAR_LICENSE_KEY` is a different case — DeepAR's SDK license keys are meant to be domain-restricted and used client-side, so that one is fine as-is.

### `src/sdk/` — embeddable SDK for partner Shopify stores

`GhostProject.js` is the public surface (`GhostProject.open({ productId, modelUrl, productUrl, cartUrl, storeId, metadata })`, `.on()`/`.off()` pub/sub via `ghost-events.js`). `product-adapter.js` (`ProductAdapter`) resolves the active product from URL query params or explicit params, falling back to a `modelUrl` lookup in `src/data/products.json` (with a cache-busting version suffix). `store-adapters/` holds per-partner-store config (currently just `clickwear.js`) — the pattern to extend as more partner stores onboard. The built embed scripts are served as `public/ghost-sdk.js` / `public/gsdk.js`; **edit `public/gsdk.js` directly, never `dist/gsdk.js`** (Vite overwrites `dist/` on every build). Shopify-side theme integration (Liquid snippets) lives under `shopify/`.

### `src/labs/` and dev-only test harnesses

Routed via `src/main.tsx` reading `?lab=` from the query string; falls back to `App_FINAL` otherwise. Not all labs live under `src/labs/` — three sit at `src/` root instead:

| `?lab=` | Component | Path |
|---|---|---|
| `replay` | ReplayLab | `src/ReplayLab.jsx` |
| `webarrocks` | WebARRocksLab | `src/WebARRocksLab.jsx` |
| `deepar` | DeepARLab | `src/DeepARLab.jsx` |
| `tasks-wrist` | TasksWristLab | `src/labs/tasks-wrist/TasksWristLab.jsx` |
| `validate-glb` | GLBValidationLab | `src/labs/GLBValidationLab.jsx` |
| `calibrate-product` | ProductCalibrationLab | `src/labs/ProductCalibrationLab.jsx` |

`src/labs/tasks-wrist/` has its own supporting tooling (`calibrationMetrics.js`, `calibrationPresets.js`, `calibrationRunner.js`, `filterCalibration.js`, `reportServer.mjs`), tied to the `lab:m069b` script.

### GLB calibration pipeline (`scripts/normalize-glb/`)

`normalize.mjs` reads each `public/models/CW0XX.glb` (original, untouched Tripo3D/Meshy output) plus `product-calibration-overrides.json` (per-product `rotationDeg`/`scale`/`offset`/`flip180Y`/`flip180Z`/`status`, keyed by product id), wraps the scene in a single `AR_NORMALIZED` transform node, and writes the result to `public/models/normalized/CW0XX.glb`. Target size differs by type: `watch` → 0.08 units max dimension, `bracelet` → 0.07 (validated by `validate.mjs`, which checks a `watch`'s Y is its largest dimension vs. a `bracelet`'s Y being its smallest — loop perpendicular to the wrist axis).

**`rotationDeg` in the overrides file is the only source of rotation truth** — there used to be an automatic PCA-based pre-alignment step baked into `normalize.mjs` before the manual override was applied, but it was removed (2026-07-09) because the calibration UI (`ProductCalibrationLab`, `?lab=calibrate-product`) had no way to account for it, so every manual adjustment silently drifted. Do not reintroduce an automatic pre-rotation step without also updating `ProductCalibrationLab`'s `baseMatrixFor()` to match, or the two will disagree again.

`ProductCalibrationLab.jsx` lets a human eyeball-rotate a product's `normalized` GLB with the mouse and "Aplicar" the current camera orbit as the new absolute rotation; "Copiar JSON" produces the block to paste into `product-calibration-overrides.json`. `qa-compare.mjs` automates the sanity check this pipeline exists to prevent: it fetches each product's real photo straight from `imageUrl` in `products.json` and screenshots the current 3D render next to it, because product IDs and their `.glb` files have previously gotten silently swapped/mismatched (a real photo not matching its 3D file is a data bug, not a calibration bug — re-derive/regenerate the GLB, don't try to rotate your way out of it).

## Roadmap — features futuras (NÃO implementar agora)

- **Feature v2 — variação de cor por produto:** mesmo relógio em cores diferentes (dourado/prateado/preto). Duas abordagens possíveis: (1) GLB separado por cor; (2) troca de material em tempo real via materiais nomeados no GLB. Não implementar agora — registrado para roadmap futuro.

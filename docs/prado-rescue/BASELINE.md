# BASELINE — PRADO GHOST RESCUE / AR LAB v1

Registro criado por: subagente `ar-rescue`
Execução: FASE 1 (Baseline) do protocolo permanente.

---

## 1. Estado do repositório no momento desta execução

- **Data/hora local:** 2026-08-16
- **Branch atual:** `ghost-engine-v1`
- **Commit atual (HEAD):** `248efc6` — "Checkpoint: teste do Foxbox — video na tela inicial, reforco de Pose, material sem brilho espelhado"
- **Situação em relação ao remoto:** branch local está 6 commits à frente de `origin/ghost-engine-v1` (não sincronizado, não é problema — só registro).
- **`git status` no momento da leitura:**
  - Modificados (não staged): `.claude/settings.json`, `CLAUDE.md`, `scripts/normalize-glb/VALIDATION_REPORT.md`
  - Não rastreados: `.claude/agents/ar-rescue.md`, `docs/GHOST_BUSINESS_MASTER_PLAN.md`, `public/deepar-wrist-test.html`, `public/effects/`
  - Nenhuma dessas alterações foi tocada, criada ou revertida por esta execução do AR LAB. Ficam como estavam.
- **Nenhum `git reset`, `checkout` destrutivo, ou criação de branch/tag foi feito.** Não foi necessário criar snapshot adicional porque nada foi alterado no motor.

Últimos 10 commits (contexto, não alterado):
```
248efc6 Checkpoint: teste do Foxbox — video na tela inicial, reforco de Pose, material sem brilho espelhado
8a8b340 Endereco curto para o teste do Foxbox na Shopee
936e330 Publica o GLB calibrado do Foxbox no tamanho certo (43MB -> 0,6MB)
d6559f6 Corrige pulseira CW005 usando o GLB calibrado em vez do cru
648c486 Hospeda o MediaPipe Hands localmente em vez de CDN externo
58beeb4 Corrige orientacao do relogio no pulso (bug -90 fixo no WristTracker) e comprime os GLBs do catalogo
4a11a15 Fixa preparo automatico pre-3D (limpar fundo, endireitar, centralizar, padronizar) + modulos isolados de selecao de imagem e prompt 3D
2720e74 Checkpoint: catalogo cresce pra 35 produtos + botao Voltar sempre visivel
a3c3c40 Checkpoint: pipeline Photoroom + fotos-limpas curadas + calibracao dos 11 regenerados
3141d32 Corrige provador AR: reverte modelUrl pro bruto (o motor antigo nao entende o calibrado)
```

## 2. Existia investigação AR LAB anterior?

**NÃO.** `docs/prado-rescue/CURRENT_STATE.md` não existia antes desta execução. `docs/prado-rescue/evidence/` e `scripts/prado-rescue/` já existiam como pastas vazias (criadas em algum momento anterior, sem conteúdo, sem git tracking — pastas vazias não entram no git). Esta é, na prática, a primeira execução real do protocolo AR LAB v1 (registro AR-000 será o primeiro, quando a Fase 3 for autorizada).

## 3. Como iniciar o projeto (levantado por inspeção, não alterado)

Definido em `package.json`:

```bash
npm run dev          # servidor principal — vite.config.ts, host 0.0.0.0:5173, https auto-assinado (@vitejs/plugin-basic-ssl)
npm run build         # build de produção
npm run preview       # preview do build
npm run lab:m069b     # servidor dos labs de calibração/tracking — vite.config.lab.mjs, host 0.0.0.0:5173, https via mkcert (certificado confiável — necessário pra câmera funcionar no celular sem aviso de "site não seguro")
```

Não existe test runner nem linter configurado (confirma o que já está em `CLAUDE.md`).

## 4. Como acessar o motor AR (loja real vs. labs)

Roteamento em `src/main.tsx`, via query param `?lab=`:

| URL (`?lab=`) | Componente | Motor de tracking usado |
|---|---|---|
| (nenhum — rota padrão) | `App_FINAL.jsx` (loja real) | `src/tracking/` — **legado**, `@mediapipe/hands` via CDN/script global (`window.Hands`) |
| `tasks-wrist` | `TasksWristLab.jsx` | `src/engine/` (**GhostEngine**) — moderno, `@mediapipe/tasks-vision` (HandLandmarker), confirmado por leitura direta do import (`useGhostWristAR.js`) |
| `replay` | `ReplayLab.jsx` | replay de captura |
| `webarrocks` | `WebARRocksLab.jsx` | avaliação de SDK terceiro (WebAR.rocks) |
| `deepar` | `DeepARLab.jsx` | avaliação de SDK terceiro (DeepAR) |
| `validate-glb` | `GLBValidationLab.jsx` | validação geométrica de GLB, sem câmera |
| `calibrate-product` | `ProductCalibrationLab.jsx` | calibração manual de rotação/escala de produto |
| `material-ab` | `MaterialABLab.jsx` | teste A/B de material |

URLs de teste do motor moderno (documentadas em `docs/GHOST_ENGINE_MIGRATION_REPORT.md`, na rede local do autor original):
```
https://<IP-da-máquina>:5173/                                          → loja real (App_FINAL.jsx, motor legado)
https://<IP-da-máquina>:5173/?lab=tasks-wrist                          → motor GhostEngine, GLB CW001 fixo
https://<IP-da-máquina>:5173/?lab=tasks-wrist&productId=CW005          → motor GhostEngine, GLB dinâmico
https://<IP-da-máquina>:5173/?lab=tasks-wrist&auto=1                   → fluxo de auto-calibração
```
IP atual desta máquina na rede local (Wi-Fi): `192.168.0.2` (pode mudar a cada sessão — sempre reconferir com `ipconfig`).

**Nota sobre acesso via USB (relevante para Fase 2):** como alternativa a estar na mesma rede Wi-Fi, é possível usar `adb reverse tcp:5173 tcp:5173` com o cabo USB conectado, e então abrir `https://localhost:5173/...` diretamente no navegador do celular — no Chrome do Android, certificados autoassinados (`vite.config.ts`, plugin `basic-ssl`) ainda geram aviso de "não seguro" que precisa ser aceito manualmente; `npm run lab:m069b` usa `mkcert`, que gera certificado confiável, mas mkcert instala a autoridade certificadora apenas na máquina local — o celular ainda vai ver o certificado como não confiável a menos que essa CA tenha sido instalada nele antes. Isso é só um lembrete operacional, nenhuma ação foi tomada.

## 5. Estado atual conhecido do motor AR (por inspeção de documentação existente — não testado nesta execução)

Fonte: `docs/GHOST_ENGINE_MIGRATION_REPORT.md` (2026-07-02, branch `ghost-engine-v1`) e `CLAUDE.md`.

- Existem **duas implementações de tracking paralelas**, não uma migração completa:
  - `src/tracking/` — **em produção agora**, usada por `App_FINAL.jsx` (a loja real). API legada `@mediapipe/hands`.
  - `src/engine/` (GhostEngine) — reescrita moderna, usa `@mediapipe/tasks-vision` (HandLandmarker), One Euro Filter, hold-last-pose 1500ms/500ms conforme a versão, âncora em landmark 0 + 18% do antebraço. **Só é consumida pelo lab `?lab=tasks-wrist`. `App_FINAL.jsx` NÃO usa `src/engine/`.**
  - Migrar a loja real para o motor novo (`src/engine/`) ainda não aconteceu — é trabalho futuro registrado, fora do escopo desta execução.
- Pipeline de normalização de GLB (`scripts/normalize-glb/`) já validado (14/15 produtos calibrados, conforme `CLAUDE.md`).
- **Hipótese em aberto, ainda não confirmada por evidência no repositório:** reprovação em teste de estabilidade (FPS/rotação) no motor moderno, possivelmente ligada a incompatibilidade WebGL vs. GPU Adreno do Motorola Razr 40. Não encontrei nenhum relatório/log no repositório que já documente esse teste especificamente — tratando como hipótese em aberto, conforme instruído, não como fato confirmado.

## 6. Problemas conhecidos (por documentação existente, não re-testados agora)

- Duas implementações de `OneEuroFilter` divergentes (loja vs. engine) — risco de re-trabalho se um dia forem unificadas sem cuidado.
- `console.log` de diagnóstico presentes em partes do lab — não afeta produção (loja real não carrega o lab).
- Sistema de calibração automática (`?auto=1`) do lab não está conectado à loja real — parâmetros achados lá não retroalimentam `WristTracker.js` automaticamente.
- Relatório de 2026-07-02 (`AR_ENGINE_STATE_REPORT.md`) descreve o lab ANTES da migração para `src/engine/` (ainda cita `useTasksWristTracking.js`, que já foi deletado segundo `GHOST_ENGINE_MIGRATION_REPORT.md`) — tratado aqui como contexto histórico, não como estado atual do lab.

## 7. Funcionalidades que NÃO podem quebrar (regra suprema do projeto: nunca retroceder)

- `App_FINAL.jsx` (loja real) e tudo que ela consome de `src/tracking/` — comportamento funcional em produção hoje.
- `public/gsdk.js` (SDK embutido nas lojas parceiras) — nunca editar `dist/gsdk.js`.
- `public/models/` (GLBs originais) e `public/models/normalized/` (pipeline calibrado).
- `src/data/products.json` — roteamento produto → GLB.
- Qualquer commit/tag de proteção já existente (`M055B-...`, `M056G-...`, `M057A-...`, conforme `docs/STATUS_ATUAL_GHOST_PROJECT.md`).

## 8. Ferramentas de diagnóstico já existentes que NÃO foram apagadas nem substituídas

- `src/labs/tasks-wrist/` (todo o conjunto: `calibrationMetrics.js`, `calibrationPresets.js`, `calibrationRunner.js`, `filterCalibration.js`, `reportServer.mjs`, `COMO_RODAR.md`, `start-m069b.ps1`).
- Labs isolados: `ReplayLab.jsx`, `WebARRocksLab.jsx`, `DeepARLab.jsx`, `GLBValidationLab.jsx`, `ProductCalibrationLab.jsx`, `MaterialABLab.jsx`.
- `scripts/normalize-glb/` (pipeline de calibração de GLB) — intocado.

---

**Nenhum arquivo do motor AR foi modificado nesta execução.** Esta é uma fase de leitura e registro apenas, mais a criação da infraestrutura da Fase 2 (scripts USB/ADB), que é nova e não sobrescreve nada existente.

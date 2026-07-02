# AR Engine State Report — Ghost Project AI
**Data:** 2026-07-02 · **Branch:** m069-tasks-wrist-lab · **Auditor:** Claude Fable 5

> Diagnóstico puro. Nenhuma correção aplicada. Cada item mostra estado atual, arquivo/linha, o que falta e proposta de correção.

---

## BLOCO A — ROTEAMENTO DE PRODUTO

### A1. Fluxo completo: clique → GLB

**Estado: ✅ funcional na loja real / ❌ hardcoded no lab**

```
[Shopify store page]
gsdk.js → getProductHandle()        → lê pathname /products/{handle}
       → PRODUCT_MAP[handle]        → productId (ex: 'CW001')
       → injectARButton(productId)  → monta URL:
           GHOST_BASE_URL/?productId=CW001&productUrl=...&mode=embedded
       → openGhostOverlay(url)      → iframe com essa URL

[Dentro do iframe — App_FINAL.jsx]
useEffect (linha 292)               → params.get('productId') → 'CW001'
openScanner('CW001') (linha 345)
  └─ ProductAdapter.fromParams({ productId: 'CW001' })
       └─ _lookupModelUrl('CW001')   → products.json → modelUrl: '/models/CW001.glb'
       └─ retorna '/models/CW001.glb?v029'  (MODEL_CACHE_VERSION)
  └─ setGeneratedModelUrl('/models/CW001.glb?v029')

[Scanner JSX, linha 1548]
<model-viewer src={generatedModelUrl || modelUrl} />
  └─ src = '/models/CW001.glb?v029' ← produto correto
```

**No lab (?lab=tasks-wrist):**  
`TasksWristLab.jsx:7` → `const GLB_URL = '/models/CW001.glb'` — fixo.  
Não lê `?productId=` nem `products.json`. Intencional para o lab de calibração, mas impede uso como showcase de produto dinâmico.

---

### A2. Instâncias hardcoded de GLBs específicos

| Arquivo | Linha | Valor | Bug ou intencional? |
|---|---|---|---|
| `src/labs/tasks-wrist/TasksWristLab.jsx` | 7 | `'/models/CW001.glb'` | **Bug de escopo**: lab deveria receber o produto do contexto pai para ser reutilizável |
| `src/labs/tasks-wrist/TasksWristLab.jsx` | 409 | label `'CW001'` no canvas | Intenional: só visível com `DEBUG_OVERLAY=true` |
| `src/labs/tasks-wrist/TasksWristLab.jsx` | 514, 716 | label `'Ativar GLB CW001'` | Cosmético; não afeta funcionalidade |
| `public/gsdk.js` | 34–49 | `MODEL_MAP` com CW001–CW015 | **Intencional**: tabela de lookup completa |
| `public/gsdk.js` | 11 | `GHOST_BASE_URL` fixo | Intencional: URL de produção |

---

### A3. Loja real vs Lab — troca de produto funciona?

**Loja real / Embedded Store Mode:** ✅ **Dinâmico e funcional.**  
`ProductAdapter.fromParams()` resolve qualquer `productId` CW001–CW015 para o GLB correto via `products.json`. Chamar CW008 mostra CW008.

**Lab (?lab=tasks-wrist):** ❌ **Hardcoded em CW001.**  
O lab não foi projetado como showcase de produto — é um laboratório de calibração de filtro. Porém, se for evoluído para demonstração (ex: exibir o produto atual da loja enquanto calibra), precisará ler `?productId=` e resolver via `ProductAdapter`.

---

### A4. products.json vs public/models/

**Estado: ✅ 100% consistente.**

- `products.json`: 15 entradas (CW001–CW015), cada uma com `modelUrl: '/models/CWxxx.glb'`
- `public/models/`: contém CW001–CW015 + extras (`CASIO.glb`, `black.glb`, `diver.glb`, `gold.glb`, `metal.glb`, `skeleton.glb`)
- Sem arquivos faltando. Sem path errado.

---

## BLOCO B — ENCAIXE NO PULSO (posição)

### B1. Âncora e landmark usado

**Loja real (App_FINAL.jsx + WristTracker.js):**
- Landmarks usados: `[0]` (wrist), `[5]` (index_mcp), `[9]` (middle_mcp), `[17]` (pinky_mcp)
- **Âncora NÃO é lm0 direto** — é um ponto com offset:
  - `WristTracker.js:272–274` → `watchX = wrist.x + forearmDirX * offset * dirSign`
  - `offset = forearmLength * 0.18` (config `watchOffsetRatio`)
  - Direção: oposta à palma (antebraço)
- Resultado: relógio posicionado ~18% do comprimento pulso→palma, no sentido do antebraço

**Lab (useTasksWristTracking.js):**
- Landmarks usados: `[0]` (wrist), `[5]` (index_mcp), `[17]` (pinky_mcp)
- **Âncora = lm0 exatamente** — `useTasksWristTracking.js:142` → `rawPos = { x: lm0.x, y: lm0.y, z: lm0.z }`
- Sem offset. Relógio fica exatamente na articulação do pulso.

### B2. Descolamento e offset por-produto

**Loja real:** Offset global (`watchOffsetRatio=0.18`), não por-produto. Ajustável via `?offsetRatio=` na URL.  
**Lab:** Sem offset. O relógio pode ficar ligeiramente acima do ponto ideal do pulso para alguns usuários.  
**Por-produto:** Não existe em nenhuma das implementações. Um smartwatch bulky e uma pulseira fina recebem o mesmo offset.

**O que falta:** Offset por-produto (campo `wristOffsetRatio` em products.json) e teste por produto real.

---

## BLOCO C — ORIENTAÇÃO (relógio deitado)

### C1. Como a rotação é aplicada

**Loja real:**
- `WristTracker.js:285` → `watchRotation = atan2(forearmDirY, forearmDirX) * (180/PI) + watchRotationOffset`
- `watchRotationOffset = -90°` (default, hardcoded)
- Aplicado via CSS `rotateZ(rotation)` no `watchStyle` (App_FINAL.jsx:1192)
- **Adicionalmente**, o model-viewer tem atributo estático `orientation="0deg 0deg -90deg" scale="2 2 2"` (App_FINAL.jsx:1558–1559)

**Lab:**
- `useTasksWristTracking.js:144` → `rawRotZ = Math.atan2(lm17.y - lm5.y, lm17.x - lm5.x)`
- Aplicado via CSS `rotate(${rotZ}deg)` no div do model-viewer (TasksWristLab.jsx, no bloco GLB render)
- **Nenhuma correção de orientação no model-viewer** — sem atributo `orientation=`, sem offset fixo

### C2. Origem do "relógio deitado"

**Causa dupla:**
1. **GLBs foram modelados com o relógio em pose horizontal** (face voltada para cima ou para a câmera, não "vestido"). Isso é um problema de asset, não de código.
2. **Lab não tem `orientation=` no model-viewer:** sem `-90deg` em Z, o GLB aparece na sua orientação nativa (deitado). A loja real compensa isso com `orientation="0deg 0deg -90deg"`.

### C3. Global vs por-produto

**Global** nas duas implementações. A correção `-90deg` é aplicada igualmente a todos os 15 produtos.  
Se algum GLB foi exportado com orientação diferente, aparecerá errado (necessário auditar asset por asset).

**O que falta:** Adicionar `orientation="0deg 0deg -90deg"` (ou equivalente) no model-viewer do lab. Idealmente, um campo `modelOrientation` em `products.json` por produto.

---

## BLOCO D — TAMANHO / ESCALA

### D1. Como a escala é calculada

**Loja real (WristTracker.js:255–280):**
```js
palmWidth = Math.hypot(indexMcp.x - pinkyMcp.x, indexMcp.y - pinkyMcp.y)  // em pixels de tela
rawSize   = palmWidth * watchSizeMultiplier  // watchSizeMultiplier = 1.5 (default)
watchSize = clamp(rawSize, minWatchSize=80, maxWatchSize=220)               // pixels
```
O container é um quadrado `watchSize × watchSize` px.

**Lab (TasksWristLab.jsx, seção Derived):**
```js
scale  = dist2D(lm5, lm17)              // [0,1], coords normalizadas do video frame
watchW = Math.round(scale * window.innerWidth * WRIST_SCALE_MULTIPLIER)  // WRIST_SCALE_MULTIPLIER = 4.5
watchH = Math.round(watchW * 0.5)       // proporção 2:1 (hardcoded)
```

### D2. Responsividade à distância e por-produto

**Acompanha distância:** Sim, nos dois contextos — o span lm5–lm17 cresce quando a mão se aproxima.  
**Por-produto:** Não existe em nenhuma implementação. Um smartwatch chunky e uma pulseira fina recebem o mesmo tamanho.  
**Clamp na loja real:** O clamp 80–220px pode subavaliar o tamanho correto em telas grandes ou quando o produto é especialmente grande/pequeno.

**O que falta:** Campo `watchSizeMultiplier` em `products.json` por produto, ou mapeamento por categoria (relógio ≠ pulseira ≠ bracelete).

---

## BLOCO E — ESTABILIDADE (tremor)

### E1. One Euro Filter — parâmetros atuais

**Loja real (WristTracker.js:52–80):**
| Canal | minCutoff | beta | dCutoff |
|---|---|---|---|
| Posição (X,Y) | 1.2 | 0.3 | 1.0 |
| Rotação Z | 1.0 | 0.5 | 1.0 |
| Escala | 0.8 | 0.1 | 1.0 |
| Pitch / Yaw | 1.0 | 0.5 | 1.0 |

Além do filtro: dead zone posição=3px, rotação=2°, escala=2%; clamp de mudança brusca por frame.

**Lab (useTasksWristTracking.js:33–38):**
| Canal | minCutoff | beta | dCutoff |
|---|---|---|---|
| Posição (X,Y,Z) | 1.0 (default) | 0.007 (default) | 1.0 |
| Rotação Z | 1.0 | 0.007 | 1.0 |
| Escala | 0.5 (minCutoff × 0.5) | 0.007 | 1.0 |

Sem dead zone nem clamp por frame. O `beta=0.007` é muito baixo (muito suave, alta latência) comparado com `0.3` da loja — o lab é mais suave mas mais lento. O sistema de calibração (?auto=1) pode otimizar isso.

### E2. Hold last known pose

**Loja real:** `WristTracker._handleLostTracking()` — mantém última pose por `maxLostFrames=30` frames (~1s a 30fps). **Ativo.**  
**Lab:** `HOLD_POSE_MS=500ms` via `lastPoseRef` + `lastDetectedMsRef`. **Ativo.**

### E3. Sistema de calibração (?auto=1)

**Estado: ⚠️ funcional mas desconectado da loja real.**

- O fluxo `?auto=1` coleta frames estáticos + lentos, roda `runCalibration()` (grid 7×7 = 49 combos), aplica o melhor via `setFilterOpts()` que repassa ao hook via prop `filterOpts`.
- Resultado é enviado ao `reportServer.mjs` (porta 5174) e salvo em `M069B_FILTER_CALIBRATION_REPORT.md`.
- **O que falta:** Integração com a loja real — os parâmetros ótimos encontrados pelo lab nunca foram propagados para o `WristTracker` da loja. São dois sistemas de filtro independentes.

---

## BLOCO F — RENDERIZADOR & COMPATIBILIDADE

### F1. Registro do model-viewer — cobertura e sentinels

| Contexto | Sentinel | Arquivo |
|---|---|---|
| Shopify store (gsdk.js) | `data-ghost-mv` | `public/gsdk.js:72` |
| App_FINAL.jsx (iframe) | `data-mv` | `App_FINAL.jsx:56` |
| Lab (?lab=tasks-wrist) | `data-mv` | `useModelViewerLoader.js:28` |

**Os sentinels do gsdk.js e do app são diferentes** (`data-ghost-mv` vs `data-mv`), mas são documentos separados (store page vs iframe), portanto **não há conflito real**. Porém é inconsistência que pode confundir em inspeção.

**No lab**, `useModelViewerLoader.js` retorna `{ ready: boolean }` (polling via rAF) e só renderiza o `<model-viewer>` quando `ready=true`. **Cobertura completa.**

### F2. Divergência entre loja real e lab

**Três divergências críticas:**

1. **Engine de tracking completamente diferente:**
   - Loja real: `@mediapipe/hands` (API legada, CDN script tag, `window.Hands`, `window.Camera`) → `WristTracker` (coords de pixel, filtro+dead zone+clamp)
   - Lab: `@mediapipe/tasks-vision` (npm package, HandLandmarker, VIDEO mode, GPU delegate) → `useTasksWristTracking` (coords normalizadas, filtro simples)
   - São duas APIs do MediaPipe de gerações diferentes. Resultados não são compatíveis.

2. **Posicionamento e escala diferentes:**
   - Loja: container px fixo (size×size) posicionado em `left/top` de pixel absoluto de tela
   - Lab: largura dinâmica em px (`scale * innerWidth * multiplier`) posicionada em `left/top` percentual do viewport

3. **Orientação do modelo:**
   - Loja: `orientation="0deg 0deg -90deg"` no atributo do model-viewer → relógio vestido
   - Lab: sem `orientation` → relógio deitado

### F3. Performance — onde o fps cai

**Loja real:**
- `@mediapipe/hands` com `modelComplexity: 0`, câmera 640×480, callback por frame
- O `Camera` do MediaPipe gerencia o loop internamente, implicitamente 30fps
- Re-renders React: `setWatch(pose)` a cada frame → re-render completo do scanner

**Lab:**
- RAF loop direto, sem cap de fps → 60fps em dispositivos modernos
- `setState` chamado em cada frame da detecção → 60fps de re-renders React (sem batching)
- `@mediapipe/tasks-vision` com GPU delegate → melhor performance que a API legada
- **FPS em luz baixa:** o HandLandmarker perde detecção por baixa qualidade de imagem, mas o hold-pose (500ms) mitiga o piscar

**Otimizações pendentes no lab:**
- Trocar `setState` por `useRef` para posição/escala dentro do loop, chamar `setState` só quando há mudança significativa
- Adicionar throttle ou cap a 30fps no RAF loop

---

## BLOCO G — ARQUITETURA / DÍVIDA TÉCNICA

### G1. Acoplamento a "relógio/pulso"

**Lab — acoplamentos identificados:**

| Elemento | Arquivo | Acoplamento |
|---|---|---|
| `GLB_URL = '/models/CW001.glb'` | TasksWristLab.jsx:7 | Produto fixo |
| `watchH = watchW * 0.5` | TasksWristLab.jsx (Derived) | Proporção 2:1 de relógio |
| `WATCH_W_NORM = 0.22` | TasksWristLab.jsx:8 | Constante de "largura de relógio" |
| lm0, lm5, lm17 para anchor | useTasksWristTracking.js:138–143 | Landmarks específicos da mão |
| Labels "GLB CW001" | TasksWristLab.jsx:514,716 | Nome de produto |

**Genérico (reutilizável):**
- `useModelViewerLoader.js` — 100% genérico ✓
- `oneEuroFilter.js`, `calibrationRunner.js`, `calibrationMetrics.js`, `calibrationPresets.js`, `filterCalibration.js` — genéricos ✓
- `recordWithProgress`, `runAutoSequence` — genéricos em estrutura ✓

**Loja real — acoplamentos:**
- `watchRotationOffset = -90` → calibrado para relógio deitado
- `orientation="0deg 0deg -90deg"` → idem
- `WristTracker` — nome e implementação para pulso/mão

### G2. Duplicações, código morto e dívida

1. **Dois engines MediaPipe divergentes:**
   `@mediapipe/hands` (loja) vs `@mediapipe/tasks-vision` (lab) — APIs diferentes, comportamento diferente, sem plano de unificação. Quando o lab for promovido a produção, um dos dois será descartado.

2. **Dois OneEuroFilter independentes:**
   `src/tracking/OneEuroFilter.js` (usado pelo WristTracker da loja) e `src/labs/tasks-wrist/oneEuroFilter.js` (usado pelo lab). Parâmetros e implementações levemente diferentes. A versão da loja tem wrap-around para rotação; a do lab não.

3. **Dois loaders de model-viewer:**
   `useModelViewer()` em `App_FINAL.jsx:54–67` (não retorna estado) e `useModelViewerLoader.js` (retorna `{ ready }`, mais robusto). O do lab é superior; o da loja deveria ser substituído por ele.

4. **Logs de diagnóstico em produção:**
   `TasksWristLab.jsx:26–29` — 4 `console.log('[M069B DIAG]...')` e `console.log('[M069B AUTO]...')` em vários pontos. Devem ser removidos antes de produção/showcase para investidores.

5. **Sistema de calibração sem integração:**
   Os parâmetros ótimos do ?auto=1 (minCutoff, beta) ficam no lab e nunca alimentam o `WristTracker` da loja real. A calibração descobrirá que `beta=0.007` é diferente do `0.3` usado na loja — gap que nunca foi fechado.

6. **Três labs de tracking não integrados:**
   `ReplayLab.jsx`, `WebARRocksLab.jsx`, `DeepARLab.jsx` — experimentos isolados que não compartilham componentes nem resultados com a loja principal.

7. **`shouldRenderWatch` vs `mvReady`:**
   A loja usa `trackerRef.current?.shouldRender()` para controlar visibilidade; o lab usa `glbActive && mvReady && isTracking`. Lógicas distintas para o mesmo conceito.

8. **Sentinel inconsistente no model-viewer:**
   `gsdk.js` usa `data-ghost-mv`; `App_FINAL.jsx` e `useModelViewerLoader.js` usam `data-mv`. Inócuo funcionalmente (documentos separados), mas inconsistente para manutenção.

---

## Tabela-Resumo

| Função | Estado | Prioridade | Correção proposta |
|---|---|---|---|
| **A1** Roteamento produto → GLB (loja real) | ✅ ok | — | — |
| **A1** Roteamento produto → GLB (lab) | ❌ quebrado | Alta | Ler `?productId=` no lab, resolver via `ProductAdapter` |
| **A2** GLB hardcoded no lab | ⚠️ parcial | Alta | Extrair `GLB_URL` como prop/param; manter constante só como fallback |
| **A4** products.json ↔ public/models/ | ✅ ok | — | — |
| **B1** Âncora no pulso (loja) | ✅ ok | — | — |
| **B1** Âncora no pulso (lab) | ⚠️ parcial | Média | Adicionar offset no vetor antebraço como no WristTracker |
| **B2** Offset por-produto | ⬜ não existe | Baixa | Campo `wristOffsetRatio` em products.json |
| **C1** Rotação (loja real) | ✅ ok | — | — |
| **C1** Rotação (lab) | ❌ quebrado | Alta | Adicionar `orientation="0deg 0deg -90deg"` no model-viewer do lab |
| **C3** Orientação por-produto | ⬜ não existe | Baixa | Campo `modelOrientation` em products.json |
| **D1** Escala dinâmica com câmera | ✅ ok (ambos) | — | — |
| **D2** Escala por-produto | ⬜ não existe | Média | Campo `sizeMultiplier` em products.json por produto |
| **E1** One Euro Filter (loja) | ✅ ok | — | — |
| **E1** One Euro Filter (lab) | ⚠️ parcial | Média | `beta=0.007` muito baixo; integrar resultado da calibração |
| **E2** Hold last known pose | ✅ ok (ambos) | — | — |
| **E3** Calibração ?auto=1 | ⚠️ parcial | Média | Propagar parâmetros ótimos para WristTracker da loja |
| **F1** Registro model-viewer | ✅ ok (ambos) | — | Unificar sentinel (`data-mv` em todos) |
| **F2** Divergência loja vs lab | ❌ quebrado | Alta | Unificar engine (tasks-vision) e estratégia de posicionamento |
| **F3** Performance / fps | ⚠️ parcial | Média | Throttle RAF para 30fps no lab; trocar setState por refs no loop |
| **G1** Acoplamento a "relógio" | ⚠️ parcial | Baixa | Extrair constantes de produto para arquivo de config; renomear hooks |
| **G2** Dois OneEuroFilter | ⚠️ parcial | Média | Mover `src/tracking/OneEuroFilter.js` para módulo compartilhado |
| **G2** Logs de diagnóstico em produção | ❌ quebrado | Alta | Remover ou colocar sob flag `DEBUG_OVERLAY` |
| **G2** Dois loaders model-viewer | ⚠️ parcial | Baixa | Substituir `useModelViewer()` em App_FINAL pelo `useModelViewerLoader.js` |

---

## As 3 correções de maior impacto para a próxima sessão

Ordenadas por impacto visual imediato:

### 1. Orientação no Lab (C1 — Alta)
Adicionar `orientation="0deg 0deg -90deg"` no `<model-viewer>` do `TasksWristLab.jsx`.  
Isso transforma o relógio de "deitado" para "vestido" — impacto visual imediato nos 15 produtos.

### 2. Produto dinâmico no Lab (A1/A2 — Alta)
Fazer o lab ler `?productId=` da URL → `ProductAdapter.fromParams()` → GLB dinâmico.  
Substituir `const GLB_URL = '/models/CW001.glb'` por resolução dinâmica.  
Isso permite que o lab exiba o produto da loja correto durante um showcase.

### 3. Remover logs de diagnóstico (G2 — Alta antes de qualquer demo)
Remover ou condicionar as 4 linhas `console.log('[M069B DIAG]...')` e as múltiplas `console.log('[M069B AUTO]...')` que ficam expostas no console do cliente/investidor.

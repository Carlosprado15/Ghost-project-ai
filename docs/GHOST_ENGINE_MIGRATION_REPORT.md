# GHOST_ENGINE_MIGRATION_REPORT
Branch: `ghost-engine-v1` | Data: 2026-07-02 | Fases: 4 completas

---

## 1. Estrutura do Engine (`src/engine/`)

```
src/engine/
├── config/
│   └── defaultPreset.json          ← preset produção (minCutoff=1.2 β=0.3 dCutoff=1.0)
├── core/
│   ├── GhostEngine.js              ← API pública (classe JS pura, sem React)
│   ├── anchor/
│   │   └── wristAnchor.js          ← âncora lm0 + 18% offset forearm + atan2(lm5,lm17)
│   ├── filters/
│   │   └── OneEuroFilter.js        ← implementação canônica: OneEuroFilterScalar + Vector3
│   ├── pose/
│   │   └── holdLastPose.js         ← hold 500ms após perda de detecção
│   └── tracking/
│       └── handTracker.js          ← HandLandmarker tasks-vision, GPU→CPU fallback, VIDEO mode
├── react/
│   ├── GhostWristARView.jsx        ← componente standalone (gerencia câmera + GLB)
│   └── useGhostWristAR.js          ← hook React consumindo GhostEngine
└── render/
    └── modelViewerLoader.js        ← ensureModelViewer() puro JS, singleton por página
```

---

## 2. API Pública do Engine

### GhostEngine (JS puro)
```js
const engine = new GhostEngine({
  onPose(frame),       // callback principal: { ts, fps, detected, isTracking, position, rotationZ, scale, raw, filtered }
  onRawFrame(raw),     // opcional: { ts, detected, pos?, rotZ?, scale? } — para calibração offline
  filterPreset?,       // { minCutoff, beta, dCutoff } — usa defaultPreset.json se omitido
  debug?,              // boolean — habilita console.log internos (default false)
});
await engine.init();          // carrega WASM + cria HandLandmarker
engine.startLoop(() => videoEl);  // inicia RAF loop
engine.updateFilterPreset(p); // atualiza filtros sem reiniciar engine
engine.stop();                // para RAF + fecha HandLandmarker
```

### useGhostWristAR (React hook)
```js
const {
  isTracking, position, rotationZ, scale,  // valores filtrados
  raw, filtered,                            // para canvas debug
  fps, ready, error,                        // estado do engine
  mvReady,                                  // model-viewer registrado
  updateFilterPreset,                       // atualiza filtros ao vivo
} = useGhostWristAR({ videoRef, enabled, onRawFrame?, filterPreset?, debug? });
```

### GhostWristARView (componente standalone)
```jsx
<GhostWristARView
  glbUrl="/models/CW001.glb"
  orientation="0deg 0deg -90deg"   // corrige GLB modelado horizontalmente
  scaleMultiplier={4.5}
  arScale={1.0}                     // multiplicador por produto (de products.json)
  filterPreset={null}               // usa defaultPreset
  debug={false}
/>
```

---

## 3. Os 7 Achados da Auditoria — Resolução

| # | Achado | Status | Resolução |
|---|--------|--------|-----------|
| C1 | GLB deitado (sem orientation) | ✅ | `orientation="0deg 0deg -90deg" scale="2 2 2"` padrão em `GhostWristARView.jsx` e `TasksWristLab.jsx` |
| A1 | GLB hardcodado no engine | ✅ | Engine nunca referencia GLB; consumidor sempre passa `glbUrl` |
| F2 | Dois MediaPipe divergentes | ✅ | Engine usa exclusivamente `@mediapipe/tasks-vision`; legacy `@mediapipe/hands` (App_FINAL) intocado |
| G2 | console.log sem flag debug | ✅ | Todos logs em `GhostEngine.js` e `HandTracker.js` condicionados a `debug=false` padrão |
| E1 | filterPreset não configurável | ✅ | `filterPreset` no construtor; `updateFilterPreset()` para updates ao vivo |
| B1 | Âncora no lm0 puro (sem offset) | ✅ | `wristAnchor.js`: offset 18% forearm via `lm0 - forearmDir * fvLen * 0.18` |
| D2 | arScale por produto ausente | ✅ | Campo opcional `arScale` adicionado a `products.json` (CW001=1.0); engine aplica `scale × WRIST_SCALE_MULTIPLIER × arScale` |

---

## 4. O Que Foi Deletado do Lab

| Arquivo removido | Substituído por |
|-----------------|-----------------|
| `src/labs/tasks-wrist/oneEuroFilter.js` | `src/engine/core/filters/OneEuroFilter.js` |
| `src/labs/tasks-wrist/useTasksWristTracking.js` | `src/engine/react/useGhostWristAR.js` |
| `src/labs/tasks-wrist/useModelViewerLoader.js` | `src/engine/render/modelViewerLoader.js` |

**Mantidos no lab** (específicos do fluxo de calibração):
- `filterCalibration.js` — processamento offline de frames (independente do engine)
- `calibrationMetrics.js`, `calibrationPresets.js`, `calibrationRunner.js`
- `reportServer.mjs`, `start-m069b.ps1`, `COMO_RODAR.md`

---

## 5. Fluxo Calibração → Preset → Engine

```
?auto=1 → TasksWristLab detecta mão
       → runAutoSequence() grava frames via onRawFrame (passado ao engine)
       → runCalibration(staticFrames, slowFrames) [offline, filterCalibration.js]
       → applyPreset(best) → updateFilterPreset({ minCutoff, beta, dCutoff })
       → engine._initFilters(preset) reinicializa OneEuroFilterVector3/Scalar sem restart
       → HUD mostra "preset: mc=X β=Y"
```

**Default persistido**: `src/engine/config/defaultPreset.json` contém os parâmetros de produção comprovados pela loja real (positionMinCutoff=1.2, beta=0.3, dCutoff=1.0).

---

## 6. O Que Resta para Migração da Loja (App_FINAL → Engine)

Os seguintes itens NÃO foram alterados nesta missão (fora do escopo):

| Item | Localização atual | Status |
|------|-------------------|--------|
| `WristTracker.js` | `src/tracking/WristTracker.js` | Intocado — usa legacy `@mediapipe/hands` |
| `useModelViewer()` | `App_FINAL.jsx:54-67` | Intocado — usa sentinel `data-mv` |
| Products flow | `ProductAdapter.fromParams()` | Intocado |
| Legacy MediaPipe | `App_FINAL.jsx` `window.Hands` | Intocado — migrar quando loja for atualizada |

**Para migrar a loja**: substituir `WristTracker.js` + `useModelViewer()` em `App_FINAL.jsx` por `useGhostWristAR` do engine. Os parâmetros comprovados já estão em `defaultPreset.json`.

---

## 7. URLs de Teste

| Rota | URL | Comportamento |
|------|-----|---------------|
| Loja padrão | `https://192.168.0.140:5173/` | App_FINAL.jsx — NÃO alterado |
| Lab default | `https://192.168.0.140:5173/?lab=tasks-wrist` | GLB CW001, engine ativo |
| Lab produto | `https://192.168.0.140:5173/?lab=tasks-wrist&productId=CW005` | GLB CW005 dinâmico |
| Lab auto calib | `https://192.168.0.140:5173/?lab=tasks-wrist&auto=1` | Fluxo automático completo |

---

## 8. PROVA DE NÃO-REGRESSÃO

**Build**: ✅ 66 módulos, sem erros, sem warnings de compilação

**Scope check** (`git diff --name-only main...HEAD | grep -v engine | grep -v labs | grep -v tracking-engines | grep -v docs | grep -v vite.config | grep -v package | grep -v RELATORIO | grep -v main.tsx`):
```
src/data/products.json    ← SOMENTE adição de "arScale": 1.0 a CW001
```

**Arquivos PROIBIDOS — confirmação de NÃO toque**:

| Arquivo | Tocado? |
|---------|---------|
| `src/App_FINAL.jsx` | ✅ NÃO |
| `src/data/products.json` | ✅ SOMENTE campo arScale adicionado a CW001 |
| `public/models/` | ✅ NÃO |
| `public/gsdk.js` | ✅ NÃO |
| `src/tracking/WristTracker.js` | ✅ NÃO |

**Rota da loja** (`/` sem parâmetros): continua carregando `App_FINAL.jsx` via `src/main.tsx` (condição `lab === 'tasks-wrist'` não altera o else-branch da loja).

**Commits neste branch**:
```
c27271c M069G: extração GhostEngine — motor AR modular em src/engine/
db07061 M069B-F: lab tasks-wrist scaffolding, M069B fixes e auditoria AR Engine
```

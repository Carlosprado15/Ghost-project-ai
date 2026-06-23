# RELATORIO_MISSAO_019 — Smart Loading

## 1. Arquivos Alterados

| Arquivo | Motivo |
|---|---|
| `src/App_FINAL.jsx` | openScanner, captureAndGenerate, novo useEffect de erro |
| `src/sdk/product-adapter.js` | _generatedModels, cacheGeneratedModel, _lookupModelUrl |

---

## 2. Métodos Alterados

### `src/App_FINAL.jsx`

**`openScanner(productId)` — linha ~290**
- Antes: `hasGeneratedRef.current = false` (sempre permitia o pipeline)
- Depois: verifica `_productForLoad.modelUrl`; se válido, `hasGeneratedRef.current = true` — pipeline bloqueado

**`captureAndGenerate()` — linha ~563**
- Adicionado: `ProductAdapter.cacheGeneratedModel(pid, url)` após persistir asset

**`useEffect` (novo) — após linha 607**
- Adicionado: listener `error` no model-viewer para resetar `hasGeneratedRef.current = false` quando GLB falha (fallback automático ao pipeline)

### `src/sdk/product-adapter.js`

**`_lookupModelUrl(productId)`**
- Adicionado: verifica `_generatedModels[productId]` antes dos dados estáticos

**`cacheGeneratedModel(productId, url)` (novo método)**
- Armazena GLB gerado em `_generatedModels` para próximas execuções na sessão

---

## 3. Fluxo Antigo

```
openScanner()
  └─ hasGeneratedRef = false   ← sempre

trackingActive (1.5s)
  └─ captureAndGenerate()      ← sempre rodava
      └─ pipeline.run()        ← Meshy → Tripo
          └─ setGeneratedModelUrl(url)

model-viewer: generatedModelUrl || modelUrl
```

**Problema**: para CW001-CW015 (que já têm `/models/CWxxx.glb`), o pipeline rodava sem necessidade, gerando delay e exibindo UPLOADING / GENERATING / DOWNLOADING.

---

## 4. Fluxo Novo

```
openScanner(productId)
  ├─ _productForLoad = ProductAdapter.fromParams / getActive()
  └─ hasGeneratedRef = Boolean(modelUrl)   ← TRUE se produto tem GLB

SE hasGeneratedRef = true:
  └─ model-viewer carrega modelUrl imediatamente
  └─ SEM pipeline, SEM indicadores de progresso

SE hasGeneratedRef = false (produto sem modelUrl):
  └─ trackingActive (1.5s)
      └─ captureAndGenerate()   ← pipeline executa normalmente
          └─ Meshy → Tripo
          └─ setGeneratedModelUrl(url)
          └─ ProductAdapter.cacheGeneratedModel(pid, url)

SE GLB falha ao carregar (404 / corrompido / timeout):
  └─ model-viewer dispara evento 'error'
  └─ hasGeneratedRef = false
  └─ pipeline ativa automaticamente na próxima janela de tracking
```

---

## 5. Build

```
✓ built in 15.34s
0 erros | 0 warnings novos
48 módulos transformados
dist/assets/index-qgAES8g8.js  436.45 kB (gzip: 128.81 kB)
```

---

## 6. Observações

- **REGRA 3** satisfeita implicitamente: `pipelineStage` fica `null` quando pipeline não roda → indicador de progresso não é renderizado
- **REGRA 5** cobre apenas a sessão atual (blob URLs não sobrevivem a reloads); para persistência cross-session, o AssetRepository já salva no localStorage
- **REGRA 6**: nenhum componente existente foi alterado — WristTracker, RenderPipeline, PrecisionFit, Screenshot, Share, QR, SDK, Landing, Buy Now intactos
- O cache `_generatedModels` em ProductAdapter é por sessão (memória); limpo automaticamente a cada reload

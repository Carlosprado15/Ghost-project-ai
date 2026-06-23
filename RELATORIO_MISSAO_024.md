# RELATÓRIO MISSÃO 024

## 1. Arquivos modificados

- `src/tracking/WristTracker.js`
- `src/App_FINAL.jsx`

---

## 2. Métodos alterados

- `WristTracker.update()`
- `WristTracker.shouldRender()`
- `App.openScanner()` (remoção de diagnósticos M021)
- `App.captureAndGenerate()` (remoção de diagnósticos M021)
- `App` — effect `trackingActive` (remoção de diagnósticos M021)
- `App` — effect `model-viewer error` (remoção de diagnósticos M021)
- `App` — effect auto-activate store mode
- `App` — render JSX (nova tela 360°, HUD, assinatura)

---

## 3. O que foi alterado

1. **Tracking imediato (causa raiz)**: `WristTracker.update()` agora seta `this.state.isTracking = true` logo após o confidence check passar (confiança >= 0.6), antes de `_updateStability()`. Antes, `isTracking` só era setado dentro de `_updateStability()`, que retornava cedo no primeiro frame (quando `lastValidPose === null`), causando delay de 9 frames (~0.3s).

2. **`shouldRender()` simplificado**: removida exigência de `isStable`. Agora retorna `this.state.isTracking` apenas. O relógio aparece no mesmo frame em que o pulso é detectado.

3. **Fluxo 360° antes do AR**: auto-activate em store mode chama `setShow360(true)` em vez de `openScanner()`. Nova tela 360° renderiza `Hero3D` com o GLB do produto, botão `VER EM AR` (vai para o scanner) e botão `COMPRAR AGORA` (vai direto ao carrinho).

4. **Embedded experience**: botão `← Voltar` oculto em store mode (condição `!ProductAdapter.isStoreMode() || cameFromTestModels`). Assinatura `Powered by Ghost Project AI` vira watermark não-interativo em store mode (sem `onClick`, sem `cursor: pointer`, `opacity: 0.4`).

5. **Remoção de diagnósticos M021**: removidos ~60 linhas de `console.group/log/warn` em 4 locais. Sem overhead em produção.

6. **Pipeline AI bloqueado para Click & Wear**: guards `hasGeneratedRef` e `_guardProd.modelUrl` mantidos e agora sem dead code ao redor. Com a tela 360° no fluxo, o scanner AR só abre após o usuário escolher "VER EM AR", garantindo que o produto com GLB já tenha `hasGeneratedRef = true`.

---

## 4. Build

```
✓ 46 modules transformed.
dist/index.html      0.83 kB │ gzip:   0.44 kB
dist/assets/*.css   26.54 kB │ gzip:   5.42 kB
dist/assets/*.js   436.44 kB │ gzip: 128.30 kB
✓ built in 16.62s (local) / 811ms (Vercel cache)
```

Sem erros. Sem warnings críticos.

Deploy: `https://ghost-project-ai.vercel.app`

---

## 5. Pendências

1. Verificar em dispositivo real se o relógio aparece ao primeiro frame de detecção (sem delay visível).
2. A tela 360° mostra `productName` apenas se o campo vier via URL param (`?productName=...`). Fluxo ClickWear não passa o nome — avaliar se é necessário exibir.
3. Transição animada entre 360° → AR (fade) não implementada (fora do escopo desta missão).

---

## 6. Próxima missão sugerida

**M025 — Tela de produto integrada / product card**
Adicionar imagem e nome do produto na tela 360°, lidos do `products.json` pelo `productId`.

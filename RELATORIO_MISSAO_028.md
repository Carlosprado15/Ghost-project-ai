# RELATÓRIO MISSÃO 028

## 1. Arquivos modificados

- `src/App_FINAL.jsx`

---

## 2. Métodos alterados

- `useEffect` de storeMode (linha 248) — lógica de roteamento por `embedded`
- `<model-viewer>` do scanner — remoção do atributo `camera-controls="false"`

---

## 3. O que foi alterado

**BUG 1 — `embedded=true` ignorado (causa raiz do bloqueio):**

O useEffect de storeMode sempre chamava `setShow360(true)` independente do parâmetro `embedded`. Com `?productId=CW005&embedded=true`, a tela 360° era exibida obrigatoriamente — o fluxo AR (etapas 4–7) só executava após o usuário clicar "VER EM AR". O parâmetro `embedded=true` indica que a experiência é embutida na loja e deve ir direto ao scanner.

Correção: quando `embedded=true` está na URL E `isStoreMode()` é verdadeiro, `openScanner(productId)` é chamado diretamente. O fluxo sem `embedded` (tela 360°) permanece inalterado.

```js
// ANTES
useEffect(() => {
    if (ProductAdapter.isStoreMode()) {
        setShow360(true);
    }
}, []);

// DEPOIS
useEffect(() => {
    if (ProductAdapter.isStoreMode()) {
        const params = new URLSearchParams(window.location.search);
        if (params.get('embedded') === 'true') {
            openScanner(ProductAdapter.getActive().productId);
        } else {
            setShow360(true);
        }
    }
}, []);
```

**BUG 2 — `camera-controls="false"` habilitava controles em vez de desabilitar:**

Em model-viewer, atributos boolean funcionam por presença/ausência no DOM (`hasAttribute()`). A string `"false"` não desabilita o atributo — ela o mantém presente, o que HABILITA os controles de câmera. O correto para desabilitar é omitir o atributo completamente.

Correção: linha `camera-controls="false"` removida do model-viewer do scanner.

---

## 4. Build

```
✓ 47 modules transformed
dist/assets/index-2dUL4oaY.js  440.82 kB │ gzip: 129.69 kB
✓ built in 15.64s
0 erros | 0 warnings
```

---

## 5. Pendências

1. Confirmar em Android físico se o relógio aparece no pulso com `?productId=CW005&embedded=true` (sem clicar "VER EM AR").
2. Validar se `orientation="0deg 0deg -90deg"` está correto para o GLB do CW005 — pode precisar de ajuste fino por modelo.

---

## 6. Próxima missão sugerida

**M029 — Validação AR em dispositivo físico**
Confirmar que o relógio CW005 aparece sobre o pulso com `embedded=true`, ajustar `orientation` se necessário, e validar os demais produtos do catálogo.

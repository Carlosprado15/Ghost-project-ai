# RELATORIO_MISSAO_038 — SDK como Única Fonte da Verdade

**Status:** Auditoria completa — edição manual obrigatória no Shopify Admin  
**Data:** 2026-06-22

---

## 1. Arquivos modificados (locais)

Nenhum arquivo local foi modificado. O `gsdk.js` e `layout/theme.liquid` já estão corretos.

**Arquivo que requer edição manual (Shopify Admin):**
- `sections/product-information.liquid` — tema Horizon (MAIN)

---

## 2. Métodos alterados

- Nenhum método alterado (SDK já implementa toda a lógica corretamente)

---

## 3. O que foi auditado e o que precisa ser feito

### FASE 1 — Resultado da Auditoria

| Arquivo | Estado | Ação |
|---------|--------|------|
| `layout/theme.liquid` | ✅ 1 include correto: `ghost-project-ai.vercel.app/gsdk.js` | Nenhuma |
| `sections/product-information.liquid` | ❌ Botão manual com URL `-bbvc` (errada) + metafield vazio | Remover bloco |
| Snippets Ghost (`snippets/ghost-*.liquid`) | ✅ Nenhum existe | Nenhuma |
| `public/gsdk.js` | ✅ PRODUCT_MAP completo, injeção correta | Nenhuma |
| `vercel.json` | ✅ CORS configurado para `/gsdk.js` | Nenhuma |

### FASE 2 — Bloqueio de API

A Shopify Admin API bloqueia escrita (`themeFilesUpsert`) em temas publicados (MAIN). O tema Horizon é o tema ativo — edição deve ser feita diretamente no Shopify Admin → Online Store → Themes → Edit code.

### FASE 2 — Edição manual obrigatória

**Onde editar:**  
`Shopify Admin → Online Store → Themes → Horizon → Edit code → sections/product-information.liquid`

**Localizar este bloco** (dentro de `{% capture details %}`, após o `{% content_for 'block' %}`):

```liquid
      
      {% comment %} GHOST PROJECT AI — BOTÃO DE REALIDADE AUMENTADA {% endcomment %}
      <div class="ghost-ar-container">
        <a
          href="https://ghost-project-ai-bbvc.vercel.app/?productId={{ closest.product.metafields.custom.ghost_id }}"
          target="_blank"
          class="ghost-ar-button"
        >
          👁 Ver em AR — Experimente no Pulso
        </a>
      </div>
```

**Apagar o bloco inteiro.** O `{% endcapture %}` deve ficar imediatamente após o `{% content_for %}`.

**Resultado esperado após remoção:**

```liquid
    {% capture details %}
      {% content_for 'block',
        type: '_product-details',
        id: 'product-details',
        closest.product: closest.product
      %}
    {% endcapture %}
```

**CSS órfão a remover do `{% stylesheet %}`** (opcional — não causa erro, mas é código morto):

```css
  .ghost-ar-container {
    width: 100%;
    margin: 20px 0;
    padding: 0;
  }

  .ghost-ar-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 14px;
    background: #000000;
    color: #ffffff;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 600;
    text-decoration: none;
    letter-spacing: 0.05em;
    z-index: 999;
    position: relative;
  }
```

E dentro de `@media screen and (max-width: 749px)`:

```css
    .ghost-ar-container {
      grid-column: 2 / 3;
    }
```

### FASE 3 — SDK validado

`layout/theme.liquid` já possui exatamente **1 include** do SDK:

```html
<script src="https://ghost-project-ai.vercel.app/gsdk.js" defer></script>
```

URL correta. Sem duplicidade.

### FASE 4 — Responsabilidades do SDK após a mudança

O `gsdk.js` (SAAPS Foundation 1.0 - Build 4) já executa sozinho:

1. **Detecta handle**: via `window.__ghostHandle` (Liquid) ou `window.location.pathname`
2. **Resolve productId**: via `PRODUCT_MAP` interno (15 produtos mapeados)
3. **Cria badge** `.ghost-badge` com ícone + "Ghost Spatial Preview™"
4. **Cria botão** `.ghost-ar-btn` com URL montada dinamicamente:
   - Mobile: `?productId=X&productUrl=...&cartUrl=...&embedded=true`
   - Desktop: `?productId=X&...&desktop=1` (vai direto ao QR)
5. **Cria rodapé** `.ghost-powered` "Powered by Ghost Project AI"
6. **Injeta tudo** antes do `form[action="/cart/add"]`
7. **Remove duplicatas** a cada ciclo via `setInterval(init, 800)`

Nenhum arquivo Liquid monta URL. Nenhum metafield necessário.

---

## 4. Build

```
✓ 46 modules transformed
dist/index.html                   0.83 kB
dist/assets/index-Cf-V5ABJ.css   26.54 kB
dist/assets/index-B6tHK-jm.js   440.71 kB
✓ built in 16.64s
```

Sem erros. Sem warnings críticos.

---

## 5. Pendências

1. **Edição manual no Shopify Admin** — remover o bloco `ghost-ar-container` de `sections/product-information.liquid` (API bloqueia escrita no tema MAIN)
2. **Verificar em produto real** após edição — confirmar que apenas 1 botão aparece (criado pelo SDK)
3. **Remover CSS órfão** `.ghost-ar-container` e `.ghost-ar-button` do `{% stylesheet %}` (cosmético)

---

## 6. Próxima missão sugerida

**MISSÃO 039 — Validação Plug-and-Play em loja parceira**  
Testar instalação do Ghost Project em uma segunda loja Shopify inserindo apenas `<script src="https://ghost-project-ai.vercel.app/gsdk.js" defer></script>` no `theme.liquid`, sem nenhuma edição Liquid adicional.

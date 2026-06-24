# RELATORIO_MISSAO_044 — Auditoria Forense do Fluxo productId

## 1. Arquivos Modificados

- `public/gsdk.js`
- `src/App_FINAL.jsx`
- `src/sdk/product-adapter.js`

## 2. Métodos Alterados

- `getProductId()` — Etapa 1: log de handle e productId
- `injectARButton()` — Etapa 2: log de arUrl construída
- `useEffect` (params URL) — Etapa 3: log de productId recebido no App
- `openScanner()` — Etapa 4: log de productId recebido
- `_lookupModelUrl()` — Etapa 5: log de resolução productId → modelUrl
- `useEffect` (generatedModelUrl) — Etapa 6: log do src final no model-viewer

## 3. O Que Foi Alterado

- Adicionados 6 logs temporários `[M043][EtapaX-...]` nos pontos de passagem do productId
- Análise forense completa por inspeção estática + API Shopify

**VEREDICTO:**
> **Não existe troca de produto no fluxo gsdk.js → App_FINAL → ProductAdapter → model-viewer.**
> O problema está na Etapa 1 (Shopify): botão Liquid legado com domínio morto e metafield vazio.

### Tabela de Auditoria (análise estática — gsdk.js button)

| Produto | Etapa 1 handle→ID | Etapa 2 arUrl | Etapa 3 App | Etapa 4 openScanner | Etapa 5 modelUrl | Etapa 6 generatedModelUrl | Divergência |
|---------|--------------------|---------------|-------------|---------------------|------------------|---------------------------|-------------|
| CW001 | `relogio-casio-...a-pr` → CW001 | `/?productId=CW001&embedded=true` | CW001 | CW001 | `/models/CW001.glb?v029` | `/models/CW001.glb?v029` | **NÃO** |
| CW002 | `nidin-moda-...crist` → CW002 | `/?productId=CW002&embedded=true` | CW002 | CW002 | `/models/CW002.glb?v029` | `/models/CW002.glb?v029` | **NÃO** |
| CW005 | `pulseira-...original` → CW005 | `/?productId=CW005&embedded=true` | CW005 | CW005 | `/models/CW005.glb?v029` | `/models/CW005.glb?v029` | **NÃO** |
| CW010 | `novo-relogio-...livre` → CW010 | `/?productId=CW010&embedded=true` | CW010 | CW010 | `/models/CW010.glb?v029` | `/models/CW010.glb?v029` | **NÃO** |
| CW015 | `relogio-masculino-...re` → CW015 | `/?productId=CW015&embedded=true` | CW015 | CW015 | `/models/CW015.glb?v029` | `/models/CW015.glb?v029` | **NÃO** |

### Causa Raiz Identificada — Etapa 1 (Shopify)

**Arquivo:** `sections/product-information.liquid` (tema Horizon, Click & Wear)

**Problema:** botão AR legado ainda presente no Liquid:
```liquid
<div class="ghost-ar-container">
  <a href="https://ghost-project-ai-bbvc.vercel.app/?productId={{ closest.product.metafields.custom.ghost_id }}"
     target="_blank" class="ghost-ar-button">
    👁 Ver em AR — Experimente no Pulso
  </a>
</div>
```

**Dois bugs confirmados via API Shopify:**
1. Domínio `ghost-project-ai-bbvc.vercel.app` — não existe (confirmado M036)
2. `metafields.custom.ghost_id` — vazio para TODOS os 15 produtos (confirmado via GraphQL query)

**Resultado:** URL gerada = `https://ghost-project-ai-bbvc.vercel.app/?productId=` (domínio morto + productId vazio)

**Mitigação atual:** `gsdk.js` injeta CSS `.ghost-ar-container{display:none!important}` sincronamente ao carregar, ocultando o botão legado. Risco residual: race condition se o usuário clicar antes do script carregar.

### Correção Mínima (ação manual no Shopify Admin)

Remover o bloco abaixo de `sections/product-information.liquid`:

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

**Caminho no Shopify Admin:** Online Store → Themes → Horizon → Edit code → `sections/product-information.liquid`

**Nota:** A API Shopify bloqueia escrita no tema MAIN (ativo). Edição manual obrigatória.

## 4. Build

```
vite build — ✓ built in 16.93s
dist/assets/index-iS41TSNe.js  441.14 kB │ gzip: 129.80 kB
Sem erros. Sem warnings críticos.
```

Deploy Vercel M043: `dpl_DpFuo8SxMx2M3SFdNxEdfWJrEYmT` — estado: **READY**
Commit: `01da315` — `audit: M043 — instrumentação forense do fluxo productId (6 etapas)`

## 5. Pendências

1. **[BLOQUEANTE — Manual]** Remover botão Liquid legado de `sections/product-information.liquid` no Shopify Admin (API bloqueia escrita no tema ativo)
2. **[Opcional]** Remover CSS morto `.ghost-ar-container` e `.ghost-ar-button` do `{% stylesheet %}` do mesmo arquivo
3. **[Pós-fix]** Remover os 6 logs `[M043]` temporários dos 3 arquivos modificados (após validação)
4. **[Opcional]** Configurar `window.__ghostHandle` em `theme.liquid` para eliminar dependência de regex de URL no `getProductHandle()`

## 6. Próxima Missão Sugerida

**M045 — Limpeza pós-auditoria:** remover os 6 logs `[M043]` temporários e confirmar que o botão legado foi removido do Shopify.

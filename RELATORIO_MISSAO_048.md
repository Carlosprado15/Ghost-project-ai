# RELATÓRIO MISSÃO 048 — 360° Real na Vitrine (Modal Interativo)

## 1. Arquivos Modificados

Todos os arquivos pertencem **exclusivamente** ao tema Shopify "Cópia de Horizon" (ID: `161916649690`). Zero alterações no Ghost Project.

| Arquivo | Ação | Tamanho |
|---|---|---|
| `assets/ghost-360-modal.js` | **Novo** — lógica do modal + PRODUCT_MAP | ~2,1 KB |
| `snippets/cw-360-modal.liquid` | **Novo** — HTML do modal + script tag | ~700 B |
| `assets/ghost-premium.css` | **Atualizado** — estilos do modal + badge interativo | +80 linhas |
| `snippets/product-card.liquid` | **Atualizado** — `<span>` → `<button>` com `data-cw-handle` | delta cirúrgico |
| `layout/theme.liquid` | **Atualizado** — `{% render 'cw-360-modal' %}` antes de `</body>` | +3 linhas |

---

## 2. Métodos Criados

### `ghost-360-modal.js`

| Função | Responsabilidade |
|---|---|
| `loadMV(cb)` | Carrega `model-viewer.min.js` sob demanda (lazy). Usa callback queue para serializar chamadas simultâneas. Se já carregado, chama `cb()` imediatamente. |
| `openModal(code)` | Recebe o código CW (`CW001`–`CW015`), aciona `loadMV`, define `src` do viewer e abre o modal com animação. |
| `closeModal()` | Remove classe de animação, restaura scroll, aguarda 260ms para esconder o modal e limpar o `src` (libera memória). |
| `init()` | Wires backdrop, botão X, Escape key e click delegation (capture phase). |

---

## 3. Como Cada Card Identifica Seu GLB

**Passo 1 — Server-side (Liquid):**
```liquid
<button
  type="button"
  class="cw-360-hint"
  data-cw-handle="{{ product.handle }}"
>
```
O `product.handle` do Shopify é injetado diretamente no DOM.

**Passo 2 — Client-side (JavaScript):**
```javascript
// ghost-360-modal.js intercepta o click:
var code = PRODUCT_MAP[btn.getAttribute('data-cw-handle')];
// Ex: 'relogio-casio-para-neutro-...' → 'CW001'

// URL final:
'https://ghost-project-ai.vercel.app/models/' + code + '.glb'
// → https://ghost-project-ai.vercel.app/models/CW001.glb
```

O `PRODUCT_MAP` em `ghost-360-modal.js` é uma cópia exata do mapa em `gsdk.js` — 15 entradas, handle → código CW.

---

## 4. Como o Modal Funciona

### Abertura
1. Usuário toca/clica no badge `360°` de um card
2. Listener em capture phase (`document.addEventListener('click', fn, true)`) intercepta o evento
3. `e.preventDefault()` + `e.stopPropagation()` bloqueiam navegação para o produto
4. `loadMV()` verifica se `model-viewer` já está registrado:
   - **Na página do produto:** já pré-carregado no `<head>` — abre instantaneamente
   - **Na vitrine/home:** carrega o script (~150 KB) uma única vez, depois mantém em memória
5. `viewer.setAttribute('src', URL_do_GLB)` dispara download apenas do GLB clicado
6. Modal aparece com fade + scale (`cubic-bezier(0.34,1.56,0.64,1)`) em ~220ms

### Interação
- **Rotação:** arrastar com dedo (mobile) ou mouse (desktop)
- **Zoom:** pinça (mobile) ou scroll (desktop)
- **Auto-rotate:** 28°/s, para ao interagir, retoma depois
- **AR desativado:** atributo `ar` ausente no `<model-viewer>` — botão AR não aparece

### Fechamento
- Toque fora do painel (backdrop)
- Botão X no header
- Tecla `Escape`
- Após fechar: scroll da página restaurado, `src` removido (GLB liberado da memória)

---

## 5. Como Foi Evitada Duplicação de Código

| Decisão | Justificativa |
|---|---|
| `ghost-360-modal.js` como asset separado | Carregado uma vez, reutilizado para todos os 15 cards |
| `<model-viewer id="cw-360-viewer">` único no DOM | Um único elemento compartilhado — `src` é trocado a cada abertura |
| `loadMV()` com callback queue | Evita criar múltiplos `<script>` de model-viewer se o usuário clicar em 2 cards rapidamente |
| `{% render 'cw-360-modal' %}` em `theme.liquid` | Modal renderizado uma vez por página, independente de quantos cards existem |
| `window.__cw360 = true` (já existia) | Script de posicionamento do badge executado uma única vez mesmo com múltiplos cards |
| Reuso de `model-viewer.min.js` já existente | Em páginas de produto, o script já está pré-carregado — `customElements.get('model-viewer')` retorna truthy e `loadMV` não cria um segundo script |

---

## 6. Confirmação — Ghost Project Intacto

Nenhum dos seguintes arquivos foi tocado:

| Arquivo | Status |
|---|---|
| `public/gsdk.js` | ✅ Não tocado |
| `src/App_FINAL.jsx` | ✅ Não tocado |
| `src/App.css` | ✅ Não tocado |
| `src/components/Hero3D.css` | ✅ Não tocado |
| `src/data/products.json` | ✅ Não tocado |
| `public/models/*.glb` | ✅ Não tocados |
| Pipeline AR (WristTracker, RenderPipeline, etc.) | ✅ Não tocada |
| Fluxo Click & Wear | ✅ Não interferido |
| Botão "Ver em Realidade Aumentada" | ✅ Não interferido |

---

## 7. Preview

```
https://hgqvif-ne.myshopify.com/?preview_theme_id=161916649690
```

Para publicar: Shopify Admin → Online Store → Themes → "Cópia de Horizon" → **Publish**.

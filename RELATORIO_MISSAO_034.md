# RELATÓRIO MISSÃO 034 — ENCONTRAR O BOTÃO REAL "VER EM AR"

**Data:** 2026-06-21
**Status:** DIAGNÓSTICO CONCLUÍDO — CORREÇÃO MANUAL PENDENTE

---

## 1. DELTA TÉCNICO

### Problema raiz

`sections/product-information.liquid` no tema Shopify **Horizon** (publicado) continha:

```liquid
href="https://ghost-project-ai-bbvc.vercel.app/?productId={{ closest.product.metafields.custom.ghost_id }}"
```

Dois bugs simultâneos:
- **URL inexistente**: `ghost-project-ai-bbvc.vercel.app` não existe no Vercel. O domínio correto é `ghost-project-ai.vercel.app`
- **Metafield vazio**: `closest.product.metafields.custom.ghost_id` não está configurado em nenhum produto da loja → resulta em `?productId=` (string vazia)

### Por que a M033 não teve efeito

A M033 corrigiu `ghost-ar-button-shopify.html` — arquivo que existe apenas no repositório Ghost Project AI local e **nunca foi instalado no tema Shopify**. O tema usa `sections/product-information.liquid` diretamente, editado manualmente no Shopify Admin em alguma missão anterior.

---

## 2. ARQUIVOS ENVOLVIDOS

| Arquivo | Localização | Status |
|---|---|---|
| `sections/product-information.liquid` | Tema Shopify "Horizon" (publicado) | **ARQUIVO REAL** — contém o bug |
| `ghost-ar-button-shopify.html` | Repositório Ghost Project AI | Template local, **não usado pela loja** |

---

## 3. AUDITORIA DO TEMA

- **Tema publicado:** Horizon (`gid://shopify/OnlineStoreTheme/156625699034`)
- **Único tema na loja** — sem tema de rascunho
- **Arquivo que renderiza a página de produto:** `sections/product-information.liquid` (referenciado em `templates/product.json` via `"type": "product-information"`)
- Nenhum snippet `ghost-ar-button.liquid` ou similar existe no tema

---

## 4. CORREÇÃO NECESSÁRIA

**Localização no arquivo:** bloco `{% capture details %}` em `sections/product-information.liquid`

**Substituir:**
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

**Por:**
```liquid
{% comment %} GHOST PROJECT AI — BOTÃO DE REALIDADE AUMENTADA {% endcomment %}
{% assign ghost_base_url = "https://ghost-project-ai.vercel.app" %}
{% assign ghost_product_id = "" %}
{% case closest.product.handle %}
  {% when "relogio-casio-para-neutro-2023-novos-estilos-definir-marca-superior-de-luxo-a-pr" %}{% assign ghost_product_id = "CW001" %}
  {% when "nidin-moda-banhado-a-ouro-corrente-mistura-pulseira-para-mulheres-colorido-crist" %}{% assign ghost_product_id = "CW002" %}
  {% when "vinterly-pulseiras-magneticas-de-cobre-puro-para-mulheres-joias-de-terapia-vint" %}{% assign ghost_product_id = "CW003" %}
  {% when "pulseiras-de-cobre-puro-vinterly-estilo-viking-yggdrasil-15mm-ajustaveis-joi" %}{% assign ghost_product_id = "CW004" %}
  {% when "pulseira-magnetico-bioquantico-de-equilibrio-original" %}{% assign ghost_product_id = "CW005" %}
  {% when "bluetooth-conectado-telefone-relogio-inteligente-das-mulheres-dos-homens-musica" %}{% assign ghost_product_id = "CW006" %}
  {% when "amoled-relogio-inteligente-banda-smartwatch-feminino-masculino-frequencia-cardia" %}{% assign ghost_product_id = "CW007" %}
  {% when "curren-relogio-de-ouro-feminino-relogios-senhoras-criativo-aco-pulseira-relogios" %}{% assign ghost_product_id = "CW008" %}
  {% when "diamante-relogio-feminino-marca-de-luxo-2025-strass-elegante-senhoras-relogios-r" %}{% assign ghost_product_id = "CW009" %}
  {% when "novo-relogio-inteligente-masculino-de-2-01-polegadas-para-atividades-ao-ar-livre" %}{% assign ghost_product_id = "CW010" %}
  {% when "gps-ecg-ppg-bluetooth-chamada-smartwatch-pulseira-esportiva-relogio-inteligent" %}{% assign ghost_product_id = "CW011" %}
  {% when "curren-relogios-masculinos-marca-superior-de-luxo-moda-amp-casual-negocios-rel" %}{% assign ghost_product_id = "CW012" %}
  {% when "reloj-hombre-2023-relogio-masculino-minimalista-ultra-fino-relogios-moda-masculi" %}{% assign ghost_product_id = "CW013" %}
  {% when "curren-relogio-de-pulso-masculino-cronografo-a-prova-d-39-agua-militar-do-exe" %}{% assign ghost_product_id = "CW014" %}
  {% when "relogio-masculino-2023-moda-masculino-relogios-de-luxo-aco-inoxidavel-quartzo-re" %}{% assign ghost_product_id = "CW015" %}
{% endcase %}
{% if ghost_product_id != "" %}
<div class="ghost-ar-container">
  <a
    href="{{ ghost_base_url }}?productId={{ ghost_product_id }}&embedded=true"
    target="_blank"
    class="ghost-ar-button"
  >
    👁 Ver em AR — Experimente no Pulso
  </a>
</div>
{% endif %}
```

---

## 5. BLOQUEIO TÉCNICO

A API Shopify MCP bloqueia escrita em tema publicado (`themeFilesUpsert` bloqueado pela política `live_theme`). A correção deve ser aplicada manualmente no Shopify Admin:

**Caminho:** Online Store → Themes → Horizon → Edit code → sections/product-information.liquid

---

## 6. RESULTADO ESPERADO APÓS CORREÇÃO

URL gerada para produto CW001:
```
https://ghost-project-ai.vercel.app?productId=CW001&embedded=true
```

Produtos sem mapeamento (fora de CW001–CW015): botão não aparece (`{% if ghost_product_id != "" %}`).

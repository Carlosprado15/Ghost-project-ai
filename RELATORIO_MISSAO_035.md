# RELATORIO_MISSAO_035 — Auditoria do Estado Atual

## 1. Arquivos modificados
Nenhum. Missão de leitura apenas.

## 2. Métodos alterados
Nenhum.

## 3. O que foi auditado

- Branch: `main`, sincronizado com origin
- Último commit: `8a6fb1f` — M033
- Working tree limpo (nenhum arquivo rastreado modificado)
- 11 relatórios `.md` untracked (M019–M034)
- Missões M028–M033 confirmadas no código
- Sem fallback CW001 no fluxo principal ✅
- `embedded=true` → scanner direto (mobile) ou QR (desktop) ✅
- `productId` resolvido via URL → `products.json` → GLB com cache-bust `v029`

## 4. Build
Não executado (fora do escopo da missão).

## 5. Pendências

1. **DIVERGÊNCIA DE URL CRÍTICA**: `ghost-ar-button-shopify.html` aponta para `ghost-project-ai-bbvc.vercel.app`; `gsdk.js` aponta para `ghost-project-ai.vercel.app` — uma está errada
2. **Tela 360°** nunca exibida no fluxo real da loja (`embedded=true` bypassa sempre)
3. **Universal Product Resolver** não iniciado

## 6. Próxima missão sugerida

**M036 — Padronizar URL Vercel**: corrigir divergência entre `ghost-ar-button-shopify.html` e `gsdk.js` para apontar para a mesma URL ativa.

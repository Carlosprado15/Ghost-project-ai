# STATUS ATUAL — GHOST PROJECT AI
Última atualização: 2026-06-30

---

## 1. ESTADO PROTEGIDO (tags git)

| Tag | Descrição |
|---|---|
| `M055B-360-PRODUCT-ROUTING-OK` | 360° abre produto correto nas 15 páginas de produto da Click & Wear |
| `M056G-AR-EMBEDDED-ROUTING-OK` | AR embedded abre produto correto (15/15), URL da loja não muda, overlay fecha |
| `M057A-FIT-DEBUG-SAFE` | Modo fitDebug criado: parâmetros de calibração via URL, produção inalterada |

---

## 2. COMMITS AINDA NÃO TAGUEADOS

| Commit | Hash | Missão | Descrição |
|---|---|---|---|
| M057B | `ad09279` | flipX seguro | `fitDebug=1&flipX=1` inverte eixo X para câmera traseira |
| M057C | `2933739` | debug visual do pulso | Overlay SVG com wrist, palmCenter, anchor, render, painel de texto |
| M057D | `e83c0f6` | offsetDirection=forearm | `fitDebug=1&offsetDirection=forearm` inverte direção do offset anatômico |
| M057E | `497a4d8` | embedded direto no scanner | `mode=embedded` + `productId` abre scanner sem passar pela home |

Estes commits estão em `main` e publicados no Vercel, mas aguardam validação no celular antes da tag.

---

## 3. O QUE JÁ ESTÁ RESOLVIDO

- **360° → produto correto:** 15/15 páginas de produto abrem o modelo GLB correto no modal 360°
- **AR embedded → produto correto:** 15/15 produtos abrem AR com `productId` certo no iframe
- **Click & Wear permanece visualmente na loja:** overlay fullscreen dentro da página Shopify, sem navegar para fora
- **Modo fitDebug criado:** parâmetros `offsetRatio`, `sizeMultiplier`, `rotationOffset`, `minSize`, `maxSize`, `deadZonePosition`, `deadZoneRotation`, `flipX`, `offsetDirection` — todos só ativam com `fitDebug=1`
- **Debug visual criado:** `showTrackingDebug=1` mostra wrist (azul), palm (verde), vetor antebraço (amarelo), anchor pré-smoothing (vermelho), render center (branco) e painel de texto com todos os parâmetros
- **Embedded abre direto no scanner:** quando `mode=embedded` + `productId` válido, a home screen não é exibida e o scanner abre via useEffect sem flash

---

## 4. O QUE AINDA PRECISA DE TESTE REAL NO CELULAR

| Item | Prioridade | Observação |
|---|---|---|
| M057E: embedded abre direto no scanner | Alta | Primeiro teste a fazer |
| M057D: `offsetDirection=forearm` corrige posição do anchor | Alta | Anchor ia para lado da mão; agora vai para lado do antebraço |
| Encontrar melhor combinação de parâmetros de pulso | Alta | offsetRatio, sizeMultiplier, rotationOffset a calibrar |
| Demora do relógio aparecer | Média | Bottleneck: MediaPipe WASM (~2–6s 1ª carga) + GLB download |
| Rotação final do relógio no pulso | Alta | `rotationOffset=0` ou outro valor para GLB do CW001 |
| Tamanho final do relógio | Média | `sizeMultiplier` a calibrar com base em feedback visual |

---

## 5. REGRAS DO PROJETO

- **Ghost Project e Click & Wear são sistemas separados.** Não misturar arquitetura.
- **Ghost Project** = motor universal de AR/3D para e-commerces. Agnóstico de plataforma.
- **Click & Wear** = loja real, laboratório e vitrine para investidores. Ambiente Shopify atual.
- **Shopify não é o destino final** do Ghost Project — é o ambiente da Click & Wear apenas.
- **Ghost Project deve ser white-label/fantasma** nas lojas parceiras: sem branding visível ao consumidor final quando em `mode=embedded`.
- **Não quebrar o que já funciona.** Toda mudança em tracking, routing ou deploy deve ser precedida de diagnóstico e protegida com guard (`fitDebug=1`).
- **Toda etapa validada deve ser protegida com tag git** antes de avançar para a próxima.
- **Deploy obrigatório após cada missão:** push para main → Vercel publica automaticamente.
- **`public/gsdk.js` é o arquivo correto** para editar o SDK da loja. `dist/` é sobrescrito pelo Vite.

---

## 6. PRÓXIMA ORDEM CORRETA

1. **Validar M057E no celular:** abrir URL embedded com `productId=CW001` e confirmar que o scanner abre direto, sem home screen.
2. **Validar M057D no celular:** comparar posição do anchor com e sem `offsetDirection=forearm` usando o debug visual.
3. **Calibrar parâmetros do pulso** com base no vídeo real: `rotationOffset`, `offsetRatio`, `sizeMultiplier`.
4. **Validar rotação do relógio:** testar `rotationOffset=0`, `45`, `90`, `-45` para achar a posição correta para o GLB do CW001.
5. **Reduzir demora do relógio** (investigação futura): avaliar preload do MediaPipe WASM antes de abrir o scanner.
6. **Criar tag de proteção** somente após validação completa do ajuste no pulso (M057B–E em conjunto).

---

## 7. URLS DE REFERÊNCIA

```
# Embedded com debug visual completo (calibração)
https://ghost-project-ai.vercel.app/?productId=CW001&mode=embedded&host=clickwear&fitDebug=1&flipX=1&rotationOffset=0&offsetRatio=0.18&sizeMultiplier=1.25&offsetDirection=forearm&showTrackingDebug=1

# Embedded limpo (teste M057E — sem debug)
https://ghost-project-ai.vercel.app/?productId=CW001&mode=embedded&host=clickwear&embedded=true

# Standalone (produção normal)
https://ghost-project-ai.vercel.app/
```

---

## 8. AMBIENTE

| Item | Valor |
|---|---|
| Repositório | `github.com/Carlosprado15/Ghost-project-ai` |
| Branch principal | `main` |
| Deploy | Vercel (automático no push para main) |
| Loja Click & Wear | `hgqvif-ne.myshopify.com` |
| Tema draft (testes) | ID `161916649690` — "Cópia de Horizon" |
| Tema live (não tocar) | ID `156625699034` — "Horizon" |
| gsdk.js (fonte) | `public/gsdk.js` → servido pelo Vercel |
| Senha da loja | [CREDENCIAL REMOVIDA — NÃO REGISTRAR SENHAS NO REPOSITÓRIO] |

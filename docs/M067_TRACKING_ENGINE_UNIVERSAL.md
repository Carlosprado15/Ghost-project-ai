# M067 — Tracking Engine Universal do Ghost Project

---

## 1. Decisão Principal

O tracking de pulso entra em **pausa técnica** após os seguintes resultados:

| Missão | Engine | Resultado |
|---|---|---|
| M051–M058 | MediaPipe Hands | Múltiplas iterações — tracking instável, reprovado no celular |
| M063–M066 | WebAR.rocks.hand (NN_WRISTBACK_45) | 0% taxa de detecção, 45 frames, câmera traseira — REPROVADO |

A decisão não é abandonar o AR de pulso — é **não continuar corrigindo engines que não têm baseline para produção**.

O próximo passo técnico correto é avaliar engines com arquitetura industrial (DeepAR, Perfect Corp, Banuba, MIRRAR) via POC isolada, sem tocar no core do app.

---

## 2. O Que Fica Protegido

Os arquivos abaixo **não foram tocados** nesta missão e não devem ser alterados sem Codex audit:

- `src/App_FINAL.jsx` — scanner principal, lógica de AR embedded, 360°
- `src/main.tsx` — roteamento da aplicação
- `src/ProductAdapter` — adapter de produto (Shopify → Ghost)
- `src/data/products.json` — catálogo dos 15 produtos Click & Wear
- `shopify/` — tema e snippets Shopify da Click & Wear
- `public/models/` — modelos GLB dos produtos
- `public/gsdk.js` — SDK Ghost embeddable
- `src/tracking/WristTracker.js` — MediaPipe legacy (manter como referência)
- Labs existentes (`?lab=webarrocks`, `?lab=replay`) — não remover

---

## 3. Por Que MediaPipe e WebAR.rocks Não São Mais Solução Principal

**MediaPipe Hands:**
- Projetado para reconhecimento de gestos (hand sign detection), não para try-on de produto.
- Landmark[0] (base do pulso) tem variância alta — posição muda ao movimentar os dedos.
- Sem oclusão: o relógio sobreposto à pele diminui a confiança do modelo, criando feedback negativo.
- Múltiplas iterações de calibração (M055–M058) não produziram tracking estável em teste real.

**WebAR.rocks.hand (NN_WRISTBACK_45):**
- Resultado do avaliador objetivo M066: 0% taxa de detecção, confiança média = 0.
- Possíveis causas (não investigadas): câmera traseira + ângulo de pulso + iluminação + modelo.
- Pode ser que `NN_WRIST_27.json` (palma) ou configurações diferentes produzam resultado diferente.
- Mas: não é o momento certo para investigar — o investimento de tempo não é justificado sem baseline.

**Conclusão:** Engines open-source/MIT não têm a arquitetura de dados de treinamento necessária para wrist try-on de qualidade de produção. Motores industriais (treinados em milhões de frames de produto real) são o caminho correto.

---

## 4. Arquitetura Ghost Commerce Core + Tracking Engine Layer

```
┌─────────────────────────────────────────────────────────────┐
│                    Ghost Commerce Core                      │
│  App_FINAL.jsx · ProductAdapter · products.json · gsdk.js  │
│  360° viewer · AR embedded white-label · Shopify/Click&Wear │
│               (PROTEGIDO — não alterar sem Codex audit)     │
└───────────────────────────┬─────────────────────────────────┘
                            │ Interface plugável (futura)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Tracking Engine Layer                      │
│              src/tracking-engines/                          │
│                                                             │
│  types.js · engineRegistry.js · engineMatrix.js            │
│  engines/                                                   │
│    viewer/        ← READY (em produção)                     │
│    deepar/        ← CANDIDATE (próxima POC: M068)           │
│    perfectcorp/   ← CANDIDATE (produção futura)             │
│    banuba/        ← CANDIDATE (fallback)                    │
│    mirrar/        ← CANDIDATE (avaliar pós-M068)            │
│    legacy-mediapipe/ ← LEGACY (preservado)                  │
└─────────────────────────────────────────────────────────────┘
                            │ POC isolada primeiro
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Labs Isolados                            │
│   ?lab=webarrocks  ?lab=deepar (M068)  ?lab=perfectcorp     │
│   (nunca integrar no scanner principal sem APROVADO M066)   │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Categorias de Motores

| Categoria | Produtos | Engine Recomendado Atual |
|---|---|---|
| `wrist` | relógios, pulseiras, anéis | DeepAR (POC pendente) |
| `face` | óculos, brincos, maquiagem, cabelo, chapéus | Perfect Corp (comercial) |
| `body` | roupas, bolsas, acessórios corporais | Banuba (avaliar) |
| `foot` | tênis, sandálias | Banuba (avaliar) |
| `room` | móveis, decoração, objetos no ambiente | model-viewer ✅ READY |
| `viewer` | 3D/360° sem tracking corporal | model-viewer ✅ READY |

---

## 6. Matriz Resumida dos Candidatos

| Engine | Wrist | Face | Body | Web | iOS | Shopify | GLB próprio | Custo | Lock-in | Ghost Score |
|---|---|---|---|---|---|---|---|---|---|---|
| Perfect Corp | ✅ | ✅ | ❓ | ✅ | ✅ | ❓ | ❓ | enterprise | alto | 8/10 |
| DeepAR | ✅ | ✅ | ❌ | ✅ | ✅ | ❓ | ✅ | $19–500/mês | médio | 7/10 |
| Banuba | ❓ | ✅ | ✅ | ✅ | ✅ | ❓ | ❓ | enterprise | médio | 6/10 |
| MIRRAR | ✅ | ✅ | ❌ | ❓ | ❓ | ❓ | ❓ | ❓ | médio | 5/10 |
| model-viewer | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | free | baixo | 9/10 |
| MediaPipe | ✅* | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ | free | baixo | 3/10 |
| WebAR.rocks | ✅* | ❌ | ❌ | ✅ | ❌ | ❓ | ✅ | free | baixo | 2/10 |

*Em lab — reprovado em produção real. `❓` = needs-vendor-confirmation.

---

## 7. Ranking Atual

1. **model-viewer** (9/10) — READY, em produção, zero custo, sem lock-in
2. **Perfect Corp** (8/10) — melhor candidato para investidor, exige contato comercial
3. **DeepAR** (7/10) — **próxima POC técnica** (M068), SDK disponível, preço publicado
4. **Banuba** (6/10) — fallback sólido para body/face, confirmar wrist
5. **MIRRAR** (5/10) — possível demo rápida watches, verificar modelo de integração
6. **MediaPipe** (3/10) — LEGACY, múltiplas falhas em produção
7. **WebAR.rocks** (2/10) — 0% detecção M066, experimental

---

## 8. O Que Não Testar Mais (neste momento)

- Novas configurações do MediaPipe para wrist try-on
- Outras redes neurais do WebAR.rocks sem investigação estruturada de causa raiz
- Qualquer correção de placeholder/calibração nos labs existentes sem novo engine

---

## 9. Próxima POC Recomendada

**M068 — POC Isolada DeepAR Wrist Engine**

- Criar rota isolada: `?lab=deepar`
- Criar `src/DeepARLab.jsx` (não alterar `App_FINAL.jsx`)
- Não instalar SDK ainda — primeiro ler documentação oficial e decidir abordagem
- Ao terminar a POC: rodar o avaliador objetivo do M066 (10s, 13 métricas)
- Critério de aprovação: mesmo threshold do M066

O DeepAR é a escolha correta para a primeira POC industrial porque:
1. SDK JS disponível e documentado publicamente
2. Suporta modelos GLB próprios — sem necessidade de converter assets
3. Planos de preço publicados ($19–$500/mês) — POC pode começar sem contato comercial
4. White-label confirmado — sem branding DeepAR visível ao consumidor
5. Menor poc difficulty entre os candidatos industriais

---

## 10. Critério de Sucesso da Próxima Fase

Um engine de wrist é considerado aprovado para integração no Ghost Core se:

| Métrica | Critério |
|---|---|
| Taxa de detecção | ≥ 70% dos frames |
| Confiança média | ≥ 0.50 |
| Maior perda consecutiva | ≤ 1.000ms |
| Jitter médio do centro | ≤ 35px CSS |
| Largura máx placeholder | ≤ 160px CSS |
| Runtime obrigatório | iOS Safari + Android Chrome |
| Modelo GLB próprio | compatível sem conversão |
| White-label | sem branding vendor visível |

Avaliação feita via avaliador objetivo do M066 (`?lab=deepar` + botão "INICIAR TESTE DE 10 SEGUNDOS").

---

## M068A — DeepAR Lab Isolado

**Status:** concluído — aguarda teste com license key real.

**O que foi criado:**
- Lab acessível em `?lab=deepar` — rota isolada, sem alterar `App_FINAL.jsx`
- `src/DeepARLab.jsx` — componente React com status, logs, diagnóstico, preview DeepAR
- `createDeepARWebCdnSession()` exportada em `deepAREngine.placeholder.js`

**Abordagem técnica:**
- SDK carregado via **CDN dynamic import** (`https://cdn.jsdelivr.net/npm/deepar/js/deepar.esm.js`)
- Nenhuma dependência npm instalada — Vite não bundla URLs absolutas
- License key lida de `import.meta.env.VITE_DEEPAR_LICENSE_KEY`
- Se a chave não estiver configurada: tela de instrução clara, sem quebrar o app

**Efeito inicial (smoke test):**
- `https://cdn.jsdelivr.net/npm/deepar/effects/aviators` (óculos AR genérico)
- Objetivo: provar que SDK carrega, câmera abre e DeepAR renderiza no browser
- NÃO é o efeito wrist/watch final

**O que M068A NÃO faz:**
- Não coloca relógio GLB real no pulso
- Não usa modelos CW001/CASIO ainda
- Não integra com o scanner principal

**Próximos passos:**
- **M068B** — configurar `VITE_DEEPAR_LICENSE_KEY` e testar `?lab=deepar` em localhost e celular
- **M068C** — buscar/acessar efeito oficial DeepAR para wrist/watch (ShopAR ou AR Try-On Watch)

---

## M068B — DeepAR Smoke Test Validado

**Status:** APROVADO localmente.

**O que foi confirmado:**
- `VITE_DEEPAR_LICENSE_KEY` configurada em `.env.local` (protegido pelo `.gitignore`)
- `?lab=deepar` carregou sem erros
- SDK DeepAR carregado via CDN dynamic import — sem npm install
- Câmera abriu (modo frontal / `facingMode: 'user'`)
- Efeito `aviators` apareceu no rosto corretamente
- Botão PARAR funcionou (`deepAR.shutdown()`)
- App principal (`App_FINAL.jsx`, scanner, Shopify) preservado sem alteração

**Conclusão técnica:**
SDK + licença + câmera + render AR = validados. O gargalo deixou de ser infraestrutura.

---

## M068C — Próximo Gargalo

**O gargalo agora é obter um efeito DeepAR wrist/watch real.**

O efeito `aviators` prova que o SDK funciona, mas ele é um efeito de face (óculos). Para testar watch try-on, é necessário um efeito DeepAR específico para pulso/relógio.

**O lab está preparado** — `?lab=deepar` agora tem dois modos:
- **Smoke Test (Aviators)** — efeito face, câmera frontal, status: VALIDADO
- **Wrist Investigation** — câmera traseira, campo para URL manual de efeito wrist

**Opções para obter o efeito wrist/watch:**

1. **DeepAR Developer Portal → Asset Store** — verificar se há efeito watch gratuito
2. **Demo oficial wrist** — procurar em `developer.deepar.ai` demos de jewelry/watch
3. **ShopAR / DeepAR Try-On** — produto comercial DeepAR específico para e-commerce de watches
4. **Solicitar ao suporte DeepAR** — arquivo `.deepar` de teste para wrist/relógio
5. **Alternativa:** se DeepAR wrist ficar fechado/pago, avaliar Perfect Corp ou Banuba para WRIST

**Critério de avanço para M069:**
Obter URL de efeito wrist válida → colar no campo manual do Wrist Investigation → rodar → se detectar pulso e posicionar objeto → rodar avaliador objetivo M066 (10s, 13 métricas) → aprovado ou reprovado.

---

## M068D — DeepAR Wrist Demo Oficial

**Status:** demo oficial encontrada — validação manual pendente.

**Demo encontrada:** `https://try.deepar.ai/wrist/rolex`

Confirmada pelo site oficial DeepAR como AR Watch & Wrist Jewelry Try-On:
- watches, bangles, bracelets
- wrist mapping
- HTML5, iOS Safari, Android Chrome

**DeepAR/ShopAR agora tem duas provas:**
1. SDK funcionando no Ghost Project com efeito aviators (M068B — APROVADO)
2. Demo oficial wrist/watch existente e acessível publicamente

**Gargalo atual:** obter efeito wrist/watch real ou ShopAR trial para integrar no `?lab=deepar`.

**Decisão:** validar a demo oficial no celular antes de tentar integrar.
- Se funcionar bem → DeepAR continua candidato principal → M068E: pedir acesso
- Se falhar → acionar Perfect Corp e Banuba em paralelo → M068F

**Ações adicionadas ao lab `?lab=deepar`:**
- Card "Demo oficial DeepAR Wrist/Watch" com botão "ABRIR DEMO OFICIAL WRIST ↗"
- Link direto: `https://try.deepar.ai/wrist/rolex` (abre em nova aba, sem carregar SDK)
- Template de contato: `docs/M068D_DEEPAR_WRIST_ACCESS.md`

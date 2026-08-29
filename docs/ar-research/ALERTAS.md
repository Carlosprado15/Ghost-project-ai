# ALERTAS — Achados que exigem atenção

Ordem cronológica inversa (mais novo no topo). Cada entrada tem no máximo
6 linhas, neste formato:

```
## [DATA] [NIVEL] título de uma linha
ORIGEM: AR-KB-XXX
O QUE É: uma frase
POR QUE IMPORTA PARA O GHOST: uma frase concreta
AÇÃO SUGERIDA: uma frase
VEREDITO: COMPROVADO / PROVAVEL / HIPOTESE
```

## Níveis — critério objetivo

- **[CRITICO]** — a pesquisa contradiz uma decisão que já está no código, ou
  revela que algo já implementado no Ghost está errado, ou mostra que uma
  tecnologia em uso tem limite documentado que inviabiliza o objetivo.
  Exemplo: descobrir que o filtro atual tem falha conhecida, ou que WebXR
  não faz no iOS o que a arquitetura assume.
- **[ALTO]** — existe solução pronta, documentada e de custo BAIXO ou MEDIO
  para um problema que o Ghost tem hoje em aberto.
- **[OPORTUNIDADE]** — capacidade nova que o motor poderia ter e que
  ninguém tinha considerado, com aplicação clara em corpo ou ambiente, não
  só pulso.

## Regra anti-ruído (obrigatória, não negociável)

No máximo **1 alerta por ciclo**. Se o achado do ciclo não atingir nenhum
dos três critérios acima, **não escrever nada aqui** — é o resultado
esperado na maioria dos ciclos, não uma falha do ciclo. Um achado
interessante mas sem ação concreta não é alerta, fica só registrado no
tópico em `topics/`. Nunca escrever um alerta só para justificar que o
ciclo "produziu algo" — silêncio é o padrão, alerta é a exceção.

---

## [2026-08-28] [ALTO] anchorState reset: solução de 2 linhas para state management do crossoverOffset
ORIGEM: AR-KB-008
O QUE É: quando hold expira (held===null), zerar crossoverOffset e prevDegraded; durante hold, preservar.
POR QUE IMPORTA PARA O GHOST: sem essa regra, implementação ingênua de AR-KB-005 fix preserva offset
  velho após perda longa — poderia causar erro permanente de ~90° no reaparecimento do modelo.
AÇÃO SUGERIDA: ao codificar AR-KB-005 fix em GhostEngine.js, acrescentar 2 linhas no bloco
  `if (held===null)` já existente (linha 122) — custo BAIXO, padrão já estabelecido por _scaleHist.
VEREDITO: COMPROVADO (MediaPipe re-detecção + ARCore PAUSED/STOPPED) / PROVAVEL (aplicação ao Ghost)

---

## [2026-08-28] [CRITICO] FALLBACK_ROT_TRIM_DEG=0 causa erro de ~90° — constante fixa é arquiteturalmente errada
ORIGEM: AR-KB-005
O QUE É: thumb CMC (lm1) tem ROM de 40–70° e se abduz junto com a pronação que ativa o fallback;
  o offset entre lm5-lm17 e lm1-lm17 varia ±50° além da base de 30–40°, tornando impossível um valor fixo.
POR QUE IMPORTA PARA O GHOST: os ~93°/~293° observados em teste real (28/08) saem exatamente dessa variação;
  enquanto FALLBACK_ROT_TRIM_DEG for constante, qualquer valor escolhido será errado em alguma pose.
AÇÃO SUGERIDA: substituir pela técnica de crossover-offset: medir atan2 dos dois pares no frame de troca,
  armazenar a diferença, aplicar enquanto degraded=true — ~25 linhas; detalhes em AR-KB-005.
VEREDITO: COMPROVADO (constante inadequada) / PROVAVEL (fix dinâmico resolve)

---

## [2026-08-27] [ALTO] rotZ sem unwrap (alerta anterior) já corrigido em branch não mesclada
ORIGEM: AR-KB-002 — atualização por verificação do ar-rescue (leitura, git show)
O QUE É: o D4 (commit 9d1d523, branch fix/d1-d2-d4-estabilizacao) já implementa
  _unwrapRotZ() e corrige exatamente este ponto; ghost-engine-v1 (branch de
  trabalho normal) segue com o bug, porque o fix nunca foi mesclado pra lá.
POR QUE IMPORTA PARA O GHOST: o alerta CRITICO anterior sugeria "implementar" algo
  que já existe pronto em outro branch — a ação certa é mesclar/portar, não recriar.
AÇÃO SUGERIDA: portar _unwrapRotZ() de fix/d1-d2-d4-estabilizacao pra
  ghost-engine-v1; a correção em si nunca foi testada fisicamente girando o
  pulso pela fronteira ±180° em aparelho real — testar antes de dar como resolvido.
VEREDITO: COMPROVADO (fix existe e resolve o ponto) / HIPOTESE (funciona em campo)

---

## [2026-08-27] [ALTO] detectForVideo() bloqueia main thread — solução documentada (Web Worker)
ORIGEM: AR-KB-003
O QUE É: detectForVideo() é síncrono por design; a doc oficial recomenda Web Workers;
  GhostEngine.startLoop() chama a inferência no main thread a cada requestAnimationFrame.
POR QUE IMPORTA PARA O GHOST: inferência de 30–60 ms no main thread é compatível com
  os 3–7 FPS observados no motor novo (jul/2026) — o gargalo pode ser este.
AÇÃO SUGERIDA: mover HandTracker para Web Worker em src/engine/core/tracking/handTracker.js
  usando Transferable (ImageBitmap) para envio de frames — custo MÉDIO.
VEREDITO: COMPROVADO (bloqueio síncrono) / PROVAVEL (causa dos 3–7 FPS)

---

## [2026-08-27] [CRITICO] OneEuroFilter recebe ângulo atan2 cru sem unwrapping
ORIGEM: AR-KB-002
O QUE É: GhostEngine.js:154 passa anchor.rotZ (saída de atan2, domínio (-π, π])
  direto ao OneEuroFilterScalar; quando o pulso cruza ±180° o filtro vê delta de
  ~2π em vez de ~0 e o modelo gira no sentido errado por vários frames.
POR QUE IMPORTA PARA O GHOST: o cruzamento ocorre em poses naturais de pulso
  (mão apontando para o lado); o efeito é visível como snap/spin no modelo AR.
AÇÃO SUGERIDA: implementar unwrapAngle() em GhostEngine.js antes de f.rotZ.filter()
  — estimativa 8–12 linhas, custo BAIXO, sem risco de regressão em poses normais.
VEREDITO: COMPROVADO

---

(AR-KB-001 foi avaliado contra os 3 critérios e não gerou entrada aqui: a suspeita
de dupla suavização WASM+JS é PROVAVEL/hipótese a confirmar por medição — fica
registrada só no próprio tópico, como a regra anti-ruído pede.)

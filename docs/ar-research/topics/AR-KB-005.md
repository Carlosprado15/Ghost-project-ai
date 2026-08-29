ID: AR-KB-005
CAMADA: D / G / H
APLICABILIDADE:
  PULSO: problema real confirmado em teste 28/08 — troca lm5-lm17 → lm1-lm17 gerou
    ~93°/~293° de erro em wristAnchor.js com FALLBACK_ROT_TRIM_DEG=0. Solução:
    offset dinâmico medido no frame de cruzamento substitui a constante fixa.
  CORPO: mesmo princípio para qualquer tracker que troque referência de eixo mid-session
    (ex.: ombro→cotovelo em body tracking); a amplitude do offset muda com a anatomia
    do segmento, mas o algoritmo de crossover-offset é idêntico.
  AMBIENTE: não se aplica — rastreamento de superfície não usa par de landmarks anatômicos
    com este problema de troca de eixo. Se houver troca de âncoras em SLAM, o contexto
    é translação 3D, não ângulo 2D de eixo anatômico.
PERGUNTA:
  Troca de par de landmarks de referência (lm5–lm17 → lm1–lm17) para calcular o ângulo
  de orientação do pulso em modo degradado: como a literatura evita ou compensa o salto
  angular que essa troca introduz?

RESPOSTA EM 3 LINHAS:
  A literatura não trata este caso exato, mas o princípio derivável de tracking e
  controle é: medir o offset angular entre os dois pares no frame de cruzamento (quando
  ambos ainda são geometricamente válidos), armazenar como `crossoverOffset`, e somar
  ao ângulo do par de fallback enquanto o modo degradado estiver ativo.
  FALLBACK_ROT_TRIM_DEG constante não funciona porque lm1 (thumb CMC) tem ROM de
  40–70° — a posição relativa a lm17 muda exatamente na pronação que ativa o fallback.

DETALHAMENTO TÉCNICO:
  ## Por que o offset entre os dois pares não é constante

  lm5→lm17 (index MCP → pinky MCP): eixo de knuckle; quase horizontal com palma
  neutra; encurta na projeção 2D quando a mão prona — esse encurtamento é o critério
  de degradação (SPAN_RATIO_MIN = 0.45 em wristAnchor.js).

  lm1→lm17 (thumb CMC → pinky MCP): lm1 é articulação em sela (2 GDL), abdução ativa
  de 40–70° independente da orientação do punho (JOSPT 2003). A pronação que dispara
  o fallback é correlacionada com abdução do polegar — exatamente quando lm1 mais se
  afasta de sua posição neutra. Logo: base ≈ 30–40° de offset entre os eixos +
  ±50° de abdução contextual = erros de até ~90°.

  Isso explica o achado do teste físico: ~93°/~293° sem o pulso estar nessa posição.

  ## Solução: offset dinâmico no frame de cruzamento (crossover-offset)

  No frame em que `degraded` muda de `false → true`, ambos os pares ainda são
  geometricamente mensuráveis. Nesse momento mede-se o offset real:

  ```js
  // frame de entrada no modo degradado:
  const primaryAngle  = Math.atan2(lm17.y - lm5.y,  lm17.x - lm5.x);
  const fallbackAngle = Math.atan2(lm17.y - lm1.y,  lm17.x - lm1.x);
  let crossoverOffset = primaryAngle - fallbackAngle;
  // Normaliza para (-π, π] — necessário pelo mesmo motivo que AR-KB-002:
  while (crossoverOffset >  Math.PI) crossoverOffset -= 2 * Math.PI;
  while (crossoverOffset < -Math.PI) crossoverOffset += 2 * Math.PI;
  // Aplicar enquanto degraded=true:
  //   rotZ = fallbackAngle + crossoverOffset + rotationOffsetDeg * DEG_TO_RAD
  ```

  Ao retornar a `degraded=false`, descartar `crossoverOffset` — o par primário
  retoma diretamente.

  ## Suavização na transição (opcional mas recomendada)

  Mesmo com crossoverOffset correto, troca abrupta pode gerar jitter se o frame
  de cruzamento for ruidoso. Interpolar o ângulo linear por N=3–5 frames
  (~100–167 ms a 30 fps) absorve ruído sem introduzir lag perceptível.

  ## Implicação arquitetural

  computeWristAnchor() é hoje uma função pura (stateless). Para armazenar
  crossoverOffset entre frames é necessário: (a) converter para closure/classe, ou
  (b) ter o chamador manter o estado e passá-lo como parâmetro. Opção (b) mantém
  a função testável e alinhada com o padrão atual do módulo.

EVIDÊNCIA:
  - Teste físico Ghost Engine 28/08/2026: ~93°/~293° com FALLBACK_ROT_TRIM_DEG=0.
  - Anatomia: thumb CMC abdução ativa ≈ 40–70° (JOSPT 2003, tabela de ROM).
  - Modelagem de mão: thumb CMC inclinado ~55° em relação ao plano palmar (arXiv 2512.07359).
  - O algoritmo de crossover-offset é derivação geométrica direta; sem fonte única citável.

FONTES:
  - https://arxiv.org/abs/2006.10214 [PAPER] MediaPipe Hands (Zhang et al. 2020) — 21 landmarks, esqueleto
  - https://arxiv.org/pdf/2512.07359 [PAPER] Multi-Rigid-Body Approx. of Human Hands — thumb CMC 55°
  - https://www.jospt.org/doi/pdf/10.2519/jospt.2003.33.7.386 [PAPER] CMC Joint of the Thumb — ROM 40–70°
  - https://arxiv.org/abs/2602.21610 [PAPER] WatchHand CHI 2026 — wrist pose tracking sob oclusão

APLICAÇÃO AO GHOST:
  src/engine/core/anchor/wristAnchor.js:
  - Remover FALLBACK_ROT_TRIM_DEG como constante global.
  - Adicionar parâmetro opcional `crossoverOffset = 0` a computeWristAnchor().
  - Chamador (ex.: GhostEngine.js) detecta transição degraded e passa o offset
    calculado no frame de cruzamento. ~25 linhas de mudança no total.
  - Manter FALLBACK_SCALE_RATIO = 0.85 — esse ajuste é de escala, não de ângulo,
    e é menos sensível à mobilidade do thumb CMC.

VEREDITO:
  COMPROVADO: constante fixa (FALLBACK_ROT_TRIM_DEG=0 ou qualquer valor fixo) não
    resolve — ROM do thumb CMC supera qualquer média calibrável.
  PROVAVEL: crossover-offset dinâmico elimina o salto no ponto de troca —
    geometricamente correto, não testado fisicamente ainda no Ghost Engine.

CUSTO DE ADOÇÃO: MÉDIO (~25 linhas; requer estado entre frames no chamador)

NOVAS PERGUNTAS GERADAS:
  - QR-050 [P0][D] Como estruturar o estado de crossoverOffset entre frames em
    wristAnchor.js — parâmetro no chamador vs. closure — sem quebrar testabilidade?
  - QR-051 [P0][F] Quantos frames de interpolação na transição de par são perceptíveis
    como lag em AR de pulso a 30 fps? Existe limiar documentado de latência perceptível?

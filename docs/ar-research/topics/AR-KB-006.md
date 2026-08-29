ID: AR-KB-006
CAMADA: D / E
APLICABILIDADE:
  PULSO: aplicação direta — wristAnchor.js precisa de { prevDegraded, crossoverOffset }
    persistido entre frames para o fix de AR-KB-005 funcionar.
  CORPO: idêntico ao pulso — rastreamento corporal que troca par de referência (ex:
    ombro→quadril quando um é ocluído) tem a mesma estrutura de estado inter-frame;
    { prevDegraded, crossoverOffset } por articulação rastreada; escalar para N joints
    = N objetos de estado independentes.
  AMBIENTE: crossoverOffset não se aplica — SLAM/WebXR/hit-test não usa pares de
    landmarks angulares, então o cálculo específico de AR-KB-005 não se transfere.
    A escolha arquitetural factory vs. estado explícito se aplica a qualquer módulo
    com transição de modo entre frames (ex: tracker marker → SLAM), mas não gera
    impacto concreto até esse caso existir no Ghost.
PERGUNTA: Como estruturar o estado de crossoverOffset entre frames em wristAnchor.js
  — parâmetro no chamador vs. closure — sem quebrar testabilidade do módulo?
RESPOSTA EM 3 LINHAS:
  Usar estado explícito como parâmetro: computeWristAnchor(landmarks, anchorState, opts).
  O chamador cria { prevDegraded: false, crossoverOffset: 0 } uma vez e passa por
  referência a cada frame; a função atualiza in-place. Mais testável que factory/closure
  porque testes injetam qualquer estado inicial sem replay de sequência de frames.
DETALHAMENTO TÉCNICO:
  Dois padrões candidatos:

  Opção A — Factory/closure (padrão do MediaPipe HandLandmarker e do OneEuroFilter):
    export function createWristAnchor(opts) {
      let prevDegraded = false;
      let crossoverOffset = 0;
      return function(landmarks, frameOpts) { /* usa closure */ };
    }
    Prós: chamador não gerencia objeto de estado; consistente com OneEuroFilter já no Ghost.
    Contras: para testar "frame N após sequência X", é preciso replay de N-1 frames para
    atingir o estado desejado — alto acoplamento entre teste e lógica de transição.
    Não reentrante se o mesmo createWristAnchor() for reutilizado em dois contextos.

  Opção B — Estado explícito como parâmetro (padrão funcional):
    export function computeWristAnchor(landmarks, anchorState = {}, opts = {}) {
      // lê anchorState.prevDegraded, anchorState.crossoverOffset
      // escreve anchorState.prevDegraded, anchorState.crossoverOffset in-place
      // retorna { x, y, z, rotZ, scale, degraded } — retorno inalterado
    }
    Prós: teste cria anchorState = { prevDegraded: true, crossoverOffset: 1.2 } e
    chama uma vez; estado visível, injetável, reentrante (dois usos = dois objetos).
    Contras: chamador precisa criar e guardar o objeto entre frames — custo baixíssimo.

  Por que MediaPipe usa factory para HandLandmarker mas Opção B é melhor para wristAnchor:
    HandLandmarker encapsula estado de ~10 componentes (detector de palma, tracker leve,
    histórico de timestamps). Expor tudo como parâmetros externos seria impraticável.
    computeWristAnchor tem estado mínimo: 2 campos. O overhead de factory supera o benefício.

  Implementação concreta (Opção B) para wristAnchor.js:
    // GhostEngine.js — criar uma vez:
    const anchorState = {};
    // a cada frame:
    const anchor = computeWristAnchor(landmarks, anchorState, { offsetRatio: 0.18 });
    // dentro de computeWristAnchor:
    if (degraded && !anchorState.prevDegraded) {
      anchorState.crossoverOffset = primaryAngle - fallbackAngle;  // captura na transição
    }
    anchorState.prevDegraded = degraded;
    const rotZ = (degraded ? fallbackAngle + (anchorState.crossoverOffset ?? 0)
                           : primaryAngle) + baseOffsetRad;
    // onde primaryAngle = atan2 de lm5–lm17, fallbackAngle = atan2 de lm1–lm17

  Risco de estado obsoleto: se o GhostEngine for destruído e recriado sem recriar
  anchorState, um crossoverOffset de sessão anterior pode ser aplicado erroneamente.
  Solução: anchorState = {} junto com qualquer reinicialização do motor.

EVIDÊNCIA:
  MediaPipe HandLandmarker em VIDEO_STREAM: exige timestamps monotonicamente crescentes
  entre chamadas de detectForVideo() — prova que a instância mantém estado interno
  entre frames. Implementado como factory de classe (createFromOptions returns instance).
  arXiv 2006.10214: "hand tracker model outputs confidence score... only when below
  threshold is palm detection reapplied" — inter-frame state explícito no paper.
  Princípio derivado: função com estado explícito = 1 chamada por caso de teste;
  closure = replay de N frames para atingir estado mid-sequence (custo de teste cresce
  com complexidade da sequência de transição).

FONTES:
  - https://developers.google.com/mediapipe/api/solutions/js/tasks-vision.handlandmarker
    [OFICIAL] HandLandmarker JS API — factory pattern, detectForVideo timestamp monotônico
  - https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker/web_js
    [OFICIAL] Guia Web — VIDEO_STREAM mode, tracking leve inter-frame documentado
  - https://arxiv.org/abs/2006.10214 [PAPER] MediaPipe Hands — arquitetura stateful (detector+tracker)
  - https://jeremydmiller.com/2024/01/10/building-a-critter-stack-application-easy-unit-testing-with-pure-functions/
    [BLOG] "Functional core, imperative shell" — estado na shell, cálculo puro no core
  - https://medium.com/caffeine-and-testing/javascript-pure-functions-helped-simplify-unit-testing-for-me-baf8baf08a7f
    [BLOG] Pure functions reduzem complexidade de testes unitários em JavaScript

APLICAÇÃO AO GHOST:
  src/engine/core/anchor/wristAnchor.js: adicionar parâmetro anchorState = {} à assinatura
  de computeWristAnchor(); ler prevDegraded e crossoverOffset; escrever in-place a cada frame.
  src/engine/core/GhostEngine.js ou react/useGhostWristAR.js: criar const anchorState = {}
  junto com os filtros OneEuro; passar a cada chamada de computeWristAnchor(); recriar junto
  com o restante do estado do motor quando o tracking for reinicializado.

VEREDITO:
  Factory/classe para inter-frame state em sistemas grandes (MediaPipe): COMPROVADO [OFICIAL+PAPER]
  Estado explícito como parâmetro melhor para testabilidade de função pequena: PROVAVEL [BLOG]
  Opção B (estado explícito) preferida para wristAnchor.js pelo custo/benefício: PROVAVEL

CUSTO DE ADOÇÃO: BAIXO (~20 linhas em wristAnchor.js + 2 linhas no chamador)

NOVAS PERGUNTAS GERADAS:
  QR-052 [P0][E]: Quando tracking é perdido (holdLastPose ativa) e depois recuperado,
    anchorState deve ser zerado, preservado ou congelado até próxima transição primário→fallback?
  QR-053 [P0][F]: crossoverOffset deve ser step function (valor fixo enquanto degraded=true)
    ou interpolado → 0 nos primeiros N frames do fallback? Lag de interpolação perceptível a 30 fps?

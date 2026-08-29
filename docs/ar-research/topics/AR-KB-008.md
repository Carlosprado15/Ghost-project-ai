ID: AR-KB-008
CAMADA: E
APLICABILIDADE:
  PULSO: crossoverOffset de AR-KB-005 precisa de regra de reset durante tracking
    loss/recovery em wristAnchor.js. Resposta: preservar durante hold ativo (<holdMs),
    zerar quando hold expira. O trigger `held===null` já existe em GhostEngine.js:122.
  CORPO: mesmo princípio — qualquer pair-switch offset em body tracking (ex.:
    ombro→cotovelo) segue o padrão; holdMs pode diferir, mas o trigger é idêntico.
    O período de hold em body tracking tende a ser maior (>2 s), favorecendo
    mais a preservação — razão: body landmarks perdem-se por oclusão, não por
    rotação, então a pose retorna para o mesmo segmento anatômico com frequência.
  AMBIENTE: não se aplica diretamente — SLAM/superfície não usa pair-switch state.
    O princípio geral de invalidar estado derivado ao reiniciar o tracker vale em
    qualquer sistema, mas sem o conceito específico de holdMs ou degraded pair.
PERGUNTA:
  QR-052: quando tracking é perdido (holdLastPose ativa) e depois recuperado,
  o anchorState (crossoverOffset proposto em AR-KB-005) deve ser zerado,
  preservado ou congelado até a próxima transição primário→fallback?

RESPOSTA EM 3 LINHAS:
  Preservar durante hold ativo (<holdMs); zerar quando hold expira.
  MediaPipe re-detecta via palm detection após landmarks=null — nova sessão de
  tracking, offset pode ser inválido. Durante hold (<1.5 s), a mão provavelmente
  não reposicionou; reset causaria o mesmo erro ~90° de FALLBACK_ROT_TRIM_DEG=0.

DETALHAMENTO TÉCNICO:

## MediaPipe: nova sessão após perda de tracking

Quando landmarks=null, HandLandmarker já executou re-detecção via palm detection
(doc oficial: "only when the landmark model could no longer identify hand presence
is palm detection invoked to relocalize the hand"). O próximo frame com landmarks
é uma nova sessão — não é continuação geométrica da anterior. O crossoverOffset
da sessão anterior é conceitualmente inválido para a nova detecção; a questão
é: quão inválido na prática?

## Dois cenários

Perda curta — hold ativo (held !== null em GhostEngine.js:122):
  Modelo permanece visível. Usuário provavelmente não reposicionou mão em <1.5 s.
  Se recovery ocorre com degraded=true: usar crossoverOffset preservado é melhor
  do que 0, que causaria erro ~90° — o mesmo bug de FALLBACK_ROT_TRIM_DEG=0.
  ROM de punho em 1.5 s não invalida significativamente um offset baseado em atan2.
  Decisão: PRESERVAR crossoverOffset.

Perda longa — hold expirado (held === null em GhostEngine.js:122):
  Modelo sumiu; usuário viu transição visual. Mão pode ter reposicionado.
  Recovery com crossoverOffset=0 causa erro transitório, mas coincide com o snap
  visual já existente no reaparecimento — percebido como "normal" pelo usuário.
  Preservar offset muito velho pode causar erro permanente de ~90°.
  Decisão: ZERAR crossoverOffset.

## Padrão ARCore confirma a distinção

ARCore documenta TrackingState em dois estados:
  PAUSED: "has paused tracking, may resume" — pose preservada (= hold ativo).
  STOPPED: "stopped tracking, will not resume" (= hold expirado, modelo sumiu).
Padrão oficial Google: preservar estado em PAUSED, reiniciar em STOPPED.

## Implementação: 2 linhas no padrão existente de GhostEngine.js

GhostEngine.js já usa `held===null` como trigger de reset para `_scaleHist`:

  if (held === null) {
    this._scaleHist       = [];    // já existente
    this._crossoverOffset  = 0;    // ← novo, mesma lógica
    this._prevDegraded     = false; // ← novo, mesma lógica
  }

No 1º frame pós-recovery: _prevDegraded=false → transição false→true só dispara
se degraded=true nesse frame → medição fresca imediata — comportamento correto.

## Caso edge: recovery com hold expirado + degraded=true imediato

crossoverOffset=0 + degraded=true → erro ~90° por vários frames até próxima
transição false→true gerar medição fresca. Mitigado por interpolação (QR-053):
rampa de 0 ao valor medido mascara o erro gradualmente no reaparecimento.

EVIDÊNCIA:
  - MediaPipe hand_landmarker guide [OFICIAL]: re-detecção via palm detection
    após landmarks=null — nova sessão de tracking confirmada.
  - ARCore TrackingState [OFICIAL]: PAUSED vs STOPPED como padrão de
    preserve/reset documentado pelo Google.
  - GhostEngine.js:122 — `if (held===null) this._scaleHist=[]` — trigger de
    reset para estado derivado de tracking já em uso sem mecanismo extra.

FONTES:
  https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker
    [OFICIAL] MediaPipe HandLandmarker Guide — re-detection on tracking loss
  https://developers.google.com/ar/reference/java/com/google/ar/core/TrackingState
    [OFICIAL] ARCore TrackingState — PAUSED / STOPPED pattern
  https://developers.google.com/ar/reference/java/com/google/ar/core/AugmentedImage
    [OFICIAL] ARCore AugmentedImage — pose preservation on PAUSED vs TRACKING

APLICAÇÃO AO GHOST:
  src/engine/core/GhostEngine.js: ao implementar AR-KB-005 fix, acrescentar 2
  linhas no bloco `if (held===null)` (linha 122 atual):
    this._crossoverOffset = 0;
    this._prevDegraded    = false;
  Nenhuma nova estrutura — padrão idêntico ao `_scaleHist` já estabelecido.
  src/engine/core/anchor/wristAnchor.js: sem mudança (estado gerenciado pelo
  chamador, como decidido em AR-KB-006).

VEREDITO:
  COMPROVADO: padrão MediaPipe (re-detecção = nova sessão após loss) e ARCore
    (PAUSED/STOPPED) fundamentam a distinção hold-ativo/hold-expirado com fontes
    OFICIAL.
  PROVAVEL: aplicação específica ao crossoverOffset — geometricamente sólida,
    não testada fisicamente no Ghost Engine ainda.

CUSTO DE ADOÇÃO: BAIXO (2 linhas no bloco existente, padrão já estabelecido)

NOVAS PERGUNTAS GERADAS:
  QR-053 (já ABERTA) cobre o caso edge recovery-em-degraded via interpolação.
  QR-055 [P0][E][ABERTA] Ao implementar o reset de crossoverOffset em
    GhostEngine.js, como testar a corretude sem UI? Existe padrão para teste
    unitário de máquinas de estado de tracking com sequência landmarks/null/landmarks?

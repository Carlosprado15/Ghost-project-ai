ID: AR-KB-002
CAMADA: F / D
APLICABILIDADE: PULSO / CORPO / AMBIENTE
  PULSO: rotZ derivado de atan2 sobre landmarks 2D — range (-π, π]. Wrap ocorre
    quando o pulso aponta diretamente para o lado na imagem (~±180°). Impacto
    visível: modelo gira no sentido errado por alguns frames ao cruzar a fronteira.
  CORPO: mesmo problema em qualquer ângulo de segmento derivado de atan2/arccos
    (ombro, cotovelo, quadril). Pior que no pulso porque amplitude de movimento
    corporal é maior — mais chance de cruzar ±180°. O mesmo fix de unwrapping
    se aplica; não há parâmetro distinto, a geometria do problema é idêntica.
  AMBIENTE: não relevante — objetos de ambiente (móveis, paredes) não têm rotação
    derivada de tracking contínuo frame-a-frame. O problema só existe em tracking
    de pose de membro em movimento.
PERGUNTA: Wrap-around de rotação ±180° em filtro temporal: formulação matemática
  correta com quaternion e com ângulo desembrulhado?

RESPOSTA EM 3 LINHAS:
  Quando um ângulo cruza ±180°, atan2 salta de +π para -π e o filtro vê delta de
  ~2π em vez de ~0, causando rotação no sentido errado por vários frames. A correção
  é calcular angleDiff (diferença normalizada em (-π, π]) antes de passar ao filtro
  e acumular o ângulo sem truncar. Para quaternions, negar o quaternion corrente se
  seu produto escalar com o estado anterior for negativo.

DETALHAMENTO TÉCNICO:

### 1. O problema com atan2 + filtro escalar cru

  atan2 retorna em (-π, π]. Quando a rotação cruza a fronteira:
    frame k-1: rotZ =  +2.9 rad  (+166°)
    frame k:   rotZ =  -2.9 rad  (-166°)
    delta cru: -5.8 rad  ← filtro interpreta "girou 332° no sentido negativo"
    delta real: +0.4 rad  ← o que realmente mudou

  OneEuroFilterScalar usa dx = (value - x_prev) / dt sobre o valor cru.
  Efeito: modelo fica vários frames girando no sentido errado até convergir.

### 2. Correção por angle unwrapping

  function angleDiff(a, b) {
    // retorna a diferença mínima em (-π, π]
    let d = a - b;
    while (d >  Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return d;
  }

  // estado adicional no chamador: lastRawRotZ
  const unwrapped = lastUnwrappedRotZ + angleDiff(currRawRotZ, lastRawRotZ);
  lastRawRotZ     = currRawRotZ;
  lastUnwrappedRotZ = unwrapped;  // atualizar após filtrar
  const filtered  = rotZFilter.filter(unwrapped, ts);
  // `filtered` pode estar fora de (-π, π) mas Math.sin/cos são periódicos — ok.

  Reset obrigatório ao perder tracking: lastRawRotZ = null → tratar próximo
  frame como primeiro (inicializa sem diferença acumulada).

### 3. Correção para quaternion (double cover)

  q e -q representam a mesma rotação. Se sign flip ocorrer entre frames,
  os 4 componentes saltam simultaneamente.

  // antes de filtrar cada componente:
  if (q_prev.dot(q_curr) < 0) q_curr = q_curr.negate();
  // então filtrar q_curr.x, .y, .z, .w com OneEuroFilterScalar independentes.
  // Re-normalizar ao final: q_out = q_out.normalize().

  Alternativa mais robusta: usar SLERP como operador de filtro polo-único:
    q_filtered = slerp(q_filtered_prev, q_curr, alpha)
  onde alpha vem da mesma lógica do OneEuro. SLERP opera na geodésica da
  esfera unitária e é invariante ao sinal do quaternion por construção.

### 4. Angle unwrap vs. quaternion fix — quando usar cada um

  - Unwrap escalar: resolve rotações planas (1 grau de liberdade).
    Custo: 1 função auxiliar + 1 campo de estado. Simples para rotZ.
  - Quaternion negate: resolve rotações 3D completas (3 DoF).
    Custo: filtrar 4 componentes + normalização. Adequado se a arquitetura
    evoluir para pose full 3D do antebraço.
  - Rotação >1 volta inteira: quaternion negate não resolve (quaternion
    cicla a cada 720°); unwrap escalar resolve (acumula sem limite).
    Em wrist AR isso é improvável mas possível em rotação rápida de pulso.

EVIDÊNCIA:
  - Algoritmo de unwrapping sequencial com pseudocódigo (theorangeduck.com):
    verificado via fetch neste ciclo.
  - MATLAB Lowpass Filter with Quaternion SLERP documenta filtro polo-único
    adaptado para quaternion, evitando descontinuidade por construção.
  - GhostEngine.js:154 (código Ghost, lido neste ciclo): confirma que
    anchor.rotZ (saída de atan2, linha 75 de wristAnchor.js) é passado
    direto a f.rotZ.filter() sem qualquer unwrapping — bug presente.
  - OneEuroFilter.js (código Ghost, lido neste ciclo): dx = (value - this._x)
    / dt sem normalização angular — confirma que recebe o delta cru.

FONTES:
  - https://theorangeduck.com/page/unrolling-rotations | blog-tecnico
  - https://www.mathworks.com/help/nav/ug/lowpass-filter-orientation-using-quaternion-slerp.html | doc-oficial
  - https://github.com/DarioMazzanti/OneEuroFilterUnity | repo-oficial
  - src/engine/core/GhostEngine.js:154 (código do projeto)
  - src/engine/core/anchor/wristAnchor.js:75 (código do projeto)
  - src/engine/core/filters/OneEuroFilter.js:27 (código do projeto)

APLICAÇÃO AO GHOST:
  GhostEngine.js:154 faz f.rotZ.filter(anchor.rotZ, ts) sem unwrapping.
  Fix: adicionar _lastRawRotZ e _lastUnwrappedRotZ a GhostEngine, calcular
  unwrapped = angleDiff() antes de filter(), resetar nos dois campos ao
  perder tracking (holdLastPose.onLost / re-detecção).
  Arquivo alvo: src/engine/core/GhostEngine.js — estimativa 8–12 linhas.
  Sem risco de regressão em poses normais (ângulos longe de ±180°).

VEREDITO: COMPROVADO
CUSTO DE ADOÇÃO: BAIXO
NOVAS PERGUNTAS GERADAS:
  QR-044 [P0][F] O hold-last-pose e o reset de tracking reiniciam os campos
    de estado do unwrap em GhostEngine? Se não, re-detecção começará com
    ângulo acumulado errado e o filtro divergirá.
  QR-045 [P0][F] Com unwrapping ativo e rotação de pulso contínua (>1 volta),
    o ângulo acumulado crescerá indefinidamente — existe um protocolo de
    re-normalização periódica sem causar descontinuidade visível?

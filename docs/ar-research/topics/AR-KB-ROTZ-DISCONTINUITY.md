ID: AR-KB-004
CAMADA: D-POSE, E-TRACKING, F-FILTER
APLICABILIDADE:
- PULSO: aplicação direta — mesmo problema, mesmo tipo de landmark (mão/pulso)
- CORPO: mesmo princípio se aplica a qualquer articulação rastreada por câmera que precise de orientação 3D (cotovelo, ombro)
- AMBIENTE: não aplicável (objetos estáticos não têm esse tipo de descontinuidade de rotação contínua)

PERGUNTA: Como referências externas (Cvetković/Niš, Holz/ETH Zürich) representam
e suavizam rotação de pulso, e isso explica por que o Ghost Engine precisa de
_unwrapRotZ() enquanto eles não têm esse problema?

RESPOSTA EM 3 LINHAS:
Nenhum dos dois grupos guarda um ângulo de rotação acumulado entre quadros —
Cvetković reconstrói a matriz de rotação inteira do zero a cada quadro, Holz
usa quatérnion. O salto em ±180° do Ghost Engine é consequência específica de
guardar rotação como um ângulo Euler único que precisa "dar a volta"; não é
uma propriedade inevitável do problema físico, é uma escolha de representação.

DETALHAMENTO TÉCNICO:

Como o Cvetković calcula rotação (Cvetković, Špeletić, Nikolić — "Edge-Centric
AR Framework for Realtime Wristwatch Try-On", IJIMAI 2026):

A cada quadro, a matriz de rotação inteira é reconstruída do zero a partir de
3 pontos da mão do MediaPipe (WRIST, INDEX_MCP, PINKY_MCP):
1. Vetor 1: do centro do triângulo formado pelos 3 pontos até o INDEX_MCP
2. Vetor 2: normal do triângulo (produto vetorial de duas arestas)
3. Vetor 3: produto vetorial dos vetores 1 e 2
4. Normaliza os três → matriz de rotação 3×3 ortonormal pronta

Isso é reconstrução geométrica direta (Gram-Schmidt-like), não decomposição
incremental em ângulos de Euler. Não existe "ângulo anterior" guardado em
lugar nenhum — cada quadro é independente do anterior.

Onde entra a suavização: o pipeline do paper (Fig. 2) é Landmarks → Matriz de
Transformação (posição + rotação) → Buffer (average/median/exponential) →
Renderização. O buffer suaviza os PARÂMETROS JÁ CALCULADOS quadro a quadro,
não a entrada bruta.

Limite real do paper, relevante pro nosso bug: o gráfico de resultado (Fig. 10)
mostra a suavização aplicada sobre um valor de "y-rotation" já decomposto em
ângulo escalar — ou seja, em algum ponto do pipeline deles a matriz É
convertida para ângulo antes de suavizar. Um filtro de média ou mediana
aplicado ingenuamente sobre um ângulo que cruza ±180° teria exatamente o
mesmo problema que temos. O texto do paper não usa as palavras "wrap",
"discontinuity" ou "±180" em nenhum momento — o caso extremo nunca foi
testado por eles. Isto NÃO é uma solução pronta. É uma pista de arquitetura,
não uma prova.

O que o laboratório do Holz reforça (SIPLAB, ETH Zürich — HOOV: Hand
Out-of-View Tracking; Armani/Qian/Jiang/Holz, "Ultra Inertial Poser", ACM
SIGGRAPH 2024): o trabalho deles em tracking de pulso via IMU representa
orientação em quatérnions, nunca em ângulo de Euler isolado como estado
persistente. Quatérnion não tem descontinuidade em ±180° por construção.

EVIDÊNCIA:
COMPROVADO — Cvetković reconstrói a matriz de rotação do zero a cada quadro
(equações 5-10 do paper, verificadas no PDF completo em acesso aberto).
COMPROVADO — Holz/SIPLAB usa representação em quatérnion nos papers citados
(confirmado no texto de "Ultra Inertial Poser" e na literatura padrão de IMU
que o laboratório cita).
PROVAVEL — que a causa estrutural do salto no Ghost Engine é a escolha de
guardar rotZ como ângulo Euler acumulado, por analogia com os dois grupos
que não têm esse bug. Não é COMPROVADO porque não veio de teste isolado no
próprio Ghost Engine — veio de comparação de arquitetura com terceiros.
DESCONHECIDO — se migrar o Ghost Engine para quatérnion resolveria sem
introduzir regressão em outra parte do pipeline (ex.: calibração por
produto, que hoje pode depender de offsets em Euler).

FONTES:
- Cvetković, S., Špeletić, M., Nikolić, J. (2026). "Edge-Centric Augmented
  Reality Framework for Realtime Wristwatch Try-On." IJIMAI, 9(7), 78-87.
  DOI: 10.9781/ijimai.2026.2227 [OFICIAL/PAPER] — acesso aberto, CC-BY 4.0.
- Armani, R., Qian, C., Jiang, J., Holz, C. (2024). "Ultra Inertial Poser:
  Scalable Motion Capture and Tracking from Sparse Inertial Sensors and
  Ultra-Wideband Ranging." ACM SIGGRAPH 2024. [OFICIAL/PAPER]
- HOOV: Hand Out-Of-View Tracking for Proprioceptive Interaction using
  Inertial Sensing (SIPLAB). arxiv.org/pdf/2303.07016 [OFICIAL/PAPER]

APLICAÇÃO AO GHOST:
O fix já implementado (_unwrapRotZ() em fix/d1-d2-d4-estabilizacao, commit
9d1d523) resolve o SINTOMA — detecta o salto e corrige comparando com o
quadro anterior. Funciona, mas é reativo: depende de nunca perder o quadro
exato da virada (ex.: frame drop, mão saindo brevemente do enquadramento no
momento exato da rotação).

A pista da literatura aponta para uma correção estrutural, a considerar
DEPOIS do AR-004, não agora — e isto não é mandato para mexer em código hoje:
- Opção A (Cvetković): parar de acumular ângulo; reconstruir a orientação do
  zero a cada quadro a partir dos 3 pontos crus, igual ao paper faz.
- Opção B (Holz / prática padrão da indústria): migrar a representação
  interna de rotação para quatérnion. Three.js já suporta nativamente
  (THREE.Quaternion, .slerp() para interpolação suave sem descontinuidade).

Qualquer uma das duas elimina a CLASSE do bug em vez de remendar o sintoma a
cada caso novo que aparecer.

VEREDITO: PROVAVEL — a causa estrutural do salto (representação por ângulo
Euler acumulado, em vez de matriz/quatérnion reconstruído por quadro) é
consistente com a arquitetura de dois grupos de pesquisa independentes que
não têm esse bug. Não é COMPROVADO que migrar para quatérnion resolve sem
regressão no Ghost Engine especificamente.

CUSTO DE ADOÇÃO: MÉDIO — não é mudança pontual, é mudança de representação
interna de rotação em todo o pipeline (cálculo, buffer, calibração por
produto, aplicação ao modelo 3D). Não implementar antes do AR-004. Decisão
de arquitetura, não correção de bug isolado.

NOVAS PERGUNTAS GERADAS:
- Os offsets de calibração por produto (os 40 modelos do catálogo) estão
  armazenados em Euler ou em outra representação? Se em Euler, migrar
  rotação para quatérnion exige recalibrar todo o catálogo.
- O _unwrapRotZ() atual falha sob frame drop? Isso só se sabe testando —
  não foi verificado nesta análise.

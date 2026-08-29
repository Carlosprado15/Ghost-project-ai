# AR-KB — Base de Pesquisa Acumulativa do Motor AR (Ghost Project)

**Antes de qualquer coisa, ler [ALERTAS.md](ALERTAS.md)** — achados que
exigem atenção (crítico, alto ou oportunidade), se houver algum.

Máquina de pesquisa que acumula conhecimento técnico verificado sobre AR de
precisão espacial, para sustentar o motor AR do Ghost Project — hoje vendido
comercialmente para pulso (relógio/pulseira), mas projetado desde a raiz
como motor **universal**: corpo (anéis, óculos, roupa) e ambiente (móveis,
espaços). Nenhuma resposta aqui deve se apoiar numa solução específica de
pulso sem declarar explicitamente o que muda para corpo e ambiente — ver
campo `APLICABILIDADE` do template abaixo.

Esta é só a estrutura. Nenhum tópico foi pesquisado ainda nesta execução.

## Como isto se relaciona com docs/prado-rescue/

`docs/prado-rescue/` é o registro de **evidência medida** (testes reais em
aparelho, capturas, bugs encontrados e corrigidos no motor de verdade).
`docs/ar-research/` é o registro de **conhecimento externo** (papers,
documentação oficial, benchmarks de terceiros) que informa decisões futuras
do motor. Um não substitui o outro: antes de escrever um tópico aqui que
toque em algo já medido no projeto (ex.: comportamento do MediaPipe no
Motorola Razr 40, bug de wrap-around ±180° já corrigido em D4), o ciclo deve
ler `docs/prado-rescue/CURRENT_STATE.md` e `BASELINE.md` primeiro pra não
contradizer ou duplicar o que já foi comprovado na prática.

## Estrutura

```
docs/ar-research/
  INDEX.md          — este arquivo (visão geral + template obrigatório)
  QUEUE.md           — fila de perguntas, priorizada
  SOURCES.md         — log de todas as fontes citadas, por tópico
  SYNTHESIS.md        — consolidação da arquitetura de motor sustentada
                        pela pesquisa acumulada (escrito a cada 10 tópicos)
  topics/            — um arquivo por pergunta respondida (AR-KB-XXX.md)
scripts/ar-research/
  cycle.sh / cycle.bat — roda UM ciclo de pesquisa (ver seção Scripts)
```

## Camadas do motor (taxonomia usada em CAMADA)

| Sigla | Camada |
|---|---|
| A | CAMERA — captura de vídeo, sensor, driver |
| B | DETECTION — detecção do alvo (mão, corpo, objeto) no frame |
| C | LANDMARK — extração de pontos-chave |
| D | POSE — orientação/pose 3D derivada dos landmarks |
| E | TRACKING — continuidade entre frames, recuperação de perda |
| F | FILTER — suavização temporal |
| G | CALIBRATION — escala, referência, calibração de modelo/câmera |
| H | COORDINATE — sistemas de coordenadas, mapeamento de espaço |
| I | TRANSFORM — composição de translação/rotação/escala |
| J | ANCHOR — ancoragem espacial do objeto virtual |
| K | DEPTH — profundidade, oclusão por distância |
| L | OCCLUSION — oclusão por objeto/pessoa |
| M | RENDERING — composição visual final |
| N | PERFORMANCE — desempenho, orçamento de tempo/memória |
| O | DEVICE — variação entre aparelhos/plataformas |
| P | UX — percepção do usuário, sinais de estabilidade |

## Template obrigatório — todo arquivo em topics/ (máx. 120 linhas)

```
ID: AR-KB-XXX
CAMADA: (uma ou mais das siglas acima)
APLICABILIDADE: PULSO / CORPO / AMBIENTE / UNIVERSAL
   (campo obrigatório — se a resposta só serve para pulso,
    dizer explicitamente o que muda para corpo e ambiente)
PERGUNTA:
RESPOSTA EM 3 LINHAS:
DETALHAMENTO TÉCNICO: (máx 40 linhas, com a matemática quando houver)
EVIDÊNCIA: (número, benchmark, paper, medição — não opinião)
FONTES: (URLs completas, cada uma rotulada [OFICIAL]/[PAPER]/[COMUNIDADE]/[BLOG] — ver critério abaixo)
APLICAÇÃO AO GHOST: (o que isso muda no motor, em termos concretos)
VEREDITO: COMPROVADO / PROVAVEL / HIPOTESE / DESCONHECIDO
CUSTO DE ADOÇÃO: BAIXO / MÉDIO / ALTO
NOVAS PERGUNTAS GERADAS:
```

Regras do template:
- 120 linhas é limite rígido — se o assunto for maior, dividir em mais de um
  `AR-KB-XXX`, nunca estourar o limite num arquivo só.
- `EVIDÊNCIA` não aceita opinião do autor da fonte sem número/medição por
  trás — se a fonte só opina, o veredito não pode ser COMPROVADO.
- `APLICAÇÃO AO GHOST` tem que apontar arquivo/módulo real do motor quando
  fizer sentido (ex.: `src/engine/core/filters/`), não só "seria bom usar
  isso".
- `NOVAS PERGUNTAS GERADAS` alimenta `QUEUE.md` — todo tópico tende a abrir
  mais perguntas do que fecha; isso é esperado, é o motivo da fila ser viva.

## Critério de fonte (obrigatório, resolve ambiguidade de "oficial")

**OFICIAL** = domínio controlado pelo criador ou mantenedor da tecnologia
citada (ex.: `developers.google.com` para MediaPipe, `khronos.org` para
WebGL/glTF), ou paper publicado com revisão. **Estar no GitHub NÃO torna um
repositório oficial.** Um port, wrapper, fork ou reimplementação feita por
terceiro é **COMUNIDADE**, nunca OFICIAL — mesmo que seja bom, popular ou
tecnicamente correto.

Toda fonte em `FONTES:` deve vir rotulada com um destes quatro:
`[OFICIAL]` `[PAPER]` `[COMUNIDADE]` `[BLOG]`.

**Nenhuma alegação com veredito COMPROVADO pode se apoiar apenas em fonte
`[COMUNIDADE]` ou `[BLOG]`** — precisa de pelo menos uma `[OFICIAL]` ou
`[PAPER]` por trás, ou o veredito cai pra PROVAVEL/HIPOTESE.

## Registro de tópicos concluídos

| ID | Camada | Pergunta (resumo) | Veredito | Aplicabilidade |
|---|---|---|---|---|
| [AR-KB-001](topics/AR-KB-001.md) | F | 1€ vs Kalman vs conf-weighted para landmark de pulso: tradeoff com números | COMPROVADO / PROVAVEL | PULSO / CORPO / AMBIENTE |
| [AR-KB-002](topics/AR-KB-002.md) | F / D | Wrap-around ±180° em filtro temporal: angle unwrapping e quaternion double cover | COMPROVADO | PULSO / CORPO |
| [AR-KB-003](topics/AR-KB-003.md) | B / N / O | HandLandmarker GPU Adreno WebGL: FPS, memória e modos de falha documentados | COMPROVADO / PROVAVEL / HIPOTESE | PULSO / CORPO |
| [AR-KB-004](topics/AR-KB-ROTZ-DISCONTINUITY.md) | D / E / F | Como Cvetković e Holz representam rotação sem descontinuidade em ±180° — comparação com _unwrapRotZ() do Ghost Engine | PROVAVEL | PULSO / CORPO |
| [AR-KB-005](topics/AR-KB-005.md) | D / G / H | Troca de par de landmarks lm5-lm17 → lm1-lm17: como compensar salto angular na troca de referência (crossover-offset dinâmico) | COMPROVADO / PROVAVEL | PULSO / CORPO |
| [AR-KB-006](topics/AR-KB-006.md) | D / E | crossoverOffset entre frames: factory/closure vs. estado explícito como parâmetro — testabilidade e reentrância | COMPROVADO / PROVAVEL | PULSO / CORPO |
| [AR-KB-007](topics/AR-KB-007.md) | F / E / P | Frames de interpolação na troca de landmark pair: limiar de percepção de lag em AR de pulso a 30fps; lacuna de dado para jóia no pulso | COMPROVADO / HIPOTESE | PULSO / CORPO |
| [AR-KB-008](topics/AR-KB-008.md) | E | anchorState (crossoverOffset) durante tracking loss/recovery: preservar no hold, zerar quando hold expira | COMPROVADO / PROVAVEL | PULSO / CORPO |
| [AR-KB-009](topics/AR-KB-009.md) | F / E / D | crossoverOffset: step function vs. interpolado→0 durante fallback — bumpless transfer confirma step; ramp-up só no sub-caso recovery-pós-hold | COMPROVADO / PROVAVEL | PULSO / CORPO |

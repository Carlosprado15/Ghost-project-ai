ID: AR-KB-010
CAMADA: D-POSE, F-FILTER
APLICABILIDADE:
- PULSO: aplicação direta — mesmos 3 pontos que o Ghost Engine já lê (WRIST, INDEX_MCP, PINKY_MCP)
- CORPO: técnica generaliza para qualquer articulação com bone-pai definido (cotovelo, ombro), desde que haja uma pose de repouso pra calibrar a referência
- AMBIENTE: não aplicável (sem hierarquia de "osso" em objeto estático)

PERGUNTA: A técnica de swing-twist decomposition documentada no MiKaPo
(referência comunitária, Opção B do AR-KB-004) é viável de implementar do
zero no Ghost Engine, sem herdar código GPL-3.0? Qual o esboço de plano?

RESPOSTA EM 3 LINHAS:
Sim, é viável — a técnica é 3 passos matemáticos padrão (calibrar direção
de referência 1x, transformar landmark pro espaço local do pai por
quadro, gerar quatérnion via rotação mínima entre dois vetores), nenhum
deles exige o código-fonte do MiKaPo para ser reimplementado. O único
componente realmente específico do MiKaPo (retargeting p/ hierarquia de
bone de modelo MMD/PMX) não se aplica ao Ghost — o Ghost não tem uma
hierarquia de "esqueleto" a governar, só um nó de transform por produto.

DETALHAMENTO TÉCNICO:

Confirmado direto no README do MiKaPo (github.com/AmyangXYZ/MiKaPo,
lido em 01/09/2026), 3 partes relevantes ao Ghost:

1. CALIBRAÇÃO DE REPOUSO (1x, no carregamento): a direção mundo
   `pai → filho` na pose de repouso do modelo *é* a direção de referência
   local do pai (porque a cadeia de pais é identidade em repouso). Não
   precisa de nenhum dado externo — só ler os landmarks na primeira pose
   estável do usuário e guardar isso como referência.

2. TRANSFORM POR QUADRO: a cada quadro, (a) calcula o segmento
   mundo entre dois landmarks vivos, (b) converte pro espaço local do pai
   via conjugado do quatérnion do pai (`rotateVecInv`), (c) gera o
   quatérnion final por rotação mínima entre a referência calibrada e a
   direção ao vivo (`quatFromUnitVectors(ref, dir_ao_vivo)`). Isso é
   geometria pura — dois vetores 3D normalizados, produto vetorial +
   produto escalar pra montar o quatérnion de rotação mínima entre eles.
   Fórmula é de domínio público (mesma usada em qualquer engine 3D pra
   "olhar na direção de").

3. SWING-TWIST (antebraço/coxa): usa um "osso testemunha" — o segmento
   filho revela o twist (giro no eixo longitudinal) do osso pai; os dois
   segmentos formam bases ortonormais ponderadas pelo ângulo de dobra
   observável. O twist recebe um filtro próprio, mais forte, "bem mais
   calmo" que o swing — elimina tremor concentrado no ruído do landmark.
   Isso bate, ponto a ponto, com o que `z-noise-floor-analysis.md`
   (AR-007, medido hoje de manhã no aparelho real) já mostrou: o `z` é
   proporcionalmente muito mais ruidoso que x/y — exatamente o eixo que o
   "twist" isola. A arquitetura do MiKaPo já assume esse ruído como
   esperado e trata com filtro dedicado — o Ghost chegou na mesma
   conclusão por medição própria, de forma independente.

Suavização: One-Euro filter guiado por velocidade angular (mesma família
já usada no Ghost, `legacy-smooth`), mais um passo opcional
Savitzky-Golay em pós-processamento de gravação (não aplicável a
tempo real — é pra takes já gravados, não pro AR ao vivo).

EVIDÊNCIA:
PROVAVEL — confirmado por leitura direta do README (não é opinião de
terceiro sobre o projeto, é a documentação técnica do próprio autor).
Fonte é [COMUNIDADE] (reimplementação de terceiro, nunca OFICIAL), então
o teto de veredito aqui é PROVAVEL, não COMPROVADO, mesmo a leitura sendo
direta — regra do próprio INDEX.md. A base teórica (Opção B, quatérnion
sem descontinuidade) já é COMPROVADA em AR-KB-004 por fontes OFICIAIS/
PAPER (Cvetković, Holz/SIPLAB) — o MiKaPo só contribui a receita prática
de implementação, não a validação da ideia em si.

FONTES:
- github.com/AmyangXYZ/MiKaPo/blob/main/README.md [COMUNIDADE] — lido
  integralmente em 01/09/2026, GPL-3.0 confirmado (arquivo LICENSE do
  repositório).
- github.com/digitalworlds/UPose [COMUNIDADE] — segunda fonte
  independente, mesma técnica central em contexto Unity/C#, não lida
  linha a linha (só resumo), reforça que não é invenção isolada.
- Reaproveita fontes OFICIAL/PAPER já citadas em AR-KB-004 (Cvetković
  2026 IJIMAI, Holz/SIPLAB) para a base teórica do "por que quatérnion".

APLICAÇÃO AO GHOST — esboço de plano (sem código ainda):
1. Adaptar os 3 pontos que já são lidos hoje (WRIST, INDEX_MCP,
   PINKY_MCP em `src/tracking/WristTracker.js` / `src/engine/core/anchor/
   wristAnchor.js`) — o Ghost não precisa de hierarquia de bone-pai como
   o MMD, só precisa UM par pai→filho conceitual: pulso como "pai",
   direção antebraço↔mão como "filho" a orientar.
2. Calibração de repouso: capturar a direção WRIST→(centro INDEX/PINKY)
   no primeiro quadro com tracking estável e alta confiança — vira a
   referência local, substituindo qualquer rotação fixa hardcoded.
3. Por quadro: `quatFromUnitVectors(referência, direção_ao_vivo)` —
   função pequena e autocontida, sem herdar nada do MiKaPo além da ideia.
4. Twist (giro no eixo do antebraço) tratado com filtro próprio mais
   forte, alinhado à medição real de ruído do AR-007 — já temos o número,
   só falta a fórmula usar esse número como parâmetro.
5. Migração teria que decidir: implementar só no `src/engine/` (motor
   novo, ainda não em produção — risco zero pro que está ao vivo) ou
   também portar pro `src/tracking/` legado (risco alto, motor em
   produção). Recomendação de bom senso: prototipar SÓ no `src/engine/`
   primeiro.

VEREDITO: PROVAVEL — viável, tecnicamente descrito o suficiente pra
prototipar sem depender do código-fonte do MiKaPo em nenhum momento.

CUSTO DE ADOÇÃO: MÉDIO — mesma classificação que AR-KB-004 já dava pra
Opção B: não é ajuste pontual, é mudança de representação de rotação.
Este tópico não muda esse custo, só deixa o "como" mais concreto.

NOVAS PERGUNTAS GERADAS:
- Qual é a fórmula fechada de `quatFromUnitVectors(a, b)` mais estável
  numericamente quando `a` e `b` são quase opostos (180°) — caso de borda
  que qualquer implementação de rotação mínima entre vetores precisa
  tratar (divisão por quase-zero no produto vetorial)?
- Os offsets de calibração por produto (Euler, hoje) inviabilizam migrar
  só o cálculo de pose pra quatérnion mantendo a calibração como está, ou
  os dois sistemas podem conviver até o catálogo inteiro ser remigrado?

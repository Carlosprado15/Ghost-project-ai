ID: AR-KB-011
CAMADA: G-CALIBRATION
APLICABILIDADE: UNIVERSAL
- PULSO/CORPO/AMBIENTE: a técnica não é específica de nenhum alvo de AR —
  é uma etapa de QA de CATÁLOGO (comparar o GLB gerado com a foto real do
  produto), que roda antes de qualquer motor de tracking entrar em cena.
  Serve igualmente pra relógio, pulseira, anel, óculos ou móvel: qualquer
  categoria de produto que passe pelo pipeline foto→3D precisa da mesma
  checagem "isso é o objeto certo?".

PERGUNTA: Existe uma técnica de comparação de identidade/forma por
embedding visual (ex.: DINOv2) capaz de detectar automaticamente o tipo de
erro que qa-color-check.mjs (Parte 2 do QA de catálogo) NÃO pega — o
produto do render 3D ser fisicamente diferente da foto real (caso
CW006/CW007: geometria/objeto errado, não só cor errada)?

RESPOSTA EM 3 LINHAS:
Ainda não verificado de primeira mão nesta sessão — este tópico registra
uma pista trazida pelo Carlinhos de uma conversa paralela com o Claude
Chat (fontes específicas não trazidas pra cá ainda), não uma pesquisa
independente feita aqui. A ideia central (usar um embedding visual
tipo DINOv2 pra medir similaridade de "identidade" entre a foto real e um
render do GLB, além/no lugar da cor) é plausível e coerente com o estado
da arte de comparação de imagem por embedding, mas o veredito abaixo
reflete que isso não foi confirmado com fonte própria.

DETALHAMENTO TÉCNICO:

Por que este tópico existe apesar de não ter fonte própria ainda: em
02/09/2026, ao construir e validar qa-color-check.mjs (Parte 2 do QA
automático de catálogo — checagem de cor por distância RGB entre foto
real e render 3D), a validação em duas rodadas expôs um limite real e
medido do próprio script: ao testar contra o backup antigo/errado de
CW033 (`public/models/_pre_hyper3d_color_fix_backup/CW033.glb`), o script
NÃO sinalizou divergência (distância 26.8, abaixo do limiar) mesmo o
render antigo sendo visivelmente um objeto errado/quebrado — um blob
branco sem padrão nem geometria reconhecível, renderizado de um ângulo
que não é a face do produto, nada a ver com o relógio colorido rosa/
amarelo/azul da foto real. A checagem de cor (RGB médio) não pega esse
tipo de erro porque a "cor média" do blob branco por acaso ficou próxima
da cor média (clara) da foto real — o problema aqui não é tom, é
identidade/forma do objeto, uma dimensão que RGB médio simplesmente não
mede. Esse é exatamente o tipo de falha que o Carlinhos já tinha visto
"de olho" no caso CW006/CW007 (produto fisicamente diferente do gerador
3D) e que motivou a pergunta que ele trouxe do Claude Chat: existe uma
técnica de visão computacional que meça "isso é o mesmo objeto?" (forma/
identidade) em vez de "isso tem a mesma cor?".

DINOv2 (se a pista se confirmar com fonte própria) é um modelo de
self-supervised learning da Meta AI que produz embeddings visuais densos
usados amplamente pra similaridade de imagem sem precisar de rótulo —
comparar dois embeddings (foto real vs. screenshot do render) por
distância de cosseno daria um número de "quão parecido é o objeto",
capturando forma/textura/identidade, não só a média de cor. Isso é
consistente com o padrão geral de "embedding + distância de cosseno" já
usado em várias ferramentas de busca por imagem — mas essa frase é
conhecimento geral do assunto, não uma citação de fonte específica sobre
DINOv2 lida nesta sessão.

EVIDÊNCIA:
DESCONHECIDO — nenhuma fonte própria (paper, documentação oficial,
benchmark) foi lida nesta sessão pra sustentar a aplicabilidade específica
de DINOv2 a este problema. A ÚNICA evidência real e verificada aqui é o
FATO MEDIDO do blind spot de qa-color-check.mjs (distância 26.8 pra um
render visivelmente errado) — isso comprova que o problema existe e
precisa de uma solução diferente de cor; não comprova que DINOv2
especificamente é essa solução.

FONTES:
- Nenhuma. Relatado pelo Carlinhos, validado numa conversa paralela com o
  Claude Chat — fontes específicas ainda não trazidas pra esta sessão.
  Não inventar papers/URLs aqui até essas fontes serem trazidas e lidas de
  verdade (regra do INDEX.md: sem fonte [OFICIAL]/[PAPER] verificada, o
  veredito não pode subir de HIPOTESE).
- scripts/normalize-glb/qa-color-check.mjs (Parte 2, este repositório) —
  fonte primária do achado do blind spot (medição própria, 02/09/2026):
  ver `scripts/normalize-glb/qa-output/CW033_colorcheck_override.png`
  comparado a `CW033_ref.jpg`.

APLICAÇÃO AO GHOST: se confirmado, seria uma "Parte 3" natural do QA de
catálogo em `scripts/normalize-glb/` — um `qa-identity-check.mjs` ao lado
de `qa-compare.mjs` (Parte 1, visual humano) e `qa-color-check.mjs`
(Parte 2, cor). NÃO implementar agora — este tópico é só registro da
direção, por pedido explícito do Carlinhos. Antes de implementar,
precisaria: (1) trazer as fontes reais da conversa com o Claude Chat pra
esta base, (2) confirmar licença/custo de rodar DINOv2 (modelo local via
ONNX/transformers.js vs. API paga), (3) decidir o limiar de similaridade
do mesmo jeito empírico que qa-color-check.mjs fez pra DIVERGENCE_THRESHOLD
(validar contra casos conhecidos bons e ruins antes de confiar no número).

VEREDITO: HIPOTESE
CUSTO DE ADOÇÃO: DESCONHECIDO (depende de rodar DINOv2 local vs. via API —
não orçado)
NOVAS PERGUNTAS GERADAS:
- Trazer as fontes específicas da conversa do Claude Chat que validou
  DINOv2 pra este caso — sem isso, este tópico não pode sair de HIPOTESE.
- DINOv2 roda localmente (Node/Python, sem custo por chamada) ou só via
  API paga? Isso muda completamente o CUSTO DE ADOÇÃO.
- Existe alternativa mais simples (ex.: CLIP embeddings, que têm
  tooling mais madura em JS/ONNX) que resolva o mesmo problema com menos
  fricção de implementação no stack atual (Node + sharp + playwright)?

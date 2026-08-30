# Ghost Project AI — resumo pra por o Claude Chat a par (29-30/08/2026)

Documento pra você (Carlinhos) colar no Claude Chat quando for consultar ele, pra não precisar
explicar tudo de novo. Escrito em linguagem simples.

## Quem é quem

- **Você (Carlinhos)**: dono do projeto, não-programador.
- **Claude Code** (eu, quem escreveu isso): trabalha direto no código, no computador, testa no
  celular via cabo USB.
- **Claude Chat**: quem você está prestes a consultar agora — não tem acesso ao código nem ao
  celular, só ao que você mostrar/colar pra ele.

## O que é o Ghost Project, resumindo

Provador de AR (relógios/pulseiras) pra loja online — aponta a câmera do celular pro pulso, um
relógio 3D aparece "vestido" ali. Existem **dois motores de rastreamento em paralelo**:

- **Motor antigo** (`src/tracking/`) — é o que está na loja de verdade hoje. Foco atual: deixá-lo
  bom o suficiente pra abrir a loja.
- **Motor novo** (`src/engine/`) — experimental, só existe num laboratório de teste, não está na
  loja. Trabalho em paralelo, sem pressa de lançamento.

A loja **ainda não está aberta ao público** — só você e o Claude Code mexem nela pra manutenção.

## O que aconteceu ontem à noite (29/08)

1. Descobri por engano que estava trabalhando numa "branch" (versão paralela do projeto) antiga e
   desatualizada — corrigido, voltei pra branch principal certa (`ghost-engine-v1`).
2. Fiz uma auditoria de código do motor antigo e achei e corrigi 3 bugs reais:
   - A câmera do celular era tratada com um tamanho fixo errado (assumia formato "deitado" quando
     na verdade é "em pé") — deslocava o relógio quando a mão saía do centro da tela.
   - Quando a mão sai da câmera por mais de ~10s, existe um "reforço" que passa a seguir o braço em
     vez da mão — esse reforço não tinha proteção contra um giro brusco ao cruzar 180°. Corrigido.
   - A troca entre "seguir a mão" e "seguir o braço" acontecia sem suavizar a transição — corrigido
     (mede a diferença no momento da troca e compensa).
3. Limpei o catálogo: uma pasta de backup de 1,6GB esquecida, uma entrada de teste de outra loja
   sobrando no arquivo de calibração.
4. Pesquisei se o motor novo e o "reforço de braço" do motor antigo compartilham um problema
   conhecido de suavização de movimento — achei indício (não confirmado oficialmente) de que a
   biblioteca mais nova do Google (usada pelos dois) pode suavizar MENOS que a antiga, o que pode
   explicar tremor visto essa semana no motor novo.

## O que aconteceu hoje de manhã (30/08) — teste físico de verdade

Testei tudo isso no aparelho de teste atual (Motorola Razr 40), com você segurando o celular
apontado pro seu próprio pulso, e eu controlando a tela remotamente por cabo USB (abrindo links,
apertando botões, lendo os números de calibração, tirando prints) — você só precisou apontar a
câmera, sem precisar descrever nada em detalhe.

**Resultado: as 3 correções de ontem funcionam perfeitamente.** Palavras suas: "está tudo muito
perfeito". Sem tremedeira, o relógio acompanha e "gruda" no pulso.

Achamos e corrigimos mais 2 coisas ao vivo:
- O relógio estava **desproporcional** (pequeno demais) — a causa era dupla: um multiplicador de
  tamanho baixo E um teto de tamanho máximo que já estava sendo batido antes mesmo de tentar
  aumentar. Corrigido os dois.
- O relógio estava **levemente torto** — corrigido por um processo de calibração ao vivo (testamos
  valores extremos, calculamos matematicamente o ponto certo, e você confirmou visualmente:
  "agora está perfeito, não mexa mais").

Também testamos subir o "limiar de confiança" da detecção de mão pro padrão oficial recomendado —
não piorou nada, mantido.

**Tudo isso já está salvo no código** (commitado), pronto pra ser publicado quando você decidir.

## Achados encontrados, mas DECIDIDO NÃO MEXER agora (por opção sua, não esquecimento)

- **Mão fechada em punho** faz o relógio ficar pequeno (o cálculo usa a distância entre os dedos
  abertos). Você decidiu que é aceitável — uso normal é com a mão relaxada, não em punho fechado.
- **O relógio 3D parece mais um "adesivo" plano do que um objeto sólido** — ele gira certo na tela,
  mas nunca se inclina de verdade em 3D (pra frente/pra trás) conforme você inclina o pulso de
  verdade. Achei a causa exata no código (uma parte do cálculo de inclinação 3D real nunca foi
  implementada, sempre fica zerada). Você decidiu deixar pra depois, numa tarefa separada, com
  calma — prioridade agora é não mexer no que já está funcionando bem.

## Pendências reais que ainda faltam (catálogo, não é o motor)

- 3 produtos (de 35) ainda sem modelo 3D gerado — falta crédito na conta da Tripo3D (consultei
  hoje: saldo zerado).
- 2 produtos têm o modelo 3D errado (a IA gerou o objeto errado quando olhou a foto) — mesma
  situação, precisa de crédito Tripo pra regenerar.
- Não compensa comprar crédito só pra esses 5 agora — Carlinhos decidiu adiar essa decisão de
  gasto.

## O que fazer se for pedir ajuda ao Claude Chat agora

- Ele não sabe nada disso a menos que você cole este documento pra ele.
- Se for mostrar imagem/vídeo do celular pra ele analisar, tudo bem — mas qualquer decisão de
  código, ele não pode executar, só sugerir. Quem aplica no código sou eu (Claude Code).
- Evite pedir pra ele "recomeçar do zero" uma investigação que já está resolvida aqui (ex.: não
  precisa perguntar de novo "por que o relógio está torto" — isso já foi resolvido hoje).

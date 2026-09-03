# COLOR_CHECK_REPORT — QA automático de cor (Parte 2)
Gerado por `node scripts/normalize-glb/qa-color-check.mjs` em 2026-09-03

## Resumo — v1 (RGB) vs v2 (hue)

| | v1 (RGB completo, limiar 60) | v2 (matiz/hue, limiar 25°) |
|---|---|---|
| ✅ OK | 15/35 | 15/35 |
| 🔴 DIVERGENTE | 20/35 | **3/35** |
| ⚠️ COR NEUTRA (confira visualmente) | (categoria não existia) | 17/35 |

A v1 marcava 20 dos 35 produtos como "divergente", e a maioria era falso
alarme (diferença de brilho entre foto de estúdio e render, não diferença de
cor de verdade). A v2 derrubou isso pra **3 divergências** — CW007, CW018 e
CW025 — todas conferidas visualmente abaixo. As outras 17 antigas
"divergências" da v1 viraram ⚠️ COR NEUTRA: o script agora reconhece que não
tem uma leitura de cor confiável pra decidir sozinho (a maioria são relógios
prateados/pretos/cinza — cor genuinamente neutra ou dominada por metal —, não
produtos que mudaram de cor de verdade).

**Confirmado visualmente, produto por produto** (abrindo a foto real e o
screenshot do render lado a lado):
- **CW007** — 🔴 correto: é um dos 5 produtos com modelo 3D errado já
  conhecidos (CW006/007/037/038/039, ver memória do projeto) — render é um
  relógio metálico genérico, nada a ver com a pulseira preta fitness da foto.
- **CW018** — 🔴 plausível: pulseira infantil bege/pêssego com estampa de
  desenho na foto real vira uma pulseira mais acinzentada/esbranquiçada no
  render, com estampa parecida mas não idêntica. Vale conferir com atenção,
  mas não parece falso alarme.
- **CW025** — 🔴 BORDA, atenção: visualmente os dois batem bem (relógio preto
  fosco com detalhes rosa/vermelho nos dois lados) — a distância de hue
  (36.8°) ficou logo acima do limiar (25°) porque o detalhe colorido ocupa
  uma área pequena demais do relógio pra dar uma leitura de matiz estável;
  ruído de amostragem, não uma cor errada de verdade. Candidato natural se
  o limiar for recalibrado pra cima no futuro (ver seção de recalibração).
- **CW023, CW024, CW027, CW028, CW031, CW033, CW039** — motivo pelo qual NÃO
  ficaram mais 🔴 nesta versão: são o mesmo padrão do CW025 (relógio
  prateado/preto + detalhe colorido pequeno) só que com distância de hue
  abaixo do limiar — confirmado visualmente que os 3 verificados a fundo
  (CW023, CW024, CW033) batem bem com a foto real.

## v2 — comparação por matiz (hue)

Compara a cor média do produto na FOTO REAL (recorte central, aproximação —
ver nota de método no topo de `qa-color-check.mjs`) com a cor média do
produto no RENDER 3D atual (`public/models/normalized/<ID>.glb`, fundo
sólido conhecido subtraído por exclusão de cor — precisão real, não
aproximação).

**v2 compara só o MATIZ (hue, canal H do HSV, 0-360°)**, não RGB completo —
hue não muda com diferença de brilho/exposição entre foto de estúdio e
render 3D, que era a causa da maioria dos falsos alarmes da v1 (ver seção
"v1 — histórico" abaixo). Distância de hue é circular, escala 0-180°.

**Limiar de divergência atual: 25°** (constante `DIVERGENCE_THRESHOLD_HUE`
no topo do script — ajustar lá se necessário). Cores com saturação abaixo de
0.12 (escala 0-1) são tratadas como "neutras"
(preto/branco/cinza) — ver `SATURATION_NEUTRAL_THRESHOLD` e a nota de método
sobre esse caso de borda no topo do script. Tolerância de exclusão de fundo
do render: 30. Recorte central da foto real: 57%.

| Produto | Cor real (recorte central) | Cor render (fundo excluído) | Distância de hue | Cobertura produto no render | Veredito |
|---|---|---|---|---|---|
| CW001 | rgb(124, 125, 136)<br><sub>H237° S9% V53%</sub> | rgb(185, 184, 177)<br><sub>H54° S5% V73%</sub> | 176.7° | 16.5% | ⚠️ COR NEUTRA (confira visualmente) <br><sub>render e foto real têm saturação baixa (preto/branco/cinza) — matiz não é confiável aqui, comparação por hue foi pulada de propósito.</sub> |
| CW002 | rgb(173, 147, 116)<br><sub>H33° S33% V68%</sub> | rgb(186, 165, 126)<br><sub>H39° S32% V73%</sub> | 6.5° | 10.9% | ✅ OK |
| CW003 | rgb(175, 173, 166)<br><sub>H45° S5% V69%</sub> | rgb(118, 130, 128)<br><sub>H170° S9% V51%</sub> | 124.7° | 17.5% | ⚠️ COR NEUTRA (confira visualmente) <br><sub>render e foto real têm saturação baixa (preto/branco/cinza) — matiz não é confiável aqui, comparação por hue foi pulada de propósito.</sub> |
| CW004 | rgb(212, 202, 199)<br><sub>H12° S6% V83%</sub> | rgb(161, 136, 122)<br><sub>H21° S24% V63%</sub> | 9.0° | 21.3% | ✅ OK |
| CW005 | rgb(195, 192, 185)<br><sub>H45° S5% V76%</sub> | rgb(49, 49, 49)<br><sub>H209° S0% V19%</sub> | 163.7° | 12.0% | ⚠️ COR NEUTRA (confira visualmente) <br><sub>render e foto real têm saturação baixa (preto/branco/cinza) — matiz não é confiável aqui, comparação por hue foi pulada de propósito.</sub> |
| CW006 | rgb(124, 120, 117)<br><sub>H24° S5% V48%</sub> | rgb(93, 91, 91)<br><sub>H10° S3% V37%</sub> | 14.8° | 17.8% | ⚠️ COR NEUTRA (confira visualmente) <br><sub>render e foto real têm saturação baixa (preto/branco/cinza) — matiz não é confiável aqui, comparação por hue foi pulada de propósito.</sub> |
| CW007 | rgb(18, 17, 16)<br><sub>H32° S12% V7%</sub> | rgb(95, 95, 96)<br><sub>H243° S1% V38%</sub> | 148.4° | 17.2% | 🔴 DIVERGENTE |
| CW008 | rgb(218, 200, 175)<br><sub>H35° S20% V86%</sub> | rgb(143, 126, 85)<br><sub>H42° S41% V56%</sub> | 7.4° | 24.6% | ✅ OK |
| CW009 | rgb(189, 170, 162)<br><sub>H17° S14% V74%</sub> | rgb(170, 157, 139)<br><sub>H35° S18% V67%</sub> | 17.7° | 15.8% | ✅ OK |
| CW013 | rgb(63, 63, 65)<br><sub>H240° S3% V25%</sub> | rgb(86, 82, 82)<br><sub>H4° S4% V34%</sub> | 123.8° | 7.7% | ⚠️ COR NEUTRA (confira visualmente) <br><sub>render e foto real têm saturação baixa (preto/branco/cinza) — matiz não é confiável aqui, comparação por hue foi pulada de propósito.</sub> |
| CW014 | rgb(69, 71, 74)<br><sub>H223° S7% V29%</sub> | rgb(106, 104, 104)<br><sub>H1° S1% V41%</sub> | 137.9° | 27.0% | ⚠️ COR NEUTRA (confira visualmente) <br><sub>render e foto real têm saturação baixa (preto/branco/cinza) — matiz não é confiável aqui, comparação por hue foi pulada de propósito.</sub> |
| CW016 | rgb(148, 151, 154)<br><sub>H217° S4% V60%</sub> | rgb(111, 118, 125)<br><sub>H210° S11% V49%</sub> | 7.6° | 19.8% | ⚠️ COR NEUTRA (confira visualmente) <br><sub>render e foto real têm saturação baixa (preto/branco/cinza) — matiz não é confiável aqui, comparação por hue foi pulada de propósito.</sub> |
| CW017 | rgb(149, 152, 153)<br><sub>H184° S3% V60%</sub> | rgb(100, 100, 100)<br><sub>H97° S0% V39%</sub> | 87.7° | 19.6% | ⚠️ COR NEUTRA (confira visualmente) <br><sub>render e foto real têm saturação baixa (preto/branco/cinza) — matiz não é confiável aqui, comparação por hue foi pulada de propósito.</sub> |
| CW018 | rgb(215, 196, 171)<br><sub>H35° S20% V84%</sub> | rgb(165, 165, 155)<br><sub>H60° S6% V65%</sub> | 25.1° | 10.9% | 🔴 DIVERGENTE |
| CW019 | rgb(130, 129, 130)<br><sub>H333° S0% V51%</sub> | rgb(94, 89, 88)<br><sub>H3° S6% V37%</sub> | 30.3° | 22.1% | ⚠️ COR NEUTRA (confira visualmente) <br><sub>render e foto real têm saturação baixa (preto/branco/cinza) — matiz não é confiável aqui, comparação por hue foi pulada de propósito.</sub> |
| CW020 | rgb(135, 118, 109)<br><sub>H20° S19% V53%</sub> | rgb(140, 124, 105)<br><sub>H32° S25% V55%</sub> | 11.9° | 28.3% | ✅ OK |
| CW021 | rgb(136, 141, 145)<br><sub>H206° S6% V57%</sub> | rgb(92, 94, 94)<br><sub>H192° S3% V37%</sub> | 13.9° | 27.0% | ⚠️ COR NEUTRA (confira visualmente) <br><sub>render e foto real têm saturação baixa (preto/branco/cinza) — matiz não é confiável aqui, comparação por hue foi pulada de propósito.</sub> |
| CW022 | rgb(187, 172, 146)<br><sub>H39° S22% V73%</sub> | rgb(163, 143, 97)<br><sub>H42° S40% V64%</sub> | 3.3° | 27.2% | ✅ OK |
| CW023 | rgb(143, 129, 123)<br><sub>H19° S14% V56%</sub> | rgb(126, 123, 123)<br><sub>H1° S2% V49%</sub> | 18.6° | 25.4% | ✅ OK |
| CW024 | rgb(88, 79, 59)<br><sub>H42° S33% V35%</sub> | rgb(111, 110, 104)<br><sub>H49° S7% V44%</sub> | 6.9° | 31.0% | ✅ OK |
| CW025 | rgb(75, 37, 44)<br><sub>H350° S50% V30%</sub> | rgb(81, 80, 80)<br><sub>H27° S1% V32%</sub> | 36.8° | 21.9% | 🔴 DIVERGENTE |
| CW026 | rgb(186, 188, 193)<br><sub>H221° S4% V76%</sub> | rgb(110, 112, 118)<br><sub>H223° S7% V46%</sub> | 2.2° | 40.0% | ⚠️ COR NEUTRA (confira visualmente) <br><sub>render e foto real têm saturação baixa (preto/branco/cinza) — matiz não é confiável aqui, comparação por hue foi pulada de propósito.</sub> |
| CW027 | rgb(194, 186, 180)<br><sub>H26° S7% V76%</sub> | rgb(111, 93, 76)<br><sub>H29° S31% V43%</sub> | 3.3° | 37.5% | ✅ OK |
| CW028 | rgb(163, 164, 168)<br><sub>H229° S3% V66%</sub> | rgb(96, 115, 133)<br><sub>H209° S28% V52%</sub> | 19.3° | 15.6% | ✅ OK |
| CW029 | rgb(160, 127, 106)<br><sub>H23° S33% V63%</sub> | rgb(178, 158, 148)<br><sub>H21° S17% V70%</sub> | 2.3° | 29.9% | ✅ OK |
| CW030 | rgb(134, 132, 131)<br><sub>H19° S3% V53%</sub> | rgb(83, 78, 75)<br><sub>H19° S9% V33%</sub> | 0.2° | 24.4% | ⚠️ COR NEUTRA (confira visualmente) <br><sub>render e foto real têm saturação baixa (preto/branco/cinza) — matiz não é confiável aqui, comparação por hue foi pulada de propósito.</sub> |
| CW031 | rgb(201, 196, 195)<br><sub>H8° S3% V79%</sub> | rgb(114, 99, 98)<br><sub>H5° S14% V45%</sub> | 2.6° | 25.8% | ✅ OK |
| CW032 | rgb(228, 220, 218)<br><sub>H15° S4% V89%</sub> | rgb(139, 127, 124)<br><sub>H14° S11% V54%</sub> | 1.0° | 26.1% | ⚠️ COR NEUTRA (confira visualmente) <br><sub>render e foto real têm saturação baixa (preto/branco/cinza) — matiz não é confiável aqui, comparação por hue foi pulada de propósito.</sub> |
| CW033 | rgb(239, 226, 219)<br><sub>H19° S8% V94%</sub> | rgb(151, 104, 79)<br><sub>H21° S48% V59%</sub> | 2.1° | 39.4% | ✅ OK |
| CW034 | rgb(135, 134, 135)<br><sub>H340° S1% V53%</sub> | rgb(129, 126, 127)<br><sub>H332° S3% V51%</sub> | 8.1° | 23.6% | ⚠️ COR NEUTRA (confira visualmente) <br><sub>render e foto real têm saturação baixa (preto/branco/cinza) — matiz não é confiável aqui, comparação por hue foi pulada de propósito.</sub> |
| CW035 | rgb(90, 85, 86)<br><sub>H354° S6% V35%</sub> | rgb(133, 132, 125)<br><sub>H49° S6% V52%</sub> | 55.2° | 18.0% | ⚠️ COR NEUTRA (confira visualmente) <br><sub>render e foto real têm saturação baixa (preto/branco/cinza) — matiz não é confiável aqui, comparação por hue foi pulada de propósito.</sub> |
| CW036 | rgb(76, 77, 75)<br><sub>H96° S2% V30%</sub> | rgb(95, 95, 95)<br><sub>H67° S0% V37%</sub> | 28.8° | 18.2% | ⚠️ COR NEUTRA (confira visualmente) <br><sub>render e foto real têm saturação baixa (preto/branco/cinza) — matiz não é confiável aqui, comparação por hue foi pulada de propósito.</sub> |
| CW037 | rgb(119, 119, 120)<br><sub>H246° S1% V47%</sub> | rgb(103, 103, 103)<br><sub>H29° S0% V41%</sub> | 142.6° | 24.1% | ⚠️ COR NEUTRA (confira visualmente) <br><sub>render e foto real têm saturação baixa (preto/branco/cinza) — matiz não é confiável aqui, comparação por hue foi pulada de propósito.</sub> |
| CW038 | rgb(134, 122, 103)<br><sub>H37° S23% V53%</sub> | rgb(156, 152, 130)<br><sub>H49° S17% V61%</sub> | 11.9° | 26.0% | ✅ OK |
| CW039 | rgb(169, 166, 166)<br><sub>H7° S2% V66%</sub> | rgb(159, 122, 103)<br><sub>H21° S35% V62%</sub> | 13.5° | 30.4% | ✅ OK |

**Resultado: 15/35 ✅ OK · 3 🔴 DIVERGENTE · 17 ⚠️ COR NEUTRA (confira visualmente)**

> Nota de método (recorte central da foto real): aproximação v1, não é
> segmentação de verdade — assume fundo claro/branco e produto centralizado,
> como é o padrão das fotos de catálogo usadas hoje. Pode enviesar pra mais
> claro em produtos finos/pequenos dentro do frame. Nota de método (fundo do
> render): aqui a exclusão é exata, por distância de cor até o fundo sólido
> conhecido (#161616) — não é aproximação.
>
> "⚠️ COR NEUTRA" não é um erro nem um OK automático — é um aviso de que o
> script não confia na própria resposta pra esse produto (as duas cores são
> preto/branco/cinza, e matiz não é um sinal confiável nesse regime). Precisa
> de um olhar humano rápido, não é pra ser tratado como falha de pipeline.

## Rodada 2 — validação contra os 4 erros reais conhecidos

Backups em `public/models/_pre_hyper3d_color_fix_backup/` (versões ANTIGAS,
com defeito confirmado, de CW017/CW028/CW032/CW033 — já substituídas nos
arquivos atuais do catálogo). Rodado com o mecanismo de override do script
(`"CW017=caminho\do\backup.glb"`), que serve o arquivo antigo sem passar pela
calibração de rotação atual — ver ressalva abaixo.

| Produto (backup antigo) | Cor real | Cor render (backup) | Distância de hue | Veredito v2 |
|---|---|---|---|---|
| CW017 | H184° S3% V60% | H92° S0% V40% | 92.9° | ⚠️ COR NEUTRA |
| CW028 | H229° S3% V66% | H69° S1% V37% | 160.2° | ⚠️ COR NEUTRA |
| CW032 | H15° S4% V89% | H203° S0% V24% | 171.8° | ⚠️ COR NEUTRA |
| CW033 | H19° S8% V94% | H318° S0% V84% | 60.8° | ⚠️ COR NEUTRA |

**Nenhum dos 4 foi automaticamente marcado 🔴 DIVERGENTE pela v2 — os 4
caíram em ⚠️ COR NEUTRA.** Isso NÃO é uma regressão silenciosa: abri as 4
imagens (foto real + screenshot do render antigo) pra entender o motivo, e a
causa é mais profunda que "cor errada" — nos 4 casos o render antigo parece
ser um **OBJETO/GEOMETRIA errada**, não só uma cor errada num objeto certo:

- **CW032 antigo**: a foto real é uma pulseira fitness rosa clara; o render
  antigo é uma cápsula/pod preta sólida — não parece a mesma peça em ângulo
  nenhum, é outra forma.
- **CW028 antigo**: a foto real é uma pulseira azul-marinho com tela; o
  render antigo é um objeto cinza em formato de fone/clipe de fone de ouvido
  — de novo, não parece a mesma peça.
- Os dois renders antigos saíram quase pretos/cinzas (saturação ~0-1%), o que
  é consistente com "geometria errada gerando reflexos/sombras estranhos",
  não com "objeto certo pintado da cor errada".

Um objeto com forma totalmente errada não tem "matiz esperado" nenhum pra
comparar — é estruturalmente o mesmo limite já esperado e documentado pro
CW033 antigo no pedido original desta tarefa ("não é esperado que hue
resolva isso, é problema de forma"). Na prática, os 4 casos conhecidos como
"erro de cor" acabaram sendo, no fundo, erros de geometria/objeto — checagem
de cor (v1 OU v2) não é a ferramenta certa pra pegar esse tipo de problema;
`qa-compare.mjs` (comparação visual lado a lado) e conferência humana
continuam necessários pra esse tipo de erro.

**Ressalva sobre esta rodada 2 especificamente:** o mecanismo de override
serve o `.glb` de backup bruto, sem passar pela calibração de rotação do
catálogo atual (`normalize.mjs` + `product-calibration-overrides.json`) — a
câmera fixa do `_qa-color.html` pode estar olhando pra um ângulo estranho da
peça, não necessariamente "a frente". Não é possível ter 100% de certeza de
que o formato realmente é outro objeto sem girar o modelo — mas visualmente,
nos 4 screenshots, nenhum lembra o formato de pulseira/relógio em ângulo
nenhum razoável.

## v1 — histórico (RGB completo, substituído em 2026-09-02)

A primeira versão deste script comparava a distância euclidiana RGB completa
(escala 0-441, limiar 60) em vez de só o matiz. Rodada real contra os 35
produtos do catálogo em 2026-09-02: **15/35 ✅ OK · 20 🔴 DIVERGENTE**, mas a
maioria dos 20 "divergentes" era falso alarme causado só por diferença de
brilho entre foto de estúdio e render (ex.: CW001 por causa de foto de estilo
de vida, CW005 por causa do selo "100% ORIGINAL" na foto, CW033 já corrigido
e visualmente perfeito deu distância 206 só de brilho). Ver "Resumo — v1 vs
v2" no topo deste arquivo pra comparação completa.

## Recalibração — pra quem for ajustar os limiares depois

Duas constantes no topo de `qa-color-check.mjs`:
- `DIVERGENCE_THRESHOLD_HUE` (atual: 25°) — se aparecerem muitos falsos
  alarmes tipo CW025 (detalhe de cor pequeno, ruído de amostragem), considere
  subir pra ~35-40°. Se aparecerem divergências reais passando batido,
  considere descer.
- `SATURATION_NEUTRAL_THRESHOLD` (atual: 0.12, escala 0-1) — controla quando
  o script desiste de comparar hue e pede conferência humana. Baixar esse
  valor faz o script tentar comparar hue com mais frequência (mais risco de
  hue instável em cor quase neutra); subir faz mais produtos caírem em
  "⚠️ COR NEUTRA" (mais seguro, mas exige mais conferência manual).

**Duas heurísticas de "gate" foram tentadas e descartadas** antes de chegar
no design atual (exigir sinal de cor em pelo menos um dos dois lados) — ver
comentário completo em `classifyColorMatch()` no código: exigir saturação
boa nos dois lados marcava demais como neutro; exigir só do lado do render
gerava falso alarme em relógios prateado/preto com detalhe de cor pequeno
(CW023/CW024/CW025 — 3 falsos alarmes confirmados nessa tentativa
intermediária, não presentes na versão final).

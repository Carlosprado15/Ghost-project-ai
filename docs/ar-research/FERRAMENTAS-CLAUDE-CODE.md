# Ferramentas descobertas para o Claude Code — Ghost Project

Levantamento feito por Carlinhos via busca manual (o botão de Pesquisa
Avançada falhou tecnicamente em 01/09/2026). Cinco achados. Avaliação do
Claude Code no final de cada item — nada foi instalado.

## 1. MiKaPo / Reze Engine — referência de arquitetura para o bug de rotação

CAMADA: D-POSE, F-FILTER
RELEVÂNCIA: MÁXIMA — resolve, com código funcionando, a mesma classe de
bug documentada em AR-KB-004 (ROTZ-DISCONTINUITY)

Projeto web (Next.js/TypeScript, MediaPipe HolisticLandmarker) que anima
modelos MMD a partir de webcam em tempo real. O README nomeia
explicitamente o problema: "uma abordagem ingênua baseada em ângulo Euler
vaza o giro do pulso pro pitch/yaw e gimbal-trava" — a mesma classe de
bug do wristAnchor.js.

Técnica usada (documentada com pseudocódigo no README):
1. Calibra uma vez, na pose de repouso do modelo, a direção de referência
   de cada osso
2. A cada quadro, transforma os landmarks pro espaço local do osso pai
3. Rotaciona a referência calibrada até a direção ao vivo — produz
   quatérnion diretamente, nunca ângulo Euler acumulado
4. "Swing-twist decomposition" separa matematicamente girar (twist) de
   inclinar (swing) no antebraço — resolve o mesmo problema que a
   Opção B do AR-KB-004 apontava (migrar pra quatérnion)
5. Suaviza o quatérnion final com One-Euro filter (mesma família de
   filtro que o Ghost Engine já usa — legacy-smooth)

⚠️ LICENÇA: GPL-3.0. Não copiar código pra dentro do Ghost Engine
(produto comercial fechado) — GPL exigiria abrir o código do motor.
Uso permitido: estudar a técnica, escrever implementação própria
inspirada nela.

Repositório: github.com/AmyangXYZ/MiKaPo (605 estrelas, ativo, última
versão 03/05/2026)

**AVALIAÇÃO CLAUDE CODE:** Vale a pena — mas como leitura, não como
adoção. Confirmei a licença de forma independente (não confiei só no
levantamento): GPL-3.0, leitura correta, não copiar nenhuma linha de
código pro motor fechado. A técnica em si (swing-twist decomposition +
quatérnion por quadro, nunca ângulo acumulado) é exatamente a direção
que AR-KB-004 já apontava como "Opção B" — isso não é uma ideia nova,
é confirmação de que o caminho certo já identificado tem implementação
de referência funcionando. Vale abrir um tópico novo em
`docs/ar-research/topics/` estudando a técnica com atenção, citando
MiKaPo como fonte [COMUNIDADE] (nunca OFICIAL, é reimplementação de
terceiro) — mas a escrita do código é sempre nossa, do zero.

## 2. UPose — segunda referência, mesma técnica, contexto Unity

CAMADA: D-POSE
RELEVÂNCIA: MÉDIA — confirma que a técnica de #1 é padrão da indústria,
não invenção isolada de um projeto

Biblioteca que calcula GetRotation(landmark) retornando quatérnion
diretamente a partir de dados de pose do MediaPipe, pra animação de
avatar no Unity. Mesma ideia central de #1 (quatérnion por quadro, não
ângulo acumulado), em contexto diferente (Unity/C#, não navegador).
Serve como segunda confirmação da abordagem, não como código a importar.

Repositório: github.com/digitalworlds/UPose

**AVALIAÇÃO CLAUDE CODE:** Vale, mas só como nota de rodapé — não merece
ciclo de pesquisa próprio. O valor real dela é estatístico: duas
implementações independentes (Next.js/web e Unity/C#) chegando na mesma
técnica é evidência de que "quatérnion por quadro" é solução madura da
indústria, não gambiarra de um projeto só. Isso sobe o veredito de
AR-KB-004 de PROVAVEL pra mais perto de COMPROVADO da próxima vez que
esse tópico for revisitado — citar como segunda fonte, não abrir tópico
novo.

## 3. 3D Asset Processing MCP — validação/otimização do catálogo

CAMADA: nenhuma (ferramenta de pipeline, não do motor)
RELEVÂNCIA ALTA — ligado ao problema real de hoje: o CW037 saiu do Meshy
com 1.990.272 faces / 12,8MB no modo pago (o Lite gratuito saiu bem mais
leve, mas sem controle fino sobre isso)

Ferramenta MCP (conecta ao Claude Code) que valida e otimiza arquivos
GLB/glTF automaticamente: compressão Draco/Meshopt, otimização de
textura, estatísticas de geometria. Instalação simples (um comando npx).

Aplicação prática: em vez de confiar que cada gerador (Meshy, Tripo,
futuros) entrega um arquivo do tamanho certo, o Claude Code poderia
validar e comprimir automaticamente todo .glb novo antes dele entrar em
public/models/ — reduzindo risco de um modelo pesado demais derrubar o
FPS no celular, igual ao problema que vocês já investigam essa semana.

**AVALIAÇÃO CLAUDE CODE (atualizada 01/09 depois de testar de verdade):**
Não vale — testado, instalado e usado nos 68 arquivos do catálogo
(brutos + normalizados, exceto CW006). Confirma a suspeita inicial (a
compressão Draco já roda automaticamente via `normalize.mjs`) e mostra
mais um problema: **a parte de "validação de conformidade" da
ferramenta — o motivo mais forte pra ter instalado ela — está com bug**,
marca todo arquivo como inválido com o mesmo erro interno
(`validatorResult.issues is not iterable`), e os "selos de
compatibilidade" (WebGL2/iOS/Android) são fixos, não calculados de
verdade. É projeto de autor individual, versão beta — não vale manter
instalado nesse estado. Removido de `.mcp.json`.

A parte de estatística (tamanho/geometria) funcionou bem e trouxe um
achado real, sem relação com o MCP em si: **quase todo o catálogo
(30 de 34 produtos, todos vindos da Tripo3D) usa ~2 milhões de
triângulos por peça, sem relação com a complexidade real do objeto** —
parece densidade fixa de geração da Tripo, não ajuste por produto. Os 4
produtos vindos da Meshy saem 10-20x mais enxutos com aparência
equivalente. Vale investigar ajuste de parâmetro na geração futura via
Tripo — não urgente, catálogo já funciona hoje com esse peso.

## 4. BlenderMCP — geração e correção de 3D direto pelo Claude Code

CAMADA: nenhuma (ferramenta de pipeline)
RELEVÂNCIA ALTA — substitui o processo manual de ontem à noite no Meshy

Conecta o Blender (programa profissional de 3D, gratuito) ao Claude
Code. Deixa o Claude Code criar, ajustar, aplicar material e gerar
modelo 3D a partir de imagem (via integração Hyper3D/Rodin) — sem
precisar de você clicando em botões numa interface web. Também consegue
baixar assets de bibliotecas abertas (Poly Haven) e rodar Python dentro
do Blender pra correções finas.

Exige instalar Blender (gratuito) + um add-on no computador.

**AVALIAÇÃO CLAUDE CODE:** Vale, mas não agora. É a ferramenta mais
poderosa da lista — resolveria de raiz o problema que causou a
confusão do CW006 hoje (eu controlando a geração inteira, sem depender
de qual foto você escolhe no site nem de qual arquivo eu tenho no disco
na hora certa). Mas isso é uma mudança de arquitetura de pipeline, não
um ajuste — exige instalar Blender + add-on no seu computador, aprender
a integração Hyper3D/Rodin, e testar num produto de baixo risco antes de
confiar nela pro catálogo real. Com o catálogo quase fechado e o motor
AR sendo a prioridade da semana, não é hora de abrir essa frente. Guardar
pra quando o próximo lote grande de produtos precisar ser gerado (ex.:
quando a loja crescer de novo, como aconteceu de 15 pra 35).

## 5. Chrome DevTools MCP — formaliza a captura dos testes AR-004

CAMADA: E-TRACKING (ferramenta de teste, não do motor)
RELEVÂNCIA MÉDIA-ALTA — o Claude Code já faz isso na unha com scripts
customizados (capture-console-live.mjs) toda vez que roda um teste físico

Ferramenta MCP oficial pra inspeção ao vivo do Chrome via protocolo
DevTools: console, rede, performance, screenshots — tudo pronto, testado,
em vez de escrever script novo a cada rodada de captura.

**AVALIAÇÃO CLAUDE CODE:** Vale a pena, e essa é a recomendação mais
forte das cinco. Confirmei: é mantida oficialmente pelo próprio time do
Chrome DevTools do Google (`ChromeDevTools/chrome-devtools-mcp`,
43 mil+ estrelas, listada em developer.chrome.com) — não é ferramenta
de comunidade, é oficial de verdade, critério que `EXPERTS.md` e
`INDEX.md` tratam como o mais alto. Ela substitui diretamente
`capture-console-live.mjs`, que tem um bug conhecido e não corrigido
(engole erro silenciosamente dentro do coletor `setInterval` — já causou
resultado todo `null` duas vezes numa mesma sessão de teste físico, na
semana da inclinação 3D). Trocar um script caseiro com bug conhecido
por uma ferramenta oficial testada por milhares de projetos é o tipo de
troca que só tem lado bom. Único custo real é o
tempo de trocar os scripts atuais pra usar ela em vez do CDP cru — não é
urgente, mas não tem motivo pra adiar muito.

## Próximo passo sugerido (não é execução, é avaliação)

Nenhuma dessas ferramentas deve ser instalada às pressas. Antes de
adotar qualquer uma, vale o Claude Code avaliar cada uma com a mesma
régua usada no EXPERTS.md: o que ela resolve de verdade, o que custa
(tempo de instalação, dependência nova), e qual risco pro que já está
estável.

---

## Resumo da avaliação (2026-09-01)

| # | Ferramenta | Veredito |
|---|---|---|
| 1 | MiKaPo | Vale — como leitura/técnica, nunca como código (GPL-3.0 confirmado) |
| 2 | UPose | Vale — só como segunda fonte, não abre tópico novo |
| 3 | 3D Asset Processing MCP | Não vale — testado, validação de conformidade tem bug; achou 2M triângulos/peça em quase todo catálogo Tripo (achado real, sem relação com a ferramenta em si) |
| 4 | BlenderMCP | Vale, mas não agora — mudança de arquitetura, guardar pro próximo lote grande |
| 5 | Chrome DevTools MCP | Vale a pena — oficial Google, substitui script caseiro com bug conhecido |

Nada foi instalado. Nenhum código do motor, catálogo ou SDK foi alterado.

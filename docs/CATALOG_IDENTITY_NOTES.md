# Identidade de produto no catálogo — GID Shopify como fonte de verdade

**Por que este arquivo existe:** o dia 01/09/2026 inteiro foi consumido
numa investigação de "qual produto é o CW006/CW007" que só fechou de
verdade com consulta direta à API da Shopify (via Claude Chat) — nome de
arquivo local, `id` em `products.json` e memória de quem cadastrou o
produto meses atrás não bastaram. Este arquivo existe pra nunca mais
precisar repetir esse trabalho.

## Regra daqui pra frente

O nome do arquivo local (`CW006.glb`, `fotos-limpas/CW007.png` etc.) e o
`id` em `products.json` **não são identidade confiável** — são só
rótulos de conveniência do nosso lado. A única identidade que não muda
nunca é o **GID da Shopify** (`gid://shopify/Product/<número>`, visível
no painel admin). Sempre que houver qualquer dúvida sobre "esse CW00X é
esse produto mesmo?", a resposta vem de conferir o GID, não de comparar
nome ou foto de memória.

## Causa raiz real (confirmada 01/09/2026)

**CW006 e CW007, como estavam configurados até hoje, eram o MESMO
produto duplicado** (LIGE Chronos) — não é bug de geração 3D, nem da
Meshy, nem da Tripo. `products.json` tinha os dois IDs apontando (na
prática, pela foto/geração que vinha saindo) pro produto errado em
comum. Uma investigação intermediária, no mesmo dia, chegou a suspeitar
de um terceiro produto ("Smartwatch C60") — **essa pista era falso
caminho e foi descartada**, não tem relação com CW006 nem CW007.

## CW006 — Smartwatch LIGE Chronos

| Campo | Valor |
|---|---|
| Nome | Smartwatch LIGE Chronos – Conectividade e Alta Performance |
| GID | `gid://shopify/Product/9278949916890` |
| Foto real | `f65fd2d6755dfb2da91e51edbaa3af95_800x800x156967.jpg` |
| Formato | Retangular, tela grande, pulseira de silicone colorida |
| Estoque | 1867 unidades — produto ativo de verdade |

`imageUrl` do CW006 em `products.json` **já apontava pro produto certo
desde o primeiro commit do projeto** — nunca precisou de edição.
**RESOLVIDO** (01/09, commit `df6c99d`): a 4ª tentativa de geração
(Meshy, sessão limpa) saiu correta — confirmado visualmente de 4
ângulos, calibração 0°/0°/0° já nasceu certa.

## CW007 — Smartwatch ChiBear Active Pro

| Campo | Valor |
|---|---|
| Nome | Smartwatch ChiBear Active Pro – Monitoramento Avançado |
| GID | `gid://shopify/Product/9278924587226` |
| Foto real | `baeb101768bc9e1224279fb6b6f47944_800x800x159636.jpg` |
| Formato | Redondo, pulseira de aço, mostrador tema astronauta |
| Estoque | 1978 unidades — produto ativo de verdade |

Esse é o relógio redondo/astronauta que as 3 tentativas de geração
vinham produzindo insistentemente (achando que era pro CW006) — resolvido
em 01/09 reaproveitando esse mesmo resultado 3D pro CW007 (produto certo
pra essa geometria), com a calibração de rotação que já existia
(`x:-0.9° y:-85.1° z:1.1°`), e confirmado visualmente batendo com a foto
real do ChiBear. `products.json` atualizado (título + `imageUrl`); `sku`
e `handle` **não foram atualizados** (o Claude Chat não forneceu esses
dados) — ficam com os valores antigos, herdados do "Smartwatch Slim C60
AMOLED" que estava lá antes. Conferir/corrigir se algum dia isso causar
problema visível na loja.

## CW003 — Pulseira Vinterly Turquesa

| Campo | Valor |
|---|---|
| Nome | Pulseira Vinterly Turquesa – Cobre Puro & Terapia Magnética |
| GID | `gid://shopify/Product/9280080511194` |

Caso diferente dos outros dois: aqui o modelo 3D **sempre esteve
correto**, calibrado — o único problema era o link da foto de referência
em `imageUrl` (achado em 01/09 numa checagem de rotina de todos os 35
links do catálogo, sem relação com a investigação do CW006/CW007), que
tinha ficado morto (404). Corrigido com o link atual fornecido pelo
Claude Chat, confirmado retornando `200 OK` antes de aplicar. Não foi
necessário gerar nem recalibrar nada.

## CW017 — Smartwatch T9

| Campo | Valor |
|---|---|
| Nome | Smartwatch T9 – Monitor Cardíaco & Assistente de Voz |
| GID | `gid://shopify/Product/9395048841434` |
| Estoque | 0 unidades em todas as 61 variantes (vendor "DropShipping",
lote de 13/07 — mesmo padrão já visto em outros produtos desse lote;
não é urgente corrigir, registrado pra auditoria de catálogo pendente) |

Caso diferente dos outros: aqui o problema não era duplicidade nem link
morto, era **foto de referência errada desde a origem** —
`fotos-limpas/CW017.png` tinha, desde o único commit que já tocou nesse
arquivo (13/07/2026, exatamente o dia da importação em massa dos 24
produtos novos com remoção simultânea de 3 duplicados antigos), a foto
de um relógio completamente diferente (redondo, pulseira de metal,
mostrador tema astronauta — mesma imagem genérica que já causou a
confusão do CW006/CW007). Provável causa: mistura de arquivo durante a
reorganização em massa daquele dia, nunca percebida porque o modelo 3D
nunca tinha sido comparado com a foto real até 01-02/09.

Corrigido em 02/09/2026 com uma foto nova (não a `imageUrl` original,
que tinha reflexo forte no mostrador — Carlinhos pediu fotos alternativas
da galeria do produto): pulseira de silicone preta, mostrador redondo
analógico-digital limpo, sem reflexo. `fotos-limpas/CW017.png` e
`imageUrl` em `products.json` atualizados. **Modelo 3D ainda não
regenerado** — fica pra quando decidirem tratar a leva de cores erradas
(ver [[project_lembrete_cw016_cw017_meshy]] na memória).

## CW033 — Relógio rosa, aro dourado octogonal, mostrador verde-água

Regenerado em 02/09/2026 na leva de correção de cor/forma junto com
CW017/CW028/CW032 (arquivos antigos, com defeito, em
`public/models/_pre_hyper3d_color_fix_backup/`). Calibração de rotação
refeita em 03/09/2026 — o modelo novo nascia com o mostrador **deitado
de lado** (~90° fora). Valor final `rotationDeg x:90 y:22.5 z:90`
(antigo `x:97.5 y:0 z:0`), lido pelo próprio lab de calibração
(`?lab=calibrate-product`) e conferido de 4 ângulos contra a foto real.
Passa no `validate.mjs`. Cor e objeto conferem com a foto (relógio rosa,
aro dourado octogonal, mostrador verde-água com sub-mostrador rosa).

**Ressalva de qualidade de malha — NÃO é bug desta calibração,
orientação está correta:** na foto real o sub-mostrador fica por volta
das "8 horas"; no modelo 3D ele saiu mais pra baixo, perto das "6
horas", e a textura/relevo da pulseira ficou mais grosseira/ondulada que
a da foto. Isso está assado na geometria gerada, não se resolve girando
— só regenerando o modelo. **Pendência de regeneração futura**, sem
urgência (a peça já serve pro try-on: objeto certo, cor certa, de frente
e em pé).

Este caso **não é isolado** — é a mesma limitação já mapeada de
**geração de 3D a partir de foto única**: detalhes finos de mostrador e
micro-relevo de pulseira ficam aproximados. Caminhos de solução
levantados pra roadmap (não implementados): alimentar a geração com
**múltiplas fotos** do mesmo produto e/ou uma etapa de
**pós-processamento** da malha. Mesma família de CW017 (também aguardando
regeneração) e da leva de cores erradas
(ver [[project_lembrete_cw016_cw017_meshy]] e
[[project_limite_geracao_3d_foto_unica]] na memória).

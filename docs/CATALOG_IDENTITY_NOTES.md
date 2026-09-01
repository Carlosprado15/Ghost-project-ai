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
**Modelo 3D correto ainda não foi gerado** (01/09, fim do dia) — as 3
tentativas de geração (Tripo original, Meshy 30/08, Meshy 01/09) saíram
todas com a geometria que, agora sabemos, pertence ao CW007 (ver abaixo).
Fica pendente nova tentativa, com sessão da Meshy 100% limpa (login novo
ou aba anônima), usando a foto real acima —
já preparada em `fotos-limpas/CW006.png` e em
`C:\Users\Bi\Downloads\SUBIR_NO_MESHY_CW006_LIGE.jpg`.

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

#!/usr/bin/env bash
# Um ciclo da máquina de pesquisa acumulativa de AR do Ghost Project.
# Lê a fila em docs/ar-research/QUEUE.md, responde UMA pergunta (a de maior
# prioridade ainda ABERTA), grava um tópico novo em docs/ar-research/topics/,
# e atualiza INDEX.md/QUEUE.md/SOURCES.md/ALERTAS.md. A cada 10 tópicos
# concluídos, consolida SYNTHESIS.md em vez de pesquisar um tópico novo.
#
# Escopo travado: só escreve dentro de docs/ar-research/. Não instala
# dependência, não commita, não mexe em src/, public/, products.json,
# App_FINAL.jsx, SDK ou catálogo.
#
# Teto de gasto: --max-budget-usd (flag real do `claude --help`, só
# funciona com --print). Custo e duração reais (não estimativa — vêm da
# resposta --output-format json da própria API, campos total_cost_usd e
# duration_ms) completam a linha PENDENTE que o PRÓPRIO ciclo grava em
# docs/ar-research/CUSTOS.md como última ação sua — report-cycle.mjs só
# completa duração/custo, nunca adivinha qual QR foi respondida (isso já
# foi tentado por diff de posição de linha e é frágil; removido).
#
# Uso: scripts/ar-research/cycle.sh   (rodar da raiz do repo ou de qualquer
# lugar — o script entra na raiz do projeto sozinho)

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."

MAX_BUDGET_USD="2"
CUSTOS_FILE="docs/ar-research/CUSTOS.md"

PROMPT="Ler docs/ar-research/INDEX.md, QUEUE.md e SOURCES.md. As perguntas P1 e P2 estão CONGELADA-POS-LANCAMENTO — não pegar nenhuma delas agora, só P0. Pegar a pergunta P0 ABERTA de maior prioridade. Se já estiver coberta por um tópico existente, marcar como coberta e encerrar sem gastar pesquisa. Caso contrário pesquisar na web priorizando documentação oficial, papers, repositórios oficiais e benchmarks. Escrever UM arquivo em docs/ar-research/topics/ seguindo o template do INDEX.md, máximo 120 linhas. Preencher obrigatoriamente APLICABILIDADE considerando pulso, corpo e ambiente — é obrigatório nomear SEPARADAMENTE o que muda para CORPO e o que muda para AMBIENTE (não substituir por outra categoria como 'rosto'); 'UNIVERSAL' sozinho, sem essa diferenciação explícita para as duas, não é resposta aceita; se o mesmo parâmetro servir para os dois, justificar por quê em vez de só repetir o valor. CRITÉRIO DE FONTE (ler a seção completa em INDEX.md): OFICIAL = domínio controlado pelo criador ou mantenedor da tecnologia citada, ou paper publicado com revisão; estar no GitHub NÃO torna um repositório oficial; port, wrapper, fork ou reimplementação de terceiro é COMUNIDADE, nunca OFICIAL, mesmo que seja bom. Toda fonte em FONTES: vem rotulada [OFICIAL] [PAPER] [COMUNIDADE] ou [BLOG]. Nenhuma alegação com veredito COMPROVADO pode se apoiar só em [COMUNIDADE] ou [BLOG] — precisa de pelo menos uma [OFICIAL] ou [PAPER] por trás, senão o veredito cai pra PROVAVEL/HIPOTESE. Atualizar INDEX.md, marcar a pergunta como RESPONDIDA em QUEUE.md, registrar fontes rotuladas em SOURCES.md e acrescentar as novas perguntas geradas (toda pergunta nova entra como P0 por padrão, a não ser que você tenha uma razão explícita pra marcar P1/P2 — mas P1/P2 novas também ficam CONGELADA-POS-LANCAMENTO, não ABERTA). Classificar cada conclusão como COMPROVADO, PROVAVEL, HIPOTESE ou DESCONHECIDO. Depois de gravar o tópico, ler o critério objetivo no topo de docs/ar-research/ALERTAS.md e avaliar o achado deste ciclo contra os 3 níveis: CRITICO (a pesquisa contradiz uma decisão já no código, revela algo já implementado errado, ou mostra limite documentado que inviabiliza o objetivo), ALTO (existe solução pronta, documentada e de custo BAIXO ou MEDIO para um problema hoje em aberto no Ghost), OPORTUNIDADE (capacidade nova com aplicação clara em corpo ou ambiente, não só pulso). SOMENTE se o achado atingir um desses 3 níveis, acrescentar UMA entrada no topo de ALERTAS.md (máximo 6 linhas, formato definido no próprio arquivo) — no máximo 1 alerta por ciclo. Se nenhum critério for atingido, NAO escrever nada em ALERTAS.md. Se a cada 10 topicos concluidos, em vez de pesquisar, consolidar SYNTHESIS.md com a arquitetura de motor que a pesquisa acumulada sustenta. COMO ÚLTIMA AÇÃO DO CICLO, sempre: acrescentar uma linha ao final de docs/ar-research/CUSTOS.md no formato '| AAAA-MM-DD | <identificador> | PENDENTE | PENDENTE |', onde <identificador> é o QR-XXX que você respondeu de verdade (se marcou uma pergunta como coberta e respondeu outra, é a que você REALMENTE pesquisou e escreveu tópico, não a coberta), ou 'SYNTHESIS' se este ciclo consolidou SYNTHESIS.md em vez de responder pergunta — duração e custo ficam PENDENTE porque só a API sabe esse valor depois que sua resposta terminar, um script externo completa depois. NAO tocar em nada fora de docs/ar-research/. NAO fazer commit."

claude -p "$PROMPT" \
  --allowedTools "Read,Write,Edit,WebSearch,WebFetch" \
  --max-turns 30 \
  --max-budget-usd "$MAX_BUDGET_USD" \
  --output-format json \
  | node "$(dirname "${BASH_SOURCE[0]}")/report-cycle.mjs" "$CUSTOS_FILE"

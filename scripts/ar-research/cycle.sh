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
# duration_ms) são gravados em docs/ar-research/CUSTOS.md via
# report-cycle.mjs ao final.
#
# Uso: scripts/ar-research/cycle.sh   (rodar da raiz do repo ou de qualquer
# lugar — o script entra na raiz do projeto sozinho)

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."

MAX_BUDGET_USD="2"
QUEUE_FILE="docs/ar-research/QUEUE.md"
CUSTOS_FILE="docs/ar-research/CUSTOS.md"
QUEUE_SNAPSHOT="$(mktemp)"
cp "$QUEUE_FILE" "$QUEUE_SNAPSHOT"

PROMPT="Ler docs/ar-research/INDEX.md, QUEUE.md e SOURCES.md. Pegar a pergunta ABERTA de maior prioridade. Se já estiver coberta por um tópico existente, marcar como coberta e encerrar sem gastar pesquisa. Caso contrário pesquisar na web priorizando documentação oficial, papers, repositórios oficiais e benchmarks. Escrever UM arquivo em docs/ar-research/topics/ seguindo o template do INDEX.md, máximo 120 linhas. Preencher obrigatoriamente APLICABILIDADE considerando pulso, corpo e ambiente — é obrigatório nomear SEPARADAMENTE o que muda para CORPO e o que muda para AMBIENTE (não substituir por outra categoria como 'rosto'); 'UNIVERSAL' sozinho, sem essa diferenciação explícita para as duas, não é resposta aceita; se o mesmo parâmetro servir para os dois, justificar por quê em vez de só repetir o valor. Em FONTES, priorizar documentação oficial do mantenedor (site/repositório oficial do projeto) e papers publicados; evitar mirrors de terceiros (ex.: geradores de doxygen como Fossies) quando a documentação oficial cobrir o mesmo conteúdo — blog técnico só como fonte complementar, nunca sozinho pra sustentar uma alegação, e sempre rotulado como tal. Atualizar INDEX.md, marcar a pergunta como RESPONDIDA em QUEUE.md, registrar fontes em SOURCES.md e acrescentar as novas perguntas geradas. Classificar cada conclusão como COMPROVADO, PROVAVEL, HIPOTESE ou DESCONHECIDO. Depois de gravar o tópico, ler o critério objetivo no topo de docs/ar-research/ALERTAS.md e avaliar o achado deste ciclo contra os 3 níveis: CRITICO (a pesquisa contradiz uma decisão já no código, revela algo já implementado errado, ou mostra limite documentado que inviabiliza o objetivo), ALTO (existe solução pronta, documentada e de custo BAIXO ou MEDIO para um problema hoje em aberto no Ghost), OPORTUNIDADE (capacidade nova com aplicação clara em corpo ou ambiente, não só pulso). SOMENTE se o achado atingir um desses 3 níveis, acrescentar UMA entrada no topo de ALERTAS.md (máximo 6 linhas, formato definido no próprio arquivo) — no máximo 1 alerta por ciclo. Se nenhum critério for atingido, NAO escrever nada em ALERTAS.md — é o resultado esperado na maioria dos ciclos, não forçar um alerta só para o ciclo 'render algo'. Se a cada 10 topicos concluidos, em vez de pesquisar, consolidar SYNTHESIS.md com a arquitetura de motor que a pesquisa acumulada sustenta. NAO tocar em nada fora de docs/ar-research/. NAO fazer commit."

claude -p "$PROMPT" \
  --allowedTools "Read,Write,Edit,WebSearch,WebFetch" \
  --max-turns 30 \
  --max-budget-usd "$MAX_BUDGET_USD" \
  --output-format json \
  | node "$(dirname "${BASH_SOURCE[0]}")/report-cycle.mjs" "$QUEUE_SNAPSHOT" "$QUEUE_FILE" "$CUSTOS_FILE"

rm -f "$QUEUE_SNAPSHOT"

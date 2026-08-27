@echo off
REM Um ciclo da maquina de pesquisa acumulativa de AR do Ghost Project.
REM Le a fila em docs/ar-research/QUEUE.md, responde UMA pergunta P0 (a de
REM maior prioridade ainda ABERTA — P1/P2 estao CONGELADA-POS-LANCAMENTO),
REM grava um topico novo em docs/ar-research/topics/, e atualiza
REM INDEX.md/QUEUE.md/SOURCES.md/ALERTAS.md. A cada 10 topicos concluidos,
REM consolida SYNTHESIS.md em vez de pesquisar um topico novo.
REM
REM Escopo travado: so escreve dentro de docs/ar-research/. Nao instala
REM dependencia, nao commita, nao mexe em src/, public/, products.json,
REM App_FINAL.jsx, SDK ou catalogo.
REM
REM Teto de gasto: --max-budget-usd (flag real do `claude --help`, so
REM funciona com --print). Custo e duracao reais (nao estimativa — vem da
REM resposta --output-format json da propria API, campos total_cost_usd e
REM duration_ms) completam a linha PENDENTE que o PROPRIO ciclo grava em
REM docs/ar-research/CUSTOS.md como ultima acao sua — report-cycle.mjs so
REM completa duracao/custo, nunca adivinha qual QR foi respondida (isso ja
REM foi tentado por diff de posicao de linha e e fragil; removido).
REM
REM Uso: scripts\ar-research\cycle.bat   (pode ser chamado de qualquer
REM lugar — o script entra na raiz do projeto sozinho)

setlocal
chcp 65001 >nul
cd /d "%~dp0..\.."

set "MAX_BUDGET_USD=2"
set "CUSTOS_FILE=docs\ar-research\CUSTOS.md"
set "RAW_JSON_FILE=%TEMP%\ar-cycle-raw-%RANDOM%.json"

claude -p "Ler docs/ar-research/INDEX.md, QUEUE.md e SOURCES.md. As perguntas P1 e P2 estao CONGELADA-POS-LANCAMENTO — nao pegar nenhuma delas agora, so P0. Pegar a pergunta P0 ABERTA de maior prioridade. Se ja estiver coberta por um topico existente, marcar como coberta e encerrar sem gastar pesquisa. Caso contrario pesquisar na web priorizando documentacao oficial, papers, repositorios oficiais e benchmarks. Escrever UM arquivo em docs/ar-research/topics/ seguindo o template do INDEX.md, maximo 120 linhas. Preencher obrigatoriamente APLICABILIDADE considerando pulso, corpo e ambiente — e obrigatorio nomear SEPARADAMENTE o que muda para CORPO e o que muda para AMBIENTE (nao substituir por outra categoria como 'rosto'); 'UNIVERSAL' sozinho, sem essa diferenciacao explicita para as duas, nao e resposta aceita; se o mesmo parametro servir para os dois, justificar por que em vez de so repetir o valor. CRITERIO DE FONTE (ler a secao completa em INDEX.md): OFICIAL = dominio controlado pelo criador ou mantenedor da tecnologia citada, ou paper publicado com revisao; estar no GitHub NAO torna um repositorio oficial; port, wrapper, fork ou reimplementacao de terceiro e COMUNIDADE, nunca OFICIAL, mesmo que seja bom. Toda fonte em FONTES: vem rotulada [OFICIAL] [PAPER] [COMUNIDADE] ou [BLOG]. Nenhuma alegacao com veredito COMPROVADO pode se apoiar so em [COMUNIDADE] ou [BLOG] — precisa de pelo menos uma [OFICIAL] ou [PAPER] por tras, senao o veredito cai pra PROVAVEL/HIPOTESE. Atualizar INDEX.md, marcar a pergunta como RESPONDIDA em QUEUE.md, registrar fontes rotuladas em SOURCES.md e acrescentar as novas perguntas geradas (toda pergunta nova entra como P0 por padrao, a nao ser que voce tenha uma razao explicita pra marcar P1/P2 — mas P1/P2 novas tambem ficam CONGELADA-POS-LANCAMENTO, nao ABERTA). Classificar cada conclusao como COMPROVADO, PROVAVEL, HIPOTESE ou DESCONHECIDO. Depois de gravar o topico, ler o criterio objetivo no topo de docs/ar-research/ALERTAS.md e avaliar o achado deste ciclo contra os 3 niveis: CRITICO (a pesquisa contradiz uma decisao ja no codigo, revela algo ja implementado errado, ou mostra limite documentado que inviabiliza o objetivo), ALTO (existe solucao pronta, documentada e de custo BAIXO ou MEDIO para um problema hoje em aberto no Ghost), OPORTUNIDADE (capacidade nova com aplicacao clara em corpo ou ambiente, nao so pulso). SOMENTE se o achado atingir um desses 3 niveis, acrescentar UMA entrada no topo de ALERTAS.md (maximo 6 linhas, formato definido no proprio arquivo) — no maximo 1 alerta por ciclo. Se nenhum criterio for atingido, NAO escrever nada em ALERTAS.md. Se a cada 10 topicos concluidos, em vez de pesquisar, consolidar SYNTHESIS.md com a arquitetura de motor que a pesquisa acumulada sustenta. COMO ULTIMA ACAO DO CICLO, sempre: acrescentar uma linha ao final de docs/ar-research/CUSTOS.md no formato '| AAAA-MM-DD | <identificador> | PENDENTE | PENDENTE |', onde <identificador> e o QR-XXX que voce respondeu de verdade (se marcou uma pergunta como coberta e respondeu outra, e a que voce REALMENTE pesquisou e escreveu topico, nao a coberta), ou 'SYNTHESIS' se este ciclo consolidou SYNTHESIS.md em vez de responder pergunta — duracao e custo ficam PENDENTE porque so a API sabe esse valor depois que sua resposta terminar, um script externo completa depois. NAO tocar em nada fora de docs/ar-research/. NAO fazer commit." --allowedTools "Read,Write,Edit,WebSearch,WebFetch" --max-turns 30 --max-budget-usd %MAX_BUDGET_USD% --output-format json > "%RAW_JSON_FILE%"

node "%~dp0report-cycle.mjs" "%CUSTOS_FILE%" < "%RAW_JSON_FILE%"

del /q "%RAW_JSON_FILE%" >nul 2>&1
endlocal

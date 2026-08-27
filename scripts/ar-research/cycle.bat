@echo off
REM Um ciclo da maquina de pesquisa acumulativa de AR do Ghost Project.
REM Le a fila em docs/ar-research/QUEUE.md, responde UMA pergunta (a de
REM maior prioridade ainda ABERTA), grava um topico novo em
REM docs/ar-research/topics/, e atualiza INDEX.md/QUEUE.md/SOURCES.md/
REM ALERTAS.md. A cada 10 topicos concluidos, consolida SYNTHESIS.md em
REM vez de pesquisar um topico novo.
REM
REM Escopo travado: so escreve dentro de docs/ar-research/. Nao instala
REM dependencia, nao commita, nao mexe em src/, public/, products.json,
REM App_FINAL.jsx, SDK ou catalogo.
REM
REM Teto de gasto: --max-budget-usd (flag real do `claude --help`, so
REM funciona com --print). Custo e duracao reais (nao estimativa — vem da
REM resposta --output-format json da propria API, campos total_cost_usd e
REM duration_ms) sao gravados em docs/ar-research/CUSTOS.md via
REM report-cycle.mjs ao final.
REM
REM Uso: scripts\ar-research\cycle.bat   (pode ser chamado de qualquer
REM lugar — o script entra na raiz do projeto sozinho)

setlocal
chcp 65001 >nul
cd /d "%~dp0..\.."

set "MAX_BUDGET_USD=2"
set "QUEUE_FILE=docs\ar-research\QUEUE.md"
set "CUSTOS_FILE=docs\ar-research\CUSTOS.md"
set "QUEUE_SNAPSHOT=%TEMP%\ar-queue-before-%RANDOM%.md"
set "RAW_JSON_FILE=%TEMP%\ar-cycle-raw-%RANDOM%.json"
copy /y "%QUEUE_FILE%" "%QUEUE_SNAPSHOT%" >nul

claude -p "Ler docs/ar-research/INDEX.md, QUEUE.md e SOURCES.md. Pegar a pergunta ABERTA de maior prioridade. Se ja estiver coberta por um topico existente, marcar como coberta e encerrar sem gastar pesquisa. Caso contrario pesquisar na web priorizando documentacao oficial, papers, repositorios oficiais e benchmarks. Escrever UM arquivo em docs/ar-research/topics/ seguindo o template do INDEX.md, maximo 120 linhas. Preencher obrigatoriamente APLICABILIDADE considerando pulso, corpo e ambiente — e obrigatorio nomear SEPARADAMENTE o que muda para CORPO e o que muda para AMBIENTE (nao substituir por outra categoria como 'rosto'); 'UNIVERSAL' sozinho, sem essa diferenciacao explicita para as duas, nao e resposta aceita; se o mesmo parametro servir para os dois, justificar por que em vez de so repetir o valor. Em FONTES, priorizar documentacao oficial do mantenedor (site/repositorio oficial do projeto) e papers publicados; evitar mirrors de terceiros (ex.: geradores de doxygen como Fossies) quando a documentacao oficial cobrir o mesmo conteudo — blog tecnico so como fonte complementar, nunca sozinho pra sustentar uma alegacao, e sempre rotulado como tal. Atualizar INDEX.md, marcar a pergunta como RESPONDIDA em QUEUE.md, registrar fontes em SOURCES.md e acrescentar as novas perguntas geradas. Classificar cada conclusao como COMPROVADO, PROVAVEL, HIPOTESE ou DESCONHECIDO. Depois de gravar o topico, ler o criterio objetivo no topo de docs/ar-research/ALERTAS.md e avaliar o achado deste ciclo contra os 3 niveis: CRITICO (a pesquisa contradiz uma decisao ja no codigo, revela algo ja implementado errado, ou mostra limite documentado que inviabiliza o objetivo), ALTO (existe solucao pronta, documentada e de custo BAIXO ou MEDIO para um problema hoje em aberto no Ghost), OPORTUNIDADE (capacidade nova com aplicacao clara em corpo ou ambiente, nao so pulso). SOMENTE se o achado atingir um desses 3 niveis, acrescentar UMA entrada no topo de ALERTAS.md (maximo 6 linhas, formato definido no proprio arquivo) — no maximo 1 alerta por ciclo. Se nenhum criterio for atingido, NAO escrever nada em ALERTAS.md — e o resultado esperado na maioria dos ciclos, nao forcar um alerta so para o ciclo 'render algo'. Se a cada 10 topicos concluidos, em vez de pesquisar, consolidar SYNTHESIS.md com a arquitetura de motor que a pesquisa acumulada sustenta. NAO tocar em nada fora de docs/ar-research/. NAO fazer commit." --allowedTools "Read,Write,Edit,WebSearch,WebFetch" --max-turns 30 --max-budget-usd %MAX_BUDGET_USD% --output-format json > "%RAW_JSON_FILE%"

node "%~dp0report-cycle.mjs" "%QUEUE_SNAPSHOT%" "%QUEUE_FILE%" "%CUSTOS_FILE%" < "%RAW_JSON_FILE%"

del /q "%QUEUE_SNAPSHOT%" "%RAW_JSON_FILE%" >nul 2>&1
endlocal

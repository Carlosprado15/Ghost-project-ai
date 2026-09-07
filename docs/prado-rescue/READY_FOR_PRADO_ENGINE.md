# Pré-requisitos para implementar o PRADO ENGINE Control Tower

- [x] Pendência de pagamento da Shopify resolvida
- [x] Rumo do motor de AR decidido: **motor próprio é o caminho definitivo,
      sem dependência de fornecedor externo** (decisão do Carlos, 06/09/2026).
      Substitui o item anterior ("Fornecedor de SDK de AR comercial decidido —
      Camweara e/ou WANNA"), cuja premissa ficou ultrapassada: aluguel de SDK
      comercial foi descartado por custo alto e porque o motor próprio avançou
      o suficiente para não justificar a dependência. Ao implementar o Control
      Tower, registrar isso formalmente em DECISIONS.md.
- [ ] Todos os produtos validados do catálogo religados e confirmados na loja.
      Corrigido em 06/09/2026: o critério anterior ("9 SKUs de lançamento") não
      tinha origem rastreável no projeto (investigado a fundo — sem registro em
      commits, docs ou no catálogo) e não refletia a intenção real do Carlos,
      que é lançar com o catálogo inteiro, não um subconjunto arbitrário.
      **Validação geométrica do catálogo: 35/35 ✅** (CW002 corrigido em
      07/09/2026 — rotação recalibrada, laço da pulseira agora no eixo certo).
      **Falta só a confirmação visual na loja Shopify de verdade** — hoje
      impossível de checar porque a loja inteira está atrás da tela de senha
      padrão do Shopify. Isso **não é pendência técnica**: a senha está
      mantida deliberadamente até o Carlos decidir o momento do lançamento.
      Este item só fecha depois que ele tirar a senha por conta própria.
- [x] Reteste do motor AR com rotação ativa + FPS real concluído (Fase 6 do
      ar-rescue). Feito em 07/09/2026 — AR-008 (`docs/prado-rescue/evidence/AR-008/`),
      reteste físico do commit `a48e2b2` (`_lastRotZ` reset) na branch
      `fix/d1-d2-d4-estabilizacao`, no aparelho de teste atual (Razr 40). fps
      observado pela primeira vez (14-25), rotação ativa com perda/recuperação de
      tracking sem salto de ~360°. **Atualizado em 07/09/2026**: segundo ciclo
      de perda/recuperação, independente do primeiro (manual, guiado ao vivo
      pelo Carlos), com o mesmo resultado — ver
      `AR-008/manual-cycle-2-carlos/README.md`. Ressalva original superada:
      agora são 2 ciclos independentes, não mais 1.

Quando TODOS os itens acima estiverem marcados [x], a próxima sessão do
Claude Code deve implementar automaticamente a arquitetura abaixo, sem
esperar confirmação adicional (já aprovada por Carlos em 17/08/2026),
e reportar o resultado em STATE.md ao final.

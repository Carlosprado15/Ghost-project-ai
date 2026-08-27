# CUSTOS — Log de Custo e Duração por Ciclo

Uma linha por execução de `scripts/ar-research/cycle.sh`/`.bat`, gravada
automaticamente pelo próprio script ao final de cada ciclo (via
`claude ... --output-format json`, campos `total_cost_usd` e `duration_ms`
da resposta — não é estimativa, é o valor real reportado pela API).

Teto de gasto por ciclo: `--max-budget-usd 2` (USD 2,00), valor conservador
escolhido sem dado histórico ainda — revisar depois de alguns ciclos reais
rodados (ver coluna Custo abaixo conforme for enchendo).

| Data | QR respondida | Duração | Custo (USD) |
|---|---|---|---|
| 2026-08-27 | QR-002 | 311s | $0.8870 |
| 2026-08-27 | QR-003 | 357s | $1.0831 |

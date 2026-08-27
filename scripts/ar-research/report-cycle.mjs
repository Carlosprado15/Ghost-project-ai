#!/usr/bin/env node
// Helper compartilhado por cycle.sh e cycle.bat — lê o JSON de resposta do
// `claude --output-format json` via stdin e imprime o texto legível (campo
// "result") pro log do ciclo.
//
// NÃO adivinha qual QR foi respondida (isso já foi tentado por diff de
// posição de linha no QUEUE.md e é frágil — removido). O próprio ciclo,
// como última ação do seu prompt, já grava em docs/ar-research/CUSTOS.md
// uma linha com o identificador real e "PENDENTE" no lugar de duração e
// custo. Este script só ENCONTRA a última linha PENDENTE e a completa com
// os valores reais (duration_ms, total_cost_usd) da resposta da API.
//
// Uso: node report-cycle.mjs <custos.md> < raw.json
import { readFileSync, writeFileSync } from 'node:fs';

const [, , custosPath] = process.argv;

let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  let j;
  try {
    j = JSON.parse(raw);
  } catch (e) {
    process.stdout.write(`[report-cycle] Falha ao interpretar a resposta JSON: ${e.message}\n${raw}\n`);
    process.exitCode = 1;
    return;
  }

  process.stdout.write((j.result || '(sem texto de resultado)') + '\n');

  const costUsd = j.total_cost_usd != null ? j.total_cost_usd.toFixed(4) : 'desconhecido';
  const durationS = j.duration_ms != null ? Math.round(j.duration_ms / 1000) : '?';

  const lines = readFileSync(custosPath, 'utf-8').split('\n');
  let completed = false;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].includes('| PENDENTE | PENDENTE |')) {
      lines[i] = lines[i].replace('| PENDENTE | PENDENTE |', `| ${durationS}s | \$${costUsd} |`);
      completed = true;
      break;
    }
  }
  if (!completed) {
    process.stdout.write(
      '[report-cycle] AVISO: nenhuma linha PENDENTE encontrada em CUSTOS.md — o ciclo não gravou a linha esperada como última ação. Custo real desta execução: $' +
        costUsd + ', duração: ' + durationS + 's (não registrado no arquivo).\n'
    );
  } else {
    writeFileSync(custosPath, lines.join('\n'), 'utf-8');
  }
});

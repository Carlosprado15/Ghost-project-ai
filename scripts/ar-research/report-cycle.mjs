#!/usr/bin/env node
// Helper compartilhado por cycle.sh e cycle.bat — lê o JSON de resposta do
// `claude --output-format json` via stdin, imprime o texto legível (campo
// "result") pro log do ciclo, e grava uma linha em docs/ar-research/CUSTOS.md
// com data | QR respondida | duração | custo — todos valores reais
// reportados pela própria API (total_cost_usd, duration_ms), não estimativa.
//
// Uso: node report-cycle.mjs <queue-antes.md> <queue-depois.md> <custos.md> < raw.json
import { readFileSync, appendFileSync } from 'node:fs';

const [, , queueBeforePath, queueAfterPath, custosPath] = process.argv;

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

  let qr = 'nenhuma';
  try {
    const before = readFileSync(queueBeforePath, 'utf-8').split('\n');
    const after = readFileSync(queueAfterPath, 'utf-8').split('\n');
    for (let i = 0; i < after.length; i++) {
      if (after[i] !== before[i]) {
        const m = after[i].match(/QR-\d+/);
        if (m) { qr = m[0]; break; }
      }
    }
  } catch { /* sem snapshot antes — deixa "nenhuma" */ }

  const date = new Date().toISOString().slice(0, 10);
  appendFileSync(custosPath, `| ${date} | ${qr} | ${durationS}s | \$${costUsd} |\n`, 'utf-8');
});

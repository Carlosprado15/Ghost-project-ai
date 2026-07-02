// Report server — Node puro, sem dependências externas.
// POST /report : recebe { markdown: string }, grava M069B_FILTER_CALIBRATION_REPORT.md
// GET  /health : responde "ok"
// Porta 5174

import http  from 'node:http';
import fs    from 'node:fs';
import path  from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT        = 5174;
const REPORT_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'M069B_FILTER_CALIBRATION_REPORT.md');

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function addCors(res) {
  for (const [k, v] of Object.entries(CORS)) res.setHeader(k, v);
}

const server = http.createServer((req, res) => {
  addCors(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }

  if (req.method === 'POST' && req.url === '/report') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { markdown } = JSON.parse(body);
        if (typeof markdown !== 'string') throw new Error('markdown must be a string');
        fs.writeFileSync(REPORT_FILE, markdown, 'utf8');
        console.log(`[reportServer] Relatório gravado em ${REPORT_FILE}`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, path: REPORT_FILE }));
      } catch (e) {
        console.error('[reportServer] Erro:', e.message);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('not found');
});

server.listen(PORT, () => {
  console.log(`[reportServer] Rodando em http://localhost:${PORT}`);
  console.log(`[reportServer] Relatório será salvo em: ${REPORT_FILE}`);
});

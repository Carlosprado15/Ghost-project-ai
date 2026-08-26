import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// TEMPORÁRIO (22/08/2026) — endpoint só-dev-server pra salvar em disco as
// calibrações feitas em ?lab=calibrate-product sem depender de copiar/colar
// manual. Usado pelo botão "SALVAR TUDO AGORA" em ProductCalibrationLab.jsx.
// Remover os dois (plugin + botão) quando a rodada de calibração dos 32
// produtos terminar — não é parte do pipeline permanente.
function saveCalibrationPlugin() {
  return {
    name: 'ghost-save-calibration',
    configureServer(server) {
      server.middlewares.use('/__ghost-save-calibration', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method not allowed')
          return
        }
        let body = ''
        req.on('data', (chunk) => { body += chunk })
        req.on('end', () => {
          try {
            const incoming = JSON.parse(body)
            const overridesPath = path.resolve(__dirname, 'scripts/normalize-glb/product-calibration-overrides.json')
            const current = JSON.parse(fs.readFileSync(overridesPath, 'utf-8'))
            const updatedIds = Object.keys(incoming)
            for (const id of updatedIds) {
              current[id] = incoming[id]
            }
            fs.writeFileSync(overridesPath, JSON.stringify(current, null, 2) + '\n', 'utf-8')
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true, updated: updatedIds }))
          } catch (err) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: false, error: String((err && err.message) || err) }))
          }
        })
      })
    },
  }
}

// TEMPORÁRIO (25/08/2026) — endpoint só-dev-server que roda o
// normalize.mjs de UM produto sob pedido, pro botão "Salvar e Ver como vai
// ficar" em ProductCalibrationLab.jsx: sem isso, a tela sempre mostrava o
// arquivo bruto e o resultado calibrado só dava pra ver rodando o script
// manualmente no terminal. Mesmo ciclo de vida do endpoint de salvar acima
// — remover os dois juntos quando a rodada de calibração terminar.
function normalizeOnePlugin() {
  return {
    name: 'ghost-normalize-one',
    configureServer(server) {
      server.middlewares.use('/__ghost-normalize-one', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end('Method not allowed')
          return
        }
        let body = ''
        req.on('data', (chunk) => { body += chunk })
        req.on('end', () => {
          let id
          try {
            id = JSON.parse(body).id
            if (!/^[A-Za-z0-9_-]+$/.test(id || '')) throw new Error('id inválido')
          } catch (err) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: false, error: String((err && err.message) || err) }))
            return
          }
          const scriptPath = path.resolve(__dirname, 'scripts/normalize-glb/normalize.mjs')
          execFile(process.execPath, [scriptPath, id], { cwd: __dirname, timeout: 60000 }, (err, stdout, stderr) => {
            res.setHeader('Content-Type', 'application/json')
            if (err) {
              res.statusCode = 500
              res.end(JSON.stringify({ ok: false, error: stderr || err.message }))
              return
            }
            res.end(JSON.stringify({ ok: true, id, log: stdout }))
          })
        })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), basicSsl(), saveCalibrationPlugin(), normalizeOnePlugin()],
  server: {
    host: '0.0.0.0', // Expõe na rede local para Android
    port: 5173,
  },
})

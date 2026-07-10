---
description: Checklist de segurança antes de publicar a loja — confere se alguma chave secreta vazou pro pacote final, se o build passa, e o que falta pra publicar.
---

Run Ghost Project's pre-deployment safety check. Never publish/deploy anything yourself — this only reports what's safe or not; the user (Carlinhos) decides when to actually push.

Steps:
1. `rm -rf dist && npm run build` — clean rebuild, report pass/fail.
2. **Secret leak check** (the most important step — this caught a real incident on 2026-07-09): read every `.env.local` line that is NOT prefixed with `VITE_`, and grep its literal value inside `dist/assets/*.js`. Any match is a critical finding — a secret that leaked into the public bundle. Report each one by name (not by value).
3. Grep `dist/assets/*.js` for the literal strings `VITE_TRIPO_API_KEY`, `VITE_MESHY_API_KEY`, or any other suspicious-looking `VITE_*_KEY`/`VITE_*_SECRET` pattern that shouldn't be there per `CLAUDE.md`'s security note.
4. `npm audit` — report high/critical count only (don't dump the full report unless asked).
5. Confirm no protected file (`src/App_FINAL.jsx`, `src/data/products.json`, `shopify/*`) has uncommitted changes the user hasn't reviewed (`git status --short`).
6. Summarize as a plain go/no-go: "seguro pra publicar" or a specific list of what needs fixing first, in non-technical Portuguese.

---
description: Painel rápido do estado do Ghost Project — git, produtos calibrados/pendentes, servidores rodando, build.
---

Give a concise Ghost Project status report. Investigate directly (don't ask the user), then report in plain non-technical Portuguese:

1. **Git**: current branch, uncommitted changes (`git status --short`), how far ahead/behind of origin.
2. **Produtos 3D**: read `scripts/normalize-glb/product-calibration-overrides.json` and cross-reference against `src/data/products.json` — how many of the 15 are `calibrated` vs `needs_calibration`/other status. Mention if any are known to still be using a mismatched/placeholder 3D file (check recent context/CLAUDE.md for known issues).
3. **Servidores locais**: check listening ports (5173-5177) to see if a dev/lab server is already running, so the user isn't told to start one that's already up.
4. **Build**: run `npm run build` and report pass/fail (don't report warnings that already existed before, only new failures).
5. **Pendências conhecidas**: anything flagged as blocked (e.g. waiting on Tripo3D credit, waiting on a decision) — check recent conversation context / memory if available.

Keep the whole report short — a punch list, not an essay. No jargon.

---
description: Confere se o(s) produto(s) 3D batem com a foto real da loja (usa qa-compare.mjs). Sem argumento, roda nos 15.
---

Run Ghost Project's visual QA check for product 3D models against their real store photos.

Arguments passed by the user (product IDs like "CW006 CW007", or empty for all 15): $ARGUMENTS

Steps:
1. Confirm the lab dev server is running on port 5173 (`npm run lab:m069b`); if not, start it in the background and wait for it to be ready.
2. Run `node scripts/normalize-glb/qa-compare.mjs $ARGUMENTS` (omit the arg entirely — pass `--all` — if the user gave none).
3. Read the generated `scripts/normalize-glb/qa-output/qa-compare.html` — render it (e.g. via a quick Playwright screenshot) and actually look at each pair.
4. Report back in plain, non-technical Portuguese: for each product, does the 3D match the real photo or not. Flag any mismatch clearly. Don't just say "done" — give the actual verdict per product.

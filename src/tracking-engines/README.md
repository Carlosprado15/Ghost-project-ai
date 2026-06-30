# Ghost Project — Tracking Engine Layer

## O que é esta pasta

Fundação isolada da camada plugável de motores de tracking do Ghost Project.

**Esta pasta NÃO altera o app atual.** Os arquivos abaixo foram preservados sem nenhuma modificação:
- `src/App_FINAL.jsx`
- `src/main.tsx`
- `src/ProductAdapter`
- `src/data/products.json`
- `shopify/`
- `public/models/`
- `public/gsdk.js`
- `src/tracking/WristTracker.js` (MediaPipe legacy)
- Labs existentes (`?lab=webarrocks`, `?lab=replay`)

## Por que existe

O Ghost Project é infraestrutura white-label de AR commerce para produtos usados no corpo e no ambiente — não um sistema só de relógios. A primeira demonstração é watches/pulseiras, mas a visão cobre face, body, foot e room.

A camada de engines resolve **vendor lock-in**: trocar de DeepAR para Perfect Corp, ou adicionar uma categoria nova (foot-engine), não deve exigir reescrever o scanner principal.

## Estrutura

```
src/tracking-engines/
  types.js              Contratos, constantes, createEngineDescriptor()
  engineRegistry.js     Registro e lookup de engines por id/categoria
  engineMatrix.js       Matriz comparativa de todos os candidatos
  index.js              Re-exporta tudo (não importar no App ainda)
  engines/
    legacy-mediapipe/   MediaPipe Hands — LEGACY
    deepar/             DeepAR — CANDIDATE (1ª POC recomendada)
    perfectcorp/        Perfect Corp YouCam — CANDIDATE (melhor para produção)
    banuba/             Banuba — CANDIDATE (fallback multi-categoria)
    mirrar/             MIRRAR — CANDIDATE (possível demo comercial rápida)
    viewer/             model-viewer/Scene Viewer — READY (em produção)
```

## Status dos engines

| Engine | Categoria | Status | Próximo passo |
|---|---|---|---|
| model-viewer | VIEWER / ROOM | ✅ READY | Em produção — 15/15 produtos |
| DeepAR | WRIST | 🟡 CANDIDATE | M068 — POC isolada `?lab=deepar` |
| Perfect Corp | FACE / WRIST | 🟡 CANDIDATE | Contato comercial pós-M068 |
| Banuba | BODY / FACE | 🟡 CANDIDATE | Confirmação vendor |
| MIRRAR | WRIST | 🟡 CANDIDATE | Avaliar após DeepAR |
| MediaPipe | WRIST | 🔴 LEGACY | Lab only — não tocar |
| WebAR.rocks | WRIST | ⚠️ EXPERIMENTAL | 0% detecção M066 — investigar causa raiz |

## Regras obrigatórias

1. **Cada engine é isolado.** Um engine não deve importar código de outro engine.
2. **POCs futuras entram primeiro como lab/rota isolada** — `?lab=deepar`, `?lab=perfectcorp` — nunca direto no scanner principal.
3. **Nada é integrado ao scanner principal sem validação objetiva.** O critério base é o avaliador de 10s do M066: `detectionRate ≥ 70%`, `averageConfidence ≥ 0.50`, `longestLostStreakMs ≤ 1000ms`, `jitterPxAvg ≤ 35px`, `placeholderWidthMax ≤ 160px`.
4. **Codex deve auditar** qualquer proposta de alteração em `App_FINAL.jsx` que resulte de integração de engine.
5. **Placeholders são contratos, não implementações.** `createSession()` de um placeholder lança erro controlado — intencionalmente.

# RELATORIO_DIAGNOSTICO_PIPELINE.md
**Missão 018 — Diagnóstico da Falha de Geração**
Data: 2026-06-19

---

## 1. CAUSA RAIZ IDENTIFICADA

**As variáveis `VITE_MESHY_API_KEY` e `VITE_TRIPO_API_KEY` NÃO estão definidas no ambiente de produção (Vercel).**

O arquivo `.env.local` presente no repositório contém **apenas** `VERCEL_OIDC_TOKEN` (gerado pelo Vercel CLI). As chaves de API dos providers estão ausentes.

```
# .env.local — conteúdo real
VERCEL_OIDC_TOKEN="eyJhbGci..."   ← único valor presente

# VITE_MESHY_API_KEY   ← AUSENTE
# VITE_TRIPO_API_KEY   ← AUSENTE
```

O arquivo `.env.example` documenta as variáveis, mas com valores vazios, e **não é carregado em produção**.

---

## 2. FLUXO DE EXECUÇÃO EM PRODUÇÃO

```
captureAndGenerate()
  └─ imagePipelineRef.current.run(blob)          [ImageToModelPipeline]
       └─ providers = [MeshyProvider(p=10), TripoProvider(p=5)]
            │
            ├─ Tentativa 1: MeshyProvider
            │    └─ submitImage()
            │         └─ _fetchWithRetry(url, { headers: this._headers() })
            │                                             ↑
            │              throw Error('[MeshyProvider] VITE_MESHY_API_KEY não definida no .env.local')
            │              → capturado como lastError
            │
            └─ Tentativa 2: TripoProvider (fallback)
                 └─ submitImage()
                      └─ _fetchWithRetry(url, { headers: this._headers() })
                                                          ↑
                           throw Error('[TripoProvider] VITE_TRIPO_API_KEY não definida no .env.local')
                           → sobrescreve lastError

  throw lastError  →  catch(err) em captureAndGenerate()
    └─ setPipelineStage('ERROR')
    └─ setPipelineError('Falha ao gerar modelo. Tente novamente.')
    └─ UI exibe: '✕ FALHA NA GERAÇÃO'
```

---

## 3. DETALHAMENTO TÉCNICO

| Campo             | Valor |
|-------------------|-------|
| **HTTP Status**   | Nenhum — a exceção é lançada **antes** do `fetch()` ser chamado, dentro de `_headers()` |
| **Provider primário** | `meshy` (prioridade 10) |
| **Provider fallback** | `tripo` (prioridade 5) |
| **Endpoint tentado**  | Nenhum — nenhum request HTTP é executado |
| **Resposta recebida** | Nenhuma |
| **Exception final (lastError)** | `[TripoProvider] VITE_TRIPO_API_KEY não definida no .env.local` |
| **Exception Meshy** | `[MeshyProvider] VITE_MESHY_API_KEY não definida no .env.local` |

---

## 4. RASTREAMENTO NO CÓDIGO

**Ponto de falha — `MeshyProvider._headers()` ([src/pipeline/providers/MeshyProvider.js:139](src/pipeline/providers/MeshyProvider.js#L139)):**
```js
_headers() {
  if (!this.apiKey) {
    throw new Error('[MeshyProvider] VITE_MESHY_API_KEY não definida no .env.local');
  }
  return { Authorization: `Bearer ${this.apiKey}`, ... };
}
```

**Ponto de falha — `TripoProvider._headers()` ([src/pipeline/providers/TripoProvider.js:156](src/pipeline/providers/TripoProvider.js#L156)):**
```js
_headers() {
  if (!this.apiKey) {
    throw new Error('[TripoProvider] VITE_TRIPO_API_KEY não definida no .env.local');
  }
  return { Authorization: `Bearer ${this.apiKey}`, ... };
}
```

**Inicialização das chaves (falha silenciosa em produção):**
```js
// MeshyProvider.js:32
this.apiKey = config.apiKey || import.meta.env.VITE_MESHY_API_KEY || null;
//                                         ↑ undefined em produção → null

// TripoProvider.js:42
this.apiKey = config.apiKey || import.meta.env.VITE_TRIPO_API_KEY || null;
//                                         ↑ undefined em produção → null
```

**Captura do erro na UI ([src/App_FINAL.jsx:565](src/App_FINAL.jsx#L565)):**
```js
} catch (err) {
  console.error('[Pipeline]', err);
  if (activeRef.current) {
    setPipelineStage('ERROR');
    setPipelineError('Falha ao gerar modelo. Tente novamente.');
    hasGeneratedRef.current = false;
  }
}
```

**Label exibido ([src/App_FINAL.jsx:80](src/App_FINAL.jsx#L80)):**
```js
const PIPELINE_LABELS = {
  ...
  ERROR: '✕ FALHA NA GERAÇÃO',  // ← o que o usuário vê
};
```

---

## 5. OBSERVAÇÃO ADICIONAL

O painel `GhostDiagnostics` está **desabilitado em produção** — ele está condicionado a `import.meta.env.DEV`:

```jsx
{import.meta.env.DEV && (
  <GhostDiagnostics ... />
)}
```

Isso significa que **nenhuma ferramenta de diagnóstico visual está disponível em produção**. A falha ocorre silenciosamente no console do browser, invisível para o operador.

---

## 6. CONCLUSÃO

- **`VITE_MESHY_API_KEY`**: ausente em produção → `null` em runtime
- **`VITE_TRIPO_API_KEY`**: ausente em produção → `null` em runtime
- **Fallback automático**: executado, mas também falha pela mesma razão
- **Requisição HTTP**: **nunca executada** — falha no pré-processamento do header
- **Solução**: definir ambas as variáveis no painel do Vercel em **Project Settings → Environment Variables → Production**

---
*Relatório gerado por Claude — Missão 018 | Sem alterações no código*

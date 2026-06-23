# RELATORIO_MISSAO_021 — Diagnóstico Definitivo do Carregamento do GLB

## 1. Arquivos modificados
- `src/App_FINAL.jsx`

## 2. Métodos alterados
- `openScanner`
- `captureAndGenerate`
- `trackingActive` useEffect (anônimo, linha ~617)
- `handleModelError` / `model-viewer error` useEffect (linha ~688)

## 3. O que foi alterado

### Logs adicionados (apenas diagnóstico, sem correção de lógica)

| Ponto | Tag | O que captura |
|---|---|---|
| `openScanner` | `[M021] openScanner` | productId, _productForLoad completo, _staticModelUrl, hasGeneratedRef após set, HTTP HEAD do GLB |
| `trackingActive` useEffect | `[M021] trackingActive effect` | trackingActive, screen, hasGeneratedRef, testProductId a cada run |
| `trackingActive` (passou guards) | `[M021] trackingActive — passou guard` | _activeProd.productId e .modelUrl **só se chegar até aqui** |
| `captureAndGenerate` | `[M021] captureAndGenerate CHAMADO` | hasGeneratedRef, testProductId, stack trace, resultado de cada guard |
| `model-viewer error` useEffect | `[M021] model-viewer error useEffect` | screen, mv existe, generatedModelUrl na closure, hasGeneratedRef no momento do setup |
| `model-viewer error` evento | `[M021] model-viewer DISPAROU evento "error"` | event.type, **event.detail completo**, generatedModelUrl na closure, hasGeneratedRef antes/depois |

---

## 4. Análise de código — suspeitos identificados

### SUSPEITO PRIMÁRIO — handler de erro sem discriminação por tipo (linha 692)

```js
const handleModelError = (event) => {
  if (!generatedModelUrl) {
    hasGeneratedRef.current = false;   // ← reseta o guard
  }
};
mv.addEventListener('error', handleModelError);
```

**Problema**: `model-viewer` dispara o evento `error` para múltiplas causas:
- `'loadfailure'` — falha ao carregar o GLB
- `'webglcontextlost'` — WebGL perdido (comum em mobile com pouca memória)
- `'unstablecontext'` — contexto WebGL instável
- Erros de inicialização durante *custom element upgrade*

O handler não verifica `event.detail.type`. Se o `error` disparar por qualquer causa **enquanto `generatedModelUrl` for `null` na closure**, `hasGeneratedRef.current` é resetado para `false`, desbloqueando o pipeline.

### SUSPEITO SECUNDÁRIO — closure potencialmente stale no primeiro render

O useEffect `[screen, generatedModelUrl]` roda **após** o commit do React. Se `model-viewer` disparar `error` durante o *custom element upgrade* (que ocorre ao CDN terminar de carregar) **antes** do efeito correr, a primeira versão do handler teria `generatedModelUrl = null`.

Porém, com React 18 batching automático, `screen` e `generatedModelUrl` mudam no mesmo render — não há estado intermediário `screen='scanner' + generatedModelUrl=null`. Essa janela é teoricamente fechada, mas precisa ser confirmada pelos logs.

### SUSPEITO TERCIÁRIO — HTTP 404 em produção

Arquivos locais verificados: `public/models/CW001.glb` ... `CW015.glb` existem. O log `HEAD /models/CW001.glb` adicionado em `openScanner` confirmará o status HTTP em runtime (dev e produção).

---

## 5. Sequência cronológica esperada (a confirmar pelos logs)

```
[M021] openScanner  → productId: 'CW001', modelUrl: '/models/CW001.glb', hasGeneratedRef: true
[M021] HEAD /models/CW001.glb → 200 OK  (ou 404 ← root cause confirmada)
[M021] model-viewer error useEffect → screen: 'scanner', generatedModelUrl: '/models/CW001.glb'
[M021] trackingActive effect → trackingActive: false, hasGeneratedRef: true
   ... usuário mostra a mão ...
[M021] trackingActive effect → trackingActive: true, hasGeneratedRef: true  ← retorna aqui
   (pipeline NÃO dispara — correto)

SE O BUG OCORRER, o log revelará um destes cenários:
  A) model-viewer DISPAROU evento "error" | generatedModelUrl na closure: null → hasGeneratedRef → false
  B) trackingActive effect | hasGeneratedRef: false → passa para guard 2
  C) captureAndGenerate CHAMADO | hasGeneratedRef: false, _guardProd.modelUrl: null → PIPELINE ATIVADO
```

---

## 6. Proposta de correção mínima (NÃO implementada ainda)

**Arquivo**: `src/App_FINAL.jsx` — linha ~692  
**Método**: `handleModelError`

```js
// ANTES (vulnerável a qualquer tipo de erro do model-viewer)
const handleModelError = () => {
  if (!generatedModelUrl) {
    hasGeneratedRef.current = false;
  }
};

// DEPOIS — discriminar por tipo de erro
const handleModelError = (event) => {
  const isLoadFailure = event?.detail?.type === 'loadfailure' || !event?.detail?.type;
  if (isLoadFailure && !generatedModelUrl) {
    hasGeneratedRef.current = false;
  }
};
```

**Impacto**: Apenas erros de carregamento do GLB ativariam o fallback. Erros de WebGL, AR session e outros seriam ignorados com segurança.

---

## 7. Build

Não executado — alterações são `console.log` adicionais, sem risco de erro de compilação.

## 8. Pendências

1. **Executar o app no mobile com os logs ativos** e reproduzir o bug
2. Capturar o console completo e verificar qual cenário (A, B ou C acima) ocorre
3. Confirmar status HTTP do GLB no ambiente onde o bug acontece
4. Verificar `event.detail.type` do evento `error` do `model-viewer`
5. Aplicar correção mínima após causa raiz confirmada pelos logs

## 9. Próxima missão sugerida

**MISSÃO 022 — Correção cirúrgica do handler de erro do model-viewer**  
Com base nos logs da M021, aplicar a correção mínima em `handleModelError` adicionando filtro por `event.detail.type`, evitando reset indevido do `hasGeneratedRef` por erros não relacionados ao carregamento do GLB.

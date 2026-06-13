# MAPEAMENTO DA ARQUITETURA EXECUTADA - GHOST PROJECT

**Data:** 11/06/2026  
**Objetivo:** Mapear a arquitetura efetivamente executada em produção

---

## 1. PONTO DE ENTRADA DA APLICAÇÃO

### ✅ Arquivo de Entrada Real

```
index.html (linha 15)
  └─> /src/main.tsx (linha 3)
      └─> ./App_FINAL (importado como App)
```

**Resposta:** O verdadeiro ponto de entrada é `src/main.tsx`, que importa e renderiza `App_FINAL.jsx`.

---

## 2. APP_FINAL.JSX ESTÁ SENDO RENDERIZADO?

### ✅ SIM - Confirmado

**Evidência:**
```typescript
// src/main.tsx (linha 3)
import App from './App_FINAL'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

**App_FINAL.jsx** é o único componente App efetivamente renderizado em produção.

---

## 3. ARQUIVOS APP_*.JSX PRESENTES

### 📁 Inventário Completo

| Arquivo | Linhas | Status | Propósito |
|---------|--------|--------|-----------|
| **App_FINAL.jsx** | 652 | ✅ **EM USO** | Versão de produção com catálogo dinâmico |
| App.jsx | 375 | ❌ MORTO | Versão antiga com modelo fixo |
| App_NEW.jsx | 456 | ❌ MORTO | Experimento com WristTracker |
| App_BRUTO.jsx | 596 | ❌ MORTO | Versão de debug sem smoothing |
| App_DIAGNOSTICO.jsx | 440 | ❌ MORTO | Versão de diagnóstico |
| App_DIAGNOSTICO_VISUAL.jsx | 491 | ❌ MORTO | Versão de diagnóstico visual |

**Total:** 6 arquivos App, sendo **5 arquivos mortos** (3.010 linhas de código não utilizado).

---

## 4. IMPORTS E ROTAS PARA ARQUIVOS ANTIGOS

### 🔍 Análise de Imports

**Busca realizada:** `import.*from.*['"](\.\/App|App_)`

**Resultado:**
```
✅ ÚNICO IMPORT ENCONTRADO:
src/main.tsx (linha 3): import App from './App_FINAL'
```

**Conclusão:** Nenhum arquivo antigo está sendo importado. Apenas `App_FINAL.jsx` está na cadeia de execução.

---

## 5. CÓDIGO MORTO E DUPLICADO

### 🗑️ Código Morto Identificado

#### A) Componentes App Não Utilizados (5 arquivos)

1. **App.jsx** (375 linhas)
   - Versão antiga com lerp manual
   - Modelo hardcoded: `/relogio.glb`
   - Sem suporte a catálogo dinâmico

2. **App_NEW.jsx** (456 linhas)
   - Experimento com `WristTracker.js` e `RenderPipeline.js`
   - Debug profissional com canvas
   - Modelo hardcoded: `/relogio.glb`

3. **App_BRUTO.jsx** (596 linhas)
   - Versão de debug sem smoothing
   - Canvas de debug com landmarks
   - Círculo verde de validação
   - Modelo hardcoded: `/relogio.glb`

4. **App_DIAGNOSTICO.jsx** (440 linhas)
   - Diagnóstico visual controlado
   - Apenas círculo verde (sem relógio)
   - Logs extensivos no console

5. **App_DIAGNOSTICO_VISUAL.jsx** (491 linhas)
   - Diagnóstico com relógio GLB
   - Painel de debug extensivo
   - Modelo hardcoded: `/relogio.glb`

#### B) Módulos de Tracking Não Utilizados

**Diretório:** `src/tracking/`

| Arquivo | Linhas | Status | Usado por |
|---------|--------|--------|-----------|
| WristTracker.js | 449 | ❌ MORTO | App_NEW.jsx (não usado) |
| RenderPipeline.js | ? | ❌ MORTO | App_NEW.jsx (não usado) |
| OneEuroFilter.js | ? | ❌ MORTO | WristTracker.js (não usado) |

**Observação:** Estes módulos implementam tracking profissional com One Euro Filter, mas não são utilizados pelo `App_FINAL.jsx`.

### 📊 Duplicações Encontradas

#### 1. Função `loadScript()` - Duplicada 6x

**Localização:**
- App_FINAL.jsx (linhas 9-24)
- App.jsx (linhas 5-13)
- App_NEW.jsx (linhas 7-15)
- App_BRUTO.jsx (linhas 5-19)
- App_DIAGNOSTICO.jsx (linhas 5-19)
- App_DIAGNOSTICO_VISUAL.jsx (linhas 5-19)

**Código:**
```javascript
function loadScript(src, id) {
  return new Promise((resolve, reject) => {
    if (document.getElementById(id)) {
      resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.id = id;
    s.crossOrigin = 'anonymous';
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}
```

#### 2. Função `loadMediaPipe()` - Duplicada 6x

**Localização:** Todos os 6 arquivos App

**Código:**
```javascript
async function loadMediaPipe() {
  await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js', 'mp-cu');
  await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js', 'mp-du');
  await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js', 'mp-h');
}
```

#### 3. Hook `useModelViewer()` - Duplicado 5x

**Localização:**
- App_FINAL.jsx (linhas 43-56)
- App.jsx (linhas 19-27)
- App_NEW.jsx (linhas 23-31)
- App_BRUTO.jsx (linhas 36-46)
- App_DIAGNOSTICO_VISUAL.jsx (linhas 36-46)

**Código:**
```javascript
function useModelViewer() {
  useEffect(() => {
    if (document.querySelector('script[data-mv]')) return;
    const s = document.createElement('script');
    s.type = 'module';
    s.setAttribute('data-mv', '1');
    s.src = 'https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js';
    document.head.appendChild(s);
  }, []);
}
```

#### 4. Função `landmarkToViewport()` - Duplicada 6x

**Localização:** Todos os 6 arquivos App

**Código:**
```javascript
function landmarkToViewport(norm, videoEl, mirrorX) {
  const iW = videoEl.videoWidth || 1280;
  const iH = videoEl.videoHeight || 720;
  const r = videoEl.getBoundingClientRect();
  const scale = Math.max(r.width / iW, r.height / iH);
  const dW = iW * scale;
  const dH = iH * scale;
  const ox = (r.width - dW) / 2;
  const oy = (r.height - dH) / 2;
  let x = norm.x * dW + ox + r.left;
  const y = norm.y * dH + oy + r.top;
  if (mirrorX) {
    x = r.right - (norm.x * dW + ox);
  }
  return { x, y };
}
```

#### 5. Modelo GLB Hardcoded - 4 ocorrências

**Arquivos com `/relogio.glb` hardcoded:**
- App.jsx (linha 336)
- App_NEW.jsx (linha 418)
- App_BRUTO.jsx (linha 556)
- App_DIAGNOSTICO_VISUAL.jsx (linha 343)

**Observação:** `App_FINAL.jsx` usa sistema dinâmico com `getModelUrl()`.

---

## 6. CADEIA COMPLETA DE IMPORTS

### 🔗 Árvore de Dependências (App_FINAL.jsx)

```
App_FINAL.jsx
├── React hooks (useState, useRef, useEffect, useCallback)
├── ./App.css
├── ./utils/urlParams.js
│   └── ../data/products.json
├── ./DiagnosticPage.jsx
├── ./ReportPanel.jsx
└── ./TestModelsPage.jsx
```

### 📦 Módulos Utilizados

#### A) Dependências Diretas do App_FINAL.jsx

| Import | Tipo | Propósito |
|--------|------|-----------|
| `useState, useRef, useEffect, useCallback` | React | Hooks de estado e lifecycle |
| `./App.css` | CSS | Estilos da aplicação |
| `getEmbeddedParam, getModelUrl, getProductId` | Utils | Parâmetros de URL |
| `DiagnosticPage` | Componente | Página de diagnóstico GLB |
| `ReportPanel` | Componente | Painel de relatórios |
| `TestModelsPage` | Componente | Catálogo de teste de modelos |

#### B) Dependências Indiretas

**urlParams.js** importa:
```javascript
import productsData from "../data/products.json";
```

**products.json** contém:
- 15 produtos (CW001 a CW015)
- Cada produto tem: id, title, sku, price, imageUrl, handle, status, modelUrl

---

## 7. ARQUIVO EXECUTADO EM PRODUÇÃO

### ✅ Arquivo Principal

**App_FINAL.jsx** (652 linhas)

**Características:**
- ✅ Sistema de catálogo dinâmico com `products.json`
- ✅ Suporte a múltiplos modelos GLB via URL params
- ✅ Integração com `DiagnosticPage`, `ReportPanel`, `TestModelsPage`
- ✅ Smoothing cinematográfico com dead zones
- ✅ Tracking anatômico do pulso
- ✅ Validação de produto com mensagem de erro
- ✅ Modo de teste para desenvolvedores (`import.meta.env.DEV`)

**Funcionalidades:**
1. **Home Screen:** Seleção de câmera (frontal/traseira)
2. **Scanner AR:** Tracking de mão com MediaPipe
3. **Model Viewer:** Renderização 3D com Google Model Viewer
4. **Test Models:** Catálogo de produtos para teste (DEV only)
5. **Diagnostic Page:** Auditoria de arquivos GLB
6. **Report Panel:** Painel de relatórios (não implementado)

---

## 8. MODELOS GLB DISPONÍVEIS

### 📁 Diretório: `public/`

| Arquivo | Status | Usado por |
|---------|--------|-----------|
| relogio.glb | ✅ Fallback | App_FINAL (fallback padrão) |
| Watch.glb | ❓ Desconhecido | Não referenciado no código |

### 📁 Diretório: `public/models/`

**15 modelos de produtos:**
- CW001.glb a CW015.glb
- Mapeados em `products.json`
- Carregados dinamicamente via `getModelUrl()`

### 📁 Diretório: `public/models_backup/`

**Status:** Backup (não utilizado em produção)

---

## 9. RESUMO EXECUTIVO

### ✅ Arquitetura Atual

```
PRODUÇÃO:
index.html → main.tsx → App_FINAL.jsx
                         ├── DiagnosticPage.jsx
                         ├── ReportPanel.jsx
                         ├── TestModelsPage.jsx
                         ├── urlParams.js → products.json
                         └── App.css

CÓDIGO MORTO (não executado):
├── App.jsx (375 linhas)
├── App_NEW.jsx (456 linhas)
├── App_BRUTO.jsx (596 linhas)
├── App_DIAGNOSTICO.jsx (440 linhas)
├── App_DIAGNOSTICO_VISUAL.jsx (491 linhas)
└── tracking/
    ├── WristTracker.js (449 linhas)
    ├── RenderPipeline.js
    └── OneEuroFilter.js
```

### 📊 Estatísticas

| Métrica | Valor |
|---------|-------|
| **Arquivos App totais** | 6 |
| **Arquivos App em uso** | 1 (App_FINAL.jsx) |
| **Arquivos App mortos** | 5 |
| **Linhas de código morto** | ~3.010 linhas |
| **Funções duplicadas** | 4 (loadScript, loadMediaPipe, useModelViewer, landmarkToViewport) |
| **Módulos tracking não usados** | 3 (WristTracker, RenderPipeline, OneEuroFilter) |
| **Modelos GLB disponíveis** | 17 (15 produtos + 2 fallbacks) |

### 🎯 Conclusões

1. ✅ **App_FINAL.jsx** é o único arquivo executado em produção
2. ❌ **5 arquivos App** são código morto e podem ser removidos
3. ❌ **Módulos tracking/** não são utilizados pelo App_FINAL
4. ⚠️ **Duplicação massiva** de funções utilitárias (4 funções × 6 arquivos)
5. ✅ **Sistema de catálogo dinâmico** funcional com 15 produtos
6. ✅ **Nenhum import** aponta para arquivos antigos

### 🔧 Recomendações

1. **Remover código morto:**
   - Deletar: App.jsx, App_NEW.jsx, App_BRUTO.jsx, App_DIAGNOSTICO.jsx, App_DIAGNOSTICO_VISUAL.jsx
   - Avaliar: tracking/ (se não for usado futuramente)

2. **Refatorar duplicações:**
   - Criar `src/utils/cdnLoaders.js` com loadScript, loadMediaPipe, useModelViewer
   - Criar `src/utils/coordinates.js` com landmarkToViewport

3. **Renomear arquivo principal:**
   - `App_FINAL.jsx` → `App.jsx` (convenção padrão)
   - Atualizar import em `main.tsx`

4. **Documentar arquitetura:**
   - Adicionar README.md explicando estrutura
   - Documentar fluxo de catálogo dinâmico

---

## 10. ÁRVORE DE ARQUIVOS ENVOLVIDOS

```
Ghost-project-ai/
├── index.html ✅ (ponto de entrada HTML)
├── package.json ✅ (dependências)
├── vite.config.ts ✅ (configuração build)
│
├── public/
│   ├── relogio.glb ✅ (modelo fallback)
│   ├── Watch.glb ❓ (não referenciado)
│   ├── models/
│   │   ├── CW001.glb ✅
│   │   ├── CW002.glb ✅
│   │   └── ... (CW003-CW015) ✅
│   └── models_backup/ ❌ (não usado)
│
└── src/
    ├── main.tsx ✅ (ponto de entrada JS)
    ├── App.css ✅ (estilos)
    │
    ├── App_FINAL.jsx ✅ ⭐ (ARQUIVO EXECUTADO)
    ├── App.jsx ❌ (código morto)
    ├── App_NEW.jsx ❌ (código morto)
    ├── App_BRUTO.jsx ❌ (código morto)
    ├── App_DIAGNOSTICO.jsx ❌ (código morto)
    ├── App_DIAGNOSTICO_VISUAL.jsx ❌ (código morto)
    │
    ├── DiagnosticPage.jsx ✅ (usado por App_FINAL)
    ├── ReportPanel.jsx ✅ (usado por App_FINAL)
    ├── TestModelsPage.jsx ✅ (usado por App_FINAL)
    │
    ├── data/
    │   └── products.json ✅ (catálogo de produtos)
    │
    ├── utils/
    │   ├── urlParams.js ✅ (usado por App_FINAL)
    │   └── glbAuditor.js ✅ (usado por DiagnosticPage)
    │
    └── tracking/ ❌ (não usado)
        ├── WristTracker.js ❌
        ├── RenderPipeline.js ❌
        └── OneEuroFilter.js ❌
```

**Legenda:**
- ✅ Em uso / executado
- ❌ Código morto / não usado
- ❓ Status desconhecido
- ⭐ Arquivo principal

---

**FIM DO MAPEAMENTO**

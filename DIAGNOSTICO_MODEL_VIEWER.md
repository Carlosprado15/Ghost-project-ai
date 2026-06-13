# DIAGNÓSTICO MODEL-VIEWER - GHOST PROJECT

**Data:** 11/06/2026  
**Objetivo:** Investigar problemas de carregamento do model-viewer

---

## ANÁLISE CRÍTICA

### 1. O model-viewer está recebendo modelUrl válida?

**Arquivo:** `src/App_FINAL.jsx` (linha 589)

```jsx
<model-viewer
  ref={modelViewerRef}
  src={modelUrl}  // ← PROBLEMA IDENTIFICADO
  ...
/>
```

**Validação anterior (linha 502-503):**
```jsx
const modelUrl = getModelUrl(productId);
const hasValidProduct = productId && modelUrl;
```

**Função getModelUrl() (src/utils/urlParams.js, linha 23-41):**
```javascript
export function getModelUrl() {
  const params = new URLSearchParams(window.location.search);
  const productId = getProductId();

  if (productId) {
    const product = productsData.find(p => p.id === productId);
    if (product && product.modelUrl) {
      return product.modelUrl;  // Ex: "/models/CW001.glb"
    }
  }

  return params.get("modelUrl") || 
    params.get("glb") ||
    params.get("gltf") ||
    params.get("file") ||
    params.get("model") ||
    params.get("url") ||
    null;  // ← RETORNA NULL SE NÃO ENCONTRAR
}
```

**❌ PROBLEMA 1: modelUrl pode ser NULL**

Quando `getModelUrl()` retorna `null`, o model-viewer recebe:
```jsx
<model-viewer src={null} />
```

Isso causa:
- ❌ Nenhum arquivo GLB é carregado
- ❌ Evento `load` nunca dispara
- ❌ Evento `error` nunca dispara (porque não há tentativa de carregamento)
- ❌ Model-viewer fica em estado vazio/inválido

---

### 2. O evento load do model-viewer dispara?

**Arquivo:** `src/App_FINAL.jsx` (linha 608)

```jsx
onLoad={() => setModelViewerLoadedTime(performance.now())}
```

**✅ IMPLEMENTADO** - Mas só dispara se o GLB carregar com sucesso.

**Problema:** Se `src={null}`, o evento `load` **NUNCA** dispara.

---

### 3. O evento error do model-viewer dispara?

**Arquivo:** `src/App_FINAL.jsx` (linhas 587-614)

```jsx
<model-viewer
  ref={modelViewerRef}
  src={modelUrl}
  ...
  onLoad={() => setModelViewerLoadedTime(performance.now())}
  onUpdate={() => { ... }}
/>
```

**❌ PROBLEMA 2: Evento `error` NÃO ESTÁ IMPLEMENTADO**

Não há handler para:
- `onError` - Erro de carregamento do GLB
- `error` event listener

**Consequência:**
- Erros de carregamento são silenciosos
- Usuário não sabe se o modelo falhou ou está carregando
- Debugging impossível sem console do navegador

---

### 4. O GLB está sendo baixado pelo navegador?

**Depende do cenário:**

#### Cenário A: productId válido (ex: CW001)
```
getModelUrl("CW001") → "/models/CW001.glb"
Browser tenta baixar: http://localhost:5173/models/CW001.glb
```

**Arquivos disponíveis em `public/models/`:**
- ✅ CW001.glb a CW015.glb (15 arquivos)
- ✅ Outros: black.glb, CASIO.glb, diver.glb, gold.glb, metal.glb, skeleton.glb

**Status:** ✅ GLB deve ser baixado com sucesso (se arquivo existe)

#### Cenário B: productId inválido ou ausente
```
getModelUrl(null) → null
Browser NÃO tenta baixar nada
```

**Status:** ❌ Nenhum download ocorre

#### Cenário C: URL params sem productId
```
/?modelUrl=/relogio.glb
getModelUrl() → "/relogio.glb"
Browser tenta baixar: http://localhost:5173/relogio.glb
```

**Arquivo disponível em `public/`:**
- ✅ relogio.glb (fallback)

**Status:** ✅ GLB deve ser baixado com sucesso

---

### 5. Existe algum GLB corrompido?

**Arquivos GLB encontrados:**

**public/models/ (21 arquivos):**
- CW001.glb a CW015.glb (15 produtos do catálogo)
- black.glb, CASIO.glb, diver.glb, gold.glb, metal.glb, skeleton.glb (6 extras)

**public/ (2 arquivos):**
- relogio.glb (fallback principal)
- Watch.glb (não referenciado no código)

**⚠️ IMPOSSÍVEL VERIFICAR SEM EXECUTAR**

Para verificar corrupção, seria necessário:
1. Tentar carregar cada GLB no navegador
2. Verificar logs de erro do model-viewer
3. Usar ferramenta de validação GLB (ex: glTF Validator)

**Suspeita:** Arquivos provavelmente estão OK, pois foram adicionados recentemente ao projeto.

---

### 6. Existe erro de CORS, MIME type ou caminho incorreto?

#### A) CORS (Cross-Origin Resource Sharing)

**Análise:**
- Arquivos GLB estão em `public/` (servidos pelo Vite)
- Mesma origem: `http://localhost:5173`
- ✅ **SEM PROBLEMA DE CORS** (same-origin)

#### B) MIME Type

**Vite serve GLB com MIME type correto:**
- `.glb` → `model/gltf-binary`
- `.gltf` → `model/gltf+json`

**✅ SEM PROBLEMA DE MIME TYPE**

#### C) Caminho Incorreto

**Análise dos caminhos:**

**products.json (linha 10, 20, 30, etc):**
```json
"modelUrl": "/models/CW001.glb"
```

**Estrutura de diretórios:**
```
public/
├── models/
│   └── CW001.glb  ✅ EXISTE
```

**URL final:**
```
http://localhost:5173/models/CW001.glb  ✅ CORRETO
```

**✅ CAMINHOS ESTÃO CORRETOS**

**MAS:**

Se `getModelUrl()` retornar `null`, o caminho é inválido:
```jsx
<model-viewer src={null} />  ❌ INVÁLIDO
```

---

## CAUSA RAIZ

### 🔴 PROBLEMA PRINCIPAL

**Arquivo:** `src/App_FINAL.jsx`  
**Linha:** 589  

```jsx
<model-viewer
  src={modelUrl}  // ← modelUrl pode ser NULL
  ...
/>
```

**Causa:**
1. `getModelUrl(productId)` retorna `null` quando:
   - Nenhum `productId` na URL
   - `productId` não existe em `products.json`
   - Nenhum parâmetro alternativo (`modelUrl`, `glb`, etc.) na URL

2. Model-viewer recebe `src={null}`, que é inválido

3. Nenhum GLB é carregado

4. Nenhum evento (`load` ou `error`) dispara

5. Usuário vê tela vazia sem feedback

### 🔴 PROBLEMA SECUNDÁRIO

**Arquivo:** `src/App_FINAL.jsx`  
**Linhas:** 587-614  

**Falta handler de erro:**
```jsx
<model-viewer
  onLoad={...}   ✅ Implementado
  onError={...}  ❌ NÃO IMPLEMENTADO
/>
```

**Consequência:**
- Erros de carregamento são silenciosos
- Impossível debugar problemas de rede, CORS, ou GLB corrompido

---

## CORREÇÃO MÍNIMA NECESSÁRIA

### ✅ CORREÇÃO 1: Fallback para modelUrl

**Arquivo:** `src/App_FINAL.jsx`  
**Linha:** 502  

**ANTES:**
```jsx
const modelUrl = getModelUrl(productId);
```

**DEPOIS:**
```jsx
const modelUrl = getModelUrl(productId) || "/relogio.glb";
```

**Efeito:**
- Se `getModelUrl()` retornar `null`, usa `/relogio.glb` como fallback
- Garante que model-viewer sempre recebe uma URL válida
- GLB sempre será carregado (ou tentará carregar)

---

### ✅ CORREÇÃO 2: Handler de erro

**Arquivo:** `src/App_FINAL.jsx`  
**Linha:** 608 (após onLoad)  

**ADICIONAR:**
```jsx
<model-viewer
  ref={modelViewerRef}
  src={modelUrl}
  ...
  onLoad={() => setModelViewerLoadedTime(performance.now())}
  onError={(event) => {
    console.error('[MODEL-VIEWER] Erro ao carregar GLB:', {
      src: modelUrl,
      error: event.detail || event
    });
  }}
  onUpdate={() => {
    if (!firstDisplayTime && modelViewerRef.current?.modelIsVisible) {
      setFirstDisplayTime(performance.now());
    }
  }}
/>
```

**Efeito:**
- Captura erros de carregamento do GLB
- Loga informações úteis para debug
- Permite implementar UI de erro futuramente

---

### ✅ CORREÇÃO 3 (OPCIONAL): Validação mais robusta

**Arquivo:** `src/utils/urlParams.js`  
**Linha:** 23-41  

**ADICIONAR fallback na função:**
```javascript
export function getModelUrl(productId) {
  const params = new URLSearchParams(window.location.search);

  if (productId) {
    const product = productsData.find(p => p.id === productId);
    if (product && product.modelUrl) {
      return product.modelUrl;
    }
  }

  return params.get("modelUrl") || 
    params.get("glb") ||
    params.get("gltf") ||
    params.get("file") ||
    params.get("model") ||
    params.get("url") ||
    "/relogio.glb";  // ← FALLBACK AQUI
}
```

**Efeito:**
- Centraliza lógica de fallback
- Garante que função nunca retorna `null`
- Mais fácil de manter

---

## RESUMO EXECUTIVO

### 📋 RESPOSTAS DIRETAS

| Pergunta | Resposta |
|----------|----------|
| **1. ModelUrl válida?** | ❌ NÃO - Pode ser `null` se productId inválido |
| **2. Evento load dispara?** | ⚠️ SIM - Mas só se GLB carregar (não dispara se src=null) |
| **3. Evento error dispara?** | ❌ NÃO - Handler não implementado |
| **4. GLB sendo baixado?** | ⚠️ DEPENDE - Só se modelUrl válida |
| **5. GLB corrompido?** | ❓ IMPOSSÍVEL VERIFICAR sem executar |
| **6. Erro CORS/MIME/Path?** | ✅ NÃO - Tudo correto (se modelUrl válida) |

### 🎯 CAUSA RAIZ

**`getModelUrl()` retorna `null` → model-viewer recebe `src={null}` → nenhum GLB carregado**

### 🔧 CORREÇÃO MÍNIMA

**Arquivo:** `src/App_FINAL.jsx`  
**Linha:** 502  

```jsx
// ANTES
const modelUrl = getModelUrl(productId);

// DEPOIS
const modelUrl = getModelUrl(productId) || "/relogio.glb";
```

**+**

**Linha:** 608 (adicionar após onLoad)

```jsx
onError={(event) => {
  console.error('[MODEL-VIEWER] Erro ao carregar GLB:', {
    src: modelUrl,
    error: event.detail || event
  });
}}
```

---

**FIM DO DIAGNÓSTICO**

# PLANO DE IMPLEMENTAÇÃO SEGURA PARA MODELOS DINÂMICOS

## 1. TODOS os locais onde /relogio.glb é utilizado

**Arquivo:** `src/App_FINAL.jsx`  
**Linha:** 396  
**Função:** Componente principal do scanner AR

**Arquivo:** `src/App.jsx`  
**Linha:** 336  
**Função:** Componente App original

**Arquivo:** `src/App_NEW.jsx`  
**Linha:** 418  
**Função:** Componente App com tracking profissional

**Arquivo:** `src/App_BRUTO.jsx`  
**Linha:** 396  
**Função:** Componente App com tracking bruto

**Arquivo:** `src/App_DIAGNOSTICO_VISUAL.jsx`  
**Linha:** 418  
**Função:** Componente App com diagnóstico visual

**Total:** 5 arquivos, 5 ocorrências exatas do mesmo padrão

## 2. Verificação de preload do GLB

**Resultado:** **NÃO EXISTE** preload do GLB

**Justificativa:** Nenhum arquivo contém referências a `preload`, `prefetch`, `Preload`, ou qualquer mecanismo de carregamento antecipado do modelo 3D. O `<model-viewer>` nativo do Google cuida do carregamento sob demanda.

## 3. Verificação de cache relacionado ao modelo

**Resultado:** **NÃO EXISTE** cache específico do modelo

**Justificativa:** Nenhum arquivo contém implementações de cache para modelos GLB. O browser realiza caching padrão de assets, mas não há cache customizado no código.

## 4. Dependências que assumem modelo específico

### Tamanho/Scale específicos:

**Arquivo:** `src/App_FINAL.jsx`  
**Linha:** 93  
**Dependência:** `size: 220` - tamanho inicial hardcoded

**Arquivo:** `src/App_FINAL.jsx`  
**Linha:** 168-170  
**Dependência:** 
```javascript
const minWatchSize = 140;
const maxWatchSize = 420; 
const watchScaleFactor = 1.45;
```

**Arquivo:** `src/App.jsx`  
**Linha:** 124  
**Dependência:** `size: 140` - tamanho inicial

**Arquivo:** `src/App.jsx`  
**Linha:** 169  
**Dependência:** `const rawSz = Math.max(90, Math.min(220, palmPx * 1.85))`

**Arquivo:** `src/tracking/WristTracker.js`  
**Linha:** 43-46  
**Dependência:** 
```javascript
watchSizeMultiplier: config.watchSizeMultiplier ?? 1.5,
watchOffsetRatio: config.watchOffsetRatio ?? 0.18,
minWatchSize: config.minWatchSize ?? 80,
maxWatchSize: config.maxWatchSize ?? 220,
```

**Arquivo:** `src/tracking/WristTracker.js`  
**Linha:** 240  
**Dependência:** `const offset = forearmLength * this.config.watchOffsetRatio`

**Arquivo:** `src/tracking/WristTracker.js`  
**Linha:** 245  
**Dependência:** `const rawSize = palmWidth * this.config.watchSizeMultiplier`

## 5. Arquivos que precisariam ser alterados para suportar ?modelUrl=

### Arquivos PRINCIPAIS (alteração obrigatória):
1. `src/App_FINAL.jsx` - Componente principal em uso
2. `src/utils/urlParams.js` - Adicionar função `getModelUrl()`

### Arquivos SECUNDÁRIOS (para consistência):
3. `src/App.jsx` - Componente original
4. `src/App_NEW.jsx` - Componente com tracking profissional  
5. `src/App_BRUTO.jsx` - Componente com tracking bruto
6. `src/App_DIAGNOSTICO_VISUAL.jsx` - Componente diagnóstico

### Arquivos que NÃO precisam alteração:
- `src/tracking/WristTracker.js` ✅
- `src/tracking/RenderPipeline.js` ✅  
- `src/tracking/OneEuroFilter.js` ✅
- Qualquer arquivo de tracking ✅

## 6. Risco técnico de cada alteração

### `src/utils/urlParams.js`
**Risco:** **BAIXO**  
Adicionar função `getModelUrl()` seguindo padrão existente

### `src/App_FINAL.jsx`  
**Risco:** **BAIXO**  
Substituir `src="/relogio.glb"` por `src={modelUrl || "/relogio.glb"}`

### `src/App.jsx`, `src/App_NEW.jsx`, `src/App_BRUTO.jsx`, `src/App_DIAGNOSTICO_VISUAL.jsx`
**Risco:** **MÉDIO**  
Alterações similares, mas multiplicidade aumenta risco de inconsistência

## 7. Plano de execução em etapas (alteração mínima)

### ETAPA 1: Implementação Core (Risco BAIXO)

**Objetivo:** Suporte básico a `?modelUrl=` no componente principal

**Ações:**
1. Adicionar `getModelUrl()` em `src/utils/urlParams.js`
2. Modificar `src/App_FINAL.jsx` para usar URL dinâmica:
   - Importar `getModelUrl` 
   - Obter URL do modelo: `const modelUrl = getModelUrl()`
   - Usar no model-viewer: `src={modelUrl || "/relogio.glb"}`

**Resultado:** Sistema funcional com fallback para modelo padrão

### ETAPA 2: Consolidação (Risco MÉDIO)

**Objetivo:** Uniformizar todos os componentes App

**Ações:**
1. Aplicar mesma modificação em:
   - `src/App.jsx`
   - `src/App_NEW.jsx` 
   - `src/App_BRUTO.jsx`
   - `src/App_DIAGNOSTICO_VISUAL.jsx`

**Resultado:** Consistência completa na codebase

### ETAPA 3: Otimização e Segurança (Risco BAIXO)

**Objetivo:** Adicionar validações e otimizações

**Ações:**
1. Adicionar validação de URL em `getModelUrl()`
2. Implementar fallback para URLs inválidas
3. Adicionar loading states para modelos externos
4. Documentar uso para integração com lojas

**Resultado:** Sistema robusto e pronto para produção

## VISÃO GERAL DO PLANO

**Foco inicial:** ETAPA 1 apenas - alteração mínima no componente principal
**Benefício:** Funcionalidade imediata com risco mínimo
**Evolução:** Etapas subsequentes para completude
**Preservação:** Tracking, pipeline e filtros intactos - apenas visualização modificada
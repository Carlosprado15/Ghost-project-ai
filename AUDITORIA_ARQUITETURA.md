# AUDITORIA DE ARQUITETURA PARA INTEGRAÇÃO COM LOJAS

## 1. Onde o modelo 3D atual é carregado

**Arquivo:** `src/App_FINAL.jsx`  
**Linha:** 396  
**Nome do GLB:** `relogio.glb`  
**Caminho completo:** `/relogio.glb` (arquivo localizado em `public/relogio.glb`)

**Outras ocorrências:**
- `src/App.jsx` linha 336: `/relogio.glb`
- `src/App_NEW.jsx` linha 418: `/relogio.glb`
- `src/App_BRUTO.jsx` linha 396: `/relogio.glb`
- `src/App_DIAGNOSTICO_VISUAL.jsx` linha 418: `/relogio.glb`

## 2. O modelo atual está hardcoded?

**SIM**

**Trecho exato:**
```jsx
<model-viewer
  src="/relogio.glb"
  disable-zoom
  shadow-intensity="0.8"
  exposure="1.0"
  interaction-prompt="none"
  camera-orbit="0deg 78deg 105%"
  field-of-view="26deg"
  min-camera-orbit="auto auto 105%"
  max-camera-orbit="auto auto 105%"
  camera-controls="false"
  tone-mapping="neutral"
  style={{
    width: '100%',
    height: '100%',
    background: 'transparent',
    opacity: 0.98,
  }}
/>
```

O caminho `/relogio.glb` está literalmente escrito no código JSX em todos os componentes App.

## 3. Existe hoje alguma forma de trocar o modelo sem alterar código?

**NÃO**

**Explicação:** Não há mecanismo de configuração, parâmetros de URL, ou API para trocar o modelo 3D. O caminho do arquivo GLB está hardcoded em todos os componentes. A única forma de trocar o modelo seria:
1. Substituir o arquivo `public/relogio.glb` por outro modelo com o mesmo nome
2. Ou modificar manualmente o código fonte em cada componente App

## 4. Onde o model-viewer ou renderer recebe o arquivo GLB?

**Arquivo:** `src/App_FINAL.jsx`  
**Linha:** 396  
**Variável utilizada:** Atributo `src` do elemento `<model-viewer>`

**Detalhes:** O elemento `<model-viewer>` recebe o arquivo GLB através do atributo `src` com valor literal `/relogio.glb`. Não há variável JavaScript intermediária - o caminho está embutido diretamente no JSX.

## 5. Qual seria o ponto mais simples da arquitetura atual para futuramente receber um modelo externo?

**Ponto mais simples:** **Query parameter** na URL

**Justificativa:**
1. **Infraestrutura existente:** Já existe o utilitário `src/utils/urlParams.js` com funções como `getProductId()`, `getImageUrl()`, `getProductUrl()`, `getEmbeddedParam()`
2. **Baixo acoplamento:** Não requer mudanças na arquitetura de tracking ou renderização
3. **Implementação simples:** Bastaria adicionar uma função `getModelUrl()` e usar no atributo `src` do `<model-viewer>`
4. **Compatibilidade com lojas:** As lojas poderiam gerar URLs como `https://ghost-project.com/?modelUrl=https://loja.com/modelos/relogio-premium.glb`

**Alternativas em ordem de complexidade:**
1. **Query parameter** (mais simples, já tem infra)
2. **Config file** (requer arquivo de configuração)
3. **JSON endpoint** (requer API simples)
4. **API completa** (mais complexo, requer autenticação)

## 6. Existem dependências que assumem que sempre será o mesmo relógio?

**SIM** - Existem várias dependências que assumem dimensões específicas de relógio

**Referências encontradas:**

### Tamanho/Scale fixos:
- `src/App_FINAL.jsx` linha 93: `size: 220` (tamanho inicial hardcoded)
- `src/App_FINAL.jsx` linha 168: `const minWatchSize = 140`
- `src/App_FINAL.jsx` linha 169: `const maxWatchSize = 420`
- `src/App_FINAL.jsx` linha 170: `const watchScaleFactor = 1.45`

- `src/App.jsx` linha 124: `size: 140` (tamanho inicial)
- `src/App.jsx` linha 169: `const rawSz = Math.max(90, Math.min(220, palmPx * 1.85))`

- `src/tracking/WristTracker.js` linha 43-46:
  ```javascript
  watchSizeMultiplier: config.watchSizeMultiplier ?? 1.5,
  watchOffsetRatio: config.watchOffsetRatio ?? 0.18,
  minWatchSize: config.minWatchSize ?? 80,
  maxWatchSize: config.maxWatchSize ?? 220,
  ```

### Cálculos geométricos fixos:
- `src/tracking/WristTracker.js` linha 240: `const offset = forearmLength * this.config.watchOffsetRatio`
- `src/tracking/WristTracker.js` linha 245: `const rawSize = palmWidth * this.config.watchSizeMultiplier`

**Arquivos e linhas:**
1. `src/App_FINAL.jsx`: linhas 93, 168-170
2. `src/App.jsx`: linhas 124, 169
3. `src/tracking/WristTracker.js`: linhas 43-46, 240, 245
4. `src/App_BRUTO.jsx`: linhas 124, 169
5. `src/App_NEW.jsx`: linhas 43-46 (configuração similar)

## 7. O tracking atual depende do relógio específico?

**NÃO** - O tracking NÃO depende do modelo 3D específico

**Justificativa técnica:**

O sistema de tracking (`WristTracker.js`) opera exclusivamente com:
1. **Landmarks anatômicos** do MediaPipe (pulso, dedos)
2. **Geometria da mão** (largura da palma, vetor do antebraço)
3. **Cálculos independentes** de posição, rotação e escala

**O tracking calcula:**
- **Posição:** Baseada na localização do pulso com offset anatômico
- **Rotação:** Baseada no vetor antebraço (pulso → palma)
- **Escala:** Proporcional à largura da palma (palmWidth × multiplier)

**Nenhum desses cálculos referencia:**
- Dimensões do modelo 3D
- Texturas ou materiais do relógio
- Propriedades específicas do arquivo GLB

**Conclusão:** O tracking é **agnóstico ao modelo 3D**. Qualquer objeto pode ser posicionado usando as mesmas coordenadas calculadas.

## 8. O que impediria hoje o Ghost Project de trocar modelos sem alterar o tracking?

**Blocker principal:** **Código hardcoded do caminho do modelo**

**Problemas específicos:**

1. **Caminho fixo no JSX:** Todos os componentes usam `src="/relogio.glb"` literalmente
2. **Falta de abstração:** Não há componente `ModelViewer` parametrizável
3. **Ausência de configuração:** Nenhum mecanismo para passar modelo dinamicamente
4. **Multiplicidade de arquivos:** 5 diferentes componentes App (FINAL, BRUTO, NEW, etc.) precisariam ser modificados

**Para suportar:**
- **Relógio A → Relógio B → Pulseira C → Anel D**

**Seria necessário:**
1. Criar um parâmetro de URL (ex: `?model=relogioA.glb`)
2. Componentizar o `<model-viewer>` para aceitar prop `modelUrl`
3. Atualizar todos os componentes App para usar a prop dinâmica
4. Garantir que os modelos estejam disponíveis no servidor (CDN ou local)

**O tracking em si NÃO é um impedimento** - já é agnóstico ao modelo.

---

## DIAGNÓSTICO DA ARQUITETURA ATUAL

### Pontos Fortes:
1. **Tracking robusto:** Sistema profissional com OneEuroFilter, persistência temporal e confidence scoring
2. **Arquitetura modular:** Separação clara entre tracking (WristTracker), renderização (RenderPipeline) e UI (React)
3. **Agnóstico ao modelo:** Cálculos geométricos independentes do objeto 3D
4. **Infraestrutura URL:** Já possui utilitários para parâmetros de URL

### Pontos Fracos:
1. **Modelo hardcoded:** Caminho `/relogio.glb` literal em todos os componentes
2. **Multiplicidade de componentes:** 5 versões diferentes de App dificultam manutenção
3. **Falta de abstração:** Nenhum componente parametrizável para modelos 3D
4. **Configuração fixa:** Valores de tamanho/scale hardcoded em múltiplos lugares

### Grau de Preparação para Integração com Lojas: **BAIXO (2/10)**

**Justificativa:**
- ✅ Tracking agnóstico ao modelo (pronto para qualquer objeto)
- ✅ Infraestrutura básica de URL params existente
- ❌ Modelo hardcoded (impede troca dinâmica)
- ❌ Sem API ou endpoints para integração
- ❌ Sem mecanismo de configuração externa
- ❌ Multiplicidade de componentes dificulta evolução

### Próximo Passo Técnico Prioritário

**Implementar parâmetro de URL para modelo 3D**

**Passos:**
1. Adicionar função `getModelUrl()` em `src/utils/urlParams.js`
2. Criar componente `DynamicModelViewer` que aceita prop `modelUrl`
3. Atualizar `App_FINAL.jsx` para usar o componente dinâmico
4. Testar com URLs como `?modelUrl=/models/black.glb`
5. Posteriormente: suportar URLs externas (CDN de lojas)

**Impacto mínimo:** Apenas mudanças no componente de visualização, sem alterar tracking, pipeline ou geometria.

**Benefício:** Permite integração imediata com lojas via URL parameters, alinhado com o fluxo "Loja → Ghost Project → Retorna para loja".
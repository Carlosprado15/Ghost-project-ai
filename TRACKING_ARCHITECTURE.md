# 🎯 Arquitetura de Tracking Profissional - Ghost AR Watch

## 📋 Visão Geral

Sistema de tracking AR cinematográfico reconstruído do zero, eliminando jitter e implementando persistência temporal robusta.

## 🏗️ Arquitetura

### 1. **OneEuroFilter.js** - Smoothing Adaptativo
Implementação do algoritmo One Euro Filter para suavização de alta qualidade.

**Características:**
- Reduz jitter mantendo responsividade
- Adaptativo baseado em velocidade de movimento
- Filtros separados para posição, rotação e escala
- Tratamento de wrap-around para ângulos

**Classes:**
- `LowPassFilter`: Filtro passa-baixa básico
- `OneEuroFilter`: Filtro principal com cutoff adaptativo
- `VectorFilter`: Wrapper para filtrar vetores 2D/3D

### 2. **WristTracker.js** - Sistema de Tracking Anatômico

**Landmarks Utilizados:**
- `wrist (0)`: Ponto base do pulso
- `index_mcp (5)`: Base do dedo indicador
- `middle_mcp (9)`: Base do dedo médio
- `pinky_mcp (17)`: Base do dedo mínimo

**Pipeline de Tracking:**

```
MediaPipe Landmarks
        ↓
Conversão para Coordenadas de Tela
        ↓
Cálculo de Confidence Score
        ↓
Geometria Anatômica do Pulso
        ↓
One Euro Filter (Smoothing)
        ↓
Verificação de Estabilidade
        ↓
Pose Final
```

**Confidence Scoring:**
- Visibilidade dos landmarks
- Geometria da mão (proporções)
- Distância pulso-palma
- Variação de profundidade Z

**Persistência Temporal:**
- Mantém última pose válida por até 30 frames (~1s)
- Evita desaparecimento instantâneo
- Interpolação suave durante perda temporária

**Estabilização:**
- Requer 8 frames estáveis antes de renderizar
- Previne jitter inicial
- Tracking cinematográfico suave

### 3. **RenderPipeline.js** - Pipeline de Renderização Otimizado

**Separação de Responsabilidades:**
- Tracking (WristTracker) → Cálculo de pose
- Pipeline (RenderPipeline) → Renderização
- React → UI e estado

**Otimizações:**
- requestAnimationFrame gerenciado fora do React
- Interpolação adicional entre frames
- Callbacks otimizados para evitar re-renders
- Tracking de FPS

**Fluxo:**
```
MediaPipe (30fps)
        ↓
WristTracker.update()
        ↓
RenderPipeline.updatePose()
        ↓
requestAnimationFrame (60fps)
        ↓
Interpolação Suave
        ↓
React setState (throttled)
```

## 🎨 Cálculo Geométrico

### Posição do Relógio
```javascript
// 1. Centro da palma
palmCenter = (index_mcp + pinky_mcp) / 2

// 2. Vetor anatômico do antebraço
forearmVector = palmCenter - wrist

// 3. Posição do relógio (18% antes do pulso)
watchPosition = wrist - (forearmVector * 0.18)
```

### Tamanho do Relógio
```javascript
// Proporcional à largura da palma
palmWidth = distance(index_mcp, pinky_mcp)
watchSize = palmWidth * 1.5
```

### Rotação do Relógio
```javascript
// Alinhado com o eixo do antebraço
rotation = atan2(forearmVector.y, forearmVector.x) - 90°
```

## ⚙️ Configuração

### WristTracker Config
```javascript
{
  // Confidence
  minConfidence: 0.6,           // Threshold mínimo
  minStabilityFrames: 8,        // Frames para estabilizar
  maxLostFrames: 30,            // Persistência temporal
  
  // One Euro Filter - Posição
  positionMinCutoff: 1.2,       // Cutoff mínimo
  positionBeta: 0.3,            // Responsividade
  
  // One Euro Filter - Rotação
  rotationMinCutoff: 1.0,
  rotationBeta: 0.5,
  
  // One Euro Filter - Escala
  scaleMinCutoff: 0.8,
  scaleBeta: 0.1,
  
  // Geometria
  watchSizeMultiplier: 1.5,     // Tamanho relativo
  watchOffsetRatio: 0.18,       // Offset do pulso
}
```

## 📊 Estados do Tracking

### 1. **INATIVO**
- Nenhuma mão detectada
- Confidence < threshold
- UI: "APONTE PARA O SEU PULSO"

### 2. **ESTABILIZANDO**
- Mão detectada
- Confidence OK
- Frames estáveis < minStabilityFrames
- UI: "ESTABILIZANDO..."
- Relógio: opacity 0 (invisível)

### 3. **ESTÁVEL**
- Tracking ativo e estável
- Frames estáveis >= minStabilityFrames
- UI: "TRACKING ESTÁVEL"
- Relógio: opacity 1 (visível)

### 4. **PERSISTÊNCIA**
- Tracking perdido temporariamente
- Usando última pose válida
- lostFrames <= maxLostFrames
- Relógio: mantém visível

## 🚀 Melhorias Implementadas

### ✅ Eliminado
- ❌ Lerp simples inadequado
- ❌ Offsets visuais aleatórios
- ❌ Desaparecimento instantâneo
- ❌ Jitter excessivo
- ❌ Re-renders React desnecessários
- ❌ requestAnimationFrame mal gerenciado
- ❌ Landmarks incorretos

### ✅ Implementado
- ✓ One Euro Filter profissional
- ✓ Landmarks anatômicos corretos (wrist + index_mcp + pinky_mcp)
- ✓ Vetor anatômico do antebraço
- ✓ Rotação real baseada em geometria
- ✓ Confidence scoring robusto
- ✓ Persistência temporal (30 frames)
- ✓ Estabilização inicial (8 frames)
- ✓ Pipeline de renderização separado
- ✓ Interpolação suave multi-camada
- ✓ Transições CSS suaves
- ✓ Tracking de FPS
- ✓ Debug profissional

## 🎬 Resultado

**Tracking cinematográfico estilo provador premium de relógios AR:**
- Zero jitter
- Movimentos fluidos e naturais
- Nunca desaparece instantaneamente
- Estabilização inteligente
- Performance otimizada (60fps)
- Confidence visual em tempo real

## 📱 Uso

```javascript
// Inicializar tracker
const tracker = new WristTracker(config);

// Processar frame do MediaPipe
const pose = tracker.update(landmarks, handedness, videoRect, mirrorX);

// Verificar se deve renderizar
if (tracker.shouldRender()) {
  // Renderizar relógio na pose
}

// Obter estado
const state = tracker.getState();
// { isTracking, isStable, confidence, stableFrames, lostFrames, totalFrames }
```

## 🔧 Debugging

O painel de debug mostra:
- Status do sistema
- FPS em tempo real
- Frames processados
- Estado do tracking (ATIVO/INATIVO)
- Estabilidade (SIM/aguardando)
- Confidence score (0-100%)
- Frames perdidos
- Tecnologia: "One Euro Filter + Persistência Temporal"

## 📚 Referências

- [One Euro Filter Paper](http://cristal.univ-lille.fr/~casiez/1euro/)
- [MediaPipe Hands](https://google.github.io/mediapipe/solutions/hands.html)
- [Hand Landmarks](https://google.github.io/mediapipe/solutions/hands.html#hand-landmark-model)

---

**Desenvolvido com foco em qualidade cinematográfica e experiência premium.**

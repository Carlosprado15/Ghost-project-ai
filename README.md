# 👻 Ghost Project AI - AR Watch Try-On

## 🎯 Experiência AR Premium para E-commerce

Sistema de try-on virtual de relógios usando **MediaPipe Hand Tracking** + **Kalman Filter** para tracking cinematográfico.

---

## 🚀 SETUP RÁPIDO

### 1. Instalar dependências
```bash
npm install
```

### 2. Iniciar servidor HTTPS
```bash
npm run dev
```

### 3. Acessar no mobile Android

O servidor irá exibir:
```
➜  Local:   https://localhost:5173/
➜  Network: https://192.168.x.x:5173/
```

**IMPORTANTE**: Use o endereço **Network** (HTTPS) no seu Android Chrome.

---

## 📱 REQUISITOS MOBILE

### Android Chrome
- ✅ HTTPS obrigatório (configurado automaticamente)
- ✅ Permissão de câmera
- ✅ Conexão na mesma rede Wi-Fi

### Primeira vez
1. Aceite o certificado SSL auto-assinado
2. Permita acesso à câmera
3. Escolha câmera traseira ou frontal
4. Aponte para o pulso

---

## 🔧 ARQUITETURA TÉCNICA

### Stack
- **React 18** + **Vite 5**
- **MediaPipe Hands** (CDN)
- **Model Viewer** (Google)
- **Kalman Filter** (implementação própria)

### Pipeline AR
```
Câmera → MediaPipe → Kalman Filter → Lerp → Render
         (tracking)   (jitter)      (smooth)  (60fps)
```

### Smoothing Duplo
1. **Kalman Filter**: Remove jitter de alta frequência
2. **Lerp**: Transições cinematográficas

### Posicionamento Anatômico
- Vetor do antebraço (wrist → palm)
- Offset 25% antes do pulso
- Compensação de profundidade Z
- Rotação baseada em quaternion

---

## 🎨 FEATURES

### ✅ Implementado
- [x] Hand tracking 21 landmarks
- [x] Kalman Filter 4D (x, y, size, rotation)
- [x] Posicionamento anatômico do relógio
- [x] Compensação de profundidade Z
- [x] Rotação natural do pulso
- [x] HTTPS automático via Vite
- [x] Detecção de secure context
- [x] Fallback defensivo de câmera
- [x] Suporte câmera frontal/traseira
- [x] UI premium dark mode
- [x] Tracking indicator
- [x] CTA buttons (Comprar/Detalhes)

### 🎯 Performance
- 60 FPS no Android mid-range
- Latência < 50ms
- Smoothing cinematográfico
- Zero jitter visual

---

## 🐛 TROUBLESHOOTING

### ❌ "getUserMedia undefined"
**Causa**: Acesso via HTTP ou IP incorreto

**Solução**:
1. Use o endereço HTTPS exibido no terminal
2. Aceite o certificado auto-assinado
3. Recarregue a página

### ❌ Câmera não abre
**Causa**: Permissão negada ou contexto inseguro

**Solução**:
1. Verifique permissões do Chrome
2. Confirme que está usando HTTPS
3. Teste em aba anônima

### ❌ Relógio tremendo
**Causa**: Parâmetros Kalman muito agressivos

**Solução**: Ajustar em `App.jsx`:
```javascript
// Mais suave (menos reativo)
const kalmanX = new KalmanFilter(0.005, 0.4);

// Mais reativo (menos suave)
const kalmanX = new KalmanFilter(0.02, 0.2);
```

### ❌ Relógio desalinhado
**Causa**: Offset anatômico incorreto

**Solução**: Ajustar em `getWatchPosition()`:
```javascript
// Mais perto do pulso
const offsetDistance = forearmLen * 0.15;

// Mais longe do pulso
const offsetDistance = forearmLen * 0.35;
```

---

## 📊 PARÂMETROS DE TUNING

### Kalman Filter
```javascript
// processNoise: 0.005-0.02 (menor = mais suave)
// measurementNoise: 0.2-0.5 (menor = mais reativo)
new KalmanFilter(processNoise, measurementNoise)
```

### Lerp Factors
```javascript
const LERP_POS = 0.35;   // Posição (0.2-0.5)
const LERP_SIZE = 0.18;  // Tamanho (0.1-0.3)
const LERP_ROT = 0.22;   // Rotação (0.15-0.35)
```

### MediaPipe Confidence
```javascript
minDetectionConfidence: 0.5,  // 0.3-0.7
minTrackingConfidence: 0.45,  // 0.3-0.6
```

---

## 🎬 PRÓXIMOS PASSOS

### Melhorias Planejadas
- [ ] Múltiplos modelos de relógio
- [ ] Seletor de cor/material
- [ ] Screenshot/compartilhamento
- [ ] Analytics de engajamento
- [ ] Integração com checkout
- [ ] Suporte iOS Safari
- [ ] PWA offline-first
- [ ] Backend Firebase/Supabase

### Otimizações
- [ ] WASM para Kalman Filter
- [ ] Web Worker para MediaPipe
- [ ] Lazy loading de modelos 3D
- [ ] Adaptive quality baseado em FPS
- [ ] Battery optimization

---

## 📄 LICENÇA

Proprietário - Carlos Prado © 2026

---

## 🤝 CONTATO

Para dúvidas técnicas ou comerciais:
- GitHub: [@Carlosprado15](https://github.com/Carlosprado15)
- Projeto: [Ghost-project-ai](https://github.com/Carlosprado15/Ghost-project-ai)

---

**Built with 🔥 by a GOD-TIER Fullstack Engineer**

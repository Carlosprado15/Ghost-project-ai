# M068D — DeepAR Wrist/Watch Access

## Estado Validado

| Item | Status |
|---|---|
| DeepAR SDK carrega no Ghost via `?lab=deepar` | ✅ |
| License key local funciona | ✅ |
| Câmera abre | ✅ |
| Efeito `aviators` renderizou no rosto | ✅ |
| App principal (`App_FINAL.jsx`, scanner, Shopify) preservado | ✅ |
| Wrist Investigation preparado no lab | ✅ |
| Efeito wrist/watch real | ⏳ aguardando |

---

## Demo Oficial Encontrada

```
https://try.deepar.ai/wrist/rolex
```

**DeepAR AR Watch & Wrist Jewelry Try-On** — confirmado pelo site oficial:
- watches, bangles, bracelets
- wrist mapping
- HTML5, iOS Safari, Android Chrome
- link "Try demo" aponta para a demo wrist/rolex
- link "Get Started" aponta para ShopAR

---

## Objetivo da Validação Manual

Testar a demo oficial em **Android Chrome** e, quando possível, **iPhone Safari**:

- [ ] Câmera abre
- [ ] Pulso é detectado
- [ ] Relógio aparece preso ao pulso
- [ ] Relógio acompanha rotação do pulso
- [ ] Não treme demais
- [ ] Não some com facilidade
- [ ] Funciona em iluminação comum
- [ ] Experiência parece boa para apresentação a investidor

---

## Resultado Esperado

**Se a demo oficial funcionar bem:**
- DeepAR continua como primeiro candidato de wrist-engine.
- Próximo passo: pedir acesso a efeito wrist/watch de teste ou ShopAR trial.
- Missão: M068E — enviar pedido de acesso e preparar integração.

**Se a demo oficial falhar:**
- Não avançar com DeepAR como única aposta.
- Acionar Perfect Corp e Banuba em paralelo.
- Missão: M068F — iniciar trilha alternativa.

---

## Template de Contato para DeepAR / ShopAR

**Assunto:**
```
Access request — Wrist/Watch Try-On test effect for Web SDK
```

**Mensagem:**

```
Hello DeepAR / ShopAR team,

I am building Ghost Project, a white-label AR commerce infrastructure
for Shopify/e-commerce. The first investor demo is focused on watch and
bracelet try-on, but the platform is designed for multiple categories
such as wrist, face, body, foot, room and 3D viewer products.

We already validated DeepAR Web SDK inside our React/Vite project
using a local Web license key and the official aviators effect.
The SDK loads correctly, camera works, and AR rendering works in
our isolated lab.

Now we need to evaluate the wrist/watch try-on capability shown
in your official demo:
  https://try.deepar.ai/wrist/rolex

Could you provide one of the following for technical validation?
  1. A sample wrist/watch .deepar effect URL or file for Web SDK testing;
  2. Access to a ShopAR trial for watches/wrist jewelry;
  3. Developer guidance for integrating wrist/watch try-on
     in a custom React/Vite/Shopify embedded flow.

Technical context:
  - React + Vite
  - Web mobile target (Android Chrome and iPhone Safari)
  - Shopify embedded / white-label commerce flow
  - Existing product GLB models (CW001 CASIO, etc.)
  - Need isolated proof of concept before production integration

The immediate goal is a non-production proof of concept
for an investor demo.

Thank you,
Carlos Prado
Ghost Project / Click & Wear
```

---

## Contexto Comercial

O Ghost Project não é só um sistema de relógios. É infraestrutura de AR commerce para múltiplas categorias. A Click & Wear é a demonstração para investidores, mas a visão inclui:
- wrist: relógios, pulseiras, anéis
- face: óculos, brincos, maquiagem
- body: roupas, bolsas
- foot: tênis, sandálias
- room: móveis, decoração

Se a conversa com DeepAR/ShopAR avançar, mencionar que estamos avaliando **integração white-label como plataforma**, não apenas um cliente unitário.

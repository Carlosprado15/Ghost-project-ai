# Achados dos artigos de Woojin Cho (KAIST UVR Lab) — aplicabilidade ao motor AR do Ghost Project

Lidos na íntegra (PDF baixado e extraído, não só abstract) em 2026-08-25.
Ambos os artigos são reais, confirmados via KAIST Pure/OpenReview/IEEE Xplore
e a página pessoal do autor (https://uvr-wjcho.github.io/).

1. **Cho, W., Ha, T., Jeon, I., Jeon, J., Kim, T.-K., Woo, W.** "Temporally
   enhanced graph convolutional network for hand tracking from an egocentric
   camera." *Virtual Reality* 28(3), 143 (2024).
   DOI: 10.1007/s10055-024-01039-3. Doravante **TE-GCN**.
2. **Cho, W., Ha, T., Son, T., Woo, W.** "A Unified Hand and Gesture Tracking
   via Offloading Framework for Object-mediated Interaction in Wearable AR."
   IEEE VR 2026 (preprint). Doravante **Unified-HO**.

## Aviso estrutural antes de qualquer coisa: os dois artigos resolvem um problema que o Ghost Project não tem

Os dois papers assumem uma arquitetura de **offloading**: o HMD (HoloLens 2)
captura a imagem, manda pela rede (WebSocket/TCP) para um servidor com GPU
dedicada (RTX 4090 nos dois artigos), o servidor roda uma rede neural própria
e devolve só o resultado. Isso existe porque o HoloLens 2 não tem poder de
processamento embarcado suficiente para rodar os modelos deles.

**O Ghost Project é o oposto disso, de propósito**: é uma SPA estática, sem
backend (`vercel.json` só ajusta CORS/cache), rodando inteiramente no
navegador do celular do cliente via MediaPipe Tasks Vision, exatamente para
ser embutível em qualquer loja Shopify sem custo de servidor nem dependência
de rede. Adicionar um servidor de offloading contradiria esse objetivo
central (custo de infra, latência de rede, ponto único de falha). **Nenhuma
técnica de offloading dos dois artigos é recomendada para adoção aqui.**

O que É aproveitável são os princípios de **como tratar o sinal ao longo do
tempo** — isso independe de onde a inferência roda.

## 1. Suavização temporal — o conceito do Pose-Attention Encoder (TE-GCN, seção 3.2.2)

**O que o TE-GCN faz:** em vez de assumir um modelo de movimento fixo
(velocidade constante, posição constante — o que a maioria dos métodos
anteriores fazia), o TE-GCN treina um módulo (Pose-Attention Encoder) que
**decide dinamicamente, quadro a quadro, o quanto confiar na predição do
frame anterior vs. na imagem atual**. Quando a mão se move devagar, confia
mais no frame anterior (mais estável); quando a mão muda rápido — inclusive
por causa do usuário mexer a cabeça com o HMD, mudando a mão de posição na
imagem sem a mão ter se movido de verdade — o peso desloca pra imagem atual.

Resultado quantificado (Tabela 6 do TE-GCN, métrica MKA — Mean Keypoint
Acceleration, quanto menor melhor): sem nenhum mecanismo de robustez pra
frame anterior não-confiável, MKA = 9.692. Com o mix ideal (20% frame
idêntico ao anterior / 65% frame anterior com ruído / 15% sem frame anterior
disponível), MKA = 5.271 — quase metade do jitter.

**Aplicabilidade real ao nosso motor:** não dá pra copiar o módulo (é uma
rede neural treinada; nós usamos o `HandLandmarker` do MediaPipe pronto, não
treinamos nada). Mas o **princípio** de "o peso de suavização não deveria ser
uma constante fixa — deveria variar com uma medida de confiança do frame
atual" é diretamente portável para `src/engine/core/filters/` (One-Euro
filters hoje, conforme `CLAUDE.md`). O MediaPipe HandLandmarker já expõe
score de confiança por detecção (handedness score) e por landmark
(`visibility`/`presence` quando disponível) — hoje aparentemente não usado
como entrada do filtro. Ideia concreta: usar esse score como o "peso de
atenção" — baixa confiança → filtro pesa mais a pose anterior/prevista; alta
confiança → filtro confia mais na leitura nova. Isso é o mesmo espírito do
Pose-Attention Encoder, sem precisar treinar nada.

## 2. Tratamento de perda de tracking

### TE-GCN — Retroactive Data Generator (seção 3.2.1)
Treinam o modelo explicitamente com três cenários de "frame anterior":
idêntico ao atual, com ruído, e **zero (nenhum frame anterior disponível)**
— este último simula exatamente reinicialização após perda de tracking. A
lição, mesmo sem poder replicar o treino: **o caso "não tenho pose anterior
confiável" precisa ser um caminho de código deliberado e testado, não um
efeito colateral**. Vale conferir se `src/engine/core/pose/holdLastPose.js`
tem um limite de tempo explícito pra "segurar a última pose" antes de
desistir e resetar — segurar indefinidamente uma pose antiga tende a piorar
a experiência mais do que sumir e reaparecer.

### Unified-HO — redetecção periódica em vez de só extrapolar (seção 3.2)
Achado direto de engenharia, sem precisar de rede neural nenhuma: o método
clássico de "extrapolar a posição da mão a partir das duas poses anteriores"
(usado no próprio TE-GCN) **falhou em cobrir a mão de verdade durante
movimento rápido** nos testes do Unified-HO. A correção deles: centralizar a
região de busca na última pose rastreada (não extrapolar) **e rodar detecção
de imagem inteira periodicamente, em intervalos fixos**, como uma
reinicialização preventiva, em vez de só esperar o tracking falhar de vez.
Isso é diretamente relevante ao teste que estamos rodando agora (AR-005,
rotação ativa do pulso) — se o anchor "atrasar" ou "desgrudar" durante
rotação rápida, esse é exatamente o tipo de causa a verificar em
`src/engine/core/tracking/handTracker.js`/`wristAnchor.js`: o MediaPipe já
faz algo assim internamente, mas vale confirmar que o modo de execução usado
(`VIDEO`/`LIVE_STREAM`) não está deixando o tracking "derivar" sem
redetecção de referência.

### Unified-HO — filtro de decisão por frames consecutivos (seção 3.3, "Decision Logic")
Para reduzir falsos positivos, só aceitam uma classe de gesto se ela for
prevista em frames consecutivos por um número mínimo definido — picos
isolados de 1 frame são ignorados. Princípio de histerese simples, aplicável
a qualquer sinal binário instável do nosso motor (ex.: a flag `isTracking`
"piscando" entre true/false frame a frame, mencionada como problema real nas
capturas AR-001/AR-002 do `CURRENT_STATE.md` — antes de reportar
"perdeu tracking", exigir N frames seguidos negativos evitaria alarme falso
por 1 frame ruim isolado).

## 3. Abordagens de performance/mobile

- **Priorizar precisão nos pontos visíveis, tolerar imprecisão nos ocluídos**
  (Unified-HO, Discussion): ao invés de tratar todos os 21 landmarks da mão
  com o mesmo peso, dar mais peso aos que o MediaPipe reporta como
  visíveis/confiantes. Aplicável na escolha de qual landmark usar como
  âncora do pulso quando múltiplos estão disponíveis.
- **Subconjunto de joints, não os 21** (Unified-HO, Fig. 4): usam só 15 dos
  21 joints pro reconhecimento de gesto, os mais relevantes pra tarefa —
  princípio geral de "não processe informação que não muda o resultado",
  aplicável se algum cálculo do nosso pipeline (ex. PCA de calibração)
  puder ser restrito aos vértices/pontos que realmente definem a métrica que
  importa.
- **Offloading, compressão de vídeo, protocolo WebSocket/TCP** — não
  aplicável, ver aviso estrutural acima.
- **Números de latência/FPS reportados** (~17-39ms de processamento server-side,
  ~58-128ms de latência total com rede) não são comparáveis ao nosso caso:
  medem rede + GPU dedicada, não inferência local no navegador do celular.
  Não usar como benchmark de referência para o Ghost Project.

## Resumo — o que vale a pena investigar/prototipar, em ordem de esforço

1. **(Barato)** Adotar a métrica MKA (aceleração média dos keypoints entre 3
   frames consecutivos) nas capturas do `ar-rescue` como medida objetiva de
   "tremido", em vez de só julgamento visual.
2. **(Médio)** Histerese de N-frames-consecutivos antes de declarar mudança
   de estado de tracking (`isTracking` e afins) — reduz falso alarme de
   1 frame ruim isolado.
3. **(Médio)** Usar o score de confiança que o MediaPipe já expõe como peso
   adaptativo de suavização em `core/filters/`, em vez de um coeficiente
   fixo — mesmo princípio do Pose-Attention Encoder, sem treinar nada.
4. **(Precisa investigar o handTracker atual primeiro)** Confirmar se o modo
   de execução do HandLandmarker já faz alguma forma de redetecção
   periódica, ou se o tracking pode "derivar" indefinidamente sob movimento
   rápido sem correção — achado central do Unified-HO.
5. **(Não fazer)** Qualquer arquitetura de servidor/offloading — incompatível
   com o modelo de produto (SDK embutível sem backend).

Nenhuma mudança de código foi feita a partir deste documento — é só o
levantamento pedido. Próximo passo, se aprovado, seria prototipar o item 1
ou 2 (os mais baratos) numa branch isolada, testado no aparelho de teste
atual antes de qualquer promoção.

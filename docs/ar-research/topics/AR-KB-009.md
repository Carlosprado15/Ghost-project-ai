ID: AR-KB-009
CAMADA: F / E / D
APLICABILIDADE:
  PULSO: direto — decide forma de aplicação de crossoverOffset em wristAnchor.js durante
    a transição lm5-lm17→lm1-lm17 (AR-KB-005/006/008). Dois sub-casos distintos abaixo.
  CORPO: mesmo princípio de bumpless transfer vale para qualquer troca de par de landmarks
    (ex.: ombro→cotovelo em rastreamento de anel); a janela de ramp no edge case pode ser
    maior porque hold em body tracking tende a ser >2 s e o reaparecimento é mais abrupto.
  AMBIENTE: não se aplica — SLAM/hit-test não usa pair-switch state; o princípio geral
    de continuidade de sinal em troca de modo vale, mas sem o conceito de crossoverOffset.

PERGUNTA:
  QR-053: crossoverOffset deve ser aplicado como step function (valor fixo enquanto
  degraded=true) ou interpolado → 0 nos primeiros N frames do fallback? Lag de
  interpolação perceptível em AR de pulso a 30 fps?

RESPOSTA EM 3 LINHAS:
  Step function é a arquitetura correta para o caso principal (transição primário→fallback
  em sessão contínua): crossoverOffset é o "bumpless transfer" do sistema — ele garante
  continuidade do ângulo no instante de troca e deve persistir constante enquanto
  degraded=true, porque o offset geométrico entre os pares não decai com o tempo.
  Decair o offset → 0 reintroduziria gradualmente o erro de ~90° que ele corrige.
  O único sub-caso que justifica rampa é a recovery-pós-hold-expirado, e nele a
  direção é 0 → valor medido (ramp-up), não valor → 0 (ramp-down) — 2-4 frames (AR-KB-007).

DETALHAMENTO TÉCNICO:

## Bumpless transfer — analogia de controle (por quê step function)

Em teoria de controle, "bumpless transfer" é a técnica de trocar entre modos sem
descontinuidade no sinal de saída. O algoritmo canônico:
  1. No instante t_switch: medir saída do modo anterior.
  2. Carregar essa saída como estado inicial do modo novo (bias/offset).
  3. A partir de t_switch+1: operar normalmente no novo modo.

crossoverOffset É essa operação: mede atan2(lm5-lm17) − atan2(lm1-lm17) no frame de
troca e soma ao ângulo do modo fallback a partir do frame seguinte. O resultado:
  ângulo_saída(t_switch) = atan2_fallback + crossoverOffset = atan2_primário (contínuo)

Manter o offset constante enquanto degraded=true é correto porque o offset corrige uma
diferença estrutural entre dois vetores de referência — essa diferença não desaparece
com o tempo, é propriedade da anatomia (AR-KB-005).

## Por que "interpolado → 0" é a direção errada no caso principal

"Interpolar o offset → 0" significaria: começar com correção plena e gradualmente
remover a correção. O ângulo bruto de lm1-lm17 (sem correção) difere do primário por
30-90° (AR-KB-005). Após N frames de ramp-down, o ângulo corrigido seria idêntico ao
ângulo não-corrigido — o erro original voltaria.

O raw lm1-lm17 não "converge" para lm5-lm17 com o tempo; são vetores anatomicamente
distintos, seu offset não decai sem uma nova referência. Ramp-down = erro crescente.

## Dois sub-casos e suas arquiteturas

Sub-caso A — transição em sessão contínua (tracking ativo → degraded=true):
  crossoverOffset medido no frame de troca → aplicado imediatamente como step function.
  Persiste constante enquanto degraded=true. Nenhuma rampa. Custo: 0 frames de erro.

Sub-caso B — recovery após hold expirado (AR-KB-008), primeira sessão em degraded=true:
  crossoverOffset=0 (reset correto). No 1º frame degraded, mede offset fresco.
  Opção: ramp-UP de 0 → offset_medido em 2-4 frames (não ramp-down).
  Resultado: error ~90° diminui gradualmente → aparece como "ajuste de tracking" em vez
  de snap (AR-KB-007: 2-4 frames é o range pragmático menos disruptivo).
  A rampa aqui mascara a descontinuidade no reaparecimento do modelo, não a causa.

## Perceptibilidade a 30 fps (referência AR-KB-007)

Step function no sub-caso A: zero frames de erro → sem artifact.
Ramp-up de 2-4 frames no sub-caso B: drift de ~22–45°/frame (para offset de 90°) →
percebido como "ajuste de tracking" e não como snap. Acima de 5 frames, o lag domina.

EVIDÊNCIA:
  - Cheong & Safonov, "Bumpless Transfer for Adaptive Switching Controls", IFAC 2008:
    "bumpless transfer é realizado garantindo que todos os estados recebam valores
    adequados nas transições" — ausência de bump exige initialização de estado, não rampa.
  - Åström & Hägglund, "Advanced PID Control" (ISA): PID tem bumpless transfer por
    pré-posicionamento de bias, não por ramp — confirma step como padrão canônico.
  - AR-KB-007: ramp de 2-4 frames converte snap em drift curto; >5 frames é pior.
  - AR-KB-008: recovery após hold expirado = nova sessão; crossoverOffset=0 é correto.
  - Geometria: atan2(lm1-lm17) − atan2(lm5-lm17) não tende a zero com o tempo — o offset
    é estrutural, não transitório (confirmado por análise anatômica em AR-KB-005).

FONTES:
  https://skoge.folk.ntnu.no/prost/proceedings/ifac2008/data/papers/2555.pdf
    [PAPER] Cheong & Safonov — Bumpless Transfer for Adaptive Switching Controls, IFAC 2008
  https://www.semanticscholar.org/paper/Bumpless-Transfer-for-Adaptive-Switching-Controls-Cheong-Safonov/09b3781dedcfbfb4f87f5d3129a76ec92faa0854
    [PAPER] Semantic Scholar entry — mesmo paper, confirmação de autoria e publicação
  https://www.mathworks.com/help/simulink/slref/bumpless-control-transfer.html
    [OFICIAL] MATLAB/Simulink — Bumpless Control Transfer (documentação oficial MathWorks)
  https://www.isa.org/getmedia/fb0e41bc-e4f3-422a-9f67-b9bd31340e16/Advanced-PID-Control_AstromHagglund_Chapter1-Introduction.pdf
    [PAPER] Åström & Hägglund, Advanced PID Control cap.1 — bumpless transfer por bias

APLICAÇÃO AO GHOST:
  src/engine/core/anchor/wristAnchor.js: NÃO adicionar lógica de decay ao crossoverOffset.
  Aplicar o offset imediatamente como step function e manter constante enquanto degraded.
  src/engine/core/GhostEngine.js: no sub-caso B (recovery em degraded após hold expirado),
  após medir crossoverOffset no 1º frame, aplicar ramp-up de 2-4 frames com constante
  N_RAMP (derivada de AR-KB-007). Implementação: f_ramp = min(frame_degraded/N_RAMP, 1.0)
  multiplicado pelo offset → suaviza o reaparecimento sem reintroduzir o erro.

VEREDITO:
  COMPROVADO: step function é a arquitetura correta para sub-caso A (bumpless transfer
    por state initialization, suportado por Cheong/Safonov IFAC 2008 e Åström/Hägglund).
  COMPROVADO: ramp-down (offset → 0) está arquiteturalmente errado para o caso principal
    (o offset geométrico entre pares é estrutural, não transitório — AR-KB-005).
  PROVAVEL: ramp-up (0 → offset) de 2-4 frames mascara o sub-caso B de forma aceitável
    (AR-KB-007 dá a janela pragmática mas sem dado específico para jóia/pulso).

CUSTO DE ADOÇÃO: BAIXO (sub-caso A: nenhuma mudança vs. implementação natural;
  sub-caso B: ~5 linhas adicionais em GhostEngine.js, constante N_RAMP exportável)

NOVAS PERGUNTAS GERADAS:
  QR-056 [P0][D][ABERTA] Na transição de RETORNO (fallback→primário, quando lm5 reaparece),
    o crossoverOffset precisa de compensação simétrica, ou o par primário já retorna ao
    ângulo correto sem correção adicional? Existe risco de jump no retorno?

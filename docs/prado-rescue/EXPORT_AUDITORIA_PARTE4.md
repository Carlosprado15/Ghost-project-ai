# EXPORT_AUDITORIA — Ghost Project AI — Motor AR — PARTE 4 de 4 (final)

> Continuação da PARTE 3. Cole por último. Esta parte contém o histórico de commits, o
> resumo dos testes reais em dispositivo físico, o conteúdo integral dos documentos de
> estado da investigação, e — mais importante — **as 10 perguntas que você deve responder**
> e a regra absoluta de conduta desta auditoria.

---

## 4. HISTÓRICO DE COMMITS relevantes ao motor AR

Extraído com `git log --oneline -- <pasta>`, do mais recente para o mais antigo.

### `src/engine/` (motor moderno)
```
dedf7b7 M069C-M070F: checkpoint completo — tracking, pipeline GLB e calibração dos 15 produtos
c27271c M069G: extração GhostEngine — motor AR modular em src/engine/
```

### `src/tracking/` (motor legado, em produção)
```
248efc6 Checkpoint: teste do Foxbox — video na tela inicial, reforco de Pose, material sem brilho espelhado
58beeb4 Corrige orientacao do relogio no pulso (bug -90 fixo no WristTracker) e comprime os GLBs do catalogo
5f1d27f Revert "feat: M058 — improve wrist tracking geometry and MediaPipe preload"
9962593 feat: M058 — improve wrist tracking geometry and MediaPipe preload
e83c0f6 feat: M057D — safe fitDebug forearm offset direction
2933739 feat: M057C — visual tracking debug overlay (fitDebug=1&showTrackingDebug=1)
d1b7da6 feat: M057A — safe wrist fit debug parameters
26b5799 feat: M024 — tracking imediato, tela 360°, experience embedded
04412ee fix: M022 — corrigir scanner preso em Recalibrando
ed403f5 Release Candidate RC1 - Investor Demo Ready
a1c00f8 feat: nova arquitetura de tracking com pitch/yaw e fix CSS modal B2B
ba0c0a1 MVP funcional AR tracking estabilizado
2350b20 Stable MVP checkpoint - wrist tracking functional
```

**Nota sobre `9962593`/`5f1d27f`:** um commit de melhoria de geometria de tracking
(`M058`) foi revertido logo em seguida — sinal de que pelo menos uma tentativa anterior de
melhorar a geometria do tracking não deu certo e foi desfeita. Nenhum detalhe do motivo do
revert está disponível fora da mensagem de commit em si (histórico de PR/issue não existe
neste repositório).

**Nota sobre `58beeb4`:** o commit mais recente que tocou `src/tracking/` corrigiu
`watchRotationOffset` de `-90` fixo (hardcoded) para `0` — a mensagem do commit indica que
o `-90` estava causando orientação incorreta ("deitado") do relógio no pulso, afetando
**todos os produtos**. Ver comentário correspondente no código (seção 3.1 da PARTE 3,
campo `watchRotationOffset` do `WristTracker`).

### `src/labs/tasks-wrist/` (harness que consome o motor moderno)
```
248efc6 Checkpoint: teste do Foxbox — video na tela inicial, reforco de Pose, material sem brilho espelhado
dedf7b7 M069C-M070F: checkpoint completo — tracking, pipeline GLB e calibração dos 15 produtos
c27271c M069G: extração GhostEngine — motor AR modular em src/engine/
db07061 M069B-F: lab tasks-wrist scaffolding, M069B fixes e auditoria AR Engine
```

### `src/tracking-engines/` (scaffold de avaliação de SDKs terceiros, sem implementação real)
```
4a89071 M068A: add isolated DeepAR lab
4b310aa M067C: add isolated tracking engine layer
```

### Versões de dependências relevantes (`package.json`)
```
"@mediapipe/tasks-vision": "^0.10.35"   (motor moderno — HandLandmarker, PoseLandmarker)
"three": "^0.184.0"
```
O motor legado (`src/tracking/`) usa `@mediapipe/hands` — não é dependência do
`package.json`; é uma cópia vendorizada localmente em `public/mediapipe/hands/hands.js`
(mais `camera_utils.js`, `drawing_utils.js`), sem versão pinada em lockfile (commit
`648c486`: "Hospeda o MediaPipe Hands localmente em vez de CDN externo").

---

## 5. RESULTADOS DOS TESTES REAIS já coletados

Aparelho de todos os testes: **Motorola razr 40** (Android 15, GPU Adreno), flip phone com
2 telas físicas — detalhe relevante porque exigiu correções específicas nos scripts de
captura (`--display-id` explícito), sem relação com o motor AR em si.

### AR-000 — `INFRA_CAPABILITY_CHECK` (não é teste do motor)
- **Status:** `INFRA_PASS` (não é PASS/FAIL do motor — é validação da infraestrutura de
  captura: device-check, git snapshot, screenshot, logcat, vídeo).
- **Achado técnico real (não hipótese):** `console.log()` de uma aba comum do Chrome Android
  **não chega ao logcat do sistema** — só tags nativas do processo Chromium (`chromium`)
  aparecem, nunca o conteúdo de `console.log` da página. Confirmado empiricamente com um
  marcador único injetado via servidor HTTP local + `adb reverse`. Consequência: nenhuma
  métrica do motor que hoje só existe como `console.log` (motor moderno, atrás de
  `debug=true`) é observável via logcat — só via leitura visual do HUD desenhado na tela,
  quadro a quadro, num vídeo gravado.
- Fase 5 (teste funcional com câmera apontada pro pulso) **não foi executada** neste
  registro — ficou para AR-001.

### AR-001 — `AR-BASELINE-10S` (primeira tentativa)
- **Status:** `FAIL` no sinal `isTracking` — 9/9 amostras verificadas mostraram "não
  detectado", mesmo com pulso real visivelmente em quadro.
- **Ressalva metodológica grave:** a captura caiu com o modo errado selecionado (①
  "Testar GLB no centro", não ③ "GLB no pulso") — descoberto DEPOIS, por análise de vídeo.
  Nesse modo o GLB não é ancorado ao pulso por design; o resultado não serve para avaliar
  jitter/estabilidade do anchor, só o sinal `isTracking` (que é independente do modo).
- FPS não observável — HUD coberto pelo painel de calibração.
- **Erro de OIS da câmera:** 204 ocorrências de `CSLHwInternalDefaultIoctl() Ioctl failed
  for device /dev/v4l-subdev17 (Type:CSLHwOIS...) Connection timed out` no logcat nativo,
  cobrindo quase toda a janela de ~12s. Correlacionado no tempo com `isTracking=false`, mas
  **sem relação de causa comprovada** — só uma hipótese concreta a investigar.
- Hipótese externa de "loop de tracking travado" (relatada pelo coordenador via 2
  screenshots fora da janela de captura do AR-001) — analisada por diff de pixel real no
  próprio vídeo do AR-001: o feed de câmera mudou 57-91% dos pixels dentro da janela
  capturada (não estava congelado nessa janela específica). **Não confirmada nem
  descartada** — a janela do AR-001 não cobre o momento em que a discrepância foi relatada.

### AR-002 — `AR-BASELINE-10S` (repetição corrigida)
- **Status:** `FAIL` no sinal `isTracking` — 12/12 amostras, 0 mostraram tracking ativo.
- **Correção em relação ao AR-001:** modo confirmado CORRETO desta vez (③ "GLB no pulso"),
  verificado por screenshot antes de gravar.
- **Ressalva metodológica desta captura:** na maior parte das 12 amostras, a câmera
  mostrava tapete/joelho, **não** uma mão/pulso reconhecível — explicação alternativa
  plausível para o FAIL, que não implica necessariamente defeito do motor.
- **Achado estrutural confirmado (não hipótese):** o painel de calibração é permanente no
  código desta versão do lab (sem botão de fechar), e a soma das larguras dos dois painéis
  (240px + 262px = 502px) excede a largura de tela em retrato (~411px) neste aparelho — por
  isso o HUD de fps/scale/rotZ fica coberto **por design de layout**, não por acidente
  pontual. Não resolvível por interação de UI; exigiria mudança de código.
- **Erro de OIS reproduzido pela 2ª vez:** 206 ocorrências, mesma janela de ~12s, agora em
  modo diferente do lab — reforça hipótese de condição persistente do hardware/driver deste
  aparelho específico.

### AR-003 — `AR-BASELINE-10S` (terceira captura, primeira condição limpa)
- **Status:** `PASS` no sinal `isTracking` — 18/18 amostras verificadas (de 24 disponíveis,
  ~75% da janela de 11.97s) mostraram tracking ativo e o GLB visivelmente ancorado sobre o
  pulso real, inclusive durante um pequeno reposicionamento do pulso perto de t≈9.5s. Zero
  amostras com pill vermelho, inversão do modelo, ou "salto" perceptível entre quadros.
- **O que mudou em relação ao AR-002:** modo confirmado correto (③) **e** enquadramento
  confirmado por screenshot ANTES de gravar (mão/pulso real com dedos visíveis, ocupando a
  maior parte do quadro) — corrigindo o problema do AR-002 (câmera apontada pro chão/joelho).
- **Escopo explícito do PASS (não generalizar além disso):** cobre detecção de mão/pulso +
  ancoragem visual do GLB, sob pulso **majoritariamente parado** com um movimento pequeno.
  NÃO testa (e portanto não é evidência de PASS nem FAIL para): FPS do motor sob carga,
  comportamento sob rotação rápida do pulso, comportamento sob perda e reaquisição de
  tracking, nem a hipótese mais ampla de instabilidade citada no histórico do projeto — essa
  hipótese **continua sem teste direto até agora**.
- Relato do operador de que o relógio "dançou"/apareceu de cabeça para baixo em algum
  momento anterior: **NÃO corroborado** nesta captura específica (amostragem a 2fps pode não
  capturar um evento breve de alta frequência; o relato original pode ser de outro
  momento/sessão) — tratado como observação do operador, não como fato medido.
- **Erro de OIS reproduzido pela 3ª vez consecutiva:** 206 ocorrências, mesma janela de
  ~12s, agora com conteúdo de câmera diferente (mão real, não chão/joelho) — reforça ainda
  mais a hipótese de condição persistente do hardware/driver deste aparelho específico, mas
  **não afetou o resultado de tracking desta vez** (isTracking permaneceu true durante toda
  a janela, apesar do erro de OIS ocorrer em paralelo).
- FPS continua NÃO OBSERVÁVEL (mesma limitação estrutural do HUD coberto).
- **Decisão registrada:** promover a conclusão limitada de que o motor de tracking
  (GhostEngine, `@mediapipe/tasks-vision`) detecta e ancora corretamente um pulso/mão real
  quando o modo do lab está certo e a mão está em quadro, neste aparelho, **sob movimento
  mínimo**. Não promover nenhuma conclusão sobre fps/estabilidade sob movimento rápido
  (continua NÃO OBSERVÁVEL). Próxima investigação recomendada: repetir com movimento mais
  ativo/rotação do pulso, e resolver a sobreposição estrutural do HUD para observar fps
  diretamente.

### Padrão consolidado do erro de OIS da câmera (3 capturas)
| Captura | Ocorrências | Modo do lab | Conteúdo da câmera | Afetou isTracking? |
|---|---|---|---|---|
| AR-001 | 204 | ① center | pulso em quadro | correlação temporal, causa não comprovada |
| AR-002 | 206 | ③ wrist | chão/joelho | N/A (mão não estava em quadro) |
| AR-003 | 206 | ③ wrist | pulso real em quadro | **não** (isTracking permaneceu true) |

Mensagem de erro (idêntica nas 3 capturas): `CSLHwInternalDefaultIoctl() Ioctl failed for
device /dev/v4l-subdev17 (Type:CSLHwOIS...) Connection timed out; OIS[0]: failed to submit
packet; Failed to read lens position data`. Fonte: logcat nativo do sistema, tag `CamX`
(HAL de câmera do Android), não do motor AR/JavaScript.

**Regra de compatibilidade universal em vigor** (adicionada ao protocolo após o AR-002):
qualquer causa raiz identificada — incluindo este erro de OIS — deve ser tratada como
hipótese específica deste Motorola razr 40 de teste até validação cruzada em pelo menos um
segundo Android. Nenhuma correção proposta até agora foi ou deve ser um workaround
específico de hardware de um único aparelho.

---

## 6. CONTEÚDO de BASELINE.md e CURRENT_STATE.md

### 6.1 `docs/prado-rescue/BASELINE.md` (conteúdo integral)

```markdown
# BASELINE — PRADO GHOST RESCUE / AR LAB v1

Registro criado por: subagente `ar-rescue`
Execução: FASE 1 (Baseline) do protocolo permanente.

---

## 1. Estado do repositório no momento desta execução

- **Data/hora local:** 2026-08-16
- **Branch atual:** `ghost-engine-v1`
- **Commit atual (HEAD):** `248efc6` — "Checkpoint: teste do Foxbox — video na tela inicial, reforco de Pose, material sem brilho espelhado"
- **Situação em relação ao remoto:** branch local está 6 commits à frente de `origin/ghost-engine-v1` (não sincronizado, não é problema — só registro).
- **`git status` no momento da leitura:**
  - Modificados (não staged): `.claude/settings.json`, `CLAUDE.md`, `scripts/normalize-glb/VALIDATION_REPORT.md`
  - Não rastreados: `.claude/agents/ar-rescue.md`, `docs/GHOST_BUSINESS_MASTER_PLAN.md`, `public/deepar-wrist-test.html`, `public/effects/`
  - Nenhuma dessas alterações foi tocada, criada ou revertida por esta execução do AR LAB. Ficam como estavam.
- **Nenhum `git reset`, `checkout` destrutivo, ou criação de branch/tag foi feito.** Não foi necessário criar snapshot adicional porque nada foi alterado no motor.

## 2. Existia investigação AR LAB anterior?

**NÃO.** `docs/prado-rescue/CURRENT_STATE.md` não existia antes desta execução. Esta é, na
prática, a primeira execução real do protocolo AR LAB v1 (registro AR-000 será o primeiro,
quando a Fase 3 for autorizada).

## 4. Como acessar o motor AR (loja real vs. labs)

Roteamento em `src/main.tsx`, via query param `?lab=`:

| URL (`?lab=`) | Componente | Motor de tracking usado |
|---|---|---|
| (nenhum — rota padrão) | `App_FINAL.jsx` (loja real) | `src/tracking/` — legado, `@mediapipe/hands` via CDN/script global (`window.Hands`) |
| `tasks-wrist` | `TasksWristLab.jsx` | `src/engine/` (GhostEngine) — moderno, `@mediapipe/tasks-vision` (HandLandmarker) |
| `replay` | `ReplayLab.jsx` | replay de captura |
| `webarrocks` | `WebARRocksLab.jsx` | avaliação de SDK terceiro (WebAR.rocks) |
| `deepar` | `DeepARLab.jsx` | avaliação de SDK terceiro (DeepAR) |
| `validate-glb` | `GLBValidationLab.jsx` | validação geométrica de GLB, sem câmera |
| `calibrate-product` | `ProductCalibrationLab.jsx` | calibração manual de rotação/escala de produto |
| `material-ab` | `MaterialABLab.jsx` | teste A/B de material |

## 5. Estado atual conhecido do motor AR (por inspeção de documentação existente — não testado nesta execução)

- Existem duas implementações de tracking paralelas, não uma migração completa:
  - `src/tracking/` — em produção agora, usada por `App_FINAL.jsx`. API legada `@mediapipe/hands`.
  - `src/engine/` (GhostEngine) — reescrita moderna, `@mediapipe/tasks-vision` (HandLandmarker),
    One Euro Filter, hold-last-pose 1500ms, âncora em landmark 0 + 18% do antebraço. Só consumida
    pelo lab `?lab=tasks-wrist`. `App_FINAL.jsx` NÃO usa `src/engine/`.
  - Migrar a loja real para o motor novo ainda não aconteceu — trabalho futuro registrado.
- **Hipótese em aberto, ainda não confirmada por evidência no repositório (no momento desta
  escrita):** reprovação em teste de estabilidade (FPS/rotação) no motor moderno, possivelmente
  ligada a incompatibilidade WebGL vs. GPU Adreno do Motorola Razr 40. Nenhum relatório/log no
  repositório documentava esse teste especificamente até este ponto — tratada como hipótese em
  aberto, não como fato confirmado.

## 6. Problemas conhecidos (por documentação existente, não re-testados agora)

- Duas implementações de `OneEuroFilter` divergentes (loja vs. engine) — risco de re-trabalho
  se um dia forem unificadas sem cuidado.
- Sistema de calibração automática (`?auto=1`) do lab não está conectado à loja real —
  parâmetros achados lá não retroalimentam `WristTracker.js` automaticamente.

## 7. Funcionalidades que NÃO podem quebrar (regra suprema do projeto: nunca retroceder)

- `App_FINAL.jsx` (loja real) e tudo que ela consome de `src/tracking/` — comportamento
  funcional em produção hoje.
- `public/gsdk.js` (SDK embutido nas lojas parceiras) — nunca editar `dist/gsdk.js`.
- `public/models/` (GLBs originais) e `public/models/normalized/` (pipeline calibrado).
- `src/data/products.json` — roteamento produto → GLB.

---

Nenhum arquivo do motor AR foi modificado nesta execução. Esta é uma fase de leitura e
registro apenas, mais a criação da infraestrutura da Fase 2 (scripts USB/ADB), que é nova e
não sobrescreve nada existente.
```

*(Seções 3 e 8 do documento original — comandos de inicialização do projeto e lista de
ferramentas de diagnóstico preservadas — omitidas aqui por não serem relevantes ao
diagnóstico do motor em si; texto integral disponível em `docs/prado-rescue/BASELINE.md` no
repositório.)*

### 6.2 `docs/prado-rescue/CURRENT_STATE.md` (conteúdo integral, na data desta exportação)

```markdown
# CURRENT_STATE — PRADO GHOST RESCUE / AR LAB v1

Última atualização: 2026-08-16, após execução das Fases 1-4 e duas capturas da Fase 5 (AR-001, AR-002).
**Ler este arquivo antes de qualquer nova investigação — não repetir o que já foi feito aqui.**

## REGRA PERMANENTE ADICIONADA NESTA SESSÃO (ler antes de qualquer recomendação futura)

O `.claude/agents/ar-rescue.md` ganhou a seção "REQUISITO DE COMPATIBILIDADE UNIVERSAL":
qualquer causa raiz identificada (ex: erro de OIS da câmera, ver abaixo) deve ser tratada
como hipótese específica do Motorola Razr 40 de teste até validação cruzada em pelo menos
um segundo Android. Nenhuma correção futura (Fase 6) pode ser um workaround específico de
hardware de um único aparelho. Sem um segundo dispositivo disponível, isso deve continuar
registrado como limitação conhecida.

## Estado atual

- Infraestrutura (Fase 1-2) construída e validada (Motorola razr 40, Android 15, GPU Adreno,
  serial `ZY22HDF7WJ`).
- Evidence Pack (Fase 3) e métricas (Fase 4) concluídos — ver `AR-000`.
- Fase 5 tem duas capturas reais registradas neste arquivo no momento em que foi escrito:
  `AR-001` e `AR-002`, ambas FAIL no sinal `isTracking`, ambas com ressalvas metodológicas
  sérias que impediam tratar isso como conclusão definitiva sobre o motor. Nenhuma delas
  conseguiu um teste "limpo" (modo certo + HUD legível + mão claramente enquadrada durante
  toda a janela).
- Fases 6, 7, 8 não haviam começado até este ponto — nenhuma correção foi tentada, nenhum
  código do motor AR foi alterado em nenhuma fase até aqui.

## Achado técnico real confirmado (Fase 4, não é hipótese)

`console.log()` de página web numa aba comum do Chrome Android não chega ao logcat do
sistema (confirmado empiricamente). Via leitura quadro-a-quadro do HUD visível na tela é a
que funciona, mas nas capturas da Fase 5 o HUD completo (fps/scale/rotZ) ficou
estruturalmente coberto por um painel de calibração permanente no código atual do lab.

## O que continua desconhecido (NÃO OBSERVÁVEL até o momento em que este arquivo foi escrito)

- FPS real de qualquer um dos dois motores em uso ao vivo — estruturalmente coberto pelo
  painel de calibração. Só seria observável rodando fora do modo autoPhase com uma mudança
  de código (fora de escopo) OU girando o aparelho para paisagem (não tentado até então).
- Se o erro de OIS é causa, coincidência, ou condição crônica do aparelho independente do
  site — precisa de teste comparativo fora do navegador (app de câmera nativo).
- Se o "congelamento do loop de tracking" relatado pelo coordenador no AR-001 é real —
  ainda não confirmado nem descartado até este ponto.
- Comportamento de jitter/estabilidade real do anchor no pulso quando uma mão de fato está
  em quadro — nenhuma das duas capturas registradas neste arquivo (AR-001, AR-002) havia
  conseguido isolar isso ainda.

## Próxima investigação recomendada (registrada neste arquivo)

1. AR-003: repetir com atenção específica ao ENQUADRAMENTO — garantir que a mão/pulso com
   dedos visíveis esteja de fato dentro do campo de visão da câmera durante toda a janela de
   gravação, além do modo certo.
2. Testar o erro de OIS fora do navegador (app de câmera nativo do Android) para isolar se é
   específico do uso via WebRTC/Chrome ou uma condição mais ampla do aparelho.
3. Repetir o mesmo tipo de teste na loja real (`?fitDebug=1&showTrackingDebug=1`) para
   comparar com o motor em produção hoje.

## Registros de evidência existentes (no momento em que este arquivo foi escrito)

| ID | Tipo | Resumo |
|---|---|---|
| `AR-000` | Infra capability check (Fase 3+4) | Evidence Pack validado + descoberta de métricas; nenhum teste funcional do motor AR |
| `AR-001` | AR-BASELINE-10S (Fase 5) | FAIL isTracking; modo errado selecionado; HUD coberto; erro OIS 204x; hipótese de loop travado não confirmada nem descartada |
| `AR-002` | AR-BASELINE-10S (Fase 5, repetição) | FAIL isTracking; modo CORRETO desta vez; HUD continua coberto (limitação estrutural do código, não resolvível por UI); câmera majoritariamente sem mão em quadro; erro OIS reproduzido 206x |
```

> **Aviso desta compilação:** este arquivo (`CURRENT_STATE.md`) **ainda não foi atualizado**
> com o resultado do AR-003 (PASS, seção 5 acima) no repositório no momento desta
> exportação — ele reflete o estado logo após o AR-002. O registro completo e mais atual do
> AR-003 está diretamente em `docs/prado-rescue/evidence/AR-003/` (`result.json`,
> `README.md`), cujo conteúdo já foi resumido na Seção 5 deste documento. Trate a Seção 5
> deste export como mais atual que este `CURRENT_STATE.md` no que se refere ao AR-003.

---

## 7. AS 10 PERGUNTAS

Responda cada uma com evidência específica — **arquivo + função/variável + trecho de código
ou dado de teste**. Não é permitido responder em termos gerais sem apontar exatamente onde
no código (PARTES 1-3) ou em qual teste (Seção 5 desta parte) está a evidência.

1. Qual é exatamente o gargalo de estabilidade identificado até agora?
2. É o MediaPipe Hands em si (modelo/configuração)?
3. É a forma como o código calcula o eixo de rotação?
4. É o hold-last-pose?
5. É o smoothing (filtro, janela, parâmetros)?
6. É a transformação de coordenadas 2D → 3D?
7. É o renderizador (`model-viewer` ou equivalente)?
8. Existem referências de coordenadas incompatíveis sendo misturadas (ex: normalized vs.
   pixel, CSS container vs. canvas)?
9. O motor mais novo (`ghost-engine-v1`, `src/engine/`) é estruturalmente melhor que
   tentativas anteriores, ou repete os mesmos problemas?
10. Existe correção possível dentro da arquitetura atual, ou o tracker precisa ser trocado?

---

## 8. REGRA ABSOLUTA para quem for analisar

> Não altere nada, não sugira consertar — apenas diagnostique com evidência: arquivo,
> função, linha. Se algo não puder ser determinado só com código/logs, responda "NÃO
> DETERMINÁVEL — requer teste físico adicional" em vez de especular.

---

*Fim da exportação (PARTE 4 de 4). Esta compilação não contém nenhuma análise, diagnóstico
ou correção — apenas a organização do código-fonte, histórico de commits e evidência de
testes já existentes no repositório, conforme solicitado.*

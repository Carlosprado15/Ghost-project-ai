# CURRENT_STATE — PRADO GHOST RESCUE / AR LAB v1

Última atualização: 2026-08-28 — AR-004-fisico executado de verdade, em 2 rodadas, no
aparelho de teste atual (Motorola Razr 40). Rodada 1: só métricas (CDP), rotZ/fps/isTracking
por ~150ms, sem vídeo. Rodada 2: métricas + vídeo de tela sincronizados, usados pra checar
visualmente 2 problemas novos relatados por Carlos ("tremendo muito" e "não acompanha no
vai-e-vem" e "de ponta cabeça" ao girar o pulso). Resultado abaixo — ver seção própria.
**Ler este arquivo antes de qualquer nova investigação — não repetir o que já foi feito aqui.**

## AR-004-fisico — Rodada 2 (2026-08-28) — vídeo + métricas sincronizados

**Objetivo:** confirmar visualmente (não só numericamente) se o relógio aparece "de cabeça
pra baixo" perto de rotZ≈180°, e se "tremendo"/"não acompanha" batem com perda de tracking
já medida na rodada 1.

**Evidência:** `docs/prado-rescue/evidence/AR-004/fisico-rodada2-metrics-live.txt` (132
amostras, CDP, ~150ms) + `fisico-rodada2-video.mp4` (20,06s, 1080x2640, ~12,8MB,
`screenrecord` via `adb shell`, display-id `4630947043778501762` — tela interna do Razr 40)
+ frames extraídos em `docs/prado-rescue/evidence/AR-004/frames-rodada2/` (contact sheet
1fps + frames específicos com o HUD legível, cada um mostra o valor exato de `rotZ` no
instante do frame — usado como groundtruth em vez de tentar sincronizar relógio de parede
entre vídeo e CDP, que não é exato).

**Confirmado por vídeo — "não acompanha no vai-e-vem":** SIM, o relógio realmente some da
tela nesse trecho — mas a CAUSA RAIZ, esclarecida por Carlos depois de revisar a captura,
**não é falha do motor de tracking**: ele estava testando sozinho, segurando o celular com
uma mão e girando o próprio pulso com a outra ao mesmo tempo, e a câmera saiu de
foco/enquadramento da mão durante o giro. Não foi "o app perdendo a mão por conta própria"
(isso soaria como bug) — foi limitação da metodologia de teste solo: uma pessoa sozinha
segurando o celular e girando o próprio pulso ao mesmo tempo tem dificuldade de manter o
enquadramento perfeito da câmera sobre a mão. Isso **não descarta** a necessidade de medir
robustez de tracking sob movimento — só corrige a atribuição de causa deste achado
específico, para não ser lido no futuro como "bug de tracking".

O MECANISMO técnico de COMO isso aparece na tela, esse sim, continua confirmado e não muda:
no frame em t≈16s (`full-t16.png`), com `isTracking=false`, o relógio **some completamente
da tela** (troca pelo aviso amarelo "Mostre o pulso na câmera") — não é só atraso/lag, é
desaparecimento total. Bate exatamente com o mecanismo já lido em `GhostEngine.js`
(`HOLD_POSE_MS=1500`; toda perda registrada na rodada 1 e na rodada 2 durou mais que
1500ms, ou seja, o hold sempre expirou antes de reconectar). 39 de 132 amostras desta
rodada tiveram `isTracking=false` (~30% do tempo) — número que mede quanto tempo a câmera
ficou sem enquadrar a mão claramente **neste teste solo específico**, não necessariamente a
taxa de perda em uso normal (ex.: com a câmera segurada por outra pessoa, ou o pulso
movendo-se sem o operador também girar a mão que segura o celular).

**NÃO confirmado — "de cabeça pra baixo":** a hipótese numérica da investigação anterior
(rotZ perto de 180° ⇒ visualmente invertido) foi **testada e não se sustentou**. Nos 3
frames mais próximos de 180° capturados nesta rodada (rotZ=182.8°, 190.1°, e o wrap
365.9°≈5.9°), o relógio aparece com orientação **normal/legível** nos 3 — pulseira na
direção da mão, dígitos do mostrador legíveis, não invertidos. Varredura adicional (1
frame/segundo nos 20s inteiros + amostragem fina de ~100ms numa janela de giro rápido) não
achou nenhum frame com inversão óbvia (pulseira apontando pro lado errado / texto
espelhado). **Isso não prova que o "de cabeça pra baixo" nunca aconteceu** — a amostragem
não foi exaustiva (não são todos os ~868 frames do vídeo) — mas descarta a explicação mais
simples que tínhamos (ângulo bruto perto de 180° = invertido).

**Achado novo, mais provável agora:** o relógio claramente gira por ângulos bem maiores que
o esperado durante o movimento (ex.: rotZ=93.0° e rotZ=293.3° observados em frames com o
pulso claramente não girado 90°/293° na vida real) — ou seja, existe uma rotação
visualmente ERRADA/exagerada em vários momentos, só que ela não bate com "de cabeça pra
baixo" (180°), bate mais com "girado de lado" numa quantidade que não corresponde ao giro
real do pulso. Isso é consistente com o achado de código já registrado (rotação é um único
ângulo 2D via `atan2`, sem correção quando o par de landmarks degrada — ver seção anterior)
mas ainda não temos o campo `degraded` pra confirmar se essas rotações erradas coincidem
com a troca de par lm5–lm17 → lm1–lm17.

**Limitação registrada:** `degraded` não pôde ser capturado nesta rodada (não é repassado
adiante por `GhostEngine._onFrame()`, não chega a nenhum estado/HUD/global acessível via
CDP sem editar código-fonte — proibido nesta tarefa). Sem esse dado, não dá pra confirmar
se as rotações "erradas" (93°, 293°) coincidem com o par de fallback.

**Próxima investigação recomendada:** pedir ao Carlos pra sinalizar (gesto ou fala) o
instante exato em que perceber "de cabeça pra baixo" num próximo teste, permitindo mirar o
frame certo sem depender de correlação por rotZ; alternativamente, expor `degraded` como
experimento registrado (Fase 6) pra testar a hipótese da troca de par de landmarks.

## Sessão 2026-08-27 — resumo do que mudou aqui

- **Branch de trabalho: `fix/d1-d2-d4-estabilizacao`** (não `ghost-engine-v1`), decisão
  consciente e específica para este teste: é neste branch que a correção D4
  (`_unwrapRotZ()`, ver seção AR-004 abaixo) já está portada, e é exatamente essa correção
  que o próximo teste físico precisa verificar. Confirmado por leitura direta do arquivo
  (`src/engine/core/GhostEngine.js`, método presente). Sem merge para
  `ghost-engine-v1`/`main`, sem push, sem deploy.
- **AR-003 já existia em `evidence/AR-003/` (com vídeo, logcat, screenshots) mas nunca
  tinha sido incorporado a este arquivo** — corrigido agora, ver seção própria abaixo. Foi
  a primeira captura desta investigação com PASS real de `isTracking` sob condição limpa.
- **Mudança de código pontual (única autorizada nesta sessão)**:
  `src/labs/tasks-wrist/TasksWristLab.jsx` — o painel de calibração (top-right) agora
  começa FECHADO por padrão (novo estado `calibPanelOpen`, botão próprio "▼/▲
  Calibração"), em vez de sempre visível. Resolve a limitação estrutural identificada no
  AR-002 (painel de calibração cobrindo o HUD de fps/scale/rotZ em retrato neste
  aparelho — 240+262=502 CSS px > ~411 CSS px de largura de tela). Nenhuma lógica de
  tracking/filtro/anchor foi tocada. `npm run build` verificado sem erro. Detalhe completo
  com trecho antes/depois: `evidence/AR-004/README.md`, seção "Preparação para
  AR-004-fisico".
- **Protocolo pronto** para o Carlos rodar a captura física (giro completo do pulso
  cruzando os ±180°, pra verificar se `_unwrapRotZ()` evita o salto do modelo 3D):
  `evidence/AR-004/PROTOCOLO-FISICO-CARLOS.md`. Ainda não executado.

## AR-004 (2026-08-20) — D1/D2/D4 portados do motor legado pro motor moderno

Experimento de código (Fase 6), não captura física em dispositivo. Uma auditoria externa
apontou 3 defeitos pontuais em `src/engine/` (motor moderno, hoje só usado por
`?lab=tasks-wrist` — **não** pela loja real, que usa `src/tracking/` legado):

- **D1**: `HandTracker.startLoop()` sem try/catch ao redor de `detectForVideo()` — uma
  exceção em qualquer frame matava o loop de `requestAnimationFrame` pra sempre, sem
  aviso. Corrigido com try/catch/finally, reagendando sempre o rAF (padrão portado de
  `src/tracking/PoseWristTracker.js#detect()`).
- **D2**: posição normalizada (0-1) do MediaPipe mapeada direto pra `%` de CSS num
  `<video>` com `object-fit: cover`, sem compensar a diferença de aspect ratio entre
  vídeo e container. Corrigido com novo utilitário `src/engine/react/coverMapping.js`
  (`mapNormalizedToCoverPercent`), aplicado nos 2 consumidores (`GhostWristARView.jsx`,
  `TasksWristLab.jsx`) — decisão registrada de corrigir na camada de desenho (React), não
  dentro de `wristAnchor.js`/`GhostEngine.js`, pra não mudar o contrato de dados
  normalizado 0-1 que outras ferramentas (`calibrationMetrics.js`) já consomem. Padrão
  portado de `src/tracking/PoseWristTracker.js#_toScreen()`.
- **D4**: `rotZ` de `Math.atan2()` sem unwrap angular antes do `OneEuroFilterScalar` em
  `GhostEngine._onFrame()` — cruzar a fronteira ±180° causava salto falso de quase 360°
  no filtro. Corrigido com novo método `GhostEngine._unwrapRotZ()` + estado próprio
  `this._lastRotZ` (não acessa o campo privado `_x` do filtro). Padrão portado e adaptado
  de graus pra radianos de `src/tracking/WristTracker.js#_filterRotation()`.

Verificação feita: `npm run build` sem erro; `npm run dev` sem erro; rota padrão (`/`) e
`?lab=tasks-wrist` respondem HTTP 200; cada arquivo alterado transforma sem erro de
sintaxe/import via Vite. **NÃO testado fisicamente em celular real** — isso é a próxima
ação recomendada, especificamente girando o pulso pela fronteira ±180° pra confirmar D4
visualmente.

Branch: `fix/d1-d2-d4-estabilizacao` (a partir de `ghost-engine-v1`, commit `248efc6`).
Sem merge, sem push, sem deploy. Detalhe completo:
`docs/prado-rescue/evidence/AR-004/README.md`, `result.json`, `git.txt`.

`src/tracking/` (motor legado, em produção na loja real) não foi tocado em nenhum
momento — só lido como referência.

## REGRA PERMANENTE ADICIONADA NESTA SESSÃO (ler antes de qualquer recomendação futura)

O `.claude/agents/ar-rescue.md` ganhou a seção **"REQUISITO DE COMPATIBILIDADE UNIVERSAL"**: qualquer
causa raiz identificada (ex: erro de OIS da câmera, ver abaixo) deve ser tratada como hipótese
específica do Motorola Razr 40 de teste até validação cruzada em pelo menos um segundo Android.
Nenhuma correção futura (Fase 6) pode ser um workaround específico de hardware de um único aparelho.
Sem um segundo dispositivo disponível, isso deve continuar registrado como limitação conhecida.

## Estado atual

- Infraestrutura (Fase 1-2) construída e validada (Motorola razr 40, Android 15, GPU Adreno, serial
  `ZY22HDF7WJ`).
- Evidence Pack (Fase 3) e métricas (Fase 4) concluídos — ver `AR-000`.
- **Fase 5 tem três capturas reais: `AR-001` e `AR-002` (FAIL no sinal `isTracking`, ambas com
  ressalvas metodológicas sérias) e `AR-003` (PASS no sinal `isTracking`, primeira condição
  limpa — modo certo + mão real em quadro confirmados antes de gravar).** Mesmo com o PASS do
  AR-003, o HUD de fps/scale/rotZ continuou coberto pelo painel de calibração nas três — só
  corrigido nesta sessão (2026-08-27), ainda sem uma captura que já se beneficie disso.
- **Fase 6 tem um experimento registrado: `AR-004`** — D1/D2/D4 portados do motor legado pro
  moderno (`src/engine/`), PROMOTE para o branch experimental `fix/d1-d2-d4-estabilizacao`,
  verificado só localmente (build/rotas HTTP), **nunca testado fisicamente em celular**. Nesta
  sessão (2026-08-27) foi preparado (não executado) o teste físico AR-004-fisico: painel de
  calibração do lab virou colapsável (libera a leitura do fps) + protocolo passo a passo pronto
  em `evidence/AR-004/PROTOCOLO-FISICO-CARLOS.md`.
- Fases 7, 8 não começaram.

## Histórico das capturas da Fase 5

### AR-001 (primeira tentativa)
- Modo errado selecionado ("① Testar GLB no centro" em vez de "③ GLB no pulso") — descoberto DEPOIS
  da captura, por análise de vídeo.
- `isTracking` falso nas 9 amostras verificadas, mesmo com pulso real visivelmente em quadro.
- HUD de fps/scale/rotZ coberto pelo painel de calibração.
- Achado via logcat: 204 ocorrências de erro nativo de OIS da câmera (`CamX`), cobrindo quase toda a
  janela de 12s.
- Hipótese externa de "loop travado" (relatada pelo coordenador, 2 screenshots fora da minha janela)
  — não confirmada nem descartada pelos meus dados.

### AR-002 (repetição corrigida)
- **Modo confirmado CORRETO antes de gravar desta vez** ("③ GLB no pulso", verificado por screenshot
  + localização precisa do botão certo via detecção de cor de pixel — há um botão separado "✓ GLB
  Ativo" visualmente quase sobreposto ao seletor de modo, fácil de confundir; documentado).
- HUD **continuou coberto** — descoberto por leitura de código que o painel de calibração é
  PERMANENTE nesta versão (sem botão de fechar, não ligado ao estado do HUD) e a sobreposição é
  estrutural: larguras somadas dos dois painéis (240+262=502 CSS px) excedem a largura de tela em
  retrato (~411 CSS px) neste aparelho. Não é resolvível por interação de UI; exigiria mudar código
  (fora do escopo desta investigação).
- `isTracking` falso nas 12 amostras verificadas, mesmo com modo certo — MAS a câmera estava
  majoritariamente apontada para tapete/joelho, não para uma mão/pulso reconhecível. Não dá pra
  concluir que o motor falhou em detectar um pulso real que estivesse bem enquadrado.
- **Erro de OIS da câmera REPRODUZIDO uma segunda vez**: 206 ocorrências (era 204 no AR-001),
  praticamente na mesma janela de ~12s, agora em modo diferente do lab. Isso é bem mais forte que
  coincidência — mas, por causa da nova regra permanente acima, deve ser tratado como possivelmente
  específico deste aparelho até validação cruzada, não generalizado.

Detalhe completo de cada um: `docs/prado-rescue/evidence/AR-001/` e `AR-002/` (`metrics.json`,
`result.json`, `README.md`).

### AR-003 (terceira tentativa, primeira condição limpa) — PASS

Repetição corrigida, com a causa raiz certa da confusão de modo (identificada por leitura
de código): o seletor de modo real são os três botões `① / ② / ③`, e "✓ GLB Ativo" é um
controle totalmente separado — confirmado ANTES de gravar, junto com enquadramento
(screenshot prévio mostrando mão/pulso real em quadro, corrigindo o problema do AR-002).

- **PASS no sinal `isTracking`**: 18 de 24 amostras do vídeo (2fps, ~75% da janela de
  11.97s) mostraram o pill verde "TRACKING" e o relógio 3D visivelmente ancorado sobre o
  pulso real, incluindo durante um pequeno reposicionamento do pulso perto de t≈9.5s.
  Nenhuma amostra mostrou o pill vermelho, inversão do modelo, ou salto perceptível entre
  quadros.
- **Escopo do PASS, não generalizar além disso**: cobre detecção + ancoragem visual sob
  pulso majoritariamente PARADO com um movimento pequeno. NÃO testa fps sob carga,
  rotação rápida do pulso, nem a hipótese mais ampla de instabilidade do projeto — essas
  continuam sem teste direto (é exatamente o que o teste AR-004-fisico, preparado nesta
  sessão, pretende cobrir).
- **fps continuou NÃO OBSERVÁVEL** nesta captura — mesma limitação estrutural do HUD
  coberto pelo painel de calibração (só resolvida agora, nesta sessão, ver "Sessão atual"
  no topo deste arquivo).
- Erro de OIS da câmera (`CamX`/`CSLHwOIS`) reproduzido pela terceira vez consecutiva (204,
  206, 206 ocorrências), sem afetar o resultado de tracking desta vez — continua tratado
  como possivelmente específico do aparelho de teste atual (Motorola razr 40), não
  generalizado.
- Relato do operador de que o relógio "dançou"/apareceu de cabeça para baixo em algum
  momento anterior: NÃO CORROBORADO nesta captura específica, mas também não descartado
  como fenômeno geral (amostragem a 2fps pode não capturar um evento breve).
- Bloqueio operacional relevante para o histórico: vários minutos gastos recolocando o
  aparelho em posição (estava apontado pro pé/chinelo, parado), incluindo um timeout de
  tela do Android (contornado temporariamente e revertido depois) e um reload do lab após
  o app ir para segundo plano sem querer.

Decisão registrada em `result.json`: PROMOTE a conclusão limitada de que o motor de
tracking (GhostEngine, `@mediapipe/tasks-vision`) detecta e ancora corretamente um
pulso/mão real quando o modo do lab está certo e a mão está em quadro, neste aparelho,
sob movimento mínimo — sem promover nenhuma conclusão sobre fps/estabilidade sob
movimento rápido.

Detalhe completo: `docs/prado-rescue/evidence/AR-003/` (`metrics.json`, `result.json`,
`README.md`, `video.mp4`, frames de referência).

## Hipótese em aberto do contexto do projeto (ainda sem confirmação direta)

Reprovação em teste de estabilidade (FPS/rotação) do motor moderno, possivelmente ligada a
incompatibilidade WebGL vs. GPU Adreno. Nenhuma das duas capturas testou isso diretamente (FPS não
foi observável em nenhuma das duas, pelo mesmo motivo estrutural do HUD coberto). O achado de erro de
OIS é um dado novo e agora reproduzido 2x, mas ainda não se sabe se está relacionado a essa hipótese
mais ampla — e, pela nova regra de compatibilidade universal, não deve ser tratado como causa
generalizável sem um segundo aparelho.

## Achado técnico real confirmado (Fase 4, não é hipótese)

`console.log()` de página web numa aba comum do Chrome Android não chega ao logcat do sistema
(confirmado empiricamente). Via (b) — leitura quadro-a-quadro do HUD visível na tela — é a que
funciona, mas nas duas capturas da Fase 5 até agora o HUD completo (fps/scale/rotZ) ficou
estruturalmente coberto por um painel de calibração permanente no código atual do lab.

## O que foi descartado

- Tentar ler métricas do motor via logcat diretamente para valores JS (não funciona). Eventos
  nativos do sistema (câmera HAL, crashes, ANR) SÃO observáveis via logcat — confirmado 2x agora.
- Tentar fechar o painel de calibração via toque/UI no AR-002 — não existia controle para isso
  naquele momento; era permanente no código daquela versão. **Atualização 2026-08-27: agora existe**
  — foi adicionado um botão "▼/▲ Calibração" nesta sessão (ver "Sessão atual" no topo), então este
  item deixou de ser um descarte permanente e passa a ser tratado como resolvido, pendente de
  confirmação em captura física real.

## O que continua desconhecido (NÃO OBSERVÁVEL até agora)

- FPS real de qualquer um dos dois motores em uso ao vivo — estruturalmente coberto pelo painel de
  calibração nas três tentativas até agora (AR-001, AR-002, AR-003). A causa estrutural foi corrigida
  nesta sessão (painel de calibração agora colapsável, ver "Sessão atual"), mas ainda **não existe
  nenhuma captura que já tenha se beneficiado disso** — continua NÃO OBSERVÁVEL até a próxima captura
  física rodar.
- Se o erro de OIS é causa, coincidência, ou condição crônica do aparelho independente do site —
  precisa de teste comparativo fora do navegador (app de câmera nativo).
- Se o "congelamento do loop de tracking" relatado pelo coordenador no AR-001 é real — ainda não
  confirmado nem descartado.
- Comportamento do anchor no pulso sob rotação ativa/rápida cruzando os ±180° — é exatamente o que o
  teste AR-004-fisico (protocolo pronto, não executado) pretende cobrir; a correção `_unwrapRotZ()`
  (D4) existe no branch `fix/d1-d2-d4-estabilizacao` mas não foi confirmada em uso real ainda.
- Comportamento de jitter/estabilidade real do anchor no pulso sob movimento mais amplo do que o do
  AR-003 (que cobriu só pulso majoritariamente parado + um pequeno reposicionamento) — ainda não
  isolado.

## Próxima investigação recomendada

1. **Executar o AR-004-fisico** (protocolo já pronto em `evidence/AR-004/PROTOCOLO-FISICO-CARLOS.md`):
   captura de ~15s no branch `fix/d1-d2-d4-estabilizacao`, com o Carlos girando o pulso ativamente
   cruzando os ±180° de propósito, para verificar se `_unwrapRotZ()` (D4) evita o salto/giro errado do
   modelo 3D — e, como efeito colateral útil, a primeira captura em que o fps deve estar legível no
   HUD graças à mudança desta sessão. Precisa do celular conectado por USB.
2. Testar o erro de OIS fora do navegador (app de câmera nativo do Android) para isolar se é
   específico do uso via WebRTC/Chrome ou uma condição mais ampla do aparelho — e lembrar de tratar
   qualquer conclusão como específica deste aparelho até um segundo Android estar disponível. Reproduzido
   3 vezes consecutivas agora (AR-001, AR-002, AR-003), sempre na mesma janela de tempo relativa.
3. Repetir o mesmo tipo de teste na loja real (`?fitDebug=1&showTrackingDebug=1`) para comparar com o
   motor em produção hoje (`src/tracking/`, ainda não tocado por nenhuma correção deste projeto).

## Registros de evidência existentes

| ID | Tipo | Resumo |
|---|---|---|
| `AR-000` | Infra capability check (Fase 3+4) | Evidence Pack validado + descoberta de métricas; nenhum teste funcional do motor AR |
| `AR-001` | AR-BASELINE-10S (Fase 5) | FAIL isTracking; modo errado selecionado; HUD coberto; erro OIS 204x; hipótese de loop travado não confirmada nem descartada |
| `AR-002` | AR-BASELINE-10S (Fase 5, repetição) | FAIL isTracking; modo CORRETO desta vez; HUD continua coberto (limitação estrutural do código, não resolvível por UI); câmera majoritariamente sem mão em quadro; erro OIS reproduzido 206x |
| `AR-003` | AR-BASELINE-10S (Fase 5, condição limpa) | PASS isTracking (18/24 amostras); modo certo + mão real em quadro confirmados antes de gravar; fps continua NÃO OBSERVÁVEL (HUD coberto); erro OIS reproduzido 206x (3ª vez); escopo: só pulso majoritariamente parado |
| `AR-004` | Fase 6 — Experimento de código (`src/engine`) | D1/D2/D4 portados do motor legado; PROMOTE para branch `fix/d1-d2-d4-estabilizacao`; verificação só local (build/rotas), sem teste físico ainda; nesta sessão (2026-08-27): painel de calibração do lab virou colapsável (libera leitura do fps) + protocolo `PROTOCOLO-FISICO-CARLOS.md` pronto para a captura física pendente (AR-004-fisico) |

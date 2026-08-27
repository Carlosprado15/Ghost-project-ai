# CURRENT_STATE — PRADO GHOST RESCUE / AR LAB v1

Última atualização: 2026-08-20, após AR-004 (Fase 6 — primeiro experimento de código real
no motor moderno, ainda sem teste físico).
**Ler este arquivo antes de qualquer nova investigação — não repetir o que já foi feito aqui.**

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
- **Fase 5 tem duas capturas reais: `AR-001` e `AR-002`, ambas FAIL no sinal `isTracking`, ambas com
  ressalvas metodológicas sérias que impedem tratar isso como conclusão definitiva sobre o motor.**
  Nenhuma delas conseguiu ainda um teste "limpo" (modo certo + HUD legível + mão claramente
  enquadrada durante toda a janela).
- Fases 6, 7, 8 não começaram — nenhuma correção foi tentada, nenhum código do motor AR foi alterado
  em nenhuma fase até agora.

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
- Tentar fechar o painel de calibração via toque/UI no AR-002 — não existe controle para isso; é
  permanente no código desta versão.

## O que continua desconhecido (NÃO OBSERVÁVEL até agora)

- FPS real de qualquer um dos dois motores em uso ao vivo — estruturalmente coberto pelo painel de
  calibração nas duas tentativas até agora. Só seria observável rodando fora do modo autoPhase com
  uma mudança de código (fora de escopo) OU girando o aparelho para paisagem (não tentado, risco de
  quebrar a captura, não testado ainda).
- Se o erro de OIS é causa, coincidência, ou condição crônica do aparelho independente do site —
  precisa de teste comparativo fora do navegador (app de câmera nativo).
- Se o "congelamento do loop de tracking" relatado pelo coordenador no AR-001 é real — ainda não
  confirmado nem descartado.
- Comportamento de jitter/estabilidade real do anchor no pulso quando uma mão de fato está em
  quadro — nenhuma das duas capturas conseguiu isolar isso ainda (AR-001: modo errado; AR-002: mão
  não claramente enquadrada durante a maior parte da janela).

## Próxima investigação recomendada

1. **AR-003**: repetir com atenção específica ao ENQUADRAMENTO — garantir que a mão/pulso com dedos
   visíveis esteja de fato dentro do campo de visão da câmera durante toda a janela de gravação, além
   do modo certo. Considerar girar o aparelho para paisagem para testar se isso resolve a sobreposição
   estrutural do HUD (mudança de orientação física, não de código).
2. Testar o erro de OIS fora do navegador (app de câmera nativo do Android) para isolar se é
   específico do uso via WebRTC/Chrome ou uma condição mais ampla do aparelho — e lembrar de tratar
   qualquer conclusão como específica deste aparelho até um segundo Android estar disponível.
3. Repetir o mesmo tipo de teste na loja real (`?fitDebug=1&showTrackingDebug=1`) para comparar com o
   motor em produção hoje.

## Registros de evidência existentes

| ID | Tipo | Resumo |
|---|---|---|
| `AR-000` | Infra capability check (Fase 3+4) | Evidence Pack validado + descoberta de métricas; nenhum teste funcional do motor AR |
| `AR-001` | AR-BASELINE-10S (Fase 5) | FAIL isTracking; modo errado selecionado; HUD coberto; erro OIS 204x; hipótese de loop travado não confirmada nem descartada |
| `AR-002` | AR-BASELINE-10S (Fase 5, repetição) | FAIL isTracking; modo CORRETO desta vez; HUD continua coberto (limitação estrutural do código, não resolvível por UI); câmera majoritariamente sem mão em quadro; erro OIS reproduzido 206x |

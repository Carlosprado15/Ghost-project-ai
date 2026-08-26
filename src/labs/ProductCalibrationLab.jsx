import { useEffect, useMemo, useRef, useState } from 'react';
import { ensureModelViewer } from '../engine/render/modelViewerLoader.js';
// Overrides VIGENTES — usado só pra ler type/offset/status de partida. A
// rotação e a escala exportadas NÃO compõem com o valor antigo salvo aqui
// (ver comentário em buildJsonEntry): a tela sempre mostra o arquivo bruto
// do zero, então o que sai no JSON é sempre a rotação medida a partir desse
// zero, não um incremento por cima do que já estava salvo.
import overridesData from '../../scripts/normalize-glb/product-calibration-overrides.json';

/**
 * ProductCalibrationLab — M070D/E/F
 * Calibração visual por produto dos GLBs normalizados.
 * Rota: ?lab=calibrate-product&productId=CW001
 *
 * Fluxo: girar o produto com o mouse (camera-controls) até o mostrador ficar
 * de frente — o painel mostra a órbita da câmera AO VIVO — e clicar "Aplicar":
 * a vista atual vira a rotação oficial do produto (câmera → rotationDeg),
 * a câmera volta para a frente e o resultado fica visível. "Copiar JSON"
 * gera o bloco para o product-calibration-overrides.json.
 */

// Os 32 produtos ativos hoje (catálogo pós-limpeza de CW010/011/012/015),
// na ordem em que devem aparecer na prateleira e no navegador Anterior/Próximo.
const IDS = [
  'CW001', 'CW002', 'CW003', 'CW004', 'CW005', 'CW006', 'CW007', 'CW008', 'CW009',
  'CW013', 'CW014',
  'CW016', 'CW017', 'CW018', 'CW019', 'CW020', 'CW021', 'CW022', 'CW023', 'CW024',
  'CW025', 'CW026', 'CW027', 'CW028', 'CW029', 'CW030', 'CW031', 'CW032', 'CW033',
  'CW034', 'CW035', 'CW036',
];

// Tipo (watch/bracelet) lido do overrides vigente — mesma fonte de verdade
// usada em buildJsonEntry(). Não hardcodar aqui: uma lista fixa já ficou
// desatualizada antes (10 dos 15 produtos originais estavam errados).
const typeOf = (id) => (overridesData[id]?.type === 'bracelet' ? 'bracelet' : 'watch');

// ── Álgebra 3x3 (convenção coluna: M·v) ─────────────────────────────────────
const I3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const deg2rad = (d) => d * Math.PI / 180;
const rad2deg = (r) => r * 180 / Math.PI;

const rotX = (deg) => { const c = Math.cos(deg2rad(deg)), s = Math.sin(deg2rad(deg)); return [[1, 0, 0], [0, c, -s], [0, s, c]]; };
const rotY = (deg) => { const c = Math.cos(deg2rad(deg)), s = Math.sin(deg2rad(deg)); return [[c, 0, s], [0, 1, 0], [-s, 0, c]]; };
const rotZ = (deg) => { const c = Math.cos(deg2rad(deg)), s = Math.sin(deg2rad(deg)); return [[c, -s, 0], [s, c, 0], [0, 0, 1]]; };

const matMul = (A, B) => A.map((row, i) => row.map((_, j) =>
  A[i][0] * B[0][j] + A[i][1] * B[1][j] + A[i][2] * B[2][j]
));

// Euler na convenção do PIPELINE (normalize.mjs aplica x→y→z: M = Rz·Ry·Rx)
function eulerPipeline(M) {
  const b = Math.asin(Math.max(-1, Math.min(1, -M[2][0])));
  const a = Math.atan2(M[2][1], M[2][2]);
  const c = Math.atan2(M[1][0], M[0][0]);
  return { x: rad2deg(a), y: rad2deg(b), z: rad2deg(c) };
}

// Euler na convenção REAL do <model-viewer> — usada SÓ para o preview ao vivo
// do ajuste fino.
//
// BUG CORRIGIDO (2026-08-23): o atributo orientation="A B C" NÃO é lido como
// "A no X, B no Y, C no Z, na ordem XYZ" como este arquivo assumia. O
// <model-viewer> lê "A B C" como roll(Z)=A, pitch(X)=B, yaw(Y)=C, e compõe
// como Ry(C)·Rx(B)·Rz(A) (ordem YXZ do three.js). Medido no 3.4.0 com valores
// independentes (orientation="40deg 25deg -35deg"): a fórmula YXZ acerta o
// quaternion real com 0.0000° de erro, enquanto a suposição XYZ antiga errava
// por 104.9°. Na prática isso fazia o preview do ajuste fino mostrar uma
// rotação ~24° diferente da que o código achava que estava aplicando — os
// botões X/Y/Z giravam a peça em eixos misturados.
function eulerModelViewer(M) {
  const pitch = Math.asin(Math.max(-1, Math.min(1, -M[1][2]))); // eixo X
  const roll  = Math.atan2(M[1][0], M[1][1]);                   // eixo Z
  const yaw   = Math.atan2(M[0][2], M[2][2]);                   // eixo Y
  return { roll: rad2deg(roll), pitch: rad2deg(pitch), yaw: rad2deg(yaw) };
}

// Quaternion [x,y,z,w] → matriz 3x3 (mesma convenção coluna usada aqui)
const quatToMat3 = ([x, y, z, w]) => [
  [1 - 2 * (y * y + z * z), 2 * (x * y - z * w),     2 * (x * z + y * w)],
  [2 * (x * y + z * w),     1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
  [2 * (x * z - y * w),     2 * (y * z + x * w),     1 - 2 * (x * x + y * y)],
];

const isIdentity = (M) =>
  Math.abs(M[0][0] - 1) < 1e-9 && Math.abs(M[1][1] - 1) < 1e-9 && Math.abs(M[2][2] - 1) < 1e-9 &&
  Math.abs(M[0][1]) < 1e-9 && Math.abs(M[0][2]) < 1e-9 && Math.abs(M[1][2]) < 1e-9;

// ── LEITURA DA ROTAÇÃO REAL NA TELA ─────────────────────────────────────────
// Fonte única de verdade da calibração. Em vez de rastrear separadamente a
// órbita da câmera (mouse) e a matriz do ajuste fino (botões) e tentar
// combinar as duas — o que se mostrou pouco confiável —, lê direto do
// <model-viewer> o estado que está REALMENTE na tela:
//
//   R = qCâmera⁻¹ · qModelo
//
// ...ou seja, "como o objeto está posado em relação à câmera", convertido
// para o referencial da câmera neutra (θ=0, φ=90 — medido: quaternion de
// mundo exatamente [0,0,0,1], por isso não sobra nenhum termo extra).
// Isso captura mouse e botões juntos, sem depender de qual dos dois foi usado.
//
// Validado (2026-08-23, model-viewer 3.4.0, CW014, comparando a projeção de
// 500 vértices reais na tela):
//   - só mouse   : idêntico à fórmula antiga Rx(90−φ)·Ry(−θ) com 0.0000° de erro
//   - só botões  : erro 0.00010 (ler só a orientação do objeto erra 0.08248)
//   - mouse+botões: erro de forma 0.000206 NDC (~0.07 px) depois de descontar
//     o reenquadramento automático do próprio <model-viewer>
//
// O <model-viewer> não expõe a cena three.js por API pública — só por um
// Symbol privado. Se uma atualização futura quebrar esse acesso, cai na
// fórmula antiga (só câmera, ignora o ajuste fino) e GRITA no console, para
// que uma captura quebrada nunca passe silenciosa.
function readDisplayedRotation(el) {
  try {
    const symScene = Object.getOwnPropertySymbols(el).find((s) => el[s]?.isScene);
    if (!symScene) throw new Error('cena interna do <model-viewer> não encontrada');
    const scene = el[symScene];
    const target = scene.children.find((c) => c.name === 'Target');
    const container = target?.children.find((c) => c.type === 'Group');
    if (!container) throw new Error('nó do modelo (Target > Group) não encontrado');
    const cam = scene.camera ?? scene.getCamera?.();
    if (!cam) throw new Error('câmera da cena não encontrada');
    scene.updateMatrixWorld(true);
    const Quat = container.quaternion.constructor; // o mesmo three.js do model-viewer
    const qModel = container.getWorldQuaternion(new Quat());
    const qCam = cam.getWorldQuaternion(new Quat());
    const R = qCam.clone().invert().multiply(qModel);
    return { M: quatToMat3([R.x, R.y, R.z, R.w]), source: 'live' };
  } catch (err) {
    console.error(
      '[ProductCalibrationLab] FALHA ao ler a rotação real do <model-viewer> ' +
      '(a API interna deve ter mudado numa atualização). Caindo na fórmula ' +
      'antiga só-câmera: o AJUSTE FINO NÃO VAI ENTRAR no valor salvo. ' +
      'Confira a calibração antes de rodar normalize.mjs.', err
    );
    try {
      const o = el.getCameraOrbit();
      return {
        M: matMul(rotX(90 - rad2deg(o.phi)), rotY(-rad2deg(o.theta))),
        source: 'fallback',
      };
    } catch {
      return null;
    }
  }
}

// Monta o bloco de JSON de um produto a partir da matriz acumulada (câmera +
// ajuste fino) — usado tanto no "copiar este produto" quanto no "copiar tudo
// que foi ajustado" da prateleira.
//
// IMPORTANTE: o <model-viewer> exibe SEMPRE o arquivo BRUTO (/models/ID.glb),
// nunca o normalized/ já calibrado — então a rotação lida da tela JÁ É a
// rotação absoluta final, medida a partir do zero do arquivo
// bruto. Bug corrigido (2026-08-22): antes disso multiplicava por cima da
// rotationDeg ANTIGA salva em overridesData ("baseMatrixFor"), que fazia
// sentido só quando a tela mostrava o normalized/ já pré-rotacionado — depois
// que o visualizador passou a mostrar o bruto, essa multiplicação virou uma
// rotação "fantasma" que não correspondia a nada visível na tela. Mesma razão
// pela qual "scale" agora usa só o ajuste fino desta sessão, não o valor
// antigo salvo — offset continua vindo do arquivo porque não há controle de
// offset nesta tela (nada aqui o sobrescreve visualmente).
//
// ATUALIZAÇÃO (2026-08-23): não compõe mais câmera × ajuste fino. `capturedM`
// JÁ É a rotação total lida da tela (ver readDisplayedRotation) — o ajuste
// fino está dentro dela, porque a leitura pega o quaternion real do modelo,
// que é onde o orientation= do ajuste fino já foi aplicado. `liveM`, quando
// vem preenchido, é uma releitura feita NA HORA DE SALVAR (só dá pra fazer no
// produto que está na tela); sem ele, usa o último valor confirmado no
// "Aplicar".
function buildJsonEntry(id, entry, liveM) {
  const ov    = overridesData[id] ?? {};
  const total = isEngaged(entry) ? (liveM ?? entry.capturedM) : I3;
  const e = eulerPipeline(total);
  const r1 = (v) => Math.round(v * 10) / 10;
  const r2 = (v) => Math.round(v * 100) / 100;
  return {
    type: typeOf(id),
    rotationDeg: { x: r1(e.x), y: r1(e.y), z: r1(e.z) },
    scale: r2(entry.fineScale),
    offset: { x: 0, y: 0, z: 0, ...(ov.offset ?? {}) },
    flip180Y: false,
    flip180Z: false,
    status: entry.status,
  };
}

const initialEntry = (id) => ({
  capturedM: I3,     // rotação TOTAL lida da tela no "Aplicar" (mouse + botões)
  applied: false,    // se o usuário já confirmou a vista com "Aplicar"
  fineM: I3,         // ajuste fino por botões — PREVIEWADO ao vivo
  fineScale: 1,      // multiplicador de escala do ajuste fino
  status: overridesData[id]?.status ?? 'needs_calibration',
});

// "Mexeu de fato na rotação/escala deste produto?" — só marcar PASS/FAIL não
// conta. Sem isso, abrir um produto e salvar sem calibrar gravaria a
// inclinação de ~15° da câmera padrão (φ=75°, não 90°) como se fosse rotação
// pedida pelo usuário. Mantém o comportamento antigo: não mexeu = 0,0,0.
const isEngaged = (e) => e.applied || !isIdentity(e.fineM) || e.fineScale !== 1;

const btn = (bg) => ({
  padding: '9px 14px', borderRadius: 8, border: 'none', background: bg,
  color: '#fff', cursor: 'pointer', fontSize: 13, fontFamily: 'sans-serif', fontWeight: 600,
});

export default function ProductCalibrationLab() {
  const urlId = new URLSearchParams(window.location.search).get('productId');
  // ?modelUrl= — override temporário e opcional pra comparar visualmente um
  // GLB alternativo (ex.: outra versão de compressão) sem tocar em
  // products.json nem no arquivo em uso. Ausente = comportamento normal.
  const modelUrlOverride = new URLSearchParams(window.location.search).get('modelUrl');
  const [mode, setMode] = useState(urlId ? 'edit' : 'grid'); // 'grid' = prateleira com os 15
  const [idx, setIdx] = useState(Math.max(0, IDS.indexOf(urlId ?? 'CW001')));
  const id   = IDS[idx];
  const type = typeOf(id);

  // estado por produto (matriz de rotação acumulada + status), preservado na navegação
  const storeRef = useRef({});
  if (!storeRef.current[id]) storeRef.current[id] = initialEntry(id);
  const [entry, setEntry] = useState(storeRef.current[id]);
  const set = (patch) => {
    const next = { ...storeRef.current[id], ...patch };
    storeRef.current[id] = next;
    setEntry(next);
  };

  const [mvReady, setMvReady]   = useState(() => !!window.customElements?.get('model-viewer'));
  const [mvError, setMvError]   = useState(null);
  const [applyKey, setApplyKey] = useState(0);
  const [copied, setCopied]     = useState(false);

  // cacheBust força o <model-viewer> a buscar o .glb de novo quando o valor
  // muda (o browser não refaz fetch de uma URL que já pediu antes). Dois
  // gatilhos:
  const [cacheBust, setCacheBust] = useState(() => Date.now());
  // 1) trocar de produto (Próximo/Anterior, reabrir pela prateleira) —
  //    applyKey já muda em todo goTo().
  useEffect(() => { setCacheBust(Date.now()); }, [applyKey]);

  // 2) o .glb do produto ATUAL mudar em disco sem o usuário trocar de
  //    produto (ex.: regenerado por outra sessão/terminal enquanto esta aba
  //    fica aberta parada no mesmo produto — era a lacuna que sobrava do
  //    ponto 1). Verifica a cada 2s via HEAD + ETag (o servidor de dev já
  //    devolve ETag baseado no conteúdo real do arquivo); se mudou, força
  //    um novo fetch. Só roda na tela de edição de um produto.
  const watchUrl = modelUrlOverride || `/models/${id}.glb`;
  const lastEtagRef = useRef(null);
  useEffect(() => {
    if (mode !== 'edit') return;
    lastEtagRef.current = null;
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch(watchUrl, { method: 'HEAD', cache: 'no-store' });
        const etag = res.headers.get('etag');
        if (!etag) return;
        if (lastEtagRef.current === null) {
          lastEtagRef.current = etag; // primeira leitura: só estabelece a base
        } else if (etag !== lastEtagRef.current) {
          lastEtagRef.current = etag;
          if (!cancelled) setCacheBust(Date.now());
        }
      } catch { /* servidor de dev fora do ar num instante — tenta de novo no próximo tick */ }
    };
    const intervalId = setInterval(check, 2000);
    return () => { cancelled = true; clearInterval(intervalId); };
  }, [mode, watchUrl]);

  // órbita da câmera AO VIVO (evento camera-change do model-viewer)
  const mvRef = useRef(null);
  const [cam, setCam] = useState(null); // { thetaDeg, phiDeg, radius }
  const attachMv = (el) => {
    mvRef.current = el;
    if (!el || el.dataset.camBound) return;
    el.dataset.camBound = '1';
    el.addEventListener('camera-change', () => {
      try {
        const o = el.getCameraOrbit();
        setCam({ thetaDeg: rad2deg(o.theta), phiDeg: rad2deg(o.phi), radius: o.radius });
      } catch { /* ainda carregando */ }
    });
  };

  useEffect(() => {
    ensureModelViewer({ timeoutMs: 15000 }).then(() => setMvReady(true)).catch(e => setMvError(e.message));
  }, []);

  // Lê a rotação real que está na tela AGORA. Só funciona no produto que está
  // montado no viewer (na prateleira não há viewer → null).
  const readLive = () => {
    const el = mvRef.current;
    if (!el) return null;
    return readDisplayedRotation(el)?.M ?? null;
  };

  // Antes de sair de um produto, guarda o que está na tela naquele instante.
  // Cobre o caso do "SALVAR TUDO" da prateleira: lá não dá pra reler ao vivo
  // os produtos que não estão montados, então o valor guardado aqui precisa
  // estar em dia — inclusive se o usuário mexeu no ajuste fino DEPOIS do
  // último "Aplicar".
  const snapshotCurrent = () => {
    const cur = storeRef.current[id];
    if (!cur || !isEngaged(cur)) return;
    const M = readLive();
    if (M) storeRef.current[id] = { ...cur, capturedM: M };
  };

  const goTo = (nextIdx) => {
    snapshotCurrent();
    const ni = (nextIdx + IDS.length) % IDS.length;
    setIdx(ni);
    setEntry(storeRef.current[IDS[ni]] ?? (storeRef.current[IDS[ni]] = initialEntry(IDS[ni])));
    setCam(null);
    setApplyKey(k => k + 1); // câmera padrão no produto novo
    const u = new URL(window.location.href);
    u.searchParams.set('productId', IDS[ni]);
    window.history.replaceState(null, '', u.toString());
  };

  // Prateleira → editor de um produto específico
  const openEdit = (productId) => {
    goTo(IDS.indexOf(productId));
    setMode('edit');
  };
  // Editor → volta pra prateleira (tira o productId da URL)
  const backToGrid = () => {
    snapshotCurrent();
    setMode('grid');
    const u = new URL(window.location.href);
    u.searchParams.delete('productId');
    window.history.replaceState(null, '', u.toString());
  };

  // Um produto conta como "ajustado nesta sessão" se algo mudou em relação
  // ao estado inicial (rotação de câmera aplicada, ajuste fino, escala ou status).
  const isTouched = (pid) => {
    const e = storeRef.current[pid];
    if (!e) return false;
    return isEngaged(e) ||
      e.status !== (overridesData[pid]?.status ?? 'needs_calibration');
  };
  const touchedIds = IDS.filter(isTouched);

  // Relê ao vivo só o produto que está na tela; os demais usam o valor
  // guardado (atualizado por snapshotCurrent ao sair de cada um).
  const buildCombinedTouched = () => {
    const live = readLive();
    return touchedIds.reduce((acc, pid) => {
      acc[pid] = buildJsonEntry(pid, storeRef.current[pid], pid === id ? live : null);
      return acc;
    }, {});
  };

  const [copiedAll, setCopiedAll] = useState(false);
  const copyAllTouched = async () => {
    if (touchedIds.length === 0) return;
    const text = JSON.stringify(buildCombinedTouched(), null, 2);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      window.prompt('Copie o JSON abaixo:', text);
    }
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 1500);
  };

  // TEMPORÁRIO — grava direto em disco via o endpoint de dev-server em
  // vite.config.ts, pra não depender de copiar/colar manual. Remover junto
  // com o plugin quando a rodada de calibração dos 32 produtos terminar.
  const [saveState, setSaveState] = useState('idle'); // idle | saving | done | error
  const [saveMsg, setSaveMsg] = useState('');
  const saveAllToDisk = async () => {
    if (touchedIds.length === 0) return;
    setSaveState('saving');
    try {
      const res = await fetch('/__ghost-save-calibration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildCombinedTouched()),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setSaveState('done');
      setSaveMsg(`${json.updated.length} produto(s) salvos: ${json.updated.join(', ')}`);
    } catch (err) {
      setSaveState('error');
      setSaveMsg(err.message || String(err));
    }
  };

  // "Aplicar" = CONFIRMAR ESTA VISTA. Não remonta o viewer, não reseta a
  // câmera, nada muda visualmente. Lê a rotação real que está na tela (mouse
  // E botões juntos — ver readDisplayedRotation) e a marca como a rotação
  // deste produto. É absoluto, não acumulado: a tela sempre mostra o GLB
  // bruto, então cada Aplicar substitui o anterior.
  //
  // O valor guardado aqui é uma rede de segurança para o "SALVAR TUDO" da
  // prateleira; para o produto que está na tela, a gravação relê ao vivo na
  // hora de salvar, então mexer no ajuste fino depois do Aplicar não deixa
  // mais o valor velho para trás.
  const [savedFlash, setSavedFlash] = useState(false);
  const handleApply = () => {
    const M = readLive();
    if (!M) return; // modelo ainda carregando
    set({ capturedM: M, applied: true });
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  };

  // JSON deste produto, montado NA HORA (relendo a tela), nunca memoizado —
  // memoizar era justamente o que deixava o valor velho ser copiado/salvo.
  const currentJsonBlock = () =>
    JSON.stringify({ [id]: buildJsonEntry(id, entry, readLive()) }, null, 2);

  // Preview ao vivo do AJUSTE FINO. A string vai na ordem que o
  // <model-viewer> realmente lê: "roll(Z) pitch(X) yaw(Y)" — ver
  // eulerModelViewer.
  const fineOrientation = useMemo(() => {
    if (isIdentity(entry.fineM)) return undefined;
    const e = eulerModelViewer(entry.fineM);
    return `${e.roll.toFixed(1)}deg ${e.pitch.toFixed(1)}deg ${e.yaw.toFixed(1)}deg`;
  }, [entry.fineM]);
  const fineScaleAttr = entry.fineScale !== 1
    ? `${entry.fineScale} ${entry.fineScale} ${entry.fineScale}` : undefined;

  const nudge = (axis, deg) => {
    const R = axis === 'x' ? rotX(deg) : axis === 'y' ? rotY(deg) : rotZ(deg);
    set({ fineM: matMul(R, entry.fineM) });
  };
  const nudgeScale = (mult) => {
    set({ fineScale: Math.round(entry.fineScale * mult * 1000) / 1000 });
  };

  const copyJson = async () => {
    const jsonBlock = currentJsonBlock();
    try {
      await navigator.clipboard.writeText(jsonBlock);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt('Copie o JSON abaixo:', jsonBlock);
    }
  };

  // Grava SÓ este produto em disco, na hora — mesmo endpoint de dev-server
  // do "SALVAR TUDO AGORA" da prateleira, mas sem precisar voltar pra lá nem
  // copiar/colar nada. Pensado pra usar logo depois de "Aplicar", produto a
  // produto, evitando o problema de "cliquei em Copiar e achei que tinha
  // salvo".
  const [saveOneState, setSaveOneState] = useState('idle'); // idle | saving | done | error
  const [saveOneMsg, setSaveOneMsg] = useState('');
  const saveOneToDisk = async () => {
    setSaveOneState('saving');
    try {
      const res = await fetch('/__ghost-save-calibration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [id]: buildJsonEntry(id, entry, readLive()) }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setSaveOneState('done');
      setSaveOneMsg(`${id} salvo em disco.`);
    } catch (err) {
      setSaveOneState('error');
      setSaveOneMsg(err.message || String(err));
    }
  };
  // Reseta o aviso de salvamento ao trocar de produto — não faz sentido
  // mostrar "salvo" de um produto na tela de outro.
  useEffect(() => { setSaveOneState('idle'); setSaveOneMsg(''); }, [id]);

  const coord = (label, value) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
      <span style={{ color: '#94a3b8' }}>{label}</span>
      <span style={{ color: '#93c5fd' }}>{value}</span>
    </div>
  );

  const statusColor = (s) => s === 'pass' ? '#4ade80' : s === 'fail' ? '#f87171' : '#facc15';

  // ── Prateleira: os 32 produtos lado a lado, clique abre o ajuste fino ──
  if (mode === 'grid') {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#0b0f14', color: '#e2e8f0', fontFamily: 'monospace', overflowY: 'auto', padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 10, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#a78bfa' }}>Prateleira — clique num produto pra ajustar</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={copyAllTouched} disabled={touchedIds.length === 0}
              style={{ ...btn(copiedAll ? '#16a34a' : touchedIds.length ? '#7c3aed' : '#374151'), opacity: touchedIds.length ? 1 : 0.5 }}>
              {copiedAll ? '✓ Copiado!' : `Copiar JSON de tudo que eu ajustei (${touchedIds.length})`}
            </button>
            <button onClick={saveAllToDisk} disabled={touchedIds.length === 0 || saveState === 'saving'}
              title="TEMPORÁRIO — grava direto em product-calibration-overrides.json no disco"
              style={{
                ...btn(saveState === 'done' ? '#16a34a' : saveState === 'error' ? '#dc2626' : touchedIds.length ? '#ea580c' : '#374151'),
                opacity: touchedIds.length ? 1 : 0.5,
              }}>
              {saveState === 'saving' ? 'Salvando…' : saveState === 'done' ? '✓ Salvo em disco!' : saveState === 'error' ? '✗ Erro — ver abaixo' : `SALVAR TUDO AGORA (${touchedIds.length})`}
            </button>
          </div>
        </div>
        {saveMsg && (
          <div style={{
            marginBottom: 12, fontSize: 12, padding: '8px 12px', borderRadius: 8,
            background: saveState === 'error' ? 'rgba(220,38,38,0.15)' : 'rgba(22,163,74,0.15)',
            color: saveState === 'error' ? '#f87171' : '#4ade80',
          }}>
            {saveMsg}
          </div>
        )}
        {/* Sem modelo 3D ao vivo aqui: 15 telinhas 3D ligadas ao mesmo tempo
            estouram o limite do navegador e embaralham os produtos. Cartão
            simples (ícone + nome + status) — o 3D real só liga um de cada vez,
            dentro do editor. */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 14 }}>
          {IDS.map((pid) => {
            const st = storeRef.current[pid]?.status ?? overridesData[pid]?.status ?? 'needs_calibration';
            return (
              <div key={pid} onClick={() => openEdit(pid)}
                style={{
                  background: '#11161d', borderRadius: 10, padding: '18px 10px', cursor: 'pointer',
                  border: `2px solid ${isTouched(pid) ? '#7c3aed' : 'rgba(255,255,255,0.08)'}`,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                }}>
                <div style={{ fontSize: 36 }}>{typeOf(pid) === 'watch' ? '⌚' : '📿'}</div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{pid} <span style={{ color: '#94a3b8', fontWeight: 400 }}>· {typeOf(pid)}</span></div>
                <div style={{ fontSize: 11, fontWeight: 700, color: statusColor(st) }}>{st}{isTouched(pid) ? ' · ajustado' : ''}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0b0f14', color: '#e2e8f0', fontFamily: 'monospace', display: 'flex' }}>

      {/* Viewer — ~70% da tela, rotação livre com o mouse */}
      <div style={{ flex: '1 1 70%', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
        {mvReady ? (
          <model-viewer
            ref={attachMv}
            key={`${id}-${applyKey}`}
            src={modelUrlOverride || `/models/${id}.glb?v=${cacheBust}`}
            camera-controls
            camera-orbit="0deg 90deg auto"
            interaction-prompt="none"
            disable-tap
            environment-image="neutral"
            shadow-intensity="0.9"
            shadow-softness="1"
            exposure="1.2"
            tone-mapping="neutral"
            orientation={fineOrientation}
            scale={fineScaleAttr}
            style={{ width: 'min(65vw, 78vh)', height: 'min(65vw, 78vh)', background: 'transparent' }}
          />
        ) : (
          <div style={{ color: mvError ? '#f87171' : '#facc15' }}>{mvError ?? 'Carregando model-viewer…'}</div>
        )}
        <div style={{
          position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.7)', padding: '6px 16px', borderRadius: 16, fontSize: 14, fontWeight: 700,
          color: entry.status === 'pass' ? '#4ade80' : entry.status === 'fail' ? '#f87171' : '#facc15',
        }}>
          {id} · {type} · {entry.status}
        </div>
      </div>

      {/* Painel lateral enxuto */}
      <div style={{ flex: '0 0 280px', background: '#11161d', borderLeft: '1px solid rgba(255,255,255,0.1)', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button onClick={backToGrid} style={{ ...btn('#374151'), fontSize: 12 }}>&lt; Voltar pra prateleira</button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={() => goTo(idx - 1)} style={btn('#374151')}>&lt; Anterior</button>
          <span style={{ fontWeight: 700, color: '#a78bfa' }}>{idx + 1}/{IDS.length}</span>
          <button onClick={() => goTo(idx + 1)} style={btn('#374151')}>Próximo &gt;</button>
        </div>

        <div style={{ fontSize: 15, fontWeight: 700, textAlign: 'center' }}>
          {id} <span style={{ color: '#94a3b8', fontWeight: 400 }}>• {type}</span>
        </div>

        {/* Câmera ao vivo — atualiza enquanto o mouse gira o produto */}
        <div style={{ background: 'rgba(0,0,0,0.4)', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 6 }}>CÂMERA (ao vivo)</div>
          {coord('azimute θ',  cam ? `${cam.thetaDeg.toFixed(1)}°` : '—')}
          {coord('polar φ',    cam ? `${cam.phiDeg.toFixed(1)}°`   : '—')}
          {coord('distância',  cam ? cam.radius.toFixed(3)          : '—')}
        </div>

        {/* AJUSTE FINO — gira grau a grau com preview NA HORA */}
        <div style={{ background: 'rgba(0,0,0,0.4)', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 8 }}>
            AJUSTE FINO (vê na hora)
          </div>
          <div style={{
            display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 10.5, lineHeight: 1.4,
            color: '#fbbf24', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.35)',
            borderRadius: 6, padding: '6px 8px', marginBottom: 10,
          }}>
            <span>⚠️</span>
            <span>Arrastar com o mouse NÃO gira o eixo Z (ponteiro) — só aponta a
            peça pra câmera. Depois de "Aplicar", confira sempre se o Z abaixo
            está certo antes de copiar.</span>
          </div>
          {[
            ['x', 'X — tombar frente/trás'],
            ['y', 'Y — girar esq./dir.'],
            ['z', 'Z — girar como ponteiro (mouse NÃO ajusta isso)'],
          ].map(([axis, label]) => (
            <div key={axis} style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 10, color: axis === 'z' ? '#fbbf24' : '#64748b', marginBottom: 2, fontWeight: axis === 'z' ? 700 : 400 }}>{label}</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {[-15, -1, 1, 15].map((d) => (
                  <button key={d} onClick={() => nudge(axis, d)}
                    style={{
                      ...btn('#1f2937'), flex: 1, padding: '6px 0', fontSize: 12,
                      border: axis === 'z' ? '1px solid rgba(251,191,36,0.5)' : '1px solid rgba(255,255,255,0.15)',
                    }}>
                    {d > 0 ? `+${d}°` : `${d}°`}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div style={{ fontSize: 10, color: '#64748b', marginBottom: 2 }}>Tamanho ({(entry.fineScale * 100).toFixed(0)}%)</div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            <button onClick={() => nudgeScale(1 / 1.05)} style={{ ...btn('#1f2937'), flex: 1, padding: '6px 0', fontSize: 12, border: '1px solid rgba(255,255,255,0.15)' }}>menor −5%</button>
            <button onClick={() => nudgeScale(1.05)}     style={{ ...btn('#1f2937'), flex: 1, padding: '6px 0', fontSize: 12, border: '1px solid rgba(255,255,255,0.15)' }}>maior +5%</button>
          </div>
          <button onClick={() => set({ fineM: I3, fineScale: 1 })}
            style={{ ...btn('#374151'), width: '100%', padding: '6px 0', fontSize: 11 }}>
            Zerar ajuste fino
          </button>
        </div>

        <button onClick={handleApply} style={btn(savedFlash ? '#16a34a' : '#0284c7')}>
          {savedFlash ? '✅ Aplicado' : '1. Aplicar — salvar esta vista como frente'}
        </button>
        <button onClick={saveOneToDisk} disabled={saveOneState === 'saving'}
          title="Grava este produto direto em product-calibration-overrides.json no disco"
          style={btn(saveOneState === 'done' ? '#16a34a' : saveOneState === 'error' ? '#dc2626' : '#ea580c')}>
          {saveOneState === 'saving' ? 'Salvando…' : saveOneState === 'done' ? '✓ Salvo no disco!' : saveOneState === 'error' ? '✗ Erro — ver abaixo' : '2. SALVAR NO DISCO'}
        </button>
        {saveOneMsg && (
          <div style={{
            fontSize: 11, padding: '6px 10px', borderRadius: 6,
            background: saveOneState === 'error' ? 'rgba(220,38,38,0.15)' : 'rgba(22,163,74,0.15)',
            color: saveOneState === 'error' ? '#f87171' : '#4ade80',
          }}>
            {saveOneMsg}
          </div>
        )}
        <button onClick={copyJson} style={btn(copied ? '#16a34a' : '#7c3aed')}>
          {copied ? '✓ Copiado!' : 'Copiar JSON deste produto'}
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => set({ status: 'pass' })} style={{ ...btn('#16a34a'), flex: 1 }}>PASS ✅</button>
          <button onClick={() => set({ status: 'fail' })} style={{ ...btn('#dc2626'), flex: 1 }}>FAIL ❌</button>
        </div>

        <div style={{ fontSize: 10, color: '#64748b', lineHeight: 1.6, marginTop: 'auto' }}>
          Ajuste grosso: gire com o mouse (só aponta a peça pra câmera, não
          gira o Z) → 1. Aplicar. Ajuste fino: confira o Z — o modelo muda NA
          HORA. Depois → 2. SALVAR NO DISCO (grava na hora, sem precisar
          copiar/colar nada). A tela SEMPRE mostra o arquivo bruto, nunca o já
          calibrado — pra ver o resultado real, rode node
          scripts/normalize-glb/normalize.mjs e olhe o arquivo em
          public/models/normalized/, não aqui.
        </div>
      </div>
    </div>
  );
}

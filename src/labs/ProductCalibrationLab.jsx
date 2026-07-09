import { useEffect, useMemo, useRef, useState } from 'react';
import { ensureModelViewer } from '../engine/render/modelViewerLoader.js';
// Overrides VIGENTES — o JSON copiado compõe o ajuste da câmera com estes
// valores, saindo sempre ABSOLUTO (nunca mais perde calibração anterior).
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

const IDS = Array.from({ length: 15 }, (_, i) => `CW${String(i + 1).padStart(3, '0')}`);

// Classificação confirmada por análise visual (M070D)
const TYPES = {
  CW001: 'watch', CW002: 'watch', CW003: 'watch', CW004: 'watch', CW005: 'watch',
  CW006: 'watch', CW007: 'watch', CW008: 'watch', CW010: 'watch',
  CW009: 'bracelet', CW011: 'bracelet', CW012: 'bracelet',
  CW013: 'bracelet', CW014: 'bracelet', CW015: 'bracelet',
};

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

// Euler na convenção do model-viewer/three.js 'XYZ' (M = Rx·Ry·Rz) — usada
// SÓ para o preview ao vivo do ajuste fino (exata para a mesma matriz)
function eulerThreeXYZ(M) {
  const b = Math.asin(Math.max(-1, Math.min(1, M[0][2])));
  const a = Math.atan2(-M[1][2], M[2][2]);
  const c = Math.atan2(-M[0][1], M[0][0]);
  return { x: rad2deg(a), y: rad2deg(b), z: rad2deg(c) };
}

const isIdentity = (M) =>
  Math.abs(M[0][0] - 1) < 1e-9 && Math.abs(M[1][1] - 1) < 1e-9 && Math.abs(M[2][2] - 1) < 1e-9 &&
  Math.abs(M[0][1]) < 1e-9 && Math.abs(M[0][2]) < 1e-9 && Math.abs(M[1][2]) < 1e-9;

// Matriz da calibração JÁ EMBUTIDA no GLB normalizado atual, lida do
// overrides vigente — mesma ordem de aplicação do normalize.mjs:
// Rz·Ry·Rx (rotationDeg x→y→z) e depois flips Y/Z.
function baseMatrixFor(id) {
  const ov = overridesData[id];
  if (!ov) return I3;
  const rd = ov.rotationDeg ?? {};
  let M = matMul(rotZ(rd.z ?? 0), matMul(rotY(rd.y ?? 0), rotX(rd.x ?? 0)));
  if (ov.flip180Y) M = matMul(rotY(180), M);
  if (ov.flip180Z) M = matMul(rotZ(180), M);
  return M;
}

const initialEntry = (id) => ({
  rotM: I3,          // captura da câmera ("Aplicar") — não é previewada
  fineM: I3,         // ajuste fino por botões — PREVIEWADO ao vivo
  fineScale: 1,      // multiplicador de escala do ajuste fino
  status: overridesData[id]?.status ?? 'needs_calibration',
});

const btn = (bg) => ({
  padding: '9px 14px', borderRadius: 8, border: 'none', background: bg,
  color: '#fff', cursor: 'pointer', fontSize: 13, fontFamily: 'sans-serif', fontWeight: 600,
});

export default function ProductCalibrationLab() {
  const urlId = new URLSearchParams(window.location.search).get('productId');
  const [idx, setIdx] = useState(Math.max(0, IDS.indexOf(urlId ?? 'CW001')));
  const id   = IDS[idx];
  const type = TYPES[id];

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

  const goTo = (nextIdx) => {
    const ni = (nextIdx + IDS.length) % IDS.length;
    setIdx(ni);
    setEntry(storeRef.current[IDS[ni]] ?? (storeRef.current[IDS[ni]] = initialEntry(IDS[ni])));
    setCam(null);
    setApplyKey(k => k + 1); // câmera padrão no produto novo
    const u = new URL(window.location.href);
    u.searchParams.set('productId', IDS[ni]);
    window.history.replaceState(null, '', u.toString());
  };

  // "Aplicar" (correção emergencial): SÓ SALVA — não remonta o viewer, não
  // reseta a câmera, nada muda visualmente. Lê a órbita atual (θ, φ), calcula
  // a rotação que leva a direção vista para +Z — Rx(90°−φ)·Ry(−θ) — e SUBSTITUI
  // a rotação salva do produto (o usuário sempre orbita o GLB original, então
  // cada Aplicar é absoluto, não acumulado). O visual correto só aparece após
  // rodar normalize.mjs com o JSON colado.
  const [savedFlash, setSavedFlash] = useState(false);
  const handleApply = () => {
    const el = mvRef.current;
    if (!el?.getCameraOrbit) return;
    try {
      const o = el.getCameraOrbit();
      const theta = rad2deg(o.theta), phi = rad2deg(o.phi);
      set({ rotM: matMul(rotX(90 - phi), rotY(-theta)) });
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
    } catch { /* modelo ainda carregando */ }
  };

  // JSON: rotação TOTAL ABSOLUTA (ajuste_fino ∘ ajuste_câmera ∘ calibração
  // vigente) na convenção do pipeline. Flips dobrados na rotationDeg.
  // Escala = vigente × ajuste fino; offset vigente preservado.
  const jsonBlock = useMemo(() => {
    const ov    = overridesData[id] ?? {};
    const total = matMul(entry.fineM, matMul(entry.rotM, baseMatrixFor(id)));
    const e = eulerPipeline(total);
    const r1 = (v) => Math.round(v * 10) / 10;
    const r2 = (v) => Math.round(v * 100) / 100;
    return JSON.stringify({
      [id]: {
        type,
        rotationDeg: { x: r1(e.x), y: r1(e.y), z: r1(e.z) },
        scale: r2((ov.scale ?? 1.0) * entry.fineScale),
        offset: { x: 0, y: 0, z: 0, ...(ov.offset ?? {}) },
        flip180Y: false,
        flip180Z: false,
        status: entry.status,
      },
    }, null, 2);
  }, [id, type, entry]);

  // Preview ao vivo do AJUSTE FINO (a captura de câmera continua só-salvar)
  const fineOrientation = useMemo(() => {
    if (isIdentity(entry.fineM)) return undefined;
    const e = eulerThreeXYZ(entry.fineM);
    return `${e.x.toFixed(1)}deg ${e.y.toFixed(1)}deg ${e.z.toFixed(1)}deg`;
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
    try {
      await navigator.clipboard.writeText(jsonBlock);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt('Copie o JSON abaixo:', jsonBlock);
    }
  };

  const coord = (label, value) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
      <span style={{ color: '#94a3b8' }}>{label}</span>
      <span style={{ color: '#93c5fd' }}>{value}</span>
    </div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0b0f14', color: '#e2e8f0', fontFamily: 'monospace', display: 'flex' }}>

      {/* Viewer — ~70% da tela, rotação livre com o mouse */}
      <div style={{ flex: '1 1 70%', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
        {mvReady ? (
          <model-viewer
            ref={attachMv}
            key={`${id}-${applyKey}`}
            src={`/models/normalized/${id}.glb`}
            camera-controls
            interaction-prompt="none"
            disable-tap
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={() => goTo(idx - 1)} style={btn('#374151')}>&lt; Anterior</button>
          <span style={{ fontWeight: 700, color: '#a78bfa' }}>{idx + 1}/15</span>
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
          {[
            ['x', 'X — tombar frente/trás'],
            ['y', 'Y — girar esq./dir.'],
            ['z', 'Z — girar como ponteiro'],
          ].map(([axis, label]) => (
            <div key={axis} style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 10, color: '#64748b', marginBottom: 2 }}>{label}</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {[-15, -1, 1, 15].map((d) => (
                  <button key={d} onClick={() => nudge(axis, d)}
                    style={{ ...btn('#1f2937'), flex: 1, padding: '6px 0', fontSize: 12, border: '1px solid rgba(255,255,255,0.15)' }}>
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
          {savedFlash ? '✅ Salvo' : 'Aplicar — salvar esta vista como frente'}
        </button>
        <button onClick={copyJson} style={btn(copied ? '#16a34a' : '#7c3aed')}>
          {copied ? '✓ Copiado!' : 'Copiar JSON deste produto'}
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => set({ status: 'pass' })} style={{ ...btn('#16a34a'), flex: 1 }}>PASS ✅</button>
          <button onClick={() => set({ status: 'fail' })} style={{ ...btn('#dc2626'), flex: 1 }}>FAIL ❌</button>
        </div>

        <div style={{ fontSize: 10, color: '#64748b', lineHeight: 1.6, marginTop: 'auto' }}>
          Ajuste grosso: gire com o mouse → Aplicar (só salva). Ajuste fino:
          botões de graus/tamanho — o modelo muda NA HORA e o JSON já sai
          com tudo somado. Depois: Copiar JSON → colar no
          product-calibration-overrides.json → regerar
          (node scripts/normalize-glb/normalize.mjs) → recarregar esta página
          (o ajuste fino zera sozinho, pois já ficou gravado no produto).
        </div>
      </div>
    </div>
  );
}

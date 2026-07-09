import { useEffect, useState } from 'react';
import { ensureModelViewer } from '../engine/render/modelViewerLoader.js';

/**
 * GLBValidationLab — M070B
 * Grid 3×5 com os 15 GLBs NORMALIZADOS (public/models/normalized/) para
 * validação visual de uma vez só. Rota: ?lab=validate-glb
 *
 * - Sem camera-controls, sem auto-rotate (atributos AUSENTES — semântica
 *   booleana de custom element), sem orientation (normalizados já corretos).
 * - Produtos com aviso do pipeline (PCA de baixa confiança ou facing 0%)
 *   ganham borda amarela para inspeção prioritária.
 */

const IDS  = Array.from({ length: 15 }, (_, i) => `CW${String(i + 1).padStart(3, '0')}`);
const WARN = new Set(['CW007', 'CW010', 'CW011', 'CW013']);

export default function GLBValidationLab() {
  const [mvReady, setMvReady] = useState(() => !!window.customElements?.get('model-viewer'));
  const [mvError, setMvError] = useState(null);

  useEffect(() => {
    ensureModelViewer({ timeoutMs: 15000 })
      .then(() => setMvReady(true))
      .catch((e) => setMvError(e.message));
  }, []);

  return (
    <div style={{
      minHeight: '100vh', background: '#0b0f14', color: '#e2e8f0',
      fontFamily: 'monospace', padding: '20px 16px 40px',
    }}>
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#a78bfa' }}>
          Validação Visual — 15 GLBs Normalizados
        </div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
          esperado: relógio em pé, mostrador às 12:00, de frente ·{' '}
          <span style={{ color: '#facc15' }}>borda amarela</span> = aviso do pipeline (conferir primeiro)
        </div>
        {!mvReady && !mvError && <div style={{ color: '#facc15', marginTop: 8 }}>Carregando model-viewer…</div>}
        {mvError && <div style={{ color: '#f87171', marginTop: 8 }}>{mvError}</div>}
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(180px, 220px))',
        gap: 14, justifyContent: 'center',
      }}>
        {IDS.map((id) => (
          <div key={id} style={{
            background: '#151b23', borderRadius: 10, padding: 8,
            border: WARN.has(id) ? '2px solid #facc15' : '1px solid rgba(255,255,255,0.12)',
          }}>
            {mvReady && (
              <model-viewer
                src={`/models/normalized/${id}.glb`}
                disable-tap
                style={{ width: '100%', height: 200, background: 'transparent', display: 'block' }}
              />
            )}
            {!mvReady && <div style={{ width: '100%', height: 200 }} />}
            <div style={{
              textAlign: 'center', marginTop: 6, fontSize: 13, fontWeight: 700,
              color: WARN.has(id) ? '#facc15' : '#93c5fd',
            }}>
              {id}{WARN.has(id) ? ' ⚠️' : ''}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

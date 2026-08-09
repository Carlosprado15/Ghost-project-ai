import { useEffect, useState } from 'react';
import { ensureModelViewer } from '../engine/render/modelViewerLoader.js';

/**
 * MaterialABLab — comparação lado a lado das variantes de material do
 * Foxbox (ver scripts/normalize-glb/fix-material.mjs). Rota: ?lab=material-ab
 *
 * Sem camera-controls, sem auto-rotate (atributos AUSENTES — custom element
 * trata a mera presença do atributo como "true", então não dá pra "desligar"
 * passando false; tem que não escrever o atributo).
 */

const VARIANTS = [
  { label: 'ORIGINAL',  src: '/models/TEST-FOXBOX-RAW.glb' },
  { label: 'M060 (metallic 0.6)',  src: '/models/material-fixed/TEST-FOXBOX-RAW.glb' },
  { label: 'M025 (metallic 0.25)', src: '/models/material-fixed/TEST-FOXBOX-M025.glb' },
  { label: 'NOTEX-A (sem textura · metallic 0.45 / roughness 0.65)', src: '/models/material-fixed/TEST-FOXBOX-NOTEX-A.glb' },
  { label: 'NOTEX-B (sem textura · metallic 0.20 / roughness 0.85)', src: '/models/material-fixed/TEST-FOXBOX-NOTEX-B.glb' },
];

export default function MaterialABLab() {
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
          Material A/B — Foxbox
        </div>
        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
          mesma câmera, mesma luz, mesmo tamanho — só o material muda
        </div>
        {!mvReady && !mvError && <div style={{ color: '#facc15', marginTop: 8 }}>Carregando model-viewer…</div>}
        {mvError && <div style={{ color: '#f87171', marginTop: 8 }}>{mvError}</div>}
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 280px))',
        gap: 16, justifyContent: 'center',
      }}>
        {VARIANTS.map((v) => (
          <div key={v.src} style={{
            background: '#151b23', borderRadius: 10, padding: 10,
            border: '1px solid rgba(255,255,255,0.12)',
          }}>
            {mvReady && (
              <model-viewer
                src={v.src}
                orientation="0deg 0deg -90deg"
                scale="2 2 2"
                camera-orbit="0deg 78deg 105%"
                field-of-view="26deg"
                shadow-intensity="0.8"
                exposure="1.0"
                tone-mapping="neutral"
                disable-zoom
                disable-tap
                style={{ width: '100%', height: 300, background: '#0b0f14', display: 'block' }}
              />
            )}
            {!mvReady && <div style={{ width: '100%', height: 300 }} />}
            <div style={{
              textAlign: 'center', marginTop: 8, fontSize: 13, fontWeight: 700,
              color: '#93c5fd',
            }}>
              {v.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

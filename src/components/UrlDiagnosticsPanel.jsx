import { useState } from 'react';

const PARAM_NAMES = ['productId', 'id', 'handle', 'product', 'variant', 'sku', 'slug'];

function analyzeUrl() {
  const params = new URLSearchParams(window.location.search);

  const allParams = {};
  params.forEach((v, k) => { allParams[k] = v; });

  const knownValues = {};
  PARAM_NAMES.forEach(k => {
    knownValues[k] = params.get(k);
  });

  const productId = params.get('productId');

  let paramUsed = null;
  let nullReason = null;

  if (productId) {
    paramUsed = 'productId';
  } else {
    const otherFound = PARAM_NAMES
      .filter(k => k !== 'productId')
      .find(k => params.get(k) !== null);

    if (!params.has('productId')) {
      nullReason = `Parâmetro "productId" não existe na URL.${otherFound ? ` Mas encontrado: "${otherFound}=${params.get(otherFound)}".` : ' Nenhum parâmetro de produto reconhecido.'}`;
    } else {
      nullReason = 'Parâmetro "productId" existe na URL mas está vazio ("").';
    }
  }

  return {
    href: window.location.href,
    search: window.location.search || '(sem parâmetros)',
    allParams,
    knownValues,
    paramUsed,
    productId,
    nullReason,
    totalParams: Object.keys(allParams).length,
  };
}

export default function UrlDiagnosticsPanel() {
  const [open, setOpen] = useState(true);

  const isDebug = new URLSearchParams(window.location.search).get('debug') === '1';
  if (!isDebug && !import.meta.env.DEV) return null;

  const d = analyzeUrl();
  const ok = !!d.productId;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 99999,
      fontFamily: 'monospace',
    }}>
      {/* Barra de status — sempre visível, clicável para expandir/recolher */}
      <div
        onClick={() => setOpen(v => !v)}
        style={{
          background: ok ? 'rgba(46,213,115,0.18)' : 'rgba(255,71,87,0.18)',
          borderBottom: `2px solid ${ok ? '#2ed573' : '#ff4757'}`,
          padding: '5px 12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.10em', color: ok ? '#2ed573' : '#ff4757' }}>
          URL DIAG M026 {ok
            ? `✓ productId="${d.productId}"`
            : `✗ sem productId (${d.totalParams} param${d.totalParams !== 1 ? 's' : ''} encontrado${d.totalParams !== 1 ? 's' : ''})`
          }
        </span>
        <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '11px' }}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div style={{
          background: 'rgba(0,0,20,0.97)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          padding: '8px 12px',
          maxHeight: '45vh',
          overflowY: 'auto',
          fontSize: '10px',
          color: '#bbb',
        }}>

          {/* URL completa */}
          <div style={{ marginBottom: '3px', wordBreak: 'break-all' }}>
            <span style={{ color: 'rgba(255,255,255,0.30)' }}>href: </span>
            <span style={{ color: '#aaa' }}>{d.href}</span>
          </div>
          <div style={{ marginBottom: '8px' }}>
            <span style={{ color: 'rgba(255,255,255,0.30)' }}>search: </span>
            <span style={{ color: d.search !== '(sem parâmetros)' ? '#aaa' : '#ff4757' }}>{d.search}</span>
          </div>

          {/* Todos os params encontrados */}
          <Section label={`TODOS OS PARAMS (${d.totalParams})`} />
          {d.totalParams === 0 ? (
            <div style={{ color: '#ff4757', marginBottom: '8px' }}>Nenhum parâmetro encontrado na URL</div>
          ) : (
            <div style={{ marginBottom: '8px' }}>
              {Object.entries(d.allParams).map(([k, v]) => (
                <div key={k}>
                  <span style={{ color: '#2ed573' }}>{k}</span>
                  <span style={{ color: 'rgba(255,255,255,0.25)' }}>=</span>
                  <span style={{ color: '#fff', fontWeight: 600 }}>{v}</span>
                </div>
              ))}
            </div>
          )}

          {/* Parâmetros de produto conhecidos */}
          <Section label="PARÂMETROS DE PRODUTO" />
          <div style={{ marginBottom: '8px' }}>
            {PARAM_NAMES.map(k => (
              <div key={k} style={{ display: 'flex', gap: '4px' }}>
                <span style={{ color: 'rgba(255,255,255,0.30)', minWidth: '72px', flexShrink: 0 }}>{k}:</span>
                <span style={{ color: d.knownValues[k] !== null ? '#2ed573' : '#444' }}>
                  {d.knownValues[k] !== null ? `"${d.knownValues[k]}"` : '— (ausente)'}
                </span>
              </div>
            ))}
          </div>

          {/* Diagnóstico do ProductAdapter */}
          <Section label="PRODUCT ADAPTER" />
          <div style={{ marginBottom: '4px' }}>
            <PRow label="método" value="ProductAdapter.fromUrlParams()" />
            <PRow
              label="param usado"
              value={d.paramUsed ?? 'nenhum'}
              color={d.paramUsed ? '#2ed573' : '#ff4757'}
            />
            <PRow
              label="productId"
              value={d.productId !== null ? `"${d.productId}"` : 'null'}
              color={d.productId ? '#2ed573' : '#ff4757'}
            />
          </div>
          {d.nullReason && (
            <div style={{
              marginTop: '6px',
              background: 'rgba(255,71,87,0.10)',
              border: '1px solid rgba(255,71,87,0.28)',
              borderRadius: '4px',
              padding: '6px 8px',
              color: '#ff6b6b',
              lineHeight: '1.5',
            }}>
              Por que null: {d.nullReason}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ label }) {
  return (
    <div style={{
      color: '#D4AF37',
      fontWeight: 700,
      fontSize: '10px',
      letterSpacing: '0.10em',
      marginBottom: '4px',
      borderTop: '1px solid rgba(255,255,255,0.07)',
      paddingTop: '6px',
    }}>
      {label}
    </div>
  );
}

function PRow({ label, value, color }) {
  return (
    <div style={{ display: 'flex', gap: '4px', marginBottom: '2px' }}>
      <span style={{ color: 'rgba(255,255,255,0.30)', minWidth: '90px', flexShrink: 0 }}>{label}:</span>
      <span style={{ color: color ?? '#aaa' }}>{value}</span>
    </div>
  );
}

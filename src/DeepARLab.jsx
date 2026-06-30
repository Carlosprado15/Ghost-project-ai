import { useEffect, useRef, useState, useCallback } from 'react';

const LICENSE_KEY = import.meta.env.VITE_DEEPAR_LICENSE_KEY;
const CDN_URL     = 'https://cdn.jsdelivr.net/npm/deepar/js/deepar.esm.js';

const MODES = {
  'smoke-face': {
    label:      'Smoke Test — Aviators',
    category:   'face',
    effectUrl:  'https://cdn.jsdelivr.net/npm/deepar/effects/aviators',
    facingMode: 'user',
    validated:  true,
    badge:      '✓ VALIDADO',
    badgeColor: '#16a34a',
  },
  'wrist-watch': {
    label:      'Wrist Investigation — Watch/Bracelet',
    category:   'wrist',
    effectUrl:  '',
    facingMode: 'environment',
    validated:  false,
    badge:      '⏳ AGUARDANDO EFEITO',
    badgeColor: '#d97706',
  },
};

const STATUS_LABELS = {
  'idle':              'aguardando',
  'missing-license':   'licença não configurada',
  'locked-no-effect':  'aguardando efeito wrist',
  'loading-sdk':       'carregando SDK…',
  'requesting-camera': 'solicitando câmera…',
  'running':           'rodando ✓',
  'error':             'erro',
};

const STATUS_COLORS = {
  'idle':              '#94a3b8',
  'missing-license':   '#f87171',
  'locked-no-effect':  '#d97706',
  'loading-sdk':       '#facc15',
  'requesting-camera': '#fbbf24',
  'running':           '#4ade80',
  'error':             '#f87171',
};

export default function DeepARLab() {
  const previewRef = useRef(null);
  const deepARRef  = useRef(null);

  const [selectedMode,    setSelectedMode]    = useState('smoke-face');
  const [manualEffectUrl, setManualEffectUrl] = useState('');
  const [status,          setStatus]          = useState('idle');
  const [logs,            setLogs]            = useState([]);
  const [errMsg,          setErrMsg]          = useState('');

  const addLog = useCallback((msg) => {
    setLogs(prev => [...prev.slice(-49), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  const handleModeChange = useCallback((mode) => {
    if (status === 'running' || status === 'loading-sdk' || status === 'requesting-camera') return;
    setSelectedMode(mode);
    setStatus('idle');
    setErrMsg('');
  }, [status]);

  const handleStart = useCallback(async () => {
    if (!LICENSE_KEY) { setStatus('missing-license'); return; }

    const mode      = MODES[selectedMode];
    const effectUrl = selectedMode === 'wrist-watch'
      ? (manualEffectUrl.trim() || mode.effectUrl)
      : mode.effectUrl;

    if (!effectUrl) {
      setStatus('locked-no-effect');
      addLog('Wrist mode requires a DeepAR wrist/watch effect URL before starting.');
      return;
    }

    setStatus('loading-sdk');
    setErrMsg('');

    if (selectedMode === 'smoke-face') {
      addLog('Starting DeepAR smoke test with aviators effect.');
    } else {
      addLog('Starting DeepAR wrist investigation with manual effect URL.');
    }

    try {
      const deeparMod = await import(/* @vite-ignore */ CDN_URL);
      addLog('SDK carregado.');

      setStatus('requesting-camera');
      addLog(`Câmera: ${mode.facingMode} | Efeito: ${effectUrl.split('/').pop()}`);

      const deepAR = await deeparMod.initialize({
        licenseKey: LICENSE_KEY,
        previewElement: previewRef.current,
        effect: effectUrl,
        additionalOptions: {
          cameraConfig: { facingMode: mode.facingMode },
        },
      });

      deepARRef.current = deepAR;
      setStatus('running');
      addLog('DeepAR inicializado com sucesso!');
    } catch (e) {
      setStatus('error');
      setErrMsg(e.message);
      addLog(`ERRO: ${e.message}`);
    }
  }, [selectedMode, manualEffectUrl, addLog]);

  const handleStop = useCallback(async () => {
    addLog('Parando DeepAR…');
    const deepAR = deepARRef.current;
    if (deepAR) {
      try {
        if (typeof deepAR.shutdown === 'function') {
          await deepAR.shutdown();
          addLog('deepAR.shutdown() concluído.');
        } else {
          addLog('deepAR.shutdown não disponível — limpando DOM.');
        }
      } catch (e) {
        addLog(`Aviso no shutdown: ${e.message}`);
      } finally {
        try { if (previewRef.current) previewRef.current.innerHTML = ''; } catch (_) {}
        deepARRef.current = null;
      }
    }
    setStatus('idle');
  }, [addLog]);

  useEffect(() => {
    return () => {
      const deepAR = deepARRef.current;
      if (deepAR) {
        try { if (typeof deepAR.shutdown === 'function') deepAR.shutdown(); } catch (_) {}
        try { if (previewRef.current) previewRef.current.innerHTML = ''; } catch (_) {}
        deepARRef.current = null;
      }
    };
  }, []);

  const mode      = MODES[selectedMode];
  const isMobile  = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isRunning = status === 'running';
  const isLoading = status === 'loading-sdk' || status === 'requesting-camera';
  const isMissing = status === 'missing-license';

  const resolvedEffectUrl = selectedMode === 'wrist-watch'
    ? (manualEffectUrl.trim() || mode.effectUrl)
    : mode.effectUrl;

  const hasManualEffectUrl = manualEffectUrl.trim().length > 0;
  const effectLabel        = resolvedEffectUrl
    ? resolvedEffectUrl.split('/').pop() || resolvedEffectUrl
    : 'não configurada';

  const panelBase = {
    background: 'rgba(0,0,0,0.82)',
    backdropFilter: 'blur(6px)',
    color: '#e2e8f0',
    borderRadius: 10,
    fontFamily: 'monospace',
    fontSize: 11,
    border: '1px solid rgba(255,255,255,0.08)',
  };

  const diagRows = [
    ['selectedMode',     selectedMode],
    ['selectedCategory', mode.category],
    ['cameraFacingMode', mode.facingMode],
    ['hasManualEffectUrl', hasManualEffectUrl ? 'sim' : 'não'],
    ['effectUrlLabel',   effectLabel],
    ['smokeTestStatus',  'passed-local'],
    ['wristModeStatus',  resolvedEffectUrl && selectedMode === 'wrist-watch' ? 'effect-set' : 'needs-wrist-effect'],
    ['hasLicenseKey',    LICENSE_KEY ? 'sim ✓' : 'NÃO ✗'],
    ['isMobile',         isMobile ? 'sim' : 'não'],
    ['sdkMode',          'cdn-dynamic-import'],
    ['route',            '?lab=deepar'],
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0a0a0a', overflow: 'hidden' }}>

      {/* DeepAR preview — always mounted so ref is valid */}
      <div
        ref={previewRef}
        style={{ position: 'absolute', inset: 0, visibility: isRunning ? 'visible' : 'hidden' }}
      />

      {/* ── Mode selector — top center ── */}
      {!isMissing && !isRunning && (
        <div style={{
          position: 'absolute', top: 14, left: '50%',
          transform: 'translateX(-50%)', zIndex: 10,
          display: 'flex', gap: 8,
        }}>
          {Object.entries(MODES).map(([key, m]) => (
            <button
              key={key}
              onClick={() => handleModeChange(key)}
              style={{
                padding: '7px 14px', borderRadius: 8, border: 'none',
                background: selectedMode === key ? '#7c3aed' : 'rgba(0,0,0,0.75)',
                color: '#e2e8f0', cursor: 'pointer', fontSize: 11,
                fontFamily: 'monospace', fontWeight: selectedMode === key ? 700 : 400,
                border: `1px solid ${selectedMode === key ? '#7c3aed' : 'rgba(255,255,255,0.12)'}`,
                backdropFilter: 'blur(6px)',
                whiteSpace: 'nowrap',
              }}
            >
              {m.label}
              <span style={{
                marginLeft: 6, fontSize: 9, color: m.badgeColor, fontWeight: 700,
              }}>
                {m.badge}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* ── Missing license screen ── */}
      {isMissing && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          padding: 24, zIndex: 20,
        }}>
          <div style={{ ...panelBase, padding: '28px 24px', maxWidth: 480, border: '2px solid #ef4444' }}>
            <div style={{ color: '#f87171', fontSize: 18, fontWeight: 700, marginBottom: 14 }}>
              ⚠ VITE_DEEPAR_LICENSE_KEY não configurada
            </div>
            <div style={{ lineHeight: 1.8, fontSize: 13, color: '#cbd5e1' }}>
              <p style={{ marginBottom: 10 }}>Para usar o DeepAR Lab:</p>
              <ol style={{ paddingLeft: 20, marginBottom: 12 }}>
                <li>Criar conta no <strong style={{ color: '#e2e8f0' }}>DeepAR Developer Portal</strong></li>
                <li>Criar uma <strong style={{ color: '#e2e8f0' }}>Web App</strong> no portal</li>
                <li>Cadastrar domínio:
                  <ul style={{ marginTop: 4, marginBottom: 4 }}>
                    <li><code style={{ color: '#93c5fd' }}>localhost</code></li>
                    <li><code style={{ color: '#93c5fd' }}>ghost-project-ai.vercel.app</code></li>
                  </ul>
                </li>
                <li>Copiar License Key e criar <code style={{ color: '#a78bfa' }}>.env.local</code>:<br />
                  <code style={{ color: '#a78bfa' }}>VITE_DEEPAR_LICENSE_KEY=sua_chave</code>
                </li>
                <li>Reiniciar: <code style={{ color: '#93c5fd' }}>npm run dev</code></li>
              </ol>
            </div>
            <button onClick={() => setStatus('idle')} style={{
              padding: '10px 20px', borderRadius: 8, border: 'none',
              background: '#374151', color: '#e2e8f0', cursor: 'pointer', fontSize: 14,
            }}>
              ← Voltar
            </button>
          </div>
        </div>
      )}

      {/* ── Wrist investigation info + manual URL input ── */}
      {!isMissing && !isRunning && selectedMode === 'wrist-watch' && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)', zIndex: 10,
          width: 'min(94%, 500px)',
        }}>
          <div style={{ ...panelBase, padding: '20px 20px', border: '2px solid #d97706' }}>
            <div style={{ color: '#fbbf24', fontWeight: 700, fontSize: 14, marginBottom: 10 }}>
              Wrist Investigation — Watch/Bracelet
            </div>
            <div style={{ color: '#cbd5e1', fontSize: 12, lineHeight: 1.7, marginBottom: 14 }}>
              <strong style={{ color: '#4ade80' }}>Smoke Test (aviators) APROVADO</strong> — SDK, câmera e render DeepAR validados localmente.<br /><br />
              O modo Wrist/Watch está preparado, mas ainda precisa de um <strong style={{ color: '#fbbf24' }}>efeito DeepAR de pulso/relógio real</strong>.<br /><br />
              O efeito <code style={{ color: '#93c5fd' }}>aviators</code> prova SDK/câmera/render, mas não testa tracking de pulso.
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 6 }}>
                Effect URL manual para teste (opcional):
              </div>
              <input
                type="text"
                value={manualEffectUrl}
                onChange={e => setManualEffectUrl(e.target.value)}
                placeholder="https://cdn.jsdelivr.net/npm/deepar/effects/..."
                style={{
                  width: '100%', padding: '9px 12px', borderRadius: 7,
                  border: '1px solid rgba(255,255,255,0.15)',
                  background: 'rgba(255,255,255,0.06)',
                  color: '#e2e8f0', fontSize: 12, fontFamily: 'monospace',
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
              {hasManualEffectUrl && (
                <div style={{ color: '#4ade80', fontSize: 10, marginTop: 4 }}>
                  ✓ URL manual configurada — câmera: {mode.facingMode}
                </div>
              )}
              {!hasManualEffectUrl && (
                <div style={{ color: '#d97706', fontSize: 10, marginTop: 4 }}>
                  Sem URL → botão iniciar desabilitado. Cole uma URL de efeito wrist/watch para testar.
                </div>
              )}
            </div>

            <div style={{ ...panelBase, padding: '8px 12px', fontSize: 10, lineHeight: 1.6, background: 'rgba(0,0,0,0.5)' }}>
              <div style={{ color: '#a78bfa', fontWeight: 700, marginBottom: 4 }}>Onde obter um efeito wrist/watch:</div>
              <div>• DeepAR Developer Portal → Asset Store</div>
              <div>• Demo oficial wrist watch (verificar em developer.deepar.ai)</div>
              <div>• ShopAR / DeepAR ShopAR Try-On efeito watch</div>
              <div>• Solicitar ao suporte DeepAR efeito de teste</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Status panel — top left ── */}
      {!isMissing && (
        <div style={{ ...panelBase, position: 'absolute', top: isRunning ? 14 : 64, left: 14, zIndex: 10, padding: '10px 14px', maxWidth: 240 }}>
          <div style={{ color: '#a78bfa', fontWeight: 'bold', fontSize: 12, marginBottom: 6 }}>
            DeepAR Lab — M068C
          </div>
          <div>status: <span style={{ color: STATUS_COLORS[status] }}>{STATUS_LABELS[status]}</span></div>
          {errMsg && (
            <div style={{ color: '#f87171', marginTop: 6, wordBreak: 'break-word', fontSize: 10, lineHeight: 1.5 }}>
              {errMsg}
            </div>
          )}
        </div>
      )}

      {/* ── Diagnostics — top right ── */}
      {!isMissing && (
        <div style={{ ...panelBase, position: 'absolute', top: isRunning ? 14 : 64, right: 14, zIndex: 10, padding: '10px 14px', width: 230 }}>
          <div style={{ color: '#a78bfa', fontWeight: 'bold', fontSize: 12, marginBottom: 6 }}>Diagnóstico</div>
          {diagRows.map(([k, v]) => (
            <div key={k}>
              <span style={{ color: '#94a3b8' }}>{k}: </span>
              <span style={{
                color: (k === 'hasLicenseKey' && !LICENSE_KEY) || (k === 'wristModeStatus' && v === 'needs-wrist-effect')
                  ? '#f87171'
                  : k === 'smokeTestStatus' || v === 'effect-set' ? '#4ade80' : '#93c5fd',
              }}>
                {v}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Logs ── */}
      {logs.length > 0 && !isMissing && (
        <div style={{
          ...panelBase,
          position: 'absolute', bottom: 114, left: 14, right: 14, zIndex: 10,
          padding: '8px 12px', maxHeight: 110, overflowY: 'auto',
        }}>
          {logs.map((l, i) => (
            <div key={i} style={{
              color: l.includes('ERRO') ? '#f87171' : l.includes('sucesso') || l.includes('smoke test') ? '#4ade80' : '#e2e8f0',
              fontSize: 10, marginBottom: 2,
            }}>
              {l}
            </div>
          ))}
        </div>
      )}

      {/* ── Bottom controls ── */}
      {!isMissing && (
        <div style={{
          position: 'absolute', bottom: 28, left: '50%',
          transform: 'translateX(-50%)', zIndex: 10,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
        }}>
          {!isRunning ? (
            <button
              onClick={handleStart}
              disabled={isLoading || (selectedMode === 'wrist-watch' && !resolvedEffectUrl)}
              style={{
                padding: '16px 40px', borderRadius: 10, border: 'none',
                background: selectedMode === 'smoke-face' ? '#16a34a' : '#b45309',
                color: '#fff',
                cursor: (isLoading || (selectedMode === 'wrist-watch' && !resolvedEffectUrl)) ? 'default' : 'pointer',
                fontSize: 17, fontFamily: 'sans-serif', fontWeight: 700,
                opacity: (isLoading || (selectedMode === 'wrist-watch' && !resolvedEffectUrl)) ? 0.45 : 1,
                boxShadow: isLoading ? 'none' : selectedMode === 'smoke-face'
                  ? '0 0 20px rgba(22,163,74,0.4)'
                  : '0 0 20px rgba(180,83,9,0.4)',
              }}
            >
              {isLoading
                ? STATUS_LABELS[status]
                : selectedMode === 'smoke-face'
                  ? 'INICIAR SMOKE TEST'
                  : 'INICIAR WRIST INVESTIGATION'}
            </button>
          ) : (
            <button
              onClick={handleStop}
              style={{
                padding: '14px 36px', borderRadius: 10, border: 'none',
                background: '#dc2626', color: '#fff', cursor: 'pointer',
                fontSize: 16, fontFamily: 'sans-serif', fontWeight: 700,
              }}
            >
              PARAR
            </button>
          )}
          <button
            onClick={() => window.history.back()}
            style={{
              padding: '10px 22px', borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(0,0,0,0.6)', color: '#e2e8f0',
              cursor: 'pointer', fontSize: 14, fontFamily: 'sans-serif',
            }}
          >
            ← Voltar
          </button>
        </div>
      )}
    </div>
  );
}

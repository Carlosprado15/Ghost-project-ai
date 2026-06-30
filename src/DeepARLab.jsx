import { useEffect, useRef, useState, useCallback } from 'react';

const LICENSE_KEY = import.meta.env.VITE_DEEPAR_LICENSE_KEY;
const EFFECT_URL  = 'https://cdn.jsdelivr.net/npm/deepar/effects/aviators';
const CDN_URL     = 'https://cdn.jsdelivr.net/npm/deepar/js/deepar.esm.js';

const STATUS_LABELS = {
  'idle':             'aguardando',
  'missing-license':  'licença não configurada',
  'loading-sdk':      'carregando SDK…',
  'requesting-camera':'solicitando câmera…',
  'running':          'rodando ✓',
  'error':            'erro',
};

const STATUS_COLORS = {
  'idle':             '#94a3b8',
  'missing-license':  '#f87171',
  'loading-sdk':      '#facc15',
  'requesting-camera':'#fbbf24',
  'running':          '#4ade80',
  'error':            '#f87171',
};

export default function DeepARLab() {
  const previewRef = useRef(null);
  const deepARRef  = useRef(null);

  const [status, setStatus] = useState('idle');
  const [logs,   setLogs]   = useState([]);
  const [errMsg, setErrMsg] = useState('');

  const addLog = useCallback((msg) => {
    setLogs(prev => [...prev.slice(-49), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  const handleStart = useCallback(async () => {
    if (!LICENSE_KEY) { setStatus('missing-license'); return; }

    setStatus('loading-sdk');
    setErrMsg('');
    addLog('Carregando DeepAR SDK via CDN…');

    try {
      const deeparMod = await import(/* @vite-ignore */ CDN_URL);
      addLog('SDK carregado.');

      setStatus('requesting-camera');
      addLog('Inicializando DeepAR + câmera…');

      const deepAR = await deeparMod.initialize({
        licenseKey: LICENSE_KEY,
        previewElement: previewRef.current,
        effect: EFFECT_URL,
        additionalOptions: {
          cameraConfig: { facingMode: 'environment' },
        },
      });

      deepARRef.current = deepAR;
      setStatus('running');
      addLog('DeepAR inicializado com sucesso!');
      addLog(`Efeito ativo: aviators`);
    } catch (e) {
      setStatus('error');
      setErrMsg(e.message);
      addLog(`ERRO: ${e.message}`);
    }
  }, [addLog]);

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

  const isMobile   = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isRunning  = status === 'running';
  const isLoading  = status === 'loading-sdk' || status === 'requesting-camera';
  const isMissing  = status === 'missing-license';

  const panelBase = {
    background: 'rgba(0,0,0,0.82)',
    backdropFilter: 'blur(6px)',
    color: '#e2e8f0',
    borderRadius: 10,
    fontFamily: 'monospace',
    fontSize: 11,
    border: '1px solid rgba(255,255,255,0.08)',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0a0a0a', overflow: 'hidden' }}>

      {/* DeepAR preview area — always mounted so ref is always valid */}
      <div
        ref={previewRef}
        style={{
          position: 'absolute', inset: 0,
          visibility: isRunning ? 'visible' : 'hidden',
        }}
      />

      {/* ── Missing license screen ── */}
      {isMissing && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          padding: 24, zIndex: 20,
        }}>
          <div style={{
            ...panelBase,
            padding: '28px 24px', maxWidth: 480,
            border: '2px solid #ef4444',
          }}>
            <div style={{ color: '#f87171', fontSize: 18, fontWeight: 700, marginBottom: 14 }}>
              ⚠ VITE_DEEPAR_LICENSE_KEY não configurada
            </div>
            <div style={{ lineHeight: 1.8, fontSize: 13, color: '#cbd5e1' }}>
              <p style={{ marginBottom: 10 }}>Para usar o DeepAR Lab:</p>
              <ol style={{ paddingLeft: 20, marginBottom: 12 }}>
                <li>Criar conta no <strong style={{ color: '#e2e8f0' }}>DeepAR Developer Portal</strong></li>
                <li>Criar uma <strong style={{ color: '#e2e8f0' }}>Web App</strong> no portal</li>
                <li>Cadastrar domínio (sem https, sem path):
                  <ul style={{ marginTop: 4, marginBottom: 4 }}>
                    <li><code style={{ color: '#93c5fd' }}>localhost</code> — desenvolvimento local</li>
                    <li><code style={{ color: '#93c5fd' }}>ghost-project-ai.vercel.app</code> — Vercel</li>
                  </ul>
                </li>
                <li>Copiar a License Key gerada</li>
                <li>Criar <code style={{ color: '#93c5fd' }}>.env.local</code> na raiz:<br />
                  <code style={{ color: '#a78bfa' }}>VITE_DEEPAR_LICENSE_KEY=sua_chave</code>
                </li>
                <li>Reiniciar: <code style={{ color: '#93c5fd' }}>npm run dev</code></li>
              </ol>
            </div>
            <button
              onClick={() => setStatus('idle')}
              style={{
                padding: '10px 20px', borderRadius: 8, border: 'none',
                background: '#374151', color: '#e2e8f0', cursor: 'pointer', fontSize: 14,
              }}
            >
              ← Voltar
            </button>
          </div>
        </div>
      )}

      {/* ── Status panel — top left ── */}
      {!isMissing && (
        <div style={{ ...panelBase, position: 'absolute', top: 14, left: 14, zIndex: 10, padding: '10px 14px', maxWidth: 240 }}>
          <div style={{ color: '#a78bfa', fontWeight: 'bold', fontSize: 12, marginBottom: 6 }}>
            DeepAR Lab — M068A
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
        <div style={{ ...panelBase, position: 'absolute', top: 14, right: 14, zIndex: 10, padding: '10px 14px', width: 226 }}>
          <div style={{ color: '#a78bfa', fontWeight: 'bold', fontSize: 12, marginBottom: 6 }}>Diagnóstico</div>
          {[
            ['isMobile',      isMobile ? 'sim' : 'não'],
            ['hasLicenseKey', LICENSE_KEY ? 'sim ✓' : 'NÃO ✗'],
            ['sdkMode',       'cdn-dynamic-import'],
            ['route',         '?lab=deepar'],
            ['effect',        'aviators'],
          ].map(([k, v]) => (
            <div key={k}>
              <span style={{ color: '#94a3b8' }}>{k}: </span>
              <span style={{ color: k === 'hasLicenseKey' && !LICENSE_KEY ? '#f87171' : '#93c5fd' }}>{v}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Logs — above bottom controls ── */}
      {logs.length > 0 && !isMissing && (
        <div style={{
          ...panelBase,
          position: 'absolute', bottom: 114, left: 14, right: 14, zIndex: 10,
          padding: '8px 12px', maxHeight: 130, overflowY: 'auto',
        }}>
          {logs.map((l, i) => (
            <div key={i} style={{
              color: l.includes('ERRO') ? '#f87171' : l.includes('sucesso') ? '#4ade80' : '#e2e8f0',
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
              disabled={isLoading}
              style={{
                padding: '16px 40px', borderRadius: 10, border: 'none',
                background: '#16a34a', color: '#fff', cursor: isLoading ? 'default' : 'pointer',
                fontSize: 17, fontFamily: 'sans-serif', fontWeight: 700,
                opacity: isLoading ? 0.6 : 1,
                boxShadow: isLoading ? 'none' : '0 0 20px rgba(22,163,74,0.4)',
              }}
            >
              {isLoading ? STATUS_LABELS[status] : 'INICIAR TESTE DEEPAR'}
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

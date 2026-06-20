/**
 * GhostDiagnostics — painel interno de diagnóstico técnico.
 * Acessível apenas em modo desenvolvimento (import.meta.env.DEV).
 * Etapas 1, 2 e 4 da Missão 015.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { ProductAdapter } from '../sdk/product-adapter.js';
import { GhostProject } from '../sdk/GhostProject.js';

const APP_VERSION = '1.0.0';

// ── Funções de verificação individuais ─────────────────────────────────────

async function checkMediaPipe() {
  const loaded = typeof window.Hands !== 'undefined';
  return {
    name: 'MediaPipe',
    status: loaded ? 'ok' : 'warn',
    description: loaded ? 'Carregado' : 'Não carregado (normal antes do scanner)',
  };
}

async function checkModelViewer() {
  const defined = typeof customElements !== 'undefined' &&
    customElements.get('model-viewer') !== undefined;
  return {
    name: 'model-viewer',
    status: defined ? 'ok' : 'warn',
    description: defined ? 'Elemento registrado' : 'Não registrado ainda (carrega sob demanda)',
  };
}

async function checkWebGL() {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl) {
      const renderer = gl.getParameter(gl.RENDERER) || '';
      return { name: 'WebGL', status: 'ok', description: `Disponível — ${renderer.slice(0, 40)}` };
    }
    return { name: 'WebGL', status: 'error', description: 'Contexto WebGL indisponível' };
  } catch {
    return { name: 'WebGL', status: 'error', description: 'Erro ao criar contexto WebGL' };
  }
}

async function checkCamera() {
  const hasApi = !!(navigator.mediaDevices?.getUserMedia);
  if (!hasApi) {
    return { name: 'Câmera', status: 'error', description: 'getUserMedia não disponível' };
  }
  try {
    if (navigator.permissions) {
      const perm = await navigator.permissions.query({ name: 'camera' }).catch(() => null);
      if (perm) {
        const map = { granted: 'ok', prompt: 'warn', denied: 'error' };
        const labels = { granted: 'Permissão concedida', prompt: 'Aguardando permissão', denied: 'Permissão negada' };
        return { name: 'Câmera', status: map[perm.state] ?? 'warn', description: labels[perm.state] ?? perm.state };
      }
    }
    return { name: 'Câmera', status: 'ok', description: 'getUserMedia disponível' };
  } catch {
    return { name: 'Câmera', status: 'warn', description: 'getUserMedia disponível (permissão desconhecida)' };
  }
}

function checkWristTracker(trackerRef) {
  const ok = !!(trackerRef?.current);
  return { name: 'WristTracker', status: ok ? 'ok' : 'error', description: ok ? 'Inicializado' : 'Não inicializado' };
}

function checkRenderPipeline(pipelineRef) {
  const inst = pipelineRef?.current;
  if (!inst) return { name: 'RenderPipeline', status: 'error', description: 'Não instanciado' };
  const active = inst.isActive?.() ?? false;
  return { name: 'RenderPipeline', status: 'ok', description: active ? 'Ativo (loop rAF rodando)' : 'Instanciado (parado — fora do scanner)' };
}

function checkPrecisionFit(precisionFitRef) {
  const ok = !!(precisionFitRef?.current);
  return { name: 'PrecisionFitController', status: ok ? 'ok' : 'error', description: ok ? 'Ativo' : 'Não inicializado' };
}

function checkImagePipeline(imagePipelineRef) {
  const inst = imagePipelineRef?.current;
  if (!inst) return { name: 'ImageToModelPipeline', status: 'error', description: 'Não inicializado' };
  return { name: 'ImageToModelPipeline', status: 'ok', description: `Estado: ${inst.state ?? 'IDLE'}` };
}

function checkProviderMeshy(imagePipelineRef) {
  const providers = imagePipelineRef?.current?.providerSelector?.getAll?.() ?? [];
  const found = providers.find(p => p.name?.toLowerCase().includes('meshy'));
  return {
    name: 'Provider Meshy',
    status: found ? 'ok' : 'warn',
    description: found ? 'Registrado (prioridade 10)' : 'Não registrado',
  };
}

function checkProviderTripo(imagePipelineRef) {
  const providers = imagePipelineRef?.current?.providerSelector?.getAll?.() ?? [];
  const found = providers.find(p => p.name?.toLowerCase().includes('tripo'));
  return {
    name: 'Provider Tripo',
    status: found ? 'ok' : 'warn',
    description: found ? 'Registrado (prioridade 5, fallback)' : 'Não registrado',
  };
}

function checkProductAdapter() {
  try {
    const active = ProductAdapter.getActive();
    const hasProduct = !!(active?.productId || active?.modelUrl);
    return {
      name: 'ProductAdapter',
      status: 'ok',
      description: hasProduct ? `Produto: ${active.productId}` : 'Inicializado (sem produto ativo)',
    };
  } catch (e) {
    return { name: 'ProductAdapter', status: 'error', description: `Erro: ${e.message}` };
  }
}

function checkGhostSDK() {
  try {
    const ok = typeof GhostProject?.on === 'function' &&
      typeof GhostProject?.off === 'function' &&
      typeof GhostProject?._emit === 'function';
    return {
      name: 'GhostProject SDK',
      status: ok ? 'ok' : 'error',
      description: ok ? 'Inicializado com on/off/_emit' : 'Métodos ausentes',
    };
  } catch (e) {
    return { name: 'GhostProject SDK', status: 'error', description: `Erro: ${e.message}` };
  }
}

function checkIndexedDB() {
  const ok = typeof window.indexedDB !== 'undefined';
  return {
    name: 'IndexedDB',
    status: ok ? 'ok' : 'warn',
    description: ok ? 'Disponível' : 'Indisponível — usando fallback em memória',
  };
}

function checkLocalStorage() {
  try {
    localStorage.setItem('__ghost_diag__', '1');
    localStorage.removeItem('__ghost_diag__');
    return { name: 'localStorage', status: 'ok', description: 'Disponível' };
  } catch {
    return { name: 'localStorage', status: 'error', description: 'Indisponível — assets não serão persistidos' };
  }
}

function checkCryptoSubtle() {
  const ok = !!(window.crypto?.subtle);
  return {
    name: 'crypto.subtle',
    status: ok ? 'ok' : 'warn',
    description: ok ? 'SHA-256 ativo (cache content-addressable)' : 'Indisponível — hash por metadata (requer HTTPS)',
  };
}

function checkNavigatorShare() {
  const ok = typeof navigator.share === 'function';
  return {
    name: 'navigator.share',
    status: ok ? 'ok' : 'warn',
    description: ok ? 'Disponível' : 'Indisponível — screenshot usa download automático',
  };
}

function checkScreenshot() {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1; canvas.height = 1;
    const ok = typeof canvas.toBlob === 'function' && !!canvas.getContext('2d');
    return {
      name: 'Screenshot',
      status: ok ? 'ok' : 'error',
      description: ok ? 'canvas.toBlob disponível' : 'canvas API indisponível',
    };
  } catch {
    return { name: 'Screenshot', status: 'error', description: 'Erro ao verificar canvas' };
  }
}

function checkHTTPS() {
  const proto = location.protocol;
  const host = location.hostname;
  const secure = proto === 'https:' || host === 'localhost' || host === '127.0.0.1';
  return {
    name: 'HTTPS',
    status: secure ? 'ok' : 'warn',
    description: secure ? `${proto}//${host}` : 'HTTP — câmera e crypto.subtle podem estar bloqueados',
  };
}

// ── Executor de todos os checks ─────────────────────────────────────────────

async function runAllChecks(refs) {
  const { trackerRef, pipelineRef, precisionFitRef, imagePipelineRef } = refs;

  const results = await Promise.all([
    checkMediaPipe(),
    checkModelViewer(),
    checkWebGL(),
    checkCamera(),
    Promise.resolve(checkWristTracker(trackerRef)),
    Promise.resolve(checkRenderPipeline(pipelineRef)),
    Promise.resolve(checkPrecisionFit(precisionFitRef)),
    Promise.resolve(checkImagePipeline(imagePipelineRef)),
    Promise.resolve(checkProviderMeshy(imagePipelineRef)),
    Promise.resolve(checkProviderTripo(imagePipelineRef)),
    Promise.resolve(checkProductAdapter()),
    Promise.resolve(checkGhostSDK()),
    Promise.resolve(checkIndexedDB()),
    Promise.resolve(checkLocalStorage()),
    Promise.resolve(checkCryptoSubtle()),
    Promise.resolve(checkNavigatorShare()),
    Promise.resolve(checkScreenshot()),
    Promise.resolve(checkHTTPS()),
  ]);

  return results;
}

// ── Componente principal ────────────────────────────────────────────────────

export default function GhostDiagnostics({
  trackerRef,
  pipelineRef,
  precisionFitRef,
  imagePipelineRef,
  perfMetrics,
  healthIssues,
}) {
  const [open, setOpen] = useState(false);
  const [checks, setChecks] = useState([]);
  const [running, setRunning] = useState(false);
  const [fps, setFps] = useState(0);
  const [memory, setMemory] = useState(null);
  const fpsIntervalRef = useRef(null);

  const refresh = useCallback(async () => {
    setRunning(true);
    try {
      const results = await runAllChecks({ trackerRef, pipelineRef, precisionFitRef, imagePipelineRef });
      setChecks(results);
    } finally {
      setRunning(false);
    }
  }, [trackerRef, pipelineRef, precisionFitRef, imagePipelineRef]);

  useEffect(() => {
    if (!open) return;
    refresh();
  }, [open, refresh]);

  useEffect(() => {
    if (!open) return;
    fpsIntervalRef.current = setInterval(() => {
      const f = pipelineRef?.current?.getFPS?.() ?? 0;
      setFps(f);
      if (performance.memory) {
        setMemory(Math.round(performance.memory.usedJSHeapSize / 1024 / 1024));
      }
    }, 1000);
    return () => clearInterval(fpsIntervalRef.current);
  }, [open, pipelineRef]);

  const okCount    = checks.filter(c => c.status === 'ok').length;
  const warnCount  = checks.filter(c => c.status === 'warn').length;
  const errorCount = checks.filter(c => c.status === 'error').length;
  const allOk      = checks.length > 0 && errorCount === 0;

  const fmt = (ms) => ms != null ? `${(ms / 1000).toFixed(1)}s` : '—';

  return (
    <>
      {/* Botão flutuante de acesso */}
      <button
        onClick={() => setOpen(v => !v)}
        title="Ghost Diagnostics"
        style={{
          position: 'fixed',
          bottom: '62px',
          right: '12px',
          zIndex: 9999,
          background: open
            ? 'rgba(212,175,55,0.18)'
            : allOk
              ? 'rgba(46,213,115,0.10)'
              : errorCount > 0
                ? 'rgba(255,71,87,0.14)'
                : 'rgba(0,0,0,0.60)',
          border: `1px solid ${open ? 'rgba(212,175,55,0.55)' : errorCount > 0 ? 'rgba(255,71,87,0.4)' : 'rgba(255,255,255,0.14)'}`,
          borderRadius: '8px',
          padding: '5px 10px',
          color: open ? '#D4AF37' : errorCount > 0 ? '#ff6b6b' : 'rgba(255,255,255,0.45)',
          fontSize: '10px',
          letterSpacing: '0.1em',
          fontWeight: 700,
          cursor: 'pointer',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          fontFamily: 'monospace',
          userSelect: 'none',
        }}
      >
        DIAG {checks.length > 0 && (errorCount > 0 ? `🔴${errorCount}` : warnCount > 0 ? `🟡` : '🟢')}
      </button>

      {/* Painel de diagnóstico */}
      {open && (
        <div style={{
          position: 'fixed',
          bottom: '108px',
          right: '12px',
          width: '300px',
          maxHeight: '72vh',
          overflowY: 'auto',
          background: 'rgba(6,6,10,0.96)',
          border: '1px solid rgba(212,175,55,0.22)',
          borderRadius: '12px',
          padding: '14px 14px 10px',
          zIndex: 9998,
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          fontFamily: 'monospace',
          fontSize: '11px',
          color: '#ccc',
          boxShadow: '0 16px 48px rgba(0,0,0,0.8)',
        }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div>
              <span style={{ color: '#D4AF37', fontWeight: 700, letterSpacing: '0.14em', fontSize: '11px' }}>
                GHOST DIAGNOSTICS
              </span>
              <span style={{ color: 'rgba(255,255,255,0.28)', marginLeft: '8px', fontSize: '10px' }}>
                v{APP_VERSION}
              </span>
            </div>
            <button
              onClick={refresh}
              disabled={running}
              title="Atualizar"
              style={{
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.10)',
                borderRadius: '6px',
                color: running ? '#555' : '#aaa',
                fontSize: '12px',
                padding: '2px 7px',
                cursor: running ? 'wait' : 'pointer',
              }}
            >
              {running ? '…' : '↺'}
            </button>
          </div>

          {/* Summary */}
          {checks.length > 0 && (
            <div style={{
              display: 'flex',
              gap: '12px',
              marginBottom: '10px',
              fontSize: '10px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '6px',
              padding: '5px 10px',
            }}>
              <span style={{ color: '#2ed573' }}>🟢 {okCount} OK</span>
              <span style={{ color: '#ffa502' }}>🟡 {warnCount} Atenção</span>
              <span style={{ color: '#ff4757' }}>🔴 {errorCount} Falha</span>
            </div>
          )}

          {/* Health issues (auto health check Etapa 2) */}
          {healthIssues?.length > 0 && (
            <div style={{
              marginBottom: '10px',
              background: 'rgba(255,71,87,0.08)',
              border: '1px solid rgba(255,71,87,0.22)',
              borderRadius: '6px',
              padding: '7px 10px',
            }}>
              <div style={{ color: '#ff6b6b', fontWeight: 700, fontSize: '10px', marginBottom: '4px', letterSpacing: '0.08em' }}>
                AUTO HEALTH CHECK
              </div>
              {healthIssues.map((issue, i) => (
                <div key={i} style={{ color: 'rgba(255,255,255,0.55)', fontSize: '10px', padding: '1px 0' }}>
                  🔴 {issue}
                </div>
              ))}
            </div>
          )}

          {/* Checks list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {running && checks.length === 0 && (
              <div style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '16px 0', fontSize: '10px' }}>
                Executando verificações…
              </div>
            )}
            {checks.map((c, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '6px',
                  padding: '4px 0',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                }}
              >
                <span style={{ flexShrink: 0, fontSize: '9px', lineHeight: '18px' }}>
                  {c.status === 'ok' ? '🟢' : c.status === 'warn' ? '🟡' : '🔴'}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    color: c.status === 'ok' ? '#ddd' : c.status === 'warn' ? '#ffa502' : '#ff6b6b',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    fontSize: '11px',
                  }}>
                    {c.name}
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.36)', fontSize: '9px', lineHeight: '13px' }}>
                    {c.description}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Performance metrics (Etapa 4) */}
          <div style={{
            marginTop: '12px',
            borderTop: '1px solid rgba(255,255,255,0.07)',
            paddingTop: '10px',
          }}>
            <div style={{ color: '#D4AF37', fontWeight: 700, marginBottom: '6px', letterSpacing: '0.12em', fontSize: '10px' }}>
              PERFORMANCE
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>

              <Row label="FPS médio" value={fps || '—'} color={fps >= 30 ? '#2ed573' : fps >= 15 ? '#ffa502' : fps > 0 ? '#ff4757' : '#555'} />

              {memory !== null && (
                <Row label="Memória JS" value={`${memory} MB`} color={memory < 100 ? '#2ed573' : memory < 200 ? '#ffa502' : '#ff4757'} />
              )}

              {perfMetrics?.scannerOpenTime != null && (
                <Row label="Abertura scanner" value={fmt(perfMetrics.scannerOpenTime)} color="#aaa" />
              )}

              {perfMetrics?.timeToTracking != null && (
                <Row label="Tempo p/ tracking" value={fmt(perfMetrics.timeToTracking)} color={perfMetrics.timeToTracking < 3000 ? '#2ed573' : '#ffa502'} />
              )}

              {perfMetrics?.timeToModel != null && (
                <Row label="Tempo p/ modelo" value={fmt(perfMetrics.timeToModel)} color="#aaa" />
              )}

              {perfMetrics?.glbGenerationTime != null && (
                <Row label="Geração GLB" value={fmt(perfMetrics.glbGenerationTime)} color={perfMetrics.glbGenerationTime < 30000 ? '#2ed573' : '#ffa502'} />
              )}

              {perfMetrics?.firstRenderTime != null && (
                <Row label="1ª renderização" value={fmt(perfMetrics.firstRenderTime)} color="#aaa" />
              )}
            </div>
          </div>

          <div style={{ marginTop: '10px', color: 'rgba(255,255,255,0.14)', fontSize: '9px', textAlign: 'center', letterSpacing: '0.06em' }}>
            DEV ONLY — não visível em produção
          </div>
        </div>
      )}
    </>
  );
}

function Row({ label, value, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px' }}>{label}</span>
      <span style={{ color: color ?? '#aaa', fontSize: '10px', fontWeight: 600 }}>{value}</span>
    </div>
  );
}

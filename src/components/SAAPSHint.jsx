import { useEffect, useState } from 'react';

/**
 * SAAPS - Smart Assisted AR Positioning System
 * Ghost Project AI — Versão: Foundation 1.0
 *
 * ESTADO: ARQUITETURA PREPARADA — NÃO ATIVADO
 *
 * Este componente exibe a dica visual de refinamento
 * após o primeiro posicionamento automático da IA.
 *
 * Quando ativar:
 * - Importar em App_FINAL.jsx
 * - Passar prop `visible={tracking && firstPositionDetected}`
 * - Passar prop `mode="body"` ou `mode="environment"`
 *
 * REGRA PERMANENTE:
 * - Escala do produto é protegida — nunca exposta ao usuário
 * - Apenas posição e orientação podem ser refinadas
 */

const HINT_DURATION = 2000; // 2 segundos

const gestures = {
  body: [
    { id: 'horizontal', label: 'offset-horizontal', angle: 0 },
    { id: 'vertical', label: 'offset-vertical', angle: 90 },
    { id: 'rotate', label: 'angular', angle: 45 },
  ],
  environment: [
    { id: 'drag', label: 'arrastar', angle: 0 },
    { id: 'reposition', label: 'reposicionar', angle: 45 },
    { id: 'rotate', label: 'rotacionar', angle: 90 },
  ],
};

function PinchIcon({ angle = 0 }) {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      style={{
        transform: `rotate(${angle}deg)`,
        transition: 'transform 0.3s ease',
      }}
    >
      {/* Dedo 1 */}
      <circle
        cx="14"
        cy="24"
        r="8"
        fill="rgba(255,255,255,0.15)"
        stroke="rgba(255,255,255,0.6)"
        strokeWidth="1.5"
      />
      {/* Dedo 2 */}
      <circle
        cx="34"
        cy="24"
        r="8"
        fill="rgba(255,255,255,0.15)"
        stroke="rgba(255,255,255,0.6)"
        strokeWidth="1.5"
      />
      {/* Linha de conexão */}
      <line
        x1="22"
        y1="24"
        x2="26"
        y2="24"
        stroke="rgba(255,255,255,0.3)"
        strokeWidth="1"
        strokeDasharray="2 2"
      />
    </svg>
  );
}

export default function SAAPSHint({ visible = false, mode = 'body' }) {
  const [show, setShow] = useState(false);
  const [gestureIndex, setGestureIndex] = useState(0);
  const [opacity, setOpacity] = useState(0);

  const currentGestures = gestures[mode] || gestures.body;

  useEffect(() => {
    if (!visible) {
      setShow(false);
      setOpacity(0);
      setGestureIndex(0);
      return;
    }

    // Aparece com fade in
    setShow(true);
    const fadeIn = setTimeout(() => setOpacity(1), 50);

    // Cicla gestos
    const cycleInterval = setInterval(() => {
      setGestureIndex(prev =>
        prev < currentGestures.length - 1 ? prev + 1 : 0
      );
    }, HINT_DURATION / currentGestures.length);

    // Desaparece após duração total
    const fadeOut = setTimeout(() => {
      setOpacity(0);
      setTimeout(() => setShow(false), 400);
    }, HINT_DURATION);

    return () => {
      clearTimeout(fadeIn);
      clearTimeout(fadeOut);
      clearInterval(cycleInterval);
    };
  }, [visible, mode]);

  if (!show) return null;

  const currentGesture = currentGestures[gestureIndex];

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '120px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
        opacity,
        transition: 'opacity 0.4s ease',
        pointerEvents: 'none',
      }}
    >
      {/* Ícone de pinça */}
      <div
        style={{
          background: 'rgba(0,0,0,0.25)',
          backdropFilter: 'blur(8px)',
          borderRadius: '50%',
          padding: '12px',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <PinchIcon angle={currentGesture.angle} />
      </div>

      {/* Indicador de modo — apenas ponto, sem texto */}
      <div style={{ display: 'flex', gap: '4px' }}>
        {currentGestures.map((_, i) => (
          <div
            key={i}
            style={{
              width: '4px',
              height: '4px',
              borderRadius: '50%',
              background:
                i === gestureIndex
                  ? 'rgba(255,255,255,0.8)'
                  : 'rgba(255,255,255,0.2)',
              transition: 'background 0.3s ease',
            }}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * SAAPS ROADMAP — FUTURAS IMPLEMENTAÇÕES
 *
 * FASE 2 — Gestos reais:
 * - Touch events: onTouchStart, onTouchMove, onTouchEnd
 * - Detectar pinça (dois dedos)
 * - Detectar rotação (dois dedos girando)
 * - Aplicar offset em X e Y no modelo
 * - Aplicar rotação fina no modelo
 *
 * FASE 3 — Persistência:
 * - Salvar preferências do usuário por produto
 * - Spatial Passport™ integration
 *
 * FASE 4 — Ambiente:
 * - Modo Environment™
 * - Arrastar sobre superfície detectada
 * - Reancorar em nova superfície
 *
 * ESCALA PROTEGIDA — NUNCA EXPOR AO USUÁRIO:
 * - watchScaleFactor
 * - minWatchSize / maxWatchSize
 * - anatomicalDistance
 */
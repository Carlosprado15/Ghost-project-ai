import { useState, useRef, useEffect, useCallback } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────
const STAGES = {
  IDLE: "idle",
  LOADING: "loading",
  ACTIVE: "active",
  ERROR: "error",
};

const FACING = {
  REAR: "environment",
  FRONT: "user",
};

// ─── SVG Icons ────────────────────────────────────────────────────────────────
const IconFlipCamera = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 7h-3a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2Z"/>
    <path d="M15 13a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/>
    <path d="M18 4 l2 3 -2 3"/>
  </svg>
);

const IconClose = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const IconScan = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/>
    <path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
    <line x1="7" y1="12" x2="17" y2="12"/>
  </svg>
);

// ─── Ghost Logo Mark (SVG inline) ─────────────────────────────────────────────
const GhostMark = ({ size = 48 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
    <defs>
      <linearGradient id="gGold" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#f0d060"/>
        <stop offset="50%" stopColor="#d4af37"/>
        <stop offset="100%" stopColor="#a07828"/>
      </linearGradient>
      <filter id="gGlow">
        <feGaussianBlur stdDeviation="3" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    {/* Outer G letter form */}
    <path d="M72 25 A32 32 0 1 0 72 75 L72 52 L56 52 L56 62 L62 62 L62 70 A24 24 0 1 1 62 30 L62 25 Z"
      fill="url(#gGold)" filter="url(#gGlow)" opacity="0.9"/>
    {/* Inner negative space accent */}
    <rect x="58" y="50" width="16" height="2" fill="#0a101f" opacity="0.6"/>
  </svg>
);

// ─── AR Corner Brackets ───────────────────────────────────────────────────────
const ARBrackets = () => (
  <div style={{position:'absolute',inset:0,pointerEvents:'none',zIndex:2}}>
    {[
      {top:12,left:12,borderTop:'2px solid',borderLeft:'2px solid'},
      {top:12,right:12,borderTop:'2px solid',borderRight:'2px solid'},
      {bottom:12,left:12,borderBottom:'2px solid',borderLeft:'2px solid'},
      {bottom:12,right:12,borderBottom:'2px solid',borderRight:'2px solid'},
    ].map((style, i) => (
      <div key={i} style={{
        position:'absolute', width:24, height:24,
        borderColor:'rgba(212,175,55,0.7)', ...style
      }}/>
    ))}
    {/* Center crosshair */}
    <div style={{
      position:'absolute',top:'50%',left:'50%',
      transform:'translate(-50%,-50%)',
      width:40,height:40,
      border:'1px solid rgba(212,175,55,0.25)',
      borderRadius:'50%',
    }}>
      <div style={{position:'absolute',top:'50%',left:0,right:0,height:'1px',background:'rgba(212,175,55,0.3)',transform:'translateY(-50%)'}}/>
      <div style={{position:'absolute',left:'50%',top:0,bottom:0,width:'1px',background:'rgba(212,175,55,0.3)',transform:'translateX(-50%)'}}/>
    </div>
  </div>
);

// ─── Scan Line Animation ──────────────────────────────────────────────────────
const ScanLine = () => (
  <div style={{
    position:'absolute',left:0,right:0,height:'2px',
    background:'linear-gradient(90deg, transparent, rgba(212,175,55,0.6), transparent)',
    animation:'scanline 3s ease-in-out infinite',
    zIndex:3,pointerEvents:'none',
  }}/>
);

// ─── CSS Animation Keyframes injected once ────────────────────────────────────
const GLOBAL_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@300;400;500;600;700&family=Share+Tech+Mono&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  html, body, #root {
    height: 100%;
    width: 100%;
    overflow: hidden;
    background: #060d1a;
  }

  @keyframes scanline {
    0%   { top: 10%; opacity: 0; }
    10%  { opacity: 1; }
    90%  { opacity: 1; }
    100% { top: 90%; opacity: 0; }
  }

  @keyframes pulseRing {
    0%, 100% { transform: scale(1); opacity: 0.6; }
    50%       { transform: scale(1.08); opacity: 1; }
  }

  @keyframes fadeSlideUp {
    from { opacity: 0; transform: translateY(24px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  @keyframes spinSlow {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }

  @keyframes blinkDot {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.2; }
  }

  @keyframes flipIn {
    from { opacity: 0; transform: scale(0.92); }
    to   { opacity: 1; transform: scale(1); }
  }

  .gp-btn {
    font-family: 'Share Tech Mono', monospace;
    letter-spacing: 0.18em;
    cursor: pointer;
    border: none;
    outline: none;
    transition: all 0.25s ease;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
    user-select: none;
  }
  .gp-btn:active { transform: scale(0.97); }
`;

// ─── Main App Component ───────────────────────────────────────────────────────
export default function App() {
  const [stage, setStage]       = useState(STAGES.IDLE);
  const [facing, setFacing]     = useState(FACING.REAR);
  const [errorMsg, setErrorMsg] = useState("");
  const videoRef   = useRef(null);
  const streamRef  = useRef(null);

  // Inject global styles once
  useEffect(() => {
    const existing = document.getElementById("ghost-global-styles");
    if (existing) return;
    const tag = document.createElement("style");
    tag.id = "ghost-global-styles";
    tag.textContent = GLOBAL_STYLES;
    document.head.appendChild(tag);
  }, []);

  // ── Camera control ──────────────────────────────────────────────────────────
  const startStream = useCallback(async (facingMode) => {
    // Stop any existing stream first
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }

    const constraints = {
      audio: false,
      video: {
        facingMode: { ideal: facingMode },
        width:  { ideal: 1920 },
        height: { ideal: 1080 },
      },
    };

    // Fallback: try exact, then any
    let stream = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      } catch (fallbackErr) {
        throw fallbackErr;
      }
    }

    streamRef.current = stream;

    // Wait for video element to be in DOM, then attach
    await new Promise(resolve => {
      const attach = () => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play().catch(() => {});
            resolve();
          };
        } else {
          setTimeout(attach, 80);
        }
      };
      attach();
    });
  }, []);

  const handleActivate = async () => {
    setStage(STAGES.LOADING);
    setErrorMsg("");
    try {
      await startStream(facing);
      setStage(STAGES.ACTIVE);
    } catch (err) {
      const msg = err.name === "NotAllowedError"
        ? "ACESSO À CÂMERA NEGADO. VERIFIQUE AS PERMISSÕES DO NAVEGADOR."
        : err.name === "NotFoundError"
        ? "NENHUMA CÂMERA ENCONTRADA NESTE DISPOSITIVO."
        : "ERRO AO INICIALIZAR A CÂMERA. TENTE NOVAMENTE.";
      setErrorMsg(msg);
      setStage(STAGES.ERROR);
    }
  };

  const handleFlip = async () => {
    const next = facing === FACING.REAR ? FACING.FRONT : FACING.REAR;
    setFacing(next);
    if (stage === STAGES.ACTIVE) {
      try {
        await startStream(next);
      } catch {
        // silently keep current stream if flip fails
        setFacing(facing);
      }
    }
  };

  const handleDeactivate = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setStage(STAGES.IDLE);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []);

  // ── Mirror only front camera ────────────────────────────────────────────────
  const videoMirror = facing === FACING.FRONT ? "scaleX(-1)" : "none";

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{
      position: "fixed",
      inset: 0,
      backgroundColor: "#060d1a",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Rajdhani', 'Share Tech Mono', sans-serif",
      overflow: "hidden",
    }}>
      {/* Grid background */}
      <div style={{
        position:"absolute", inset:0, pointerEvents:"none",
        backgroundImage:`
          linear-gradient(rgba(212,175,55,0.035) 1px, transparent 1px),
          linear-gradient(90deg, rgba(212,175,55,0.035) 1px, transparent 1px)
        `,
        backgroundSize:"44px 44px",
        zIndex:0,
      }}/>
      {/* Radial glow */}
      <div style={{
        position:"absolute", top:"50%", left:"50%",
        transform:"translate(-50%,-50%)",
        width:"70vmax", height:"70vmax",
        background:"radial-gradient(circle, rgba(212,175,55,0.055) 0%, transparent 65%)",
        pointerEvents:"none", zIndex:0,
      }}/>

      {/* ── IDLE SCREEN ─────────────────────────────────────────────── */}
      {stage === STAGES.IDLE && (
        <div style={{
          position:"relative", zIndex:1,
          display:"flex", flexDirection:"column",
          alignItems:"center", justifyContent:"center",
          padding:"48px 28px",
          width:"100%", maxWidth:"380px",
          animation:"fadeSlideUp 0.6s ease both",
        }}>
          {/* Logo area */}
          <div style={{position:"relative", marginBottom:"36px"}}>
            {/* Spinning outer ring */}
            <div style={{
              position:"absolute", inset:"-16px",
              border:"1px dashed rgba(212,175,55,0.2)",
              borderRadius:"50%",
              animation:"spinSlow 16s linear infinite",
            }}/>
            {/* Pulse ring */}
            <div style={{
              position:"absolute", inset:"-6px",
              border:"1px solid rgba(212,175,55,0.35)",
              borderRadius:"50%",
              animation:"pulseRing 2.8s ease-in-out infinite",
            }}/>
            {/* Logo container */}
            <div style={{
              width:"80px", height:"80px",
              borderRadius:"50%",
              background:"linear-gradient(135deg, rgba(212,175,55,0.12), rgba(212,175,55,0.04))",
              border:"1.5px solid rgba(212,175,55,0.45)",
              display:"flex", alignItems:"center", justifyContent:"center",
              boxShadow:"0 0 32px rgba(212,175,55,0.15), inset 0 1px 0 rgba(255,255,255,0.05)",
            }}>
              <GhostMark size={42} />
            </div>
          </div>

          {/* Title */}
          <div style={{textAlign:"center", marginBottom:"8px"}}>
            <div style={{
              fontSize:"clamp(22px,6vw,30px)",
              fontWeight:700,
              letterSpacing:"0.32em",
              color:"#d4af37",
              textShadow:"0 0 40px rgba(212,175,55,0.35)",
              fontFamily:"'Rajdhani', sans-serif",
              lineHeight:1,
            }}>
              GHOST PROJECT
            </div>
            <div style={{
              fontSize:"9px",
              letterSpacing:"0.52em",
              color:"rgba(212,175,55,0.45)",
              marginTop:"8px",
              fontFamily:"'Share Tech Mono', monospace",
            }}>
              AI · AR · E-COMMERCE TECHNOLOGY
            </div>
          </div>

          {/* Divider */}
          <div style={{
            width:"100%", height:"1px",
            background:"linear-gradient(90deg, transparent, rgba(212,175,55,0.25), transparent)",
            margin:"28px 0",
          }}/>

          {/* Descriptor */}
          <div style={{
            textAlign:"center",
            color:"rgba(212,175,55,0.5)",
            fontSize:"11px",
            letterSpacing:"0.12em",
            lineHeight:"1.7",
            fontFamily:"'Share Tech Mono', monospace",
            marginBottom:"36px",
          }}>
            VISUALIZAÇÃO 3D EM REALIDADE AUMENTADA<br/>
            VALIDAÇÃO DE PRODUTO EM TEMPO REAL
          </div>

          {/* CTA Button */}
          <button
            className="gp-btn"
            onClick={handleActivate}
            style={{
              width:"100%",
              padding:"17px 32px",
              borderRadius:"4px",
              border:"1.5px solid rgba(212,175,55,0.6)",
              background:"linear-gradient(135deg, rgba(212,175,55,0.14) 0%, rgba(212,175,55,0.04) 100%)",
              color:"#d4af37",
              fontSize:"12px",
              boxShadow:"0 0 24px rgba(212,175,55,0.08)",
            }}
          >
            ◈ ATIVAR GHOST AI
          </button>

          {/* Camera mode selector */}
          <div style={{
            marginTop:"20px",
            display:"flex",
            gap:"10px",
            alignItems:"center",
          }}>
            {[FACING.REAR, FACING.FRONT].map(f => (
              <button
                key={f}
                className="gp-btn"
                onClick={() => setFacing(f)}
                style={{
                  padding:"8px 16px",
                  borderRadius:"3px",
                  border:`1px solid ${facing===f ? "rgba(212,175,55,0.55)" : "rgba(212,175,55,0.15)"}`,
                  background: facing===f ? "rgba(212,175,55,0.1)" : "transparent",
                  color: facing===f ? "#d4af37" : "rgba(212,175,55,0.35)",
                  fontSize:"9px",
                }}
              >
                {f === FACING.REAR ? "TRASEIRA" : "FRONTAL"}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── LOADING SCREEN ──────────────────────────────────────────── */}
      {stage === STAGES.LOADING && (
        <div style={{
          position:"relative", zIndex:1,
          display:"flex", flexDirection:"column",
          alignItems:"center", gap:"20px",
          animation:"fadeSlideUp 0.4s ease both",
        }}>
          {/* Spinner */}
          <div style={{
            width:"56px", height:"56px",
            borderRadius:"50%",
            border:"1.5px solid rgba(212,175,55,0.15)",
            borderTop:"1.5px solid rgba(212,175,55,0.7)",
            animation:"spinSlow 1s linear infinite",
          }}/>
          <div style={{
            color:"rgba(212,175,55,0.65)",
            fontSize:"11px",
            letterSpacing:"0.35em",
            fontFamily:"'Share Tech Mono', monospace",
          }}>
            INICIALIZANDO<span style={{animation:"blinkDot 1s infinite 0s"}}>.</span>
            <span style={{animation:"blinkDot 1s infinite 0.3s"}}>.</span>
            <span style={{animation:"blinkDot 1s infinite 0.6s"}}>.</span>
          </div>
        </div>
      )}

      {/* ── ACTIVE / AR VIEW ────────────────────────────────────────── */}
      {stage === STAGES.ACTIVE && (
        <div style={{
          position:"fixed", inset:0, zIndex:10,
          display:"flex", flexDirection:"column",
          background:"#000",
          animation:"flipIn 0.35s ease both",
        }}>
          {/* Video feed — fills entire screen */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              position:"absolute", inset:0,
              width:"100%", height:"100%",
              objectFit:"cover",
              transform: videoMirror,
              backgroundColor:"#000",
            }}
          />

          {/* AR overlay layer */}
          <div style={{position:"absolute",inset:0,zIndex:2,pointerEvents:"none"}}>
            {/* Scan line */}
            <ScanLine />
            {/* Corner brackets */}
            <ARBrackets />
            {/* Top HUD */}
            <div style={{
              position:"absolute", top:0, left:0, right:0,
              padding:"env(safe-area-inset-top, 16px) 20px 16px",
              background:"linear-gradient(to bottom, rgba(6,13,26,0.75), transparent)",
              display:"flex", alignItems:"center", justifyContent:"space-between",
            }}>
              <div style={{display:"flex", alignItems:"center", gap:"10px"}}>
                <GhostMark size={24}/>
                <div>
                  <div style={{
                    fontSize:"11px", fontWeight:700, letterSpacing:"0.28em",
                    color:"#d4af37", fontFamily:"'Rajdhani',sans-serif",
                  }}>
                    GHOST PROJECT
                  </div>
                  <div style={{
                    fontSize:"8px", letterSpacing:"0.3em",
                    color:"rgba(212,175,55,0.5)",
                    fontFamily:"'Share Tech Mono',monospace",
                  }}>
                    AR · ATIVO
                  </div>
                </div>
              </div>
              {/* Live indicator */}
              <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
                <div style={{
                  width:6, height:6, borderRadius:"50%",
                  background:"#4ade80",
                  boxShadow:"0 0 8px rgba(74,222,128,0.8)",
                  animation:"blinkDot 1.5s ease-in-out infinite",
                }}/>
                <span style={{
                  fontSize:"9px",letterSpacing:"0.25em",
                  color:"rgba(74,222,128,0.9)",
                  fontFamily:"'Share Tech Mono',monospace",
                }}>LIVE</span>
              </div>
            </div>
          </div>

          {/* Controls overlay (bottom) — pointer events ON */}
          <div style={{
            position:"absolute", bottom:0, left:0, right:0, zIndex:3,
            padding:"20px 20px env(safe-area-inset-bottom, 28px)",
            background:"linear-gradient(to top, rgba(6,13,26,0.85) 0%, transparent 100%)",
            display:"flex", alignItems:"center", justifyContent:"center", gap:"20px",
          }}>
            {/* Deactivate */}
            <button
              className="gp-btn"
              onClick={handleDeactivate}
              title="Desativar"
              style={{
                width:"48px", height:"48px",
                borderRadius:"50%",
                border:"1.5px solid rgba(212,175,55,0.35)",
                background:"rgba(212,175,55,0.08)",
                color:"rgba(212,175,55,0.7)",
                display:"flex", alignItems:"center", justifyContent:"center",
              }}
            >
              <IconClose />
            </button>

            {/* Scan / Validate (placeholder for AR anchor) */}
            <button
              className="gp-btn"
              title="Validar Produto"
              style={{
                width:"68px", height:"68px",
                borderRadius:"50%",
                border:"2px solid #d4af37",
                background:"linear-gradient(135deg, rgba(212,175,55,0.2), rgba(212,175,55,0.06))",
                color:"#d4af37",
                display:"flex", alignItems:"center", justifyContent:"center",
                boxShadow:"0 0 28px rgba(212,175,55,0.2)",
              }}
            >
              <IconScan />
            </button>

            {/* Flip camera */}
            <button
              className="gp-btn"
              onClick={handleFlip}
              title="Trocar câmera"
              style={{
                width:"48px", height:"48px",
                borderRadius:"50%",
                border:"1.5px solid rgba(212,175,55,0.35)",
                background:"rgba(212,175,55,0.08)",
                color:"rgba(212,175,55,0.7)",
                display:"flex", alignItems:"center", justifyContent:"center",
              }}
            >
              <IconFlipCamera />
            </button>
          </div>
        </div>
      )}

      {/* ── ERROR SCREEN ────────────────────────────────────────────── */}
      {stage === STAGES.ERROR && (
        <div style={{
          position:"relative", zIndex:1,
          display:"flex", flexDirection:"column",
          alignItems:"center", gap:"20px",
          padding:"0 32px", maxWidth:"340px",
          textAlign:"center",
          animation:"fadeSlideUp 0.4s ease both",
        }}>
          <div style={{
            fontSize:"28px", color:"rgba(212,175,55,0.3)",
            lineHeight:1,
          }}>⊘</div>
          <div style={{
            color:"rgba(212,175,55,0.8)",
            fontSize:"11px",
            letterSpacing:"0.15em",
            lineHeight:"1.75",
            fontFamily:"'Share Tech Mono',monospace",
          }}>
            {errorMsg}
          </div>
          <button
            className="gp-btn"
            onClick={() => setStage(STAGES.IDLE)}
            style={{
              padding:"13px 28px",
              borderRadius:"3px",
              border:"1px solid rgba(212,175,55,0.4)",
              background:"rgba(212,175,55,0.07)",
              color:"rgba(212,175,55,0.75)",
              fontSize:"10px",
              letterSpacing:"0.25em",
              marginTop:"8px",
            }}
          >
            TENTAR NOVAMENTE
          </button>
        </div>
      )}
    </div>
  );
}

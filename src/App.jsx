import { useState, useRef, useEffect, useCallback } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────
const STAGES = {
  IDLE: "idle",
  LOADING: "loading",
  ACTIVE: "active",
  ERROR: "error",
};

// ─── SVG Icons ────────────────────────────────────────────────────────────────
const IconFlipCamera = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 7h-3a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2Z"/>
    <circle cx="12" cy="13" r="3"/>
    <path d="M15 2l2 3-2 3"/>
  </svg>
);

const IconClose = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const IconScan = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/>
    <path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
    <line x1="7" y1="12" x2="17" y2="12"/>
  </svg>
);

const GhostMark = ({ size = 48 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
    <defs>
      <linearGradient id="gGold" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#f0d060"/>
        <stop offset="50%" stopColor="#d4af37"/>
        <stop offset="100%" stopColor="#a07828"/>
      </linearGradient>
    </defs>
    <path d="M72 25 A32 32 0 1 0 72 75 L72 52 L56 52 L56 62 L62 62 L62 70 A24 24 0 1 1 62 30 L62 25 Z"
      fill="url(#gGold)" opacity="0.9"/>
  </svg>
);

const ARBrackets = () => (
  <div style={{position:'absolute',inset:0,pointerEvents:'none',zIndex:2}}>
    {[
      {top:12,left:12,borderTop:'2px solid',borderLeft:'2px solid'},
      {top:12,right:12,borderTop:'2px solid',borderRight:'2px solid'},
      {bottom:12,left:12,borderBottom:'2px solid',borderLeft:'2px solid'},
      {bottom:12,right:12,borderBottom:'2px solid',borderRight:'2px solid'},
    ].map((s, i) => (
      <div key={i} style={{position:'absolute',width:24,height:24,borderColor:'rgba(212,175,55,0.7)',...s}}/>
    ))}
  </div>
);

const ScanLine = () => (
  <div style={{
    position:'absolute',left:0,right:0,height:'2px',
    background:'linear-gradient(90deg,transparent,rgba(212,175,55,0.55),transparent)',
    animation:'scanline 3s ease-in-out infinite',
    zIndex:3,pointerEvents:'none',
  }}/>
);

// ─── Global styles injected once ─────────────────────────────────────────────
const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;600;700&family=Share+Tech+Mono&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html,body,#root{height:100%;width:100%;overflow:hidden;background:#060d1a;}
@keyframes scanline{0%{top:8%;opacity:0}10%{opacity:1}90%{opacity:1}100%{top:92%;opacity:0}}
@keyframes pulseRing{0%,100%{transform:scale(1);opacity:.5}50%{transform:scale(1.07);opacity:1}}
@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.15}}
@keyframes flipIn{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:scale(1)}}
.gp-btn{font-family:'Share Tech Mono',monospace;letter-spacing:.18em;cursor:pointer;border:none;outline:none;transition:opacity .2s,transform .15s;-webkit-tap-highlight-color:transparent;touch-action:manipulation;user-select:none;}
.gp-btn:active{transform:scale(.96);opacity:.8;}
.gp-btn:focus-visible{outline:2px solid rgba(212,175,55,.6);outline-offset:3px;}
`;

// ─── Camera cascade: tries multiple constraint sets for max compatibility ─────
async function getCameraStream(facingMode) {
  const strategies = [
    // 1. Ideal hint — most compatible across Android/iOS/WebView
    { video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
    // 2. Exact facing — forces the specific camera
    { video: { facingMode: { exact: facingMode } }, audio: false },
    // 3. No constraints at all — opens whatever camera is available
    { video: true, audio: false },
  ];

  let lastError;
  for (const constraints of strategies) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (stream) return stream;
    } catch (e) {
      lastError = e;
      // Permission denied is final — no point trying other strategies
      if (e.name === "NotAllowedError" || e.name === "PermissionDeniedError") throw e;
    }
  }
  throw lastError || new Error("NoCameraAvailable");
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function App() {
  const [stage,     setStage]     = useState(STAGES.IDLE);
  const [facing,    setFacing]    = useState("environment");
  const [errorMsg,  setErrorMsg]  = useState("");
  const [mirrored,  setMirrored]  = useState(false);
  const videoRef  = useRef(null);
  const streamRef = useRef(null);

  // Inject CSS once on mount
  useEffect(() => {
    if (document.getElementById("gp-global")) return;
    const s = document.createElement("style");
    s.id = "gp-global";
    s.textContent = GLOBAL_CSS;
    document.head.appendChild(s);
  }, []);

  // Cleanup on unmount
  useEffect(() => () => {
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
  }, []);

  // ── Stop current stream ───────────────────────────────────────────────────
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  // ── Attach stream to <video> with retry for delayed DOM mount ─────────────
  const attachStream = useCallback((stream) => {
    let tries = 0;
    const attempt = () => {
      const v = videoRef.current;
      if (v) {
        v.srcObject = stream;
        v.setAttribute("playsinline", "");
        v.setAttribute("webkit-playsinline", "");
        v.muted = true;
        v.play().catch(() => {}); // Autoplay policy: play() may be blocked silently
      } else if (tries++ < 20) {
        setTimeout(attempt, 100);
      }
    };
    attempt();
  }, []);

  // ── Start camera + detect actual facing for mirror logic ─────────────────
  const startCamera = useCallback(async (facingMode) => {
    stopStream();
    const stream = await getCameraStream(facingMode);
    streamRef.current = stream;
    // Read actual facingMode from the track (more reliable than what we requested)
    const track    = stream.getVideoTracks()[0];
    const settings = track?.getSettings?.() ?? {};
    setMirrored((settings.facingMode ?? facingMode) === "user");
    return stream;
  }, [stopStream]);

  // ── Activate ──────────────────────────────────────────────────────────────
  const handleActivate = async () => {
    setStage(STAGES.LOADING);
    setErrorMsg("");
    try {
      const stream = await startCamera(facing);
      setStage(STAGES.ACTIVE);
      setTimeout(() => attachStream(stream), 80);
    } catch (err) {
      const name = err.name || "";
      let msg;
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        msg = "ACESSO À CÂMERA NEGADO.\n\nPASSOS:\n1. Toque no cadeado 🔒 na barra de endereço\n2. Toque em Permissões\n3. Câmera → Permitir\n4. Recarregue a página";
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        msg = "NENHUMA CÂMERA ENCONTRADA NESTE DISPOSITIVO.";
      } else if (name === "NotReadableError" || name === "TrackStartError") {
        msg = "CÂMERA EM USO POR OUTRO APP.\nFeche o app que está usando a câmera e tente novamente.";
      } else {
        msg = `ERRO AO ACESSAR A CÂMERA.\n(${name || err.message || "Desconhecido"})`;
      }
      setErrorMsg(msg);
      setStage(STAGES.ERROR);
    }
  };

  // ── Flip camera ───────────────────────────────────────────────────────────
  const handleFlip = async () => {
    const next = facing === "environment" ? "user" : "environment";
    setFacing(next);
    if (stage === STAGES.ACTIVE) {
      try {
        const stream = await startCamera(next);
        attachStream(stream);
      } catch {
        setFacing(facing); // Revert if flip fails
      }
    }
  };

  // ── Deactivate ────────────────────────────────────────────────────────────
  const handleDeactivate = () => {
    stopStream();
    setStage(STAGES.IDLE);
  };

  // ── Colors ────────────────────────────────────────────────────────────────
  const C   = "#d4af37";
  const DIM = "rgba(212,175,55,0.45)";

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{
      position:"fixed", inset:0,
      backgroundColor:"#060d1a",
      display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center",
      fontFamily:"'Rajdhani','Share Tech Mono',sans-serif",
      overflow:"hidden",
    }}>
      {/* Grid background */}
      <div style={{
        position:"absolute", inset:0, pointerEvents:"none",
        backgroundImage:`
          linear-gradient(rgba(212,175,55,.032) 1px,transparent 1px),
          linear-gradient(90deg,rgba(212,175,55,.032) 1px,transparent 1px)`,
        backgroundSize:"44px 44px", zIndex:0,
      }}/>
      <div style={{
        position:"absolute", top:"50%", left:"50%",
        transform:"translate(-50%,-50%)",
        width:"80vmax", height:"80vmax",
        background:"radial-gradient(circle,rgba(212,175,55,.05) 0%,transparent 65%)",
        pointerEvents:"none", zIndex:0,
      }}/>

      {/* ══ IDLE ════════════════════════════════════════════════════════ */}
      {stage === STAGES.IDLE && (
        <div style={{
          position:"relative", zIndex:1,
          display:"flex", flexDirection:"column",
          alignItems:"center", padding:"40px 28px",
          width:"100%", maxWidth:"380px",
          animation:"fadeUp .55s ease both",
        }}>
          {/* Logo */}
          <div style={{position:"relative", marginBottom:"32px"}}>
            <div style={{
              position:"absolute", inset:"-14px",
              border:"1px dashed rgba(212,175,55,.17)", borderRadius:"50%",
              animation:"spin 18s linear infinite",
            }}/>
            <div style={{
              position:"absolute", inset:"-5px",
              border:"1px solid rgba(212,175,55,.28)", borderRadius:"50%",
              animation:"pulseRing 2.8s ease-in-out infinite",
            }}/>
            <div style={{
              width:"78px", height:"78px", borderRadius:"50%",
              background:"linear-gradient(135deg,rgba(212,175,55,.12),rgba(212,175,55,.04))",
              border:"1.5px solid rgba(212,175,55,.44)",
              display:"flex", alignItems:"center", justifyContent:"center",
              boxShadow:"0 0 28px rgba(212,175,55,.12)",
            }}>
              <GhostMark size={40}/>
            </div>
          </div>

          {/* Title */}
          <div style={{textAlign:"center", marginBottom:"6px"}}>
            <div style={{
              fontSize:"clamp(20px,5.5vw,28px)", fontWeight:700,
              letterSpacing:".3em", color:C,
              textShadow:"0 0 36px rgba(212,175,55,.28)",
              fontFamily:"'Rajdhani',sans-serif", lineHeight:1,
            }}>GHOST PROJECT</div>
            <div style={{
              fontSize:"9px", letterSpacing:".46em", color:DIM,
              marginTop:"7px", fontFamily:"'Share Tech Mono',monospace",
            }}>AI · AR · E-COMMERCE</div>
          </div>

          <div style={{
            width:"100%", height:"1px",
            background:"linear-gradient(90deg,transparent,rgba(212,175,55,.2),transparent)",
            margin:"22px 0",
          }}/>

          <div style={{
            textAlign:"center", color:DIM, fontSize:"10px",
            letterSpacing:".1em", lineHeight:"1.75",
            fontFamily:"'Share Tech Mono',monospace", marginBottom:"30px",
          }}>
            VISUALIZAÇÃO 3D EM REALIDADE AUMENTADA<br/>
            VALIDAÇÃO DE PRODUTO EM TEMPO REAL
          </div>

          {/* CTA */}
          <button className="gp-btn" onClick={handleActivate} style={{
            width:"100%", padding:"17px 24px", borderRadius:"4px",
            border:"1.5px solid rgba(212,175,55,.54)",
            background:"linear-gradient(135deg,rgba(212,175,55,.13),rgba(212,175,55,.04))",
            color:C, fontSize:"12px",
            boxShadow:"0 0 20px rgba(212,175,55,.07)",
          }}>
            ◈ &nbsp;ATIVAR GHOST AI
          </button>

          {/* Camera selector */}
          <div style={{marginTop:"16px", display:"flex", gap:"10px"}}>
            {["environment","user"].map(f => (
              <button key={f} className="gp-btn" onClick={() => setFacing(f)} style={{
                padding:"9px 18px", borderRadius:"3px",
                border:`1px solid ${facing===f?"rgba(212,175,55,.5)":"rgba(212,175,55,.13)"}`,
                background:facing===f?"rgba(212,175,55,.09)":"transparent",
                color:facing===f?C:"rgba(212,175,55,.3)", fontSize:"9px",
              }}>
                {f==="environment" ? "TRASEIRA" : "FRONTAL"}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ══ LOADING ══════════════════════════════════════════════════════ */}
      {stage === STAGES.LOADING && (
        <div style={{
          position:"relative", zIndex:1,
          display:"flex", flexDirection:"column",
          alignItems:"center", gap:"22px",
          animation:"fadeUp .35s ease both",
        }}>
          <div style={{
            width:"54px", height:"54px", borderRadius:"50%",
            border:"1.5px solid rgba(212,175,55,.13)",
            borderTop:"1.5px solid rgba(212,175,55,.75)",
            animation:"spin .9s linear infinite",
          }}/>
          <div style={{
            color:"rgba(212,175,55,.58)", fontSize:"10px",
            letterSpacing:".3em", fontFamily:"'Share Tech Mono',monospace",
          }}>
            INICIALIZANDO
            <span style={{animation:"blink 1s infinite 0s"}}>.</span>
            <span style={{animation:"blink 1s infinite .3s"}}>.</span>
            <span style={{animation:"blink 1s infinite .6s"}}>.</span>
          </div>
        </div>
      )}

      {/* ══ ACTIVE — AR VIEW ════════════════════════════════════════════ */}
      {stage === STAGES.ACTIVE && (
        <div style={{
          position:"fixed", inset:0, zIndex:10,
          background:"#000",
          animation:"flipIn .3s ease both",
        }}>
          {/* Camera feed */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              position:"absolute", inset:0,
              width:"100%", height:"100%",
              objectFit:"cover",
              transform: mirrored ? "scaleX(-1)" : "none",
              background:"#000",
            }}
          />

          {/* AR overlay (no pointer events) */}
          <div style={{position:"absolute",inset:0,zIndex:2,pointerEvents:"none"}}>
            <ScanLine/>
            <ARBrackets/>
            {/* Top HUD */}
            <div style={{
              position:"absolute", top:0, left:0, right:0,
              padding:"max(env(safe-area-inset-top,14px),14px) 20px 16px",
              background:"linear-gradient(to bottom,rgba(6,13,26,.78),transparent)",
              display:"flex", alignItems:"center", justifyContent:"space-between",
            }}>
              <div style={{display:"flex",alignItems:"center",gap:"9px"}}>
                <GhostMark size={22}/>
                <div>
                  <div style={{fontSize:"11px",fontWeight:700,letterSpacing:".26em",color:C,fontFamily:"'Rajdhani',sans-serif"}}>GHOST PROJECT</div>
                  <div style={{fontSize:"8px",letterSpacing:".28em",color:"rgba(212,175,55,.45)",fontFamily:"'Share Tech Mono',monospace"}}>AR · ATIVO</div>
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:"5px"}}>
                <div style={{width:6,height:6,borderRadius:"50%",background:"#4ade80",boxShadow:"0 0 8px rgba(74,222,128,.9)",animation:"blink 1.6s ease-in-out infinite"}}/>
                <span style={{fontSize:"9px",letterSpacing:".22em",color:"rgba(74,222,128,.85)",fontFamily:"'Share Tech Mono',monospace"}}>LIVE</span>
              </div>
            </div>
          </div>

          {/* Bottom controls (pointer events ON) */}
          <div style={{
            position:"absolute", bottom:0, left:0, right:0, zIndex:3,
            padding:`20px 20px max(env(safe-area-inset-bottom,24px),24px)`,
            background:"linear-gradient(to top,rgba(6,13,26,.88),transparent)",
            display:"flex", alignItems:"center", justifyContent:"center", gap:"22px",
          }}>
            <button className="gp-btn" onClick={handleDeactivate} style={{
              width:"48px",height:"48px",borderRadius:"50%",
              border:"1.5px solid rgba(212,175,55,.3)",
              background:"rgba(212,175,55,.07)",
              color:"rgba(212,175,55,.62)",
              display:"flex",alignItems:"center",justifyContent:"center",
            }}><IconClose/></button>

            <button className="gp-btn" style={{
              width:"68px",height:"68px",borderRadius:"50%",
              border:`2px solid ${C}`,
              background:"linear-gradient(135deg,rgba(212,175,55,.2),rgba(212,175,55,.05))",
              color:C,
              display:"flex",alignItems:"center",justifyContent:"center",
              boxShadow:"0 0 28px rgba(212,175,55,.18)",
            }}><IconScan/></button>

            <button className="gp-btn" onClick={handleFlip} style={{
              width:"48px",height:"48px",borderRadius:"50%",
              border:"1.5px solid rgba(212,175,55,.3)",
              background:"rgba(212,175,55,.07)",
              color:"rgba(212,175,55,.62)",
              display:"flex",alignItems:"center",justifyContent:"center",
            }}><IconFlipCamera/></button>
          </div>
        </div>
      )}

      {/* ══ ERROR ════════════════════════════════════════════════════════ */}
      {stage === STAGES.ERROR && (
        <div style={{
          position:"relative", zIndex:1,
          display:"flex", flexDirection:"column",
          alignItems:"center", gap:"20px",
          padding:"0 32px", maxWidth:"340px",
          textAlign:"center",
          animation:"fadeUp .4s ease both",
        }}>
          <div style={{fontSize:"30px",color:"rgba(212,175,55,.26)"}}>⊘</div>
          <div style={{
            color:"rgba(212,175,55,.76)", fontSize:"10.5px",
            letterSpacing:".08em", lineHeight:"1.85",
            fontFamily:"'Share Tech Mono',monospace",
            whiteSpace:"pre-line",
          }}>
            {errorMsg}
          </div>
          <button className="gp-btn" onClick={() => setStage(STAGES.IDLE)} style={{
            padding:"13px 28px", borderRadius:"3px",
            border:"1px solid rgba(212,175,55,.36)",
            background:"rgba(212,175,55,.07)",
            color:"rgba(212,175,55,.7)",
            fontSize:"10px", letterSpacing:".22em", marginTop:"6px",
          }}>
            TENTAR NOVAMENTE
          </button>
        </div>
      )}
    </div>
  );
}

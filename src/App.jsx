import { useState, useRef, useEffect } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────
const STAGES = {
  IDLE: "idle",
  LOADING: "loading",
  ACTIVE: "active",
  ERROR: "error",
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = {
  root: {
    minHeight: "100vh",
    width: "100%",
    backgroundColor: "#0a101f",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Courier New', Courier, monospace",
    overflow: "hidden",
    position: "relative",
  },
  gridOverlay: {
    position: "absolute",
    inset: 0,
    backgroundImage: `linear-gradient(rgba(212,175,55,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(212,175,55,0.04) 1px, transparent 1px)`,
    backgroundSize: "40px 40px",
    pointerEvents: "none",
    zIndex: 0,
  },
  glowCenter: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: "600px",
    height: "600px",
    background: "radial-gradient(circle, rgba(212,175,55,0.06) 0%, transparent 70%)",
    pointerEvents: "none",
    zIndex: 0,
  },
  idleContainer: {
    position: "relative",
    zIndex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "40px 24px",
    maxWidth: "360px",
    width: "100%",
  },
  logoRing: {
    width: "80px",
    height: "80px",
    borderRadius: "50%",
    border: "1.5px solid rgba(212,175,55,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "28px",
    position: "relative",
  },
  titleMain: {
    fontSize: "28px",
    fontWeight: "700",
    letterSpacing: "0.3em",
    color: "#d4af37",
    lineHeight: 1,
    textShadow: "0 0 30px rgba(212,175,55,0.4)",
  },
  titleSub: {
    fontSize: "10px",
    letterSpacing: "0.45em",
    color: "rgba(212,175,55,0.55)",
    display: "block",
    marginTop: "8px",
    textAlign: "center"
  },
  ctaButton: {
    width: "100%",
    padding: "16px 32px",
    borderRadius: "50px",
    border: "1.5px solid #d4af37",
    background: "linear-gradient(135deg, rgba(212,175,55,0.15), rgba(212,175,55,0.05))",
    color: "#d4af37",
    fontSize: "12px",
    fontFamily: "'Courier New', Courier, monospace",
    fontWeight: "700",
    letterSpacing: "0.3em",
    cursor: "pointer",
    marginTop: "40px"
  },
  cameraFrame: {
    position: "relative",
    width: "100%",
    aspectRatio: "9 / 16",
    maxHeight: "75vh",
    borderRadius: "16px",
    overflow: "hidden",
    border: "1px solid rgba(212,175,55,0.3)",
  },
  videoEl: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    transform: "scaleX(-1)", // Efeito Espelho
    backgroundColor: "#000",
  }
};

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [stage, setStage] = useState(STAGES.IDLE);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  async function handleActivate() {
    setStage(STAGES.LOADING);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" }, // Câmera Frontal
        audio: false,
      });
      streamRef.current = stream;
      setStage(STAGES.ACTIVE);
      setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      }, 100);
    } catch (err) {
      setStage(STAGES.ERROR);
    }
  }

  return (
    <div style={styles.root}>
      <div style={styles.gridOverlay} />
      <div style={styles.glowCenter} />

      {stage === STAGES.IDLE && (
        <div style={styles.idleContainer}>
          <div style={styles.logoRing}>
             <div style={{width:'32px', height:'32px', border:'2px solid #d4af37', borderRadius:'4px'}} />
          </div>
          <div style={{textAlign:'center'}}>
            <span style={styles.titleMain}>GHOST PROJECT</span>
            <span style={styles.titleSub}>AI TECHNOLOGY</span>
          </div>
          <button style={styles.ctaButton} onClick={handleActivate}>
            ATIVAR GHOST AI
          </button>
        </div>
      )}

      {stage === STAGES.ACTIVE && (
        <div style={{width:'100%', maxWidth:'420px', padding:'20px'}}>
          <div style={styles.cameraFrame}>
            <video ref={videoRef} autoPlay playsInline muted style={styles.videoEl} />
          </div>
          <button 
            style={{...styles.ctaButton, marginTop:'20px'}} 
            onClick={() => {
              streamRef.current.getTracks().forEach(t => t.stop());
              setStage(STAGES.IDLE);
            }}
          >
            DESATIVAR
          </button>
        </div>
      )}

      {stage === STAGES.LOADING && <div style={{color:'#d4af37'}}>INICIALIZANDO...</div>}
      {stage === STAGES.ERROR && <div style={{color:'#d4af37'}}>ERRO NA CÂMERA. CHEQUE AS PERMISSÕES.</div>}
    </div>
  );
}
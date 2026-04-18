import { useEffect, useRef, useState } from "react";

/* ─────────────────────────────────────────────────────────────────────────
   GHOST PROJECT AI — MVP
   Logo: coloque "logo.png" dentro da pasta PUBLIC do seu projeto GitHub
   Build: Vite 5 + React 18
───────────────────────────────────────────────────────────────────────── */

const CSS = [
  "@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;600&family=Montserrat:wght@200;300;400;500;600&display=swap');",
  "*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }",
  ":root { --gold: #C9A84C; --gl: #E8C96A; --dk: #07090D; --sv: #A8B4C0; --wh: #F0EDE8; --gn: #4ade80; }",
  "html,body,#root { width:100%; height:100%; background:var(--dk); overflow:hidden; font-family:'Montserrat',sans-serif; -webkit-tap-highlight-color:transparent; user-select:none; }",
  "@keyframes fadeIn  { from{opacity:0} to{opacity:1} }",
  "@keyframes fadeUp  { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }",
  "@keyframes shimmer { 0%{background-position:-200% center} 100%{background-position:200% center} }",
  "@keyframes pulse   { 0%,100%{opacity:.5;transform:scale(1)} 50%{opacity:1;transform:scale(1.15)} }",
  "@keyframes spin    { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }",
  "@keyframes glow    { 0%,100%{box-shadow:0 0 20px rgba(201,168,76,.3)} 50%{box-shadow:0 0 55px rgba(201,168,76,.8)} }",
  "@keyframes scan    { 0%{top:0%} 100%{top:100%} }",
  "@keyframes pop     { 0%{opacity:0;transform:scale(.4)} 80%{transform:scale(1.06)} 100%{opacity:1;transform:scale(1)} }",
  "@keyframes lglow   { 0%,100%{filter:drop-shadow(0 0 14px rgba(201,168,76,.5))} 50%{filter:drop-shadow(0 0 32px rgba(201,168,76,1))} }",
].join("\n");

/* ══ Logo — fundo cinza/xadrez some com mix-blend-mode screen ═══════════ */
function Logo({ width, style }) {
  return (
    <div style={{
      width: width || "min(52vw, 190px)",
      background: "#07090D",
      borderRadius: 8,
      overflow: "hidden",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      ...style,
    }}>
      <img
        src="/logo.png"
        alt="Ghost Project AI"
        style={{
          width: "100%",
          height: "auto",
          display: "block",
          mixBlendMode: "screen",
          filter: "brightness(1.15) contrast(1.1) saturate(0.85)",
        }}
      />
    </div>
  );
}

/* ══ Splash ═════════════════════════════════════════════════════════════ */
function Splash({ onDone }) {
  const [fade, setFade] = useState(false);
  const [sub,  setSub]  = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setSub(true),  900);
    const t2 = setTimeout(() => setFade(true), 2700);
    const t3 = setTimeout(onDone,              3400);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "radial-gradient(ellipse at 50% 45%, #0E1522 0%, #07090D 100%)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 24,
      opacity: fade ? 0 : 1, transition: "opacity .7s ease",
    }}>
      <div style={{ position:"absolute", width:300, height:300, borderRadius:"50%", border:"1px solid rgba(201,168,76,.10)", pointerEvents:"none" }} />
      <div style={{ position:"absolute", width:460, height:460, borderRadius:"50%", border:"1px solid rgba(201,168,76,.06)", pointerEvents:"none" }} />
      <div style={{ position:"absolute", width:600, height:600, borderRadius:"50%", border:"1px solid rgba(201,168,76,.03)", pointerEvents:"none" }} />

      <Logo style={{ animation: "lglow 2.5s ease-in-out infinite, fadeUp .9s cubic-bezier(.16,1,.3,1) both" }} />

      <p style={{
        fontFamily: "'Cormorant Garamond', serif",
        fontSize: 10, letterSpacing: ".44em", textTransform: "uppercase",
        color: "rgba(168,180,192,.55)", fontWeight: 300,
        opacity: sub ? 1 : 0, transition: "opacity .8s ease .2s",
      }}>
        Augmented Reality · E-Commerce
      </p>

      <div style={{ position:"absolute", bottom:68, width:130, height:1, background:"rgba(201,168,76,.12)" }}>
        <div style={{
          height: "100%",
          background: "linear-gradient(90deg,transparent,var(--gold),transparent)",
          backgroundSize: "200% 100%",
          animation: "shimmer 1.3s linear infinite",
        }} />
      </div>
    </div>
  );
}

/* ══ Home ════════════════════════════════════════════════════════════════ */
function Home({ onStart, cam, setCam }) {
  const [press, setPress] = useState(false);

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "radial-gradient(ellipse at 38% 12%, #101828 0%, #07090D 80%)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "0 26px", animation: "fadeIn .7s ease",
    }}>
      <div style={{
        position: "absolute", top: 0, left: "50%", width: 1, height: "26vh",
        background: "linear-gradient(to bottom,transparent,rgba(201,168,76,.2),transparent)",
        pointerEvents: "none",
      }} />

      <div style={{ marginBottom: 10, animation: "fadeUp .8s ease both" }}>
        <Logo style={{ animation: "lglow 2.8s ease-in-out infinite" }} />
      </div>

      <h1 style={{
        fontFamily: "'Cormorant Garamond', serif",
        fontSize: "clamp(32px, 8.5vw, 48px)", fontWeight: 300,
        lineHeight: 1.1, textAlign: "center", color: "var(--wh)",
        animation: "fadeUp .8s ease .12s both", marginBottom: 12,
      }}>
        Try Before
        <br />
        <span style={{
          background: "linear-gradient(135deg,var(--gold) 0%,var(--gl) 50%,var(--gold) 100%)",
          backgroundSize: "200% auto",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          animation: "shimmer 3s linear infinite",
        }}>
          You Buy
        </span>
      </h1>

      <p style={{
        fontSize: 12, fontWeight: 300, color: "var(--sv)",
        lineHeight: 1.8, maxWidth: 272, textAlign: "center",
        letterSpacing: ".034em",
        animation: "fadeUp .8s ease .22s both", marginBottom: 28,
      }}>
        Visualize produtos em escala real através da sua câmera.
        <br />
        Tecnologia AR que elimina devoluções.
      </p>

      <div style={{
        display: "flex", background: "rgba(255,255,255,.04)",
        borderRadius: 13, padding: 4,
        border: "1px solid rgba(255,255,255,.07)",
        width: "100%", maxWidth: 315,
        animation: "fadeUp .8s ease .32s both", marginBottom: 12,
      }}>
        {[
          { v: "environment", label: "📷  Câmera Traseira" },
          { v: "user",        label: "🤳  Câmera Frontal"  },
        ].map((item) => (
          <button key={item.v} onClick={() => setCam(item.v)} style={{
            flex: 1, padding: "10px 6px", borderRadius: 10,
            border: "none", cursor: "pointer",
            fontSize: 11, fontWeight: 500, letterSpacing: ".04em",
            fontFamily: "'Montserrat', sans-serif", transition: "all .25s ease",
            background: cam === item.v ? "linear-gradient(135deg,var(--gold),#A07020)" : "transparent",
            color: cam === item.v ? "#07090D" : "var(--sv)",
          }}>
            {item.label}
          </button>
        ))}
      </div>

      <button
        onClick={onStart}
        onPointerDown={() => setPress(true)}
        onPointerUp={() => setPress(false)}
        onPointerLeave={() => setPress(false)}
        style={{
          position: "relative", overflow: "hidden",
          width: "100%", maxWidth: 315, padding: "16px 24px",
          borderRadius: 15, border: "1px solid rgba(201,168,76,.45)",
          cursor: "pointer",
          background: "linear-gradient(135deg,var(--gold) 0%,#A07020 100%)",
          transform: press ? "scale(.97)" : "scale(1)",
          transition: "transform .14s ease",
          animation: "glow 2.5s ease-in-out infinite, fadeUp .8s ease .42s both",
          fontFamily: "'Montserrat', sans-serif", marginBottom: 24,
        }}
      >
        <span style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          fontSize: 13, fontWeight: 600, letterSpacing: ".14em",
          color: "#07090D", textTransform: "uppercase",
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="3" />
            <path d="M3 9V6a2 2 0 012-2h3M3 15v3a2 2 0 002 2h3M15 3h3a2 2 0 012 2v3M15 21h3a2 2 0 002-2v-3" />
          </svg>
          Iniciar Scanner AR
        </span>
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(90deg,transparent,rgba(255,255,255,.16),transparent)",
          backgroundSize: "200% 100%", animation: "shimmer 2s linear infinite",
          pointerEvents: "none",
        }} />
      </button>

      <p style={{
        fontSize: 8, color: "rgba(168,180,192,.28)",
        letterSpacing: ".18em", textTransform: "uppercase",
        fontWeight: 300, textAlign: "center",
        animation: "fadeUp .8s ease .5s both",
      }}>
        Ghost Project AI — Powered by WebXR
      </p>
    </div>
  );
}

/* ══ AR Loading ══════════════════════════════════════════════════════════ */
function ARLoading({ pct }) {
  const msgs = ["Iniciando câmera...", "Carregando modelo 3D...", "Preparando AR...", "Quase pronto..."];
  const idx = Math.min(Math.floor(pct / 25), 3);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 80,
      background: "rgba(7,9,13,.97)", backdropFilter: "blur(20px)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 22,
      animation: "fadeIn .3s ease",
    }}>
      <div style={{ position: "relative", width: 68, height: 68 }}>
        <div style={{ position:"absolute", inset:0, borderRadius:"50%", border:"2px solid transparent", borderTopColor:"var(--gold)", borderRightColor:"var(--gold)", animation:"spin .9s linear infinite" }} />
        <div style={{ position:"absolute", inset:10, borderRadius:"50%", border:"1px solid transparent", borderBottomColor:"rgba(201,168,76,.4)", animation:"spin 1.5s linear infinite reverse" }} />
        <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24 }}>⌚</div>
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:19, fontWeight:300, color:"var(--wh)", letterSpacing:".05em", marginBottom:6 }}>
          Carregando modelo 3D
        </div>
        <div style={{ fontSize: 10, color: "var(--sv)", letterSpacing: ".14em" }}>{msgs[idx]}</div>
      </div>
      <div style={{ width: 170, height: 2, background: "rgba(255,255,255,.07)", borderRadius: 2 }}>
        <div style={{ height:"100%", borderRadius:2, background:"linear-gradient(90deg,var(--gold),var(--gl))", width:pct+"%", transition:"width .2s ease", boxShadow:"0 0 10px rgba(201,168,76,.7)" }} />
      </div>
    </div>
  );
}

/* ══ AR View ═════════════════════════════════════════════════════════════ */
function ARView({ cam, onBack }) {
  const canvasRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [pct,     setPct]     = useState(0);
  const [badge,   setBadge]   = useState(false);
  const [error,   setError]   = useState("");
  const R = useRef({});

  useEffect(() => {
    let raf, stream;
    const refs = R.current;

    const tick = setInterval(() => {
      setPct((p) => { if (p >= 88) { clearInterval(tick); return p; } return p + Math.random() * 13; });
    }, 170);

    function loadScript(src) {
      return new Promise((resolve, reject) => {
        if (document.querySelector('script[src="' + src + '"]')) { resolve(); return; }
        const s = document.createElement("script");
        s.src = src;
        s.onload = resolve;
        s.onerror = () => reject(new Error("Falha: " + src));
        document.head.appendChild(s);
      });
    }

    async function init() {
      try {
        await loadScript("https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js");
        const T = window.THREE;

        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: cam, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        const vid = document.createElement("video");
        vid.srcObject = stream; vid.playsInline = true; vid.muted = true;
        await new Promise((res) => { vid.onloadedmetadata = res; });
        await vid.play();

        const renderer = new T.WebGLRenderer({
          canvas: canvasRef.current, alpha: true, antialias: true,
          powerPreference: "high-performance",
        });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 3));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = T.PCFSoftShadowMap;
        renderer.toneMapping = T.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.8;

        const scene = new T.Scene();
        const vtex = new T.VideoTexture(vid);
        vtex.minFilter = T.LinearFilter;
        scene.background = vtex;

        const cam3 = new T.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.01, 100);
        cam3.position.set(0, 0, 2.6);

        /* Iluminação de showroom — sem ambient forte (mata o metal) */
        scene.add(new T.AmbientLight(0xffffff, 0.08));

        const kL = new T.DirectionalLight(0xfff6e8, 4.0);
        kL.position.set(-3, 6, 4); kL.castShadow = true; scene.add(kL);

        const fL = new T.DirectionalLight(0xd8eaff, 0.5);
        fL.position.set(5, 1, 3); scene.add(fL);

        const rL = new T.DirectionalLight(0xffffff, 1.4);
        rL.position.set(1, -2, -6); scene.add(rL); refs.rL = rL;

        const sG = new T.SpotLight(0xC9A84C, 5, 9, Math.PI / 3.5, 0.25, 1.2);
        sG.position.set(1, 3, 2); scene.add(sG); refs.sG = sG;

        const dL = new T.PointLight(0xffffff, 3, 3);
        dL.position.set(0.4, 0.4, 1.4); scene.add(dL); refs.dL = dL;

        /* Grupo do relógio */
        const wg = new T.Group();
        scene.add(wg); refs.wg = wg;

        /* Materiais */
        const mPol  = new T.MeshStandardMaterial({ color: 0xD2D8DE, metalness: 1.0, roughness: 0.03 });
        const mBru  = new T.MeshStandardMaterial({ color: 0xBCC3C9, metalness: 0.97, roughness: 0.22 });
        const mSat  = new T.MeshStandardMaterial({ color: 0xC8CED4, metalness: 0.97, roughness: 0.11 });
        const mDial = new T.MeshStandardMaterial({ color: 0x080A0D, roughness: 0.04, metalness: 0.6, emissive: new T.Color(0x030507), emissiveIntensity: 1 });
        const mGold = new T.MeshStandardMaterial({ color: 0xCDA040, metalness: 1.0, roughness: 0.02, emissive: new T.Color(0xC9A030), emissiveIntensity: 0.4 });
        const mHand = new T.MeshStandardMaterial({ color: 0xECF2F8, metalness: 1.0, roughness: 0.02, emissive: new T.Color(0xffffff), emissiveIntensity: 0.1 });
        const mSec  = new T.MeshStandardMaterial({ color: 0xFF1A1A, metalness: 0.3, roughness: 0.12, emissive: new T.Color(0xFF0000), emissiveIntensity: 0.9 });
        const mIdxG = new T.MeshStandardMaterial({ color: 0xD4A84C, metalness: 1.0, roughness: 0.02, emissive: new T.Color(0xC9A030), emissiveIntensity: 0.6 });
        const mIdxW = new T.MeshStandardMaterial({ color: 0xF0F4F8, metalness: 0.98, roughness: 0.03, emissive: new T.Color(0xffffff), emissiveIntensity: 0.4 });

        /* Pulseira de aço integrada */
        const gBig = new T.BoxGeometry(0.295, 0.088, 0.050);
        const gSml = new T.BoxGeometry(0.135, 0.068, 0.040);

        function elo(y, dir) {
          const b = new T.Mesh(gBig, mBru); b.position.set(0, y, 0); b.castShadow = true; wg.add(b);
          const el = new T.Mesh(gSml, mPol); el.position.set(-0.098, y + dir * 0.048, 0.004); wg.add(el);
          const er = new T.Mesh(gSml, mPol); er.position.set( 0.098, y + dir * 0.048, 0.004); wg.add(er);
          const gr = new T.Mesh(new T.BoxGeometry(0.298, 0.003, 0.052), new T.MeshStandardMaterial({ color: 0x080A0D, metalness: 0.2, roughness: 0.9 }));
          gr.position.set(0, y + dir * 0.044, 0); wg.add(gr);
        }
        for (let i = 0; i < 6; i++) { elo( 0.44 + i * 0.100,  1); }
        for (let i = 0; i < 6; i++) { elo(-0.44 - i * 0.100, -1); }

        const fc = new T.Mesh(new T.BoxGeometry(0.295, 0.105, 0.044), mSat); fc.position.set(0, -1.08, 0); wg.add(fc);
        const fl = new T.Mesh(new T.BoxGeometry(0.263, 0.032, 0.024), mGold); fl.position.set(0, -1.08, 0.034); wg.add(fl);

        /* Caixa octogonal */
        const wcase = new T.Mesh(new T.CylinderGeometry(0.44, 0.44, 0.120, 8, 1), mBru);
        wcase.rotation.x = Math.PI / 2; wcase.rotation.z = Math.PI / 8;
        wcase.castShadow = true; wg.add(wcase);

        /* Parafusos hexagonais (Royal Oak signature) */
        for (let i = 0; i < 8; i++) {
          const ang = (i / 8) * Math.PI * 2;
          const sc = new T.Mesh(new T.CylinderGeometry(0.018, 0.018, 0.008, 6), mGold);
          sc.rotation.x = Math.PI / 2;
          sc.position.set(Math.cos(ang) * 0.40, Math.sin(ang) * 0.40, 0.064);
          wg.add(sc);
        }

        /* Bisel */
        const gBev = new T.TorusGeometry(0.44, 0.020, 8, 8);
        const bT = new T.Mesh(gBev, mPol); bT.position.z =  0.060; bT.rotation.z = Math.PI / 8; wg.add(bT);
        const bB = new T.Mesh(gBev, mPol); bB.position.z = -0.060; bB.rotation.z = Math.PI / 8; wg.add(bB);
        const bE = new T.Mesh(new T.TorusGeometry(0.44, 0.028, 6, 8), mSat); bE.position.z = 0.064; bE.rotation.z = Math.PI / 8; wg.add(bE);

        /* Lugs */
        const gLug = new T.BoxGeometry(0.078, 0.162, 0.090);
        [[-0.172, 0.455], [0.172, 0.455], [-0.172, -0.455], [0.172, -0.455]].forEach(([lx, ly]) => {
          const lug = new T.Mesh(gLug, mBru); lug.position.set(lx, ly, 0); lug.castShadow = true; wg.add(lug);
        });

        /* Mostrador */
        const dial = new T.Mesh(new T.CircleGeometry(0.40, 80), mDial); dial.position.z = 0.062; wg.add(dial);
        const dRing = new T.Mesh(new T.TorusGeometry(0.35, 0.008, 6, 80), new T.MeshStandardMaterial({ color: 0x141820, metalness: 0.4, roughness: 0.5 }));
        dRing.position.z = 0.063; wg.add(dRing);

        /* Índices de hora */
        for (let ii = 0; ii < 12; ii++) {
          const a = (ii / 12) * Math.PI * 2 - Math.PI / 2;
          const isMain = ii % 3 === 0;
          const iGeo = new T.BoxGeometry(isMain ? 0.024 : 0.013, isMain ? 0.080 : 0.052, 0.010);
          const idx = new T.Mesh(iGeo, isMain ? mIdxG : mIdxW);
          idx.position.set(Math.cos(a) * 0.308, Math.sin(a) * 0.308, 0.068);
          idx.rotation.z = a + Math.PI / 2;
          wg.add(idx);
        }

        /* Janela de data */
        const dwin = new T.Mesh(new T.BoxGeometry(0.068, 0.048, 0.004), new T.MeshStandardMaterial({ color: 0xF0F2F5, roughness: 0.1, metalness: 0.15 }));
        dwin.position.set(0.265, 0, 0.069); wg.add(dwin);
        const dwinB = new T.Mesh(new T.BoxGeometry(0.074, 0.054, 0.003), mGold);
        dwinB.position.set(0.265, 0, 0.067); wg.add(dwinB);

        /* Ponteiros Dauphine */
        function dauphine(len, w, d) {
          const g = new T.BufferGeometry();
          const hw = w / 2, hd = d / 2;
          const v = new Float32Array([
            -hw, 0, -hd,  hw, 0, -hd,  0, len, -hd,
            -hw, 0,  hd,  hw, 0,  hd,  0, len,  hd,
          ]);
          g.setAttribute("position", new T.BufferAttribute(v, 3));
          g.setIndex([0,1,2, 3,5,4, 0,3,4,4,1,0, 1,4,5,5,2,1, 2,5,3,3,0,2]);
          g.computeVertexNormals();
          return g;
        }

        const hH = new T.Mesh(dauphine(0.195, 0.034, 0.010), mHand);
        hH.position.set(0, 0.005, 0.074); wg.add(hH); refs.hH = hH;

        const mH = new T.Mesh(dauphine(0.275, 0.022, 0.010), mHand);
        mH.position.set(0, 0.005, 0.075); wg.add(mH); refs.mH = mH;

        const sH = new T.Mesh(new T.CylinderGeometry(0.0025, 0.0025, 0.330, 8), mSec);
        sH.rotation.x = Math.PI / 2; sH.position.set(0, 0.060, 0.077); wg.add(sH); refs.sH = sH;

        const cw = new T.Mesh(new T.CylinderGeometry(0.020, 0.020, 0.008, 16), mSec);
        cw.rotation.x = Math.PI / 2; cw.position.set(0, -0.085, 0.077); wg.add(cw);

        /* Tampa central */
        const cap = new T.Mesh(new T.CircleGeometry(0.022, 20), mGold); cap.position.z = 0.080; wg.add(cap);
        const capR = new T.Mesh(new T.TorusGeometry(0.022, 0.005, 8, 20), mPol); capR.position.z = 0.080; wg.add(capR);

        /* Cristal */
        const glass = new T.Mesh(new T.CircleGeometry(0.40, 80), new T.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.06, roughness: 0, metalness: 0 }));
        glass.position.z = 0.084; wg.add(glass);

        /* Coroa */
        const crn = new T.Mesh(new T.CylinderGeometry(0.027, 0.029, 0.058, 18), mSat); crn.position.set(0.480, 0.075, 0); crn.rotation.z = Math.PI / 2; wg.add(crn);
        const crnK = new T.Mesh(new T.CylinderGeometry(0.031, 0.031, 0.036, 18), mBru); crnK.position.set(0.513, 0.075, 0); crnK.rotation.z = Math.PI / 2; wg.add(crnK);

        /* Partículas sutis */
        const pgeo = new T.BufferGeometry();
        const pp = new Float32Array(50 * 3);
        for (let pi = 0; pi < 50; pi++) { pp[pi*3]=(Math.random()-.5)*1.4; pp[pi*3+1]=(Math.random()-.5)*1.4; pp[pi*3+2]=(Math.random()-.5)*.25; }
        pgeo.setAttribute("position", new T.BufferAttribute(pp, 3));
        const pts = new T.Points(pgeo, new T.PointsMaterial({ color: 0xE0B840, size: 0.007, transparent: true, opacity: 0.5 }));
        wg.add(pts); refs.pts = pts;

        wg.scale.setScalar(0.01);
        wg.position.set(0, -0.08, 0);

        clearInterval(tick); setPct(100);
        setTimeout(() => { setLoading(false); setBadge(true); }, 360);

        /* Loop de animação — pedestal giratório de joalheria */
        const t0 = Date.now();
        function loop() {
          raf = requestAnimationFrame(loop);
          const t = (Date.now() - t0) / 1000;

          /* Entrada */
          const sc = t < 1.3 ? 1 - Math.pow(1 - Math.min(1, t / 1.3), 3) : 1;
          wg.scale.setScalar(sc);

          /* Rotação showroom elegante */
          wg.rotation.y = Math.sin(t * 0.16) * 0.38;
          wg.rotation.x = -0.18 + Math.sin(t * 0.11) * 0.07;
          wg.position.y = -0.08 + Math.sin(t * 0.85) * 0.055;
          wg.position.x = Math.sin(t * 0.20) * 0.035;

          /* Hora real */
          const now = new Date();
          const hr = now.getHours() % 12;
          const mn = now.getMinutes();
          const sc2 = now.getSeconds() + now.getMilliseconds() / 1000;
          refs.sH.rotation.z = -(sc2 / 60) * Math.PI * 2;
          refs.mH.rotation.z = -((mn + sc2 / 60) / 60) * Math.PI * 2;
          refs.hH.rotation.z = -((hr + mn / 60) / 12) * Math.PI * 2;

          /* Luz dinâmica — reflexos vivos */
          refs.sG.position.set(Math.sin(t * 0.22) * 2.5, 2.5 + Math.cos(t * 0.18) * 0.8, 2.2);
          refs.sG.intensity = 4.5 + Math.sin(t * 0.55) * 0.8;
          refs.dL.position.set(Math.cos(t * 0.35) * 0.7, Math.sin(t * 0.35) * 0.7, 1.4);
          refs.dL.intensity = 2.5 + Math.sin(t * 0.9) * 0.6;
          refs.rL.intensity = 1.2 + Math.sin(t * 0.4) * 0.3;
          refs.pts.material.opacity = 0.35 + Math.sin(t * 1.5) * 0.15;
          refs.pts.rotation.z = t * 0.05;

          renderer.render(scene, cam3);
        }
        loop();

        function onResize() {
          cam3.aspect = window.innerWidth / window.innerHeight;
          cam3.updateProjectionMatrix();
          renderer.setSize(window.innerWidth, window.innerHeight);
        }
        window.addEventListener("resize", onResize);
        refs.onResize = onResize;

        let ltx = 0;
        function onTS(e) { ltx = e.touches[0].clientX; }
        function onTM(e) { wg.rotation.y += (e.touches[0].clientX - ltx) * 0.011; ltx = e.touches[0].clientX; }
        const cv = canvasRef.current;
        if (cv) { cv.addEventListener("touchstart", onTS); cv.addEventListener("touchmove", onTM); refs.onTS = onTS; refs.onTM = onTM; }

      } catch (err) {
        clearInterval(tick);
        console.error(err);
        setError(err.message || "Erro ao iniciar câmera");
        setLoading(false);
      }
    }

    init();

    return () => {
      cancelAnimationFrame(raf);
      if (stream) stream.getTracks().forEach((t) => t.stop());
      window.removeEventListener("resize", refs.onResize);
      const cv = canvasRef.current;
      if (cv) { cv.removeEventListener("touchstart", refs.onTS); cv.removeEventListener("touchmove", refs.onTM); }
    };
  }, [cam]);

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000" }}>
      {loading && <ARLoading pct={pct} />}
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block", touchAction: "none" }} />

      {!loading && !error && (
        <>
          <div style={{ position:"absolute", top:0, left:0, right:0, paddingTop:"max(env(safe-area-inset-top,0px),44px)", paddingBottom:16, paddingLeft:16, paddingRight:16, background:"linear-gradient(to bottom,rgba(7,9,13,.82),transparent)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <button onClick={onBack} style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 15px", borderRadius:100, background:"rgba(255,255,255,.08)", border:"1px solid rgba(255,255,255,.12)", color:"var(--wh)", fontSize:11, fontWeight:500, cursor:"pointer", letterSpacing:".05em", backdropFilter:"blur(8px)", fontFamily:"'Montserrat',sans-serif" }}>
              ← Voltar
            </button>
            {badge && (
              <div style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 13px", borderRadius:100, background:"rgba(18,75,50,.92)", border:"1px solid rgba(74,222,128,.32)", backdropFilter:"blur(8px)", animation:"pop .5s cubic-bezier(.16,1,.3,1) both" }}>
                <div style={{ width:5, height:5, borderRadius:"50%", background:"var(--gn)", animation:"pulse 2s ease-in-out infinite" }} />
                <span style={{ fontSize:9, color:"var(--gn)", letterSpacing:".13em", fontWeight:600 }}>GHOST PROJECT AR</span>
              </div>
            )}
          </div>

          <div style={{ position:"absolute", inset:"17%", pointerEvents:"none" }}>
            <div style={{ position:"absolute", top:0, left:0, width:22, height:22, borderTop:"1.5px solid var(--gold)", borderLeft:"1.5px solid var(--gold)", opacity:.65 }} />
            <div style={{ position:"absolute", top:0, right:0, width:22, height:22, borderTop:"1.5px solid var(--gold)", borderRight:"1.5px solid var(--gold)", opacity:.65 }} />
            <div style={{ position:"absolute", bottom:0, left:0, width:22, height:22, borderBottom:"1.5px solid var(--gold)", borderLeft:"1.5px solid var(--gold)", opacity:.65 }} />
            <div style={{ position:"absolute", bottom:0, right:0, width:22, height:22, borderBottom:"1.5px solid var(--gold)", borderRight:"1.5px solid var(--gold)", opacity:.65 }} />
            <div style={{ position:"absolute", left:0, right:0, height:1, background:"linear-gradient(90deg,transparent,rgba(201,168,76,.75),transparent)", animation:"scan 2.5s linear infinite", boxShadow:"0 0 7px rgba(201,168,76,.5)" }} />
          </div>

          <div style={{ position:"absolute", bottom:0, left:0, right:0, paddingTop:18, paddingLeft:16, paddingRight:16, paddingBottom:"max(env(safe-area-inset-bottom,0px),26px)", background:"linear-gradient(to top,rgba(7,9,13,.72),transparent)", display:"flex", flexDirection:"column", alignItems:"center", gap:5 }}>
            <p style={{ fontSize:9, color:"rgba(201,168,76,.45)", letterSpacing:".16em", textTransform:"uppercase", fontWeight:400, textAlign:"center" }}>Arraste para girar</p>
            <p style={{ fontSize:7.5, color:"rgba(168,180,192,.28)", letterSpacing:".15em", textTransform:"uppercase", fontWeight:300 }}>Ghost Project AI — Powered by WebXR</p>
          </div>
        </>
      )}

      {error && !loading && (
        <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:20, padding:30, background:"rgba(7,9,13,.98)" }}>
          <div style={{ fontSize:36 }}>📷</div>
          <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:21, color:"var(--wh)", textAlign:"center" }}>Câmera não autorizada</div>
          <p style={{ fontSize:12, color:"var(--sv)", textAlign:"center", lineHeight:1.75, maxWidth:260 }}>
            Permita acesso à câmera nas configurações do navegador e recarregue a página.
            <br /><br />
            <span style={{ fontSize:9, color:"rgba(168,180,192,.4)" }}>{error}</span>
          </p>
          <button onClick={onBack} style={{ padding:"11px 26px", borderRadius:11, border:"1px solid rgba(201,168,76,.4)", background:"transparent", color:"var(--gold)", cursor:"pointer", fontFamily:"'Montserrat',sans-serif", letterSpacing:".1em", fontSize:11 }}>
            ← Voltar
          </button>
        </div>
      )}
    </div>
  );
}

/* ══ Root ════════════════════════════════════════════════════════════════ */
export default function App() {
  const [screen, setScreen] = useState("splash");
  const [cam,    setCam]    = useState("environment");
  return (
    <>
      <style>{CSS}</style>
      {screen === "splash" && <Splash onDone={() => setScreen("home")} />}
      {screen === "home"   && <Home   onStart={() => setScreen("ar")} cam={cam} setCam={setCam} />}
      {screen === "ar"     && <ARView cam={cam} onBack={() => setScreen("home")} />}
    </>
  );
}

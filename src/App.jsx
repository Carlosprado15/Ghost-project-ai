import { useEffect, useRef, useState } from "react";

/* ─────────────────────────────────────────────────────────────────────────
   GHOST PROJECT AI — MVP (PRECISION FIX)
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
      <Logo style={{ animation: "lglow 2.5s ease-in-out infinite, fadeUp .9s cubic-bezier(.16,1,.3,1) both" }} />
      <p style={{
        fontFamily: "'Cormorant Garamond', serif",
        fontSize: 10, letterSpacing: ".44em", textTransform: "uppercase",
        color: "rgba(168,180,192,.55)", fontWeight: 300,
        opacity: sub ? 1 : 0, transition: "opacity .8s ease .2s",
      }}>Augmented Reality · E-Commerce</p>
    </div>
  );
}

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
      <div style={{ marginBottom: 10, animation: "fadeUp .8s ease both" }}>
        <Logo style={{ animation: "lglow 2.8s ease-in-out infinite" }} />
      </div>
      <h1 style={{
        fontFamily: "'Cormorant Garamond', serif",
        fontSize: "clamp(32px, 8.5vw, 48px)", fontWeight: 300,
        lineHeight: 1.1, textAlign: "center", color: "var(--wh)",
        animation: "fadeUp .8s ease .12s both", marginBottom: 12,
      }}>Try Before<br /><span style={{ background: "linear-gradient(135deg,var(--gold) 0%,var(--gl) 50%,var(--gold) 100%)", backgroundSize: "200% auto", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", animation: "shimmer 3s linear infinite" }}>You Buy</span></h1>
      <div style={{ display: "flex", background: "rgba(255,255,255,.04)", borderRadius: 13, padding: 4, border: "1px solid rgba(255,255,255,.07)", width: "100%", maxWidth: 315, animation: "fadeUp .8s ease .32s both", marginBottom: 12 }}>
        {[{ v: "environment", label: "📷 Traseira" }, { v: "user", label: "🤳 Frontal" }].map((item) => (
          <button key={item.v} onClick={() => setCam(item.v)} style={{ flex: 1, padding: "10px 6px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 500, background: cam === item.v ? "var(--gold)" : "transparent", color: cam === item.v ? "#07090D" : "var(--sv)" }}>{item.label}</button>
        ))}
      </div>
      <button onClick={onStart} style={{ width: "100%", maxWidth: 315, padding: "16px 24px", borderRadius: 15, border: "1px solid rgba(201,168,76,.45)", background: "linear-gradient(135deg,var(--gold) 0%,#A07020 100%)", animation: "glow 2.5s ease-in-out infinite", fontWeight: 600, color: "#07090D", textTransform: "uppercase", fontSize: 13, letterSpacing: ".14em" }}>Iniciar Scanner AR</button>
    </div>
  );
}

function ARLoading({ pct }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(7,9,13,.97)", backdropFilter: "blur(20px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 22 }}>
      <div style={{ fontSize: 19, color: "var(--wh)" }}>Preparando AR...</div>
      <div style={{ width: 170, height: 2, background: "rgba(255,255,255,.07)" }}><div style={{ height: "100%", background: "var(--gold)", width: pct + "%" }} /></div>
    </div>
  );
}

function ARView({ cam, onBack }) {
  const canvasRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [pct,     setPct]     = useState(0);
  const R = useRef({});

  useEffect(() => {
    let raf, stream;
    const refs = R.current;
    const tick = setInterval(() => setPct((p) => p >= 90 ? p : p + 10), 100);

    async function init() {
      try {
        if (!window.THREE) {
          await new Promise((res) => {
            const s = document.createElement("script");
            s.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
            s.onload = res; document.head.appendChild(s);
          });
        }
        const T = window.THREE;
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: cam } });
        const vid = document.createElement("video");
        vid.srcObject = stream; vid.playsInline = true; await vid.play();

        const renderer = new T.WebGLRenderer({ canvas: canvasRef.current, alpha: true, antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        
        const scene = new T.Scene();
        scene.background = new T.VideoTexture(vid);

        const cam3 = new T.PerspectiveCamera(50, window.innerWidth/window.innerHeight, 0.1, 1000);
        cam3.position.z = 5;

        const light = new T.DirectionalLight(0xffffff, 1.5);
        light.position.set(1, 1, 2); scene.add(light);
        scene.add(new T.AmbientLight(0xffffff, 0.5));

        const wg = new T.Group();
        scene.add(wg); refs.wg = wg;

        /* MATERIAIS */
        const mBru = new T.MeshStandardMaterial({ color: 0xBCC3C9, metalness: 0.9, roughness: 0.2 });
        const mGold = new T.MeshStandardMaterial({ color: 0xCDA040, metalness: 1, roughness: 0.1 });

        /* CONSTRUÇÃO SIMPLIFICADA PARA ENCAIXE */
        const caseGeo = new T.CylinderGeometry(0.5, 0.5, 0.2, 8);
        const wcase = new T.Mesh(caseGeo, mBru);
        wcase.rotation.x = Math.PI / 2;
        wg.add(wcase);

        // Pulseira Superior
        const p1 = new T.Mesh(new T.BoxGeometry(0.4, 0.8, 0.1), mBru);
        p1.position.y = 0.6; wg.add(p1);

        // Pulseira Inferior
        const p2 = new T.Mesh(new T.BoxGeometry(0.4, 0.8, 0.1), mBru);
        p2.position.y = -0.6; wg.add(p2);

        /* CONFIGURAÇÃO DE ENCAIXE (FIX) */
        // Escala reduzida para o pulso real
        wg.scale.setScalar(0.7); 
        // Posição ajustada para o centro da visão
        wg.position.set(0, -0.5, 0);
        // Rotação para ficar "deitado" no braço
        wg.rotation.set(-0.5, 0, 0);

        setLoading(false);
        function loop() {
          raf = requestAnimationFrame(loop);
          // Rotação manual via toque (se houver) ou leve inclinação
          renderer.render(scene, cam3);
        }
        loop();

        window.addEventListener("resize", () => {
          cam3.aspect = window.innerWidth / window.innerHeight;
          cam3.updateProjectionMatrix();
          renderer.setSize(window.innerWidth, window.innerHeight);
        });

      } catch (err) { console.error(err); }
    }
    init();
    return () => {
      cancelAnimationFrame(raf);
      if (stream) stream.getTracks().forEach(t => t.stop());
    };
  }, [cam]);

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000" }}>
      {loading && <ARLoading pct={pct} />}
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
      <button onClick={onBack} style={{ position: "absolute", top: 40, left: 20, padding: "10px 20px", background: "rgba(0,0,0,0.5)", color: "#fff", border: "1px solid var(--gold)", borderRadius: 10 }}>← Voltar</button>
      <div style={{ position: "absolute", bottom: 40, width: "100%", textAlign: "center", color: "var(--gold)", fontSize: 10 }}>ALINHE SEU PULSO NO CENTRO</div>
    </div>
  );
}

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

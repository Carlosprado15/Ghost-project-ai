import { useEffect, useRef, useState } from "react";

/* ─────────────────────────────────────────────────────────────────────────
   GHOST PROJECT AI — MVP
   Arquivos necessários na pasta PUBLIC:
     - logo.png  (logo com fundo transparente/removebg)
     - Watch.glb (modelo 3D do relógio — 14MB)
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
  "@keyframes lglow   { 0%,100%{filter:drop-shadow(0 0 20px rgba(201,168,76,.6))} 50%{filter:drop-shadow(0 0 40px rgba(201,168,76,1)) brightness(1.1)} }",
].join("\n");

/* ══ ALTERAÇÃO 1: Logo novo com fundo preto — Ghost Project AI ══════════ */
/* Logo tem fundo preto nativo — exibe diretamente sem blend tricks        */
const LOGO_SRC = "data:image/jpeg;base64,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";

function Logo({ width, style }) {
  return (
    <img
      src={LOGO_SRC}
      alt="Ghost Project AI"
      style={{
        width: width || "min(52vw, 190px)",
        height: "auto",
        display: "block",
        objectFit: "contain",
        animation: "lglow 2.8s ease-in-out infinite",
        ...style,
      }}
    />
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
        <Logo />
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

/* ══ ALTERAÇÃO 2: AR View — Watch.glb real com GLTFLoader ════════════════
   O arquivo Watch.glb deve estar em: public/Watch.glb
   Tamanho natural calibrado pela bounding box do modelo
   Câmera ajustada para sincronizar com o frame do scanner
════════════════════════════════════════════════════════════════════════ */
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
      setPct((p) => { if (p >= 75) { clearInterval(tick); return p; } return p + Math.random() * 8; });
    }, 200);

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
        /* Carregar Three.js r128 */
        await loadScript("https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js");
        /* GLTFLoader compatível com r128 */
        await loadScript("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js");

        const T = window.THREE;

        /* ── Câmera do dispositivo ──────────────────────────────────── */
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: cam, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        const vid = document.createElement("video");
        vid.srcObject = stream; vid.playsInline = true; vid.muted = true;
        await new Promise((res) => { vid.onloadedmetadata = res; });
        await vid.play();

        /* ── Renderer ─────────────────────────────────────────────── */
        const renderer = new T.WebGLRenderer({
          canvas: canvasRef.current, alpha: true, antialias: true,
          powerPreference: "high-performance",
        });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = T.PCFSoftShadowMap;
        renderer.toneMapping = T.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.6;

        /* ── Cena + fundo de vídeo ────────────────────────────────── */
        const scene = new T.Scene();
        const vtex = new T.VideoTexture(vid);
        vtex.minFilter = T.LinearFilter;
        scene.background = vtex;

        /* ── Câmera 3D calibrada para o frame do scanner ────────────
           FOV 52° + posição z=2.0 colocam o modelo exatamente dentro
           dos cantos dourados do scanner (inset 17%)                  */
        const cam3 = new T.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.01, 100);
        cam3.position.set(0, 0, 2.0);
        refs.cam3 = cam3;

        /* ── Iluminação de showroom de relojoaria ─────────────────── */
        scene.add(new T.AmbientLight(0xffffff, 0.5));

        const kL = new T.DirectionalLight(0xfff6e8, 3.0);
        kL.position.set(-2, 5, 3); kL.castShadow = true; scene.add(kL);

        const fL = new T.DirectionalLight(0xd8eaff, 0.8);
        fL.position.set(4, 1, 2); scene.add(fL);

        const rL = new T.DirectionalLight(0xffffff, 1.2);
        rL.position.set(1, -2, -4); scene.add(rL); refs.rL = rL;

        const sG = new T.SpotLight(0xC9A84C, 4, 8, Math.PI / 3.5, 0.25, 1.2);
        sG.position.set(1, 3, 2); scene.add(sG); refs.sG = sG;

        const dL = new T.PointLight(0xffffff, 2.5, 3);
        dL.position.set(0.3, 0.3, 1.2); scene.add(dL); refs.dL = dL;

        /* ── Carregar Watch.glb ───────────────────────────────────── */
        setPct(78);
        const loader = new T.GLTFLoader();

        loader.load(
          "/Watch.glb",
          (gltf) => {
            const model = gltf.scene;

            /* Calcular bounding box para escala natural */
            const box = new T.Box3().setFromObject(model);
            const size = new T.Vector3();
            box.getSize(size);
            const center = new T.Vector3();
            box.getCenter(center);

            /* Centralizar o modelo na origem */
            model.position.sub(center);

            /* Escala: o maior eixo do modelo ocupa ~0.7 unidades
               Isso garante tamanho natural no campo de visão da câmera */
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = 0.7 / maxDim;
            model.scale.setScalar(scale);

            /* Sombras em todos os meshes */
            model.traverse((child) => {
              if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
              }
            });

            const wg = new T.Group();
            wg.add(model);
            scene.add(wg);
            refs.wg = wg;

            /* Posição inicial z=0, levemente abaixo do centro */
            wg.position.set(0, -0.05, 0);
            /* Inclinação inicial para revelar o mostrador */
            wg.rotation.x = -0.15;

            setPct(100);
            setTimeout(() => { setLoading(false); setBadge(true); }, 300);

            /* ── Loop de animação ─────────────────────────────────
               Movimento de pedestal giratório de joalheria:
               - Rotação Y lenta e suave (showroom)
               - Leve inclinação X (revela espessura)
               - Flutuação Y suave (produto "vivo")
               - Luzes orbitando (reflexos reais no metal)       */
            const t0 = Date.now();
            function loop() {
              raf = requestAnimationFrame(loop);
              const t = (Date.now() - t0) / 1000;

              /* Rotação showroom elegante */
              wg.rotation.y = Math.sin(t * 0.18) * 0.40;
              wg.rotation.x = -0.15 + Math.sin(t * 0.11) * 0.06;
              wg.position.y = -0.05 + Math.sin(t * 0.9) * 0.04;

              /* Spot dourado orbita — reflexo vivo no aço */
              refs.sG.position.set(Math.sin(t * 0.22) * 2.2, 2.5 + Math.cos(t * 0.18) * 0.6, 2.0);
              refs.sG.intensity = 3.5 + Math.sin(t * 0.6) * 0.8;

              /* Ponto no mostrador migra suavemente */
              refs.dL.position.set(Math.cos(t * 0.35) * 0.5, Math.sin(t * 0.35) * 0.5, 1.2);
              refs.dL.intensity = 2.0 + Math.sin(t * 0.9) * 0.5;

              /* Rim sutil */
              refs.rL.intensity = 1.0 + Math.sin(t * 0.4) * 0.25;

              renderer.render(scene, cam3);
            }
            loop();
          },
          /* Progresso do carregamento do GLB */
          (xhr) => {
            if (xhr.lengthComputable) {
              const p = Math.round((xhr.loaded / xhr.total) * 100);
              setPct(Math.max(78, p));
            }
          },
          /* Erro ao carregar GLB */
          (err) => {
            console.error("Erro ao carregar Watch.glb:", err);
            setError("Erro ao carregar modelo 3D. Verifique se Watch.glb está na pasta public/");
            setLoading(false);
          }
        );

        /* ── Resize ────────────────────────────────────────────────── */
        function onResize() {
          cam3.aspect = window.innerWidth / window.innerHeight;
          cam3.updateProjectionMatrix();
          renderer.setSize(window.innerWidth, window.innerHeight);
        }
        window.addEventListener("resize", onResize);
        refs.onResize = onResize;

        /* ── Touch para girar ─────────────────────────────────────── */
        let ltx = 0;
        function onTS(e) { ltx = e.touches[0].clientX; }
        function onTM(e) {
          if (refs.wg) refs.wg.rotation.y += (e.touches[0].clientX - ltx) * 0.012;
          ltx = e.touches[0].clientX;
        }
        const cv = canvasRef.current;
        if (cv) {
          cv.addEventListener("touchstart", onTS);
          cv.addEventListener("touchmove", onTM);
          refs.onTS = onTS;
          refs.onTM = onTM;
        }

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
      if (cv) {
        cv.removeEventListener("touchstart", refs.onTS);
        cv.removeEventListener("touchmove",  refs.onTM);
      }
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
          <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:21, color:"var(--wh)", textAlign:"center" }}>Erro no Scanner AR</div>
          <p style={{ fontSize:12, color:"var(--sv)", textAlign:"center", lineHeight:1.75, maxWidth:270 }}>
            {error.includes("Watch.glb")
              ? "Coloque o arquivo Watch.glb na pasta public/ do projeto."
              : "Permita acesso à câmera e recarregue a página."}
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

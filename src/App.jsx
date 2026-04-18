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

/* ══ Logo ═══════════════════════════════════════════════════════════════ */
/* mix-blend-mode: multiply faz o fundo branco/cinza do PNG desaparecer   */
/* sobre qualquer fundo escuro — solução universal sem depender do alpha   */
function Logo({ width, isSplash, style }) {
  /* Gradientes idênticos aos das telas — o logo "faz parte" do fundo      */
  const bg = isSplash
    ? "radial-gradient(ellipse at 50% 45%, #0E1522 0%, #07090D 100%)"
    : "radial-gradient(ellipse at 38% 12%, #101828 0%, #07090D 80%)";
  return (
    <div style={{ display: "inline-block", background: bg, lineHeight: 0 }}>
      <img
        src="/logo.png"
        alt="Ghost Project AI"
        style={{
          width: width || "min(50vw, 185px)",
          height: "auto",
          display: "block",
          mixBlendMode: "multiply",
          ...style,
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
        cam3.position.set(0, 0, 2.8);
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
          "/relógio.glb",
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
            const scale = 0.35 / maxDim;
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
              wg.position.y = -0.02 + Math.sin(t * 0.9) * 0.025;

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
            console.error("Erro ao carregar relógio.glb:", err);
            setError("Erro ao carregar modelo 3D. Verifique se relógio.glb está na pasta public/");
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

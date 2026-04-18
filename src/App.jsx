import { useEffect, useRef, useState } from "react";

const LOGO = "/logo-1.png";
const CSS = [
  "@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300&family=Montserrat:wght@200;300;400;500;600;700&display=swap');",
  "*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}",
  ":root{--gold:#C9A84C;--gl:#E8C96A;--dk:#07090D;--sv:#A8B4C0;--wh:#F0EDE8;--gn:#4ade80}",
  "html,body,#root{width:100%;height:100%;background:var(--dk);overflow:hidden;font-family:'Montserrat',sans-serif;-webkit-tap-highlight-color:transparent;user-select:none}",
  "@keyframes fadeIn{from{opacity:0}to{opacity:1}}",
  "@keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}",
  "@keyframes shimmer{0%{background-position:-200% center}100%{background-position:200% center}}",
  "@keyframes pulse{0%,100%{opacity:.4;transform:scale(1)}50%{opacity:1;transform:scale(1.2)}}",
  "@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}",
  "@keyframes glow{0%,100%{box-shadow:0 0 20px rgba(201,168,76,.3)}50%{box-shadow:0 0 50px rgba(201,168,76,.8)}}",
  "@keyframes scan{0%{top:0%}100%{top:100%}}",
  "@keyframes pop{0%{opacity:0;transform:scale(.4)}80%{transform:scale(1.06)}100%{opacity:1;transform:scale(1)}}",
  "@keyframes gridPulse{0%,100%{opacity:.2}50%{opacity:.5}}",
  "@keyframes arActive{0%,100%{box-shadow:0 0 6px rgba(74,222,128,.4)}50%{box-shadow:0 0 14px rgba(74,222,128,.9)}}",
].join("\n");

/* ══ Logo com fundo branco → multiply faz branco sumir ══════════════════ */
function Logo({ size }) {
  return (
    <img
      src="/logo-1.png" />
      alt="Ghost Project AI"
      style={{
        width: size || "min(55vw, 200px)",
        height: "auto",
        display: "block",
        mixBlendMode: "multiply",
        filter: "contrast(1.1)",
      }}
    />
  );
}

/* ══ Splash ═════════════════════════════════════════════════════════════ */
function Splash({ onDone }) {
  const [show, setShow] = useState(false);
  const [out,  setOut]  = useState(false);
  useEffect(() => {
    const t1 = setTimeout(() => setShow(true),  300);
    const t2 = setTimeout(() => setOut(true),  2600);
    const t3 = setTimeout(onDone,              3200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);
  return (
    <div style={{
      position:"fixed", inset:0, zIndex:200,
      background:"radial-gradient(ellipse at 50% 40%, #0E1522 0%, #07090D 100%)",
      display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center", gap:20,
      opacity: out ? 0 : 1, transition:"opacity .6s ease",
    }}>
      {[320,500,660].map(s=>(
        <div key={s} style={{position:"absolute",width:s,height:s,borderRadius:"50%",
          border:"1px solid rgba(201,168,76,.08)",pointerEvents:"none"}}/>
      ))}
      <div style={{
        opacity: show ? 1 : 0, transform: show ? "translateY(0)" : "translateY(20px)",
        transition:"all .7s cubic-bezier(.16,1,.3,1)",
        background:"white", borderRadius:12, padding:"4px 8px",
      }}>
        <Logo size="min(52vw, 190px)" />
      </div>
      <p style={{
        fontFamily:"'Cormorant Garamond',serif", fontSize:10,
        letterSpacing:".44em", textTransform:"uppercase",
        color:"rgba(168,180,192,.5)", fontWeight:300,
        opacity: show ? 1 : 0, transition:"opacity .8s ease .4s",
      }}>Luxury · Augmented Reality</p>
      <div style={{position:"absolute",bottom:60,width:120,height:1,background:"rgba(201,168,76,.15)"}}>
        <div style={{height:"100%",background:"linear-gradient(90deg,transparent,var(--gold),transparent)",
          backgroundSize:"200% 100%",animation:"shimmer 1.3s linear infinite"}}/>
      </div>
    </div>
  );
}

/* ══ Home ════════════════════════════════════════════════════════════════ */
function Home({ onStart, cam, setCam }) {
  const [press, setPress] = useState(false);
  return (
    <div style={{
      position:"fixed", inset:0,
      background:"radial-gradient(ellipse at 40% 10%, #101828 0%, #07090D 80%)",
      display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center",
      padding:"0 24px", animation:"fadeIn .6s ease",
    }}>
      {/* Linha decorativa topo */}
      <div style={{position:"absolute",top:0,left:"50%",width:1,height:"22vh",
        background:"linear-gradient(to bottom,transparent,rgba(201,168,76,.25),transparent)",
        pointerEvents:"none"}}/>

      {/* Logo sobre fundo escuro — multiply remove o branco */}
      <div style={{
        marginBottom:12, animation:"fadeUp .7s ease both",
        background:"radial-gradient(ellipse at 40% 10%, #101828 0%, #07090D 80%)",
        borderRadius:10, padding:"2px 6px",
      }}>
        <Logo />
      </div>

      <h1 style={{
        fontFamily:"'Cormorant Garamond',serif",
        fontSize:"clamp(30px,8vw,46px)", fontWeight:300,
        lineHeight:1.1, textAlign:"center", color:"var(--wh)",
        animation:"fadeUp .7s ease .1s both", marginBottom:10,
      }}>
        Try Before<br/>
        <span style={{
          background:"linear-gradient(135deg,var(--gold) 0%,var(--gl) 50%,var(--gold) 100%)",
          backgroundSize:"200% auto", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
          animation:"shimmer 3s linear infinite",
        }}>You Buy</span>
      </h1>

      <p style={{
        fontSize:12, fontWeight:300, color:"var(--sv)",
        lineHeight:1.75, maxWidth:265, textAlign:"center", letterSpacing:".03em",
        animation:"fadeUp .7s ease .2s both", marginBottom:26,
      }}>
        Visualize produtos em escala real através da sua câmera.<br/>
        Tecnologia AR que elimina devoluções.
      </p>

      {/* Seletor câmera */}
      <div style={{
        display:"flex", background:"rgba(255,255,255,.04)",
        borderRadius:12, padding:3,
        border:"1px solid rgba(255,255,255,.07)",
        width:"100%", maxWidth:310,
        animation:"fadeUp .7s ease .3s both", marginBottom:11,
      }}>
        {[{v:"environment",l:"📷  Câmera Traseira"},{v:"user",l:"🤳  Câmera Frontal"}].map(x=>(
          <button key={x.v} onClick={()=>setCam(x.v)} style={{
            flex:1, padding:"10px 4px", borderRadius:9,
            border:"none", cursor:"pointer",
            fontSize:11, fontWeight:500, letterSpacing:".04em",
            fontFamily:"'Montserrat',sans-serif", transition:"all .22s ease",
            background:cam===x.v?"linear-gradient(135deg,var(--gold),#A07020)":"transparent",
            color:cam===x.v?"#07090D":"var(--sv)",
          }}>{x.l}</button>
        ))}
      </div>

      {/* Botão iniciar */}
      <button
        onClick={onStart}
        onPointerDown={()=>setPress(true)}
        onPointerUp={()=>setPress(false)}
        onPointerLeave={()=>setPress(false)}
        style={{
          position:"relative", overflow:"hidden",
          width:"100%", maxWidth:310, padding:"15px 24px",
          borderRadius:14, border:"1px solid rgba(201,168,76,.4)",
          cursor:"pointer",
          background:"linear-gradient(135deg,var(--gold) 0%,#A07020 100%)",
          transform:press?"scale(.97)":"scale(1)", transition:"transform .13s ease",
          animation:"glow 2.5s ease-in-out infinite, fadeUp .7s ease .38s both",
          fontFamily:"'Montserrat',sans-serif", marginBottom:22,
        }}>
        <span style={{display:"flex",alignItems:"center",justifyContent:"center",gap:9,
          fontSize:13,fontWeight:600,letterSpacing:".14em",color:"#07090D",textTransform:"uppercase"}}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="3"/>
            <path d="M3 9V6a2 2 0 012-2h3M3 15v3a2 2 0 002 2h3M15 3h3a2 2 0 012 2v3M15 21h3a2 2 0 002-2v-3"/>
          </svg>
          Iniciar Scanner AR
        </span>
        <div style={{position:"absolute",inset:0,
          background:"linear-gradient(90deg,transparent,rgba(255,255,255,.15),transparent)",
          backgroundSize:"200% 100%",animation:"shimmer 2s linear infinite",pointerEvents:"none"}}/>
      </button>

      <p style={{fontSize:8,color:"rgba(168,180,192,.25)",letterSpacing:".18em",
        textTransform:"uppercase",fontWeight:300,textAlign:"center",
        animation:"fadeUp .7s ease .44s both"}}>
        Ghost Project AI — Powered by WebXR
      </p>
    </div>
  );
}

/* ══ AR Loading ══════════════════════════════════════════════════════════ */
function ARLoading({ pct }) {
  const msgs = ["Iniciando câmera...","Carregando modelo 3D...","Preparando AR...","Quase pronto..."];
  return (
    <div style={{position:"fixed",inset:0,zIndex:80,background:"rgba(7,9,13,.97)",
      backdropFilter:"blur(20px)",display:"flex",flexDirection:"column",
      alignItems:"center",justifyContent:"center",gap:20,animation:"fadeIn .3s ease"}}>
      <div style={{position:"relative",width:64,height:64}}>
        <div style={{position:"absolute",inset:0,borderRadius:"50%",border:"2px solid transparent",
          borderTopColor:"var(--gold)",borderRightColor:"var(--gold)",animation:"spin .85s linear infinite"}}/>
        <div style={{position:"absolute",inset:9,borderRadius:"50%",border:"1px solid transparent",
          borderBottomColor:"rgba(201,168,76,.4)",animation:"spin 1.5s linear infinite reverse"}}/>
        <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",
          justifyContent:"center",fontSize:22}}>⌚</div>
      </div>
      <div style={{textAlign:"center"}}>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18,fontWeight:300,
          color:"var(--wh)",letterSpacing:".05em",marginBottom:5}}>Carregando modelo 3D</div>
        <div style={{fontSize:10,color:"var(--sv)",letterSpacing:".13em"}}>
          {msgs[Math.min(Math.floor(pct/25),3)]}
        </div>
      </div>
      <div style={{width:160,height:2,background:"rgba(255,255,255,.07)",borderRadius:2}}>
        <div style={{height:"100%",borderRadius:2,
          background:"linear-gradient(90deg,var(--gold),var(--gl))",
          width:pct+"%",transition:"width .2s ease",
          boxShadow:"0 0 10px rgba(201,168,76,.7)"}}/>
      </div>
    </div>
  );
}

/* ══ AR View — scanner com HUD premium estilo referência ════════════════ */
function ARView({ cam, onBack }) {
  const canvasRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [pct,     setPct]     = useState(0);
  const [ready,   setReady]   = useState(false);
  const [error,   setError]   = useState("");
  const R = useRef({});

  useEffect(() => {
    let raf, stream;
    const refs = R.current;

    const tick = setInterval(() => {
      setPct(p => { if(p>=78){clearInterval(tick);return p;} return p+Math.random()*12; });
    }, 180);

    function loadScript(src) {
      return new Promise((res,rej) => {
        if(document.querySelector('script[src="'+src+'"]')){res();return;}
        const s=document.createElement("script");
        s.src=src; s.onload=res;
        s.onerror=()=>rej(new Error("Falha: "+src));
        document.head.appendChild(s);
      });
    }

    async function init() {
      try {
        await loadScript("https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js");
        await loadScript("https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js");
        const T = window.THREE;

        /* Câmera */
        stream = await navigator.mediaDevices.getUserMedia({
          video:{facingMode:cam,width:{ideal:1920},height:{ideal:1080}},audio:false,
        });
        const vid=document.createElement("video");
        vid.srcObject=stream; vid.playsInline=true; vid.muted=true;
        await new Promise(r=>{vid.onloadedmetadata=r;});
        await vid.play();

        /* Renderer */
        const renderer=new T.WebGLRenderer({
          canvas:canvasRef.current,alpha:true,antialias:true,
          powerPreference:"high-performance",
        });
        renderer.setSize(window.innerWidth,window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
        renderer.shadowMap.enabled=true;
        renderer.shadowMap.type=T.PCFSoftShadowMap;
        renderer.toneMapping=T.ACESFilmicToneMapping;
        renderer.toneMappingExposure=1.8;

        /* Cena */
        const scene=new T.Scene();
        const vtex=new T.VideoTexture(vid);
        vtex.minFilter=T.LinearFilter;
        scene.background=vtex;

        /* Câmera 3D — FOV calibrado para mostrar relógio em tamanho de pulso */
        const cam3=new T.PerspectiveCamera(50,window.innerWidth/window.innerHeight,0.01,100);
        cam3.position.set(0,0,2.8);
        refs.cam3=cam3;

        /* Iluminação premium */
        scene.add(new T.AmbientLight(0xffffff,0.4));
        const kL=new T.DirectionalLight(0xfff6e8,3.5);
        kL.position.set(-2,5,3); kL.castShadow=true; scene.add(kL);
        const fL=new T.DirectionalLight(0xd8eaff,0.6);
        fL.position.set(4,1,2); scene.add(fL);
        const rL=new T.DirectionalLight(0xffffff,1.2);
        rL.position.set(1,-2,-4); scene.add(rL); refs.rL=rL;
        const sG=new T.SpotLight(0xC9A84C,5,9,Math.PI/3.5,0.25,1);
        sG.position.set(1,3,2); scene.add(sG); refs.sG=sG;
        const dL=new T.PointLight(0xffffff,2.5,3);
        dL.position.set(.3,.3,1.2); scene.add(dL); refs.dL=dL;

        /* Carregar modelo — tenta Watch.glb, fallback para relogio.glb */
        setPct(80);
        const loader=new T.GLTFLoader();

        function loadModel(path, onOk, onFail) {
          loader.load(path, onOk,
            xhr=>{ if(xhr.lengthComputable) setPct(Math.max(80,Math.round(xhr.loaded/xhr.total*100))); },
            ()=>onFail()
          );
        }

        function onModelLoaded(gltf) {
          const model=gltf.scene;
          const box=new T.Box3().setFromObject(model);
          const size=new T.Vector3(); box.getSize(size);
          const center=new T.Vector3(); box.getCenter(center);
          model.position.sub(center);
          /* Escala para tamanho de relógio real no pulso:
             0.32 unidades = ~30-35% do campo de visão com FOV 50° a z=2.8 */
          const maxDim=Math.max(size.x,size.y,size.z);
          model.scale.setScalar(0.32/maxDim);
          model.traverse(c=>{if(c.isMesh){c.castShadow=true;c.receiveShadow=true;}});
          const wg=new T.Group();
          wg.add(model); scene.add(wg); refs.wg=wg;
          wg.position.set(0,-0.02,0);
          wg.rotation.x=-0.12;

          setPct(100);
          setTimeout(()=>{setLoading(false);setReady(true);},280);

          const t0=Date.now();
          function loop(){
            raf=requestAnimationFrame(loop);
            const t=(Date.now()-t0)/1000;
            wg.rotation.y=Math.sin(t*.18)*.38;
            wg.rotation.x=-0.12+Math.sin(t*.11)*.05;
            wg.position.y=-0.02+Math.sin(t*.9)*.022;
            refs.sG.position.set(Math.sin(t*.22)*2.2,2.5+Math.cos(t*.18)*.5,2.0);
            refs.sG.intensity=4+Math.sin(t*.6)*.8;
            refs.dL.position.set(Math.cos(t*.35)*.5,Math.sin(t*.35)*.5,1.2);
            refs.dL.intensity=2+Math.sin(t*.9)*.5;
            refs.rL.intensity=1+Math.sin(t*.4)*.25;
            renderer.render(scene,cam3);
          }
          loop();
        }

        /* Tenta Watch.glb primeiro, depois relogio.glb */
        loadModel("/Watch.glb", onModelLoaded, ()=>{
          loadModel("/relogio.glb", onModelLoaded, ()=>{
            setError("Modelo não encontrado. Coloque Watch.glb ou relogio.glb na pasta public/");
            setLoading(false);
          });
        });

        /* Resize */
        function onResize(){
          cam3.aspect=window.innerWidth/window.innerHeight;
          cam3.updateProjectionMatrix();
          renderer.setSize(window.innerWidth,window.innerHeight);
        }
        window.addEventListener("resize",onResize); refs.onResize=onResize;

        /* Touch girar */
        let ltx=0;
        function onTS(e){ltx=e.touches[0].clientX;}
        function onTM(e){if(refs.wg)refs.wg.rotation.y+=(e.touches[0].clientX-ltx)*.011;ltx=e.touches[0].clientX;}
        const cv=canvasRef.current;
        if(cv){cv.addEventListener("touchstart",onTS);cv.addEventListener("touchmove",onTM);refs.ts=onTS;refs.tm=onTM;}

      } catch(err){
        clearInterval(tick);
        console.error(err);
        setError(err.message||"Erro ao iniciar câmera");
        setLoading(false);
      }
    }
    init();
    return ()=>{
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach(t=>t.stop());
      window.removeEventListener("resize",refs.onResize);
      const cv=canvasRef.current;
      if(cv){cv.removeEventListener("touchstart",refs.ts);cv.removeEventListener("touchmove",refs.tm);}
    };
  }, [cam]);

  return (
    <div style={{position:"fixed",inset:0,background:"#000"}}>
      {loading && <ARLoading pct={pct}/>}
      <canvas ref={canvasRef} style={{width:"100%",height:"100%",display:"block",touchAction:"none"}}/>

      {!loading && !error && (
        <>
          {/* ── HUD TOPO — estilo referência ─────────────────────── */}
          <div style={{
            position:"absolute",top:0,left:0,right:0,
            paddingTop:"max(env(safe-area-inset-top,0px),44px)",
            paddingBottom:12,paddingLeft:16,paddingRight:16,
            background:"linear-gradient(to bottom,rgba(7,9,13,.88),rgba(7,9,13,.4),transparent)",
            display:"flex",flexDirection:"column",alignItems:"center",gap:6,
          }}>
            {/* Botão voltar */}
            <div style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
              <button onClick={onBack} style={{
                display:"flex",alignItems:"center",gap:5,
                padding:"6px 14px",borderRadius:100,
                background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.12)",
                color:"var(--wh)",fontSize:11,fontWeight:500,cursor:"pointer",
                letterSpacing:".05em",backdropFilter:"blur(8px)",fontFamily:"'Montserrat',sans-serif",
              }}>← Voltar</button>

              {/* Badge AR ACTIVE */}
              <div style={{
                display:"flex",alignItems:"center",gap:7,
                padding:"7px 16px",borderRadius:100,
                background:"rgba(10,40,25,.92)",
                border:"1px solid rgba(74,222,128,.4)",
                backdropFilter:"blur(10px)",
                animation:"arActive 2s ease-in-out infinite",
              }}>
                <span style={{fontSize:10,fontWeight:700,color:"var(--gn)",letterSpacing:".12em"}}>AR ACTIVE</span>
                <div style={{width:7,height:7,borderRadius:"50%",background:"var(--gn)",
                  boxShadow:"0 0 8px rgba(74,222,128,.8)",animation:"pulse 1.5s ease-in-out infinite"}}/>
              </div>
            </div>

            {/* Título principal */}
            <div style={{textAlign:"center"}}>
              <div style={{
                fontFamily:"'Montserrat',sans-serif",
                fontSize:18,fontWeight:700,
                color:"var(--wh)",letterSpacing:".18em",
                textShadow:"0 0 20px rgba(201,168,76,.4)",
              }}>GHOST PROJECT</div>
              <div style={{
                fontSize:10,fontWeight:300,
                color:"var(--gold)",letterSpacing:".32em",
                textTransform:"uppercase",marginTop:2,
              }}>LUXURY AR</div>
            </div>

            {/* Specs do produto */}
            <div style={{
              marginTop:4,
              padding:"6px 16px",borderRadius:8,
              background:"rgba(0,0,0,.4)",
              border:"1px solid rgba(201,168,76,.15)",
              backdropFilter:"blur(8px)",
            }}>
              <p style={{
                fontSize:10,color:"rgba(240,237,232,.7)",
                letterSpacing:".1em",textAlign:"center",lineHeight:1.6,
              }}>
                44MM | Sapphire<br/>
                100M WR | Automatic
              </p>
            </div>
          </div>

          {/* ── Cantos scanner + linha ───────────────────────────── */}
          <div style={{position:"absolute",inset:"20%",pointerEvents:"none"}}>
            <div style={{position:"absolute",top:0,left:0,width:20,height:20,borderTop:"1.5px solid var(--gold)",borderLeft:"1.5px solid var(--gold)",opacity:.7}}/>
            <div style={{position:"absolute",top:0,right:0,width:20,height:20,borderTop:"1.5px solid var(--gold)",borderRight:"1.5px solid var(--gold)",opacity:.7}}/>
            <div style={{position:"absolute",bottom:0,left:0,width:20,height:20,borderBottom:"1.5px solid var(--gold)",borderLeft:"1.5px solid var(--gold)",opacity:.7}}/>
            <div style={{position:"absolute",bottom:0,right:0,width:20,height:20,borderBottom:"1.5px solid var(--gold)",borderRight:"1.5px solid var(--gold)",opacity:.7}}/>
            {/* Linhas de grid decorativas */}
            <div style={{position:"absolute",left:0,right:0,top:"50%",height:1,
              background:"linear-gradient(90deg,rgba(201,168,76,.15),rgba(201,168,76,.4),rgba(201,168,76,.15))",opacity:.4}}/>
            <div style={{position:"absolute",top:0,bottom:0,left:"50%",width:1,
              background:"linear-gradient(180deg,rgba(201,168,76,.15),rgba(201,168,76,.4),rgba(201,168,76,.15))",opacity:.4}}/>
            {/* Scan line */}
            <div style={{position:"absolute",left:0,right:0,height:1,
              background:"linear-gradient(90deg,transparent,rgba(201,168,76,.8),transparent)",
              animation:"scan 2.5s linear infinite",boxShadow:"0 0 8px rgba(201,168,76,.5)"}}/>
          </div>

          {/* ── HUD BASE — botão TRY-ON LIVE ────────────────────── */}
          <div style={{
            position:"absolute",bottom:0,left:0,right:0,
            paddingTop:16,paddingLeft:16,paddingRight:16,
            paddingBottom:"max(env(safe-area-inset-bottom,0px),32px)",
            background:"linear-gradient(to top,rgba(7,9,13,.9),rgba(7,9,13,.4),transparent)",
            display:"flex",flexDirection:"column",alignItems:"center",gap:10,
          }}>
            <button
              style={{
                position:"relative",overflow:"hidden",
                width:"100%",maxWidth:300,padding:"14px 24px",
                borderRadius:13,border:"1px solid rgba(201,168,76,.45)",
                cursor:"pointer",
                background:"linear-gradient(135deg,var(--gold) 0%,#A07020 100%)",
                animation:"glow 2.5s ease-in-out infinite",
                fontFamily:"'Montserrat',sans-serif",
              }}>
              <span style={{fontSize:13,fontWeight:700,letterSpacing:".18em",
                color:"#07090D",textTransform:"uppercase"}}>
                TRY-ON LIVE
              </span>
              <div style={{position:"absolute",inset:0,
                background:"linear-gradient(90deg,transparent,rgba(255,255,255,.14),transparent)",
                backgroundSize:"200% 100%",animation:"shimmer 2s linear infinite",pointerEvents:"none"}}/>
            </button>
            <p style={{fontSize:8,color:"rgba(168,180,192,.3)",letterSpacing:".14em",
              textTransform:"uppercase",fontWeight:300}}>
              Arraste para girar · Ghost Project AI
            </p>
          </div>
        </>
      )}

      {/* Erro */}
      {error && !loading && (
        <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",
          alignItems:"center",justifyContent:"center",gap:18,padding:28,
          background:"rgba(7,9,13,.98)"}}>
          <div style={{fontSize:34}}>📷</div>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,color:"var(--wh)",textAlign:"center"}}>
            Erro no Scanner AR
          </div>
          <p style={{fontSize:12,color:"var(--sv)",textAlign:"center",lineHeight:1.75,maxWidth:255}}>
            {error}
          </p>
          <button onClick={onBack} style={{padding:"10px 24px",borderRadius:10,
            border:"1px solid rgba(201,168,76,.4)",background:"transparent",
            color:"var(--gold)",cursor:"pointer",fontFamily:"'Montserrat',sans-serif",
            letterSpacing:".1em",fontSize:11}}>
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
      {screen==="splash" && <Splash onDone={()=>setScreen("home")}/>}
      {screen==="home"   && <Home   onStart={()=>setScreen("ar")} cam={cam} setCam={setCam}/>}
      {screen==="ar"     && <ARView cam={cam} onBack={()=>setScreen("home")}/>}
    </>
  );
}

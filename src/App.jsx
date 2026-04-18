import { useEffect, useRef, useState } from "react";

/* ─── CSS GLOBAL ─────────────────────────────────────────────────────────── */
const GLOBAL_CSS = [
  "@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;600&family=Montserrat:wght@200;300;400;500;600&display=swap');",
  "*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }",
  ":root { --gold:#C9A84C; --gold-light:#E8C96A; --dark:#07090D; --silver:#A8B4C0; --white:#F0EDE8; --green:#4ade80; }",
  "html,body,#root { width:100%; height:100%; background:var(--dark); overflow:hidden; font-family:'Montserrat',sans-serif; -webkit-tap-highlight-color:transparent; user-select:none; }",
  "@keyframes fadeIn  { from{opacity:0} to{opacity:1} }",
  "@keyframes fadeUp  { from{opacity:0;transform:translateY(22px)} to{opacity:1;transform:translateY(0)} }",
  "@keyframes shimmer { 0%{background-position:-200% center} 100%{background-position:200% center} }",
  "@keyframes pulse   { 0%,100%{opacity:.5;transform:scale(1)} 50%{opacity:1;transform:scale(1.12)} }",
  "@keyframes spin    { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }",
  "@keyframes glow    { 0%,100%{box-shadow:0 0 22px rgba(201,168,76,.3)} 50%{box-shadow:0 0 55px rgba(201,168,76,.75)} }",
  "@keyframes scanLine{ 0%{top:0%} 100%{top:100%} }",
  "@keyframes pop     { 0%{opacity:0;transform:scale(.5) translateY(8px)} 70%{transform:scale(1.07)} 100%{opacity:1;transform:scale(1) translateY(0)} }",
  "@keyframes logoGlow{ 0%,100%{filter:drop-shadow(0 0 18px rgba(201,168,76,.55)) brightness(1.1)} 50%{filter:drop-shadow(0 0 42px rgba(201,168,76,.95)) brightness(1.28)} }",
  "@keyframes floatIn { 0%{opacity:0;transform:translateY(30px) scale(.85)} 100%{opacity:1;transform:translateY(0) scale(1)} }",
].join("\n");

/* ─── SPLASH ─────────────────────────────────────────────────────────────── */
function Splash({ onDone }) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 900);
    const t2 = setTimeout(() => setPhase(2), 2700);
    const t3 = setTimeout(onDone, 3400);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);
  return (
    <div style={{
      position:"fixed",inset:0,zIndex:200,
      background:"radial-gradient(ellipse at 50% 40%, #0D1320 0%, #07090D 100%)",
      display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:26,
      transition:"opacity .7s ease", opacity:phase===2?0:1,
    }}>
      {[280,420,560].map((s) => (
        <div key={s} style={{position:"absolute",width:s,height:s,borderRadius:"50%",
          border:"1px solid rgba(201,168,76,"+(0.13-s/6000)+")",pointerEvents:"none"}}/>
      ))}
      {/* FIX 1: mixBlendMode + background transparent para o logo */}
      <div style={{
        position:"relative",
        width:"min(55vw,200px)",
        display:"flex",alignItems:"center",justifyContent:"center",
      }}>
        <img src="/logo.jpg" alt="Ghost Project AI" style={{
          width:"100%", height:"auto", objectFit:"contain",
          mixBlendMode:"multiply",
          filter:"brightness(1.1) contrast(1.05)",
          borderRadius:8,
          animation:"logoGlow 2.5s ease-in-out infinite",
        }}/>
      </div>
      <div style={{
        fontFamily:"'Cormorant Garamond',serif",fontSize:11,letterSpacing:".42em",
        color:"rgba(168,180,192,.6)",fontWeight:300,textTransform:"uppercase",
        opacity:phase>=1?1:0,transition:"opacity .8s ease .2s",
      }}>Augmented Reality · E-Commerce</div>
      <div style={{position:"absolute",bottom:70,width:140,height:1,background:"rgba(201,168,76,.15)"}}>
        <div style={{height:"100%",background:"linear-gradient(90deg,transparent,var(--gold),transparent)",
          backgroundSize:"200% 100%",animation:"shimmer 1.4s linear infinite"}}/>
      </div>
    </div>
  );
}

/* ─── HOME ───────────────────────────────────────────────────────────────── */
function Home({ onStart, cam, setCam }) {
  const [pressing, setPressing] = useState(false);
  return (
    <div style={{
      position:"fixed",inset:0,
      background:"radial-gradient(ellipse at 40% 15%, #101828 0%, #07090D 78%)",
      display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
      padding:"0 28px",animation:"fadeIn .8s ease",
    }}>
      <div style={{position:"absolute",top:0,left:"50%",width:1,height:"28vh",
        background:"linear-gradient(to bottom,transparent,rgba(201,168,76,.22),transparent)",
        pointerEvents:"none"}}/>

      {/* FIX 1: Logo sem fundo cinza — dark background + multiply blend */}
      <div style={{
        background:"#07090D",
        borderRadius:12,
        padding:8,
        marginBottom:8,
        animation:"fadeUp .8s ease both",
        display:"inline-flex",
        alignItems:"center",justifyContent:"center",
      }}>
        <img src="/logo.jpg" alt="Ghost Project AI" style={{
          width:"min(50vw,185px)",height:"auto",objectFit:"contain",
          mixBlendMode:"multiply",
          filter:"brightness(1.15) contrast(1.08) saturate(0.9)",
          display:"block",
          animation:"logoGlow 2.5s ease-in-out infinite",
        }}/>
      </div>

      <h1 style={{
        fontFamily:"'Cormorant Garamond',serif",fontSize:"clamp(34px,9vw,50px)",
        fontWeight:300,lineHeight:1.1,textAlign:"center",color:"var(--white)",
        animation:"fadeUp .8s ease .15s both",marginBottom:14,
      }}>
        Try Before<br/>
        <span style={{
          background:"linear-gradient(135deg,var(--gold) 0%,var(--gold-light) 50%,var(--gold) 100%)",
          backgroundSize:"200% auto",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",
          animation:"shimmer 3s linear infinite",
        }}>You Buy</span>
      </h1>

      <p style={{
        fontSize:12,fontWeight:300,color:"var(--silver)",lineHeight:1.8,
        maxWidth:278,textAlign:"center",letterSpacing:".036em",
        animation:"fadeUp .8s ease .25s both",marginBottom:30,
      }}>
        Visualize produtos em escala real através da sua câmera.<br/>
        Tecnologia AR que elimina devoluções.
      </p>

      <div style={{
        display:"flex",background:"rgba(255,255,255,.04)",borderRadius:14,padding:4,
        border:"1px solid rgba(255,255,255,.07)",width:"100%",maxWidth:320,
        animation:"fadeUp .8s ease .35s both",marginBottom:13,
      }}>
        {[{v:"environment",label:"📷  Câmera Traseira"},{v:"user",label:"🤳  Câmera Frontal"}].map(({v,label}) => (
          <button key={v} onClick={() => setCam(v)} style={{
            flex:1,padding:"11px 6px",borderRadius:10,border:"none",cursor:"pointer",
            fontSize:11,fontWeight:500,letterSpacing:".04em",fontFamily:"'Montserrat',sans-serif",
            transition:"all .25s ease",
            background:cam===v?"linear-gradient(135deg,var(--gold),#A87C22)":"transparent",
            color:cam===v?"#07090D":"var(--silver)",
          }}>{label}</button>
        ))}
      </div>

      <button
        onClick={onStart}
        onPointerDown={() => setPressing(true)}
        onPointerUp={() => setPressing(false)}
        onPointerLeave={() => setPressing(false)}
        style={{
          position:"relative",overflow:"hidden",width:"100%",maxWidth:320,padding:"17px 24px",
          borderRadius:16,border:"1px solid rgba(201,168,76,.4)",cursor:"pointer",
          background:"linear-gradient(135deg,var(--gold) 0%,#A87C22 100%)",
          transform:pressing?"scale(.97)":"scale(1)",transition:"transform .15s ease",
          animation:"glow 2.5s ease-in-out infinite, fadeUp .8s ease .45s both",
          fontFamily:"'Montserrat',sans-serif",marginBottom:26,
        }}>
        <span style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,
          fontSize:13,fontWeight:600,letterSpacing:".14em",color:"#07090D",textTransform:"uppercase"}}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="3"/>
            <path d="M3 9V6a2 2 0 012-2h3M3 15v3a2 2 0 002 2h3M15 3h3a2 2 0 012 2v3M15 21h3a2 2 0 002-2v-3"/>
          </svg>
          Iniciar Scanner AR
        </span>
        <div style={{position:"absolute",inset:0,background:"linear-gradient(90deg,transparent,rgba(255,255,255,.18),transparent)",
          backgroundSize:"200% 100%",animation:"shimmer 2s linear infinite",pointerEvents:"none"}}/>
      </button>

      <p style={{fontSize:9,color:"rgba(168,180,192,.32)",letterSpacing:".18em",
        textTransform:"uppercase",fontWeight:300,textAlign:"center",
        animation:"fadeUp .8s ease .5s both"}}>
        Ghost Project AI — Powered by WebXR
      </p>
    </div>
  );
}

/* ─── AR LOADING ─────────────────────────────────────────────────────────── */
function ARLoading({ pct }) {
  const msgs = ["Iniciando câmera...","Carregando modelo 3D...","Preparando ambiente AR...","Quase pronto..."];
  const idx = Math.min(Math.floor(pct/25), 3);
  return (
    <div style={{position:"fixed",inset:0,zIndex:80,background:"rgba(7,9,13,.96)",
      backdropFilter:"blur(16px)",display:"flex",flexDirection:"column",
      alignItems:"center",justifyContent:"center",gap:24,animation:"fadeIn .3s ease"}}>
      <div style={{position:"relative",width:72,height:72}}>
        <div style={{position:"absolute",inset:0,borderRadius:"50%",border:"2px solid transparent",
          borderTopColor:"var(--gold)",borderRightColor:"var(--gold)",animation:"spin 1s linear infinite"}}/>
        <div style={{position:"absolute",inset:10,borderRadius:"50%",border:"1px solid transparent",
          borderBottomColor:"rgba(201,168,76,.4)",animation:"spin 1.6s linear infinite reverse"}}/>
        <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",
          justifyContent:"center",fontSize:26}}>⌚</div>
      </div>
      <div style={{textAlign:"center",display:"flex",flexDirection:"column",alignItems:"center",gap:8}}>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:300,
          color:"var(--white)",letterSpacing:".06em"}}>Carregando modelo 3D</div>
        <div style={{fontSize:10,color:"var(--silver)",letterSpacing:".15em"}}>{msgs[idx]}</div>
      </div>
      <div style={{width:180,height:2,background:"rgba(255,255,255,.07)",borderRadius:2}}>
        <div style={{height:"100%",borderRadius:2,
          background:"linear-gradient(90deg,var(--gold),var(--gold-light))",
          width:pct+"%",transition:"width .25s ease",boxShadow:"0 0 12px rgba(201,168,76,.6)"}}/>
      </div>
    </div>
  );
}

/* ─── AR VIEW ────────────────────────────────────────────────────────────── */
function ARView({ cam, onBack }) {
  const canvasRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [pct, setPct] = useState(0);
  const [badge, setBadge] = useState(false);
  const [error, setError] = useState("");
  const live = useRef({});

  useEffect(() => {
    const R = live.current;
    let rafId;
    let mediaStream;

    const progTimer = setInterval(() => {
      setPct((p) => { if(p>=88){clearInterval(progTimer);return p;} return p+Math.random()*14; });
    }, 180);

    function loadScript(src) {
      return new Promise(function(resolve, reject) {
        if(document.querySelector('script[src="'+src+'"]')){resolve();return;}
        const s = document.createElement("script");
        s.src = src; s.onload = resolve;
        s.onerror = function(){ reject(new Error("Falha ao carregar: "+src)); };
        document.head.appendChild(s);
      });
    }

    async function init() {
      try {
        await loadScript("https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js");
        const THREE = window.THREE;

        /* Câmera real */
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video:{ facingMode:cam, width:{ideal:1920}, height:{ideal:1080} },
          audio:false,
        });
        const vid = document.createElement("video");
        vid.srcObject = mediaStream; vid.playsInline = true; vid.muted = true;
        await new Promise(function(res){ vid.onloadedmetadata = res; });
        await vid.play();

        /* Renderer de alta qualidade */
        const renderer = new THREE.WebGLRenderer({canvas:canvasRef.current,alpha:true,antialias:true,powerPreference:"high-performance"});
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(devicePixelRatio, 3));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.6;
        renderer.outputEncoding = THREE.sRGBEncoding;

        /* Scene */
        const scene = new THREE.Scene();
        const texVid = new THREE.VideoTexture(vid);
        texVid.minFilter = THREE.LinearFilter;
        texVid.encoding = THREE.sRGBEncoding;
        scene.background = texVid;

        const cam3 = new THREE.PerspectiveCamera(55, window.innerWidth/window.innerHeight, 0.01, 100);
        cam3.position.set(0, 0, 2.8);

        /* FIX 2: Iluminação cinematográfica realista — sem luz ambiente excessiva */
        /* Remover luz ambiente flat que deixa o relógio sem profundidade */
        const ambLight = new THREE.AmbientLight(0xffffff, 0.15); /* bem fraco — só para não ter sombras absolutas */
        scene.add(ambLight);

        /* Key light — simula janela lateral */
        const keyLight = new THREE.DirectionalLight(0xfff5e8, 3.5);
        keyLight.position.set(3, 5, 4);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.width = 1024;
        keyLight.shadow.mapSize.height = 1024;
        scene.add(keyLight);
        R.keyLight = keyLight;

        /* Fill light fraco — lado oposto */
        const fillLight = new THREE.DirectionalLight(0xd0e8ff, 0.4);
        fillLight.position.set(-4, 1, 2);
        scene.add(fillLight);

        /* Rim light — contorno traseiro para separar do fundo */
        const rimLight = new THREE.DirectionalLight(0xffffff, 1.2);
        rimLight.position.set(-2, -3, -5);
        scene.add(rimLight);
        R.rimLight = rimLight;

        /* Spot dourado — brilho quente na pulseira */
        const spotGold = new THREE.SpotLight(0xC9A84C, 4, 8, Math.PI/4, 0.3, 1);
        spotGold.position.set(0, 3, 2);
        scene.add(spotGold);
        R.spotGold = spotGold;

        /* Point de reflexo no mostrador */
        const dialSpot = new THREE.PointLight(0xffffff, 2.5, 3);
        dialSpot.position.set(0.5, 0.5, 1.5);
        scene.add(dialSpot);
        R.dialSpot = dialSpot;

        /* ── CONSTRUÇÃO DO RELÓGIO ──────────────────────────────────── */
        const wg = new THREE.Group();
        scene.add(wg);
        R.wg = wg;

        /* FIX 2: Materiais com alta fidelidade — metalness/roughness corretos para aço real */
        const mSteel = new THREE.MeshStandardMaterial({
          color:0xD0D5DA, metalness:0.99, roughness:0.04,
          envMapIntensity:2.0,
        });
        const mBrushed = new THREE.MeshStandardMaterial({
          color:0xBCC2C8, metalness:0.97, roughness:0.22,
          envMapIntensity:1.5,
        });
        const mSatinSteel = new THREE.MeshStandardMaterial({
          color:0xC8CDD3, metalness:0.96, roughness:0.12,
          envMapIntensity:1.8,
        });
        /* Mostrador — preto profundo com leve reflexo */
        const mDial = new THREE.MeshStandardMaterial({
          color:0x0a0c10, roughness:0.05, metalness:0.6,
          emissive:new THREE.Color(0x040608), emissiveIntensity:1,
        });
        const mGold = new THREE.MeshStandardMaterial({
          color:0xC9A84C, metalness:0.99, roughness:0.03,
          emissive:new THREE.Color(0xC9A84C), emissiveIntensity:0.25,
          envMapIntensity:2.5,
        });
        const mRed = new THREE.MeshStandardMaterial({
          color:0xFF1111, metalness:0.5, roughness:0.15,
          emissive:new THREE.Color(0xFF0000), emissiveIntensity:0.8,
        });
        const mHandSteel = new THREE.MeshStandardMaterial({
          color:0xF0F4F8, metalness:0.99, roughness:0.02,
          emissive:new THREE.Color(0xffffff), emissiveIntensity:0.1,
        });
        const mCrystal = new THREE.MeshPhysicalMaterial({
          color:0xffffff, transparent:true, opacity:0.08,
          roughness:0.0, metalness:0.0,
          transmission:0.95, ior:1.5,
          thickness:0.02,
        });
        /* Índices brancos com emissive para brilharem no escuro */
        const mIdxW = new THREE.MeshStandardMaterial({
          color:0xF0F4F8, metalness:0.98, roughness:0.03,
          emissive:new THREE.Color(0xffffff), emissiveIntensity:0.4,
        });
        const mIdxG = new THREE.MeshStandardMaterial({
          color:0xD4A84C, metalness:0.99, roughness:0.02,
          emissive:new THREE.Color(0xC9A84C), emissiveIntensity:0.6,
        });

        /* ── PULSEIRA DE AÇO (bracelet) ─────────────────────────────── */
        const gBig = new THREE.BoxGeometry(0.30, 0.088, 0.052);
        const gSm  = new THREE.BoxGeometry(0.138, 0.068, 0.042);
        function addLink(y, dir) {
          const big = new THREE.Mesh(gBig, mBrushed);
          big.position.set(0, y, 0); big.castShadow=true; big.receiveShadow=true; wg.add(big);
          const sl = new THREE.Mesh(gSm, mSatinSteel);
          sl.position.set(-0.10, y+dir*0.050, 0.005); sl.castShadow=true; wg.add(sl);
          const sr = new THREE.Mesh(gSm, mSatinSteel);
          sr.position.set( 0.10, y+dir*0.050, 0.005); sr.castShadow=true; wg.add(sr);
        }
        for(let i=0;i<6;i++){ addLink( 0.44+i*0.103,  1); }
        for(let i=0;i<6;i++){ addLink(-0.44-i*0.103, -1); }

        /* Fivela borboleta */
        const clasp = new THREE.Mesh(new THREE.BoxGeometry(0.30,0.115,0.048), mSatinSteel);
        clasp.position.set(0,-1.12,0); wg.add(clasp);
        const claspB = new THREE.Mesh(new THREE.BoxGeometry(0.26,0.038,0.028), mGold);
        claspB.position.set(0,-1.12,0.038); wg.add(claspB);

        /* ── CAIXA PRINCIPAL ────────────────────────────────────────── */
        /* Caixa octogonal (mais premium que circular simples) */
        const wcase = new THREE.Mesh(new THREE.CylinderGeometry(0.44,0.44,0.125,10,1), mSteel);
        wcase.rotation.x = Math.PI/2; wcase.castShadow=true; wcase.receiveShadow=true; wg.add(wcase);

        /* Bisel com faceta mais fina e brilhante */
        const gBevel = new THREE.TorusGeometry(0.44, 0.020, 14, 10);
        const bT = new THREE.Mesh(gBevel, mSteel); bT.position.z= 0.063; wg.add(bT);
        const bB = new THREE.Mesh(gBevel, mSteel); bB.position.z=-0.063; wg.add(bB);

        /* Anel bezel externo */
        const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.44,0.030,10,72), mSatinSteel);
        bezel.position.z=0.068; wg.add(bezel);

        /* Lugs (4 pcs) */
        const gLug = new THREE.BoxGeometry(0.085,0.175,0.095);
        [[-0.175,0.46],[0.175,0.46],[-0.175,-0.46],[0.175,-0.46]].forEach(function(xy){
          const l=new THREE.Mesh(gLug,mBrushed); l.position.set(xy[0],xy[1],0); l.castShadow=true; wg.add(l);
        });

        /* ── MOSTRADOR ──────────────────────────────────────────────── */
        const dial = new THREE.Mesh(new THREE.CircleGeometry(0.40,72), mDial);
        dial.position.z=0.066; wg.add(dial);

        /* Sub-anel interno do mostrador (textura sunburst simulada com círculos) */
        const innerRing = new THREE.Mesh(
          new THREE.TorusGeometry(0.32,0.015,8,64),
          new THREE.MeshStandardMaterial({color:0x1a1d22,metalness:0.5,roughness:0.4})
        );
        innerRing.position.z=0.067; wg.add(innerRing);

        /* ── ÍNDICES DE HORA ────────────────────────────────────────── */
        for(let i=0;i<12;i++){
          const a = (i/12)*Math.PI*2 - Math.PI/2;
          const isMain = i%3===0;
          const geo = new THREE.BoxGeometry(isMain?0.024:0.012, isMain?0.078:0.052, 0.009);
          const idx = new THREE.Mesh(geo, isMain?mIdxG:mIdxW);
          idx.position.set(Math.cos(a)*0.310, Math.sin(a)*0.310, 0.071);
          idx.rotation.z = a+Math.PI/2;
          wg.add(idx);
        }

        /* Janela de data às 3h */
        const dw = new THREE.Mesh(new THREE.BoxGeometry(0.070,0.050,0.004),
          new THREE.MeshStandardMaterial({color:0xf0f0f0,roughness:0.15,metalness:0.2}));
        dw.position.set(0.265,0,0.072); wg.add(dw);

        /* ── PONTEIROS ──────────────────────────────────────────────── */
        /* Ponteiro de horas — formato Dauphine (mais largo no centro) */
        const hHand = new THREE.Mesh(new THREE.BoxGeometry(0.022,0.195,0.009), mHandSteel);
        hHand.position.set(0,0.038,0.076); wg.add(hHand); R.hHand=hHand;

        /* Ponteiro de minutos */
        const mHand = new THREE.Mesh(new THREE.BoxGeometry(0.015,0.275,0.009), mHandSteel);
        mHand.position.set(0,0.062,0.077); wg.add(mHand); R.mHand=mHand;

        /* Ponteiro de segundos — vermelho fino, com contrapeso */
        const sHand = new THREE.Mesh(new THREE.BoxGeometry(0.005,0.315,0.005), mRed);
        sHand.position.set(0,0.068,0.079); wg.add(sHand); R.sHand=sHand;

        /* Contrapeso do ponteiro de segundos */
        const sCounter = new THREE.Mesh(new THREE.BoxGeometry(0.010,0.065,0.005), mRed);
        sCounter.position.set(0,-0.090,0.079); sHand.add(sCounter);

        /* Tampa central */
        const cap = new THREE.Mesh(new THREE.CircleGeometry(0.020,18), mGold);
        cap.position.z=0.082; wg.add(cap);
        const capRing = new THREE.Mesh(new THREE.TorusGeometry(0.020,0.004,8,18), mSteel);
        capRing.position.z=0.082; wg.add(capRing);

        /* Vidro safira */
        const crystal = new THREE.Mesh(new THREE.CircleGeometry(0.40,72), mCrystal);
        crystal.position.z=0.085; wg.add(crystal);

        /* ── COROA E BOTÕES ─────────────────────────────────────────── */
        const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.028,0.030,0.060,18), mSatinSteel);
        crown.position.set(0.48,0.08,0); crown.rotation.z=Math.PI/2; wg.add(crown);
        const ck = new THREE.Mesh(new THREE.CylinderGeometry(0.032,0.032,0.038,18), mBrushed);
        ck.position.set(0.51,0.08,0); ck.rotation.z=Math.PI/2; wg.add(ck);

        const gP = new THREE.CylinderGeometry(0.014,0.014,0.038,10);
        const p1=new THREE.Mesh(gP,mSatinSteel); p1.position.set(0.48, 0.24,0); p1.rotation.z=Math.PI/2; wg.add(p1);
        const p2=new THREE.Mesh(gP,mSatinSteel); p2.position.set(0.48,-0.06,0); p2.rotation.z=Math.PI/2; wg.add(p2);

        /* ── PARTÍCULAS DE BRILHO ───────────────────────────────────── */
        const pgeo = new THREE.BufferGeometry();
        const pp = new Float32Array(60*3);
        for(let i=0;i<60;i++){pp[i*3]=(Math.random()-.5)*1.5;pp[i*3+1]=(Math.random()-.5)*1.5;pp[i*3+2]=(Math.random()-.5)*.3;}
        pgeo.setAttribute("position",new THREE.BufferAttribute(pp,3));
        const parts = new THREE.Points(pgeo,new THREE.PointsMaterial({color:0xE8C96A,size:0.008,transparent:true,opacity:0.6}));
        wg.add(parts); R.parts=parts;

        /* Estado inicial — pequeno para animação de entrada */
        wg.scale.setScalar(0.01);
        wg.position.set(0, -0.1, 0);

        /* Done */
        clearInterval(progTimer); setPct(100);
        setTimeout(function(){ setLoading(false); setBadge(true); }, 380);

        /* ── FIX 2: LOOP DE ANIMAÇÃO — movimento fluido e realista ─── */
        const t0 = Date.now();
        let lastSec = -1;

        function loop(){
          rafId = requestAnimationFrame(loop);
          const t = (Date.now()-t0)/1000;

          /* Entrada suave */
          if(t < 1.4){
            const ease = 1 - Math.pow(1-Math.min(1,t/1.4), 3);
            wg.scale.setScalar(ease);
          } else {
            wg.scale.setScalar(1);
          }

          /* FIX 2: Movimento convincente — rotação lenta e elegante como showroom */
          /* Eixo Y: giro lento contínuo em um arco (não sacude) */
          wg.rotation.y = Math.sin(t * 0.18) * 0.45;
          /* Eixo X: inclinação leve para mostrar profundidade */
          wg.rotation.x = -0.15 + Math.sin(t * 0.12) * 0.08;
          /* Flutuação suave no Y */
          wg.position.y = -0.1 + Math.sin(t * 0.9) * 0.06;
          /* Micro movimento no X para parecer vivo */
          wg.position.x = Math.sin(t * 0.22) * 0.04;

          /* Ponteiros com hora real — tick exato no segundo */
          const now = new Date();
          const h = now.getHours()%12;
          const m = now.getMinutes();
          const s = now.getSeconds() + now.getMilliseconds()/1000;
          R.sHand.rotation.z = -(s/60)*Math.PI*2;
          R.mHand.rotation.z = -((m+s/60)/60)*Math.PI*2;
          R.hHand.rotation.z = -((h+m/60)/12)*Math.PI*2;

          /* Iluminação dinâmica — simula rotação da luz como ambiente real */
          R.spotGold.position.x = Math.sin(t*0.3)*2;
          R.spotGold.position.z = 2 + Math.cos(t*0.3)*0.5;
          R.spotGold.intensity = 3.5 + Math.sin(t*0.7)*1.0;

          R.rimLight.intensity = 1.0 + Math.sin(t*0.5)*0.3;
          R.dialSpot.intensity = 2.0 + Math.sin(t*1.1)*0.5;
          R.dialSpot.position.set(Math.cos(t*0.4)*0.8, Math.sin(t*0.4)*0.8, 1.5);

          /* Partículas */
          R.parts.material.opacity = 0.4 + Math.sin(t*1.6)*0.2;
          R.parts.rotation.z = t*0.06;

          renderer.render(scene, cam3);
        }
        loop();

        /* Resize */
        function onResize(){
          cam3.aspect = window.innerWidth/window.innerHeight;
          cam3.updateProjectionMatrix();
          renderer.setSize(window.innerWidth,window.innerHeight);
        }
        window.addEventListener("resize",onResize); R.onResize=onResize;

        /* Toque para girar */
        let ltx=0;
        function onTS(e){ltx=e.touches[0].clientX;}
        function onTM(e){wg.rotation.y+=(e.touches[0].clientX-ltx)*0.012;ltx=e.touches[0].clientX;}
        const canvas=canvasRef.current;
        if(canvas){canvas.addEventListener("touchstart",onTS);canvas.addEventListener("touchmove",onTM);}
        R.onTS=onTS; R.onTM=onTM;

      } catch(err){
        clearInterval(progTimer);
        console.error(err);
        setError(err.message||"Erro ao iniciar câmera");
        setLoading(false);
      }
    }

    init();

    return function(){
      cancelAnimationFrame(rafId);
      if(mediaStream) mediaStream.getTracks().forEach(function(t){t.stop();});
      window.removeEventListener("resize",R.onResize);
      const canvas=canvasRef.current;
      if(canvas){canvas.removeEventListener("touchstart",R.onTS);canvas.removeEventListener("touchmove",R.onTM);}
    };
  }, [cam]);

  return (
    <div style={{position:"fixed",inset:0,background:"#000"}}>
      {loading && <ARLoading pct={pct}/>}
      <canvas ref={canvasRef} style={{width:"100%",height:"100%",display:"block",touchAction:"none"}}/>

      {!loading && !error && (
        <>
          {/* Top HUD */}
          <div style={{
            position:"absolute",top:0,left:0,right:0,
            paddingTop:"max(env(safe-area-inset-top,0px),44px)",
            paddingBottom:18,paddingLeft:18,paddingRight:18,
            background:"linear-gradient(to bottom,rgba(7,9,13,.8),transparent)",
            display:"flex",alignItems:"center",justifyContent:"space-between",
          }}>
            <button onClick={onBack} style={{
              display:"flex",alignItems:"center",gap:7,padding:"8px 16px",borderRadius:100,
              background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.13)",
              color:"var(--white)",fontSize:11,fontWeight:500,cursor:"pointer",letterSpacing:".05em",
              backdropFilter:"blur(8px)",fontFamily:"'Montserrat',sans-serif",
            }}>← Voltar</button>

            {badge && (
              <div style={{display:"flex",alignItems:"center",gap:7,padding:"7px 14px",borderRadius:100,
                background:"rgba(20,80,55,.9)",border:"1px solid rgba(74,222,128,.35)",
                backdropFilter:"blur(8px)",animation:"pop .5s cubic-bezier(.16,1,.3,1) both"}}>
                <div style={{width:6,height:6,borderRadius:"50%",background:"var(--green)",animation:"pulse 2s ease-in-out infinite"}}/>
                <span style={{fontSize:9,color:"var(--green)",letterSpacing:".14em",fontWeight:600}}>👻 GHOST PROJECT AR</span>
              </div>
            )}
          </div>

          {/* Cantos do scanner */}
          <div style={{position:"absolute",inset:"18%",pointerEvents:"none"}}>
            <div style={{position:"absolute",top:0,left:0,width:24,height:24,borderTop:"2px solid var(--gold)",borderLeft:"2px solid var(--gold)",opacity:.7}}/>
            <div style={{position:"absolute",top:0,right:0,width:24,height:24,borderTop:"2px solid var(--gold)",borderRight:"2px solid var(--gold)",opacity:.7}}/>
            <div style={{position:"absolute",bottom:0,left:0,width:24,height:24,borderBottom:"2px solid var(--gold)",borderLeft:"2px solid var(--gold)",opacity:.7}}/>
            <div style={{position:"absolute",bottom:0,right:0,width:24,height:24,borderBottom:"2px solid var(--gold)",borderRight:"2px solid var(--gold)",opacity:.7}}/>
            <div style={{position:"absolute",left:0,right:0,height:1,
              background:"linear-gradient(90deg,transparent,rgba(201,168,76,.8),transparent)",
              animation:"scanLine 2.5s linear infinite",boxShadow:"0 0 8px rgba(201,168,76,.5)"}}/>
          </div>

          {/* FIX 3: Rodapé limpo — só texto Ghost Project AI, sem card desnecessário */}
          <div style={{
            position:"absolute",bottom:0,left:0,right:0,
            paddingTop:20,paddingLeft:18,paddingRight:18,
            paddingBottom:"max(env(safe-area-inset-bottom,0px),28px)",
            background:"linear-gradient(to top,rgba(7,9,13,.75),transparent)",
            display:"flex",flexDirection:"column",alignItems:"center",gap:6,
          }}>
            <p style={{
              fontSize:9,color:"rgba(201,168,76,.5)",
              letterSpacing:".16em",textTransform:"uppercase",fontWeight:400,
              textAlign:"center",
            }}>
              ARRASTE PARA GIRAR
            </p>
            <p style={{fontSize:8,color:"rgba(168,180,192,.3)",letterSpacing:".16em",textTransform:"uppercase",fontWeight:300}}>
              Ghost Project AI — Powered by WebXR
            </p>
          </div>
        </>
      )}

      {/* Tela de erro */}
      {error && !loading && (
        <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",
          alignItems:"center",justifyContent:"center",gap:20,padding:32,background:"rgba(7,9,13,.97)"}}>
          <div style={{fontSize:38}}>📷</div>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,color:"var(--white)",textAlign:"center"}}>
            Câmera não autorizada
          </div>
          <div style={{fontSize:12,color:"var(--silver)",textAlign:"center",lineHeight:1.75,maxWidth:265}}>
            Permita o acesso à câmera nas configurações do navegador e recarregue a página.<br/><br/>
            <span style={{fontSize:10,color:"rgba(168,180,192,.45)"}}>{error}</span>
          </div>
          <button onClick={onBack} style={{padding:"12px 28px",borderRadius:12,
            border:"1px solid rgba(201,168,76,.4)",background:"transparent",color:"var(--gold)",
            cursor:"pointer",fontFamily:"'Montserrat',sans-serif",letterSpacing:".1em",fontSize:12}}>
            ← Voltar
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── ROOT ───────────────────────────────────────────────────────────────── */
export default function App() {
  const [screen, setScreen] = useState("splash");
  const [cam, setCam] = useState("environment");
  return (
    <>
      <style>{GLOBAL_CSS}</style>
      {screen==="splash" && <Splash onDone={() => setScreen("home")}/>}
      {screen==="home"   && <Home onStart={() => setScreen("ar")} cam={cam} setCam={setCam}/>}
      {screen==="ar"     && <ARView cam={cam} onBack={() => setScreen("home")}/>}
    </>
  );
}

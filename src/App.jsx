import { useEffect, useRef, useState } from "react";

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;600&family=Montserrat:wght@300;400;500;600&display=swap');

*{margin:0;padding:0;box-sizing:border-box;}
html,body,#root{
  width:100%;
  height:100%;
  background:#07090D;
  font-family:'Montserrat',sans-serif;
  overflow:hidden;
}

/* animações premium */
@keyframes fadeIn {from{opacity:0} to{opacity:1}}
@keyframes fadeUp {from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)}}
@keyframes glow {0%,100%{box-shadow:0 0 20px rgba(201,168,76,.3)}50%{box-shadow:0 0 60px rgba(201,168,76,.8)}}
@keyframes float {0%{transform:translateY(0)}50%{transform:translateY(-6px)}100%{transform:translateY(0)}}
`;

/* ================= SPLASH ================= */
function Splash({ onDone }) {
  useEffect(()=>{
    const t=setTimeout(onDone,2600);
    return ()=>clearTimeout(t);
  },[]);
  return (
    <div style={{
      position:"fixed",inset:0,
      display:"flex",alignItems:"center",justifyContent:"center",
      background:"#07090D",
      animation:"fadeIn 1s"
    }}>
      <img 
        src="/logo.png" 
        style={{
          width:180,
          animation:"fadeUp 1.2s ease"
        }} 
      />
    </div>
  );
}

/* ================= HOME ================= */
function Home({ onStart, cam, setCam }) {
  return (
    <div style={{
      position:"fixed",inset:0,
      display:"flex",flexDirection:"column",
      alignItems:"center",justifyContent:"center",
      background:"radial-gradient(circle at 30% 10%,#101826,#07090D)",
      padding:24
    }}>

      {/* LOGO LIMPO (SEM FUNDO) */}
      <img 
        src="/logo.png" 
        style={{
          width:150,
          marginBottom:20,
          animation:"fadeUp .8s ease"
        }} 
      />

      <h1 style={{
        fontFamily:"Cormorant Garamond",
        fontSize:44,
        color:"#F0EDE8",
        textAlign:"center",
        lineHeight:1.1
      }}>
        Try Before<br/>
        <span style={{color:"#C9A84C"}}>You Buy</span>
      </h1>

      <p style={{
        color:"#A8B4C0",
        fontSize:13,
        textAlign:"center",
        margin:"18px 0 28px",
        maxWidth:260
      }}>
        Experimente produtos reais em 3D direto no seu corpo ou ambiente.
      </p>

      <div style={{display:"flex",gap:10}}>
        <button onClick={()=>setCam("environment")}
          style={{
            padding:10,
            borderRadius:10,
            background:cam==="environment"?"#C9A84C":"#1a1a1a",
            color:"#fff"
          }}>
          📷 Traseira
        </button>

        <button onClick={()=>setCam("user")}
          style={{
            padding:10,
            borderRadius:10,
            background:cam==="user"?"#C9A84C":"#1a1a1a",
            color:"#fff"
          }}>
          🤳 Frontal
        </button>
      </div>

      <button onClick={onStart}
        style={{
          marginTop:28,
          padding:"16px 38px",
          borderRadius:14,
          background:"#C9A84C",
          color:"#07090D",
          fontWeight:600,
          animation:"glow 2.5s infinite"
        }}>
        Iniciar Scanner AR
      </button>
    </div>
  );
}

/* ================= AR VIEW ================= */
function ARView({ cam, onBack }) {
  const canvasRef=useRef();

  useEffect(()=>{
    let renderer,scene,camera,stream,raf;

    async function init(){
      await loadScript("https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js");
      const T=window.THREE;

      stream=await navigator.mediaDevices.getUserMedia({
        video:{facingMode:cam},audio:false
      });

      const video=document.createElement("video");
      video.srcObject=stream;
      await video.play();

      renderer=new T.WebGLRenderer({
        canvas:canvasRef.current,
        alpha:true,
        antialias:true
      });

      renderer.setSize(window.innerWidth,window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));

      scene=new T.Scene();

      const texture=new T.VideoTexture(video);
      scene.background=texture;

      camera=new T.PerspectiveCamera(50,window.innerWidth/window.innerHeight,0.1,100);
      camera.position.z=2;

      /* iluminação premium */
      const key=new T.DirectionalLight(0xffffff,1.8);
      key.position.set(3,5,4);
      scene.add(key);

      const fill=new T.PointLight(0xffffff,0.8);
      fill.position.set(-2,-1,3);
      scene.add(fill);

      const rim=new T.DirectionalLight(0xffffff,0.6);
      rim.position.set(-4,2,-3);
      scene.add(rim);

      const group=new T.Group();
      scene.add(group);

      /* RELÓGIO MAIS REALISTA */
      const body=new T.Mesh(
        new T.CylinderGeometry(0.32,0.32,0.12,64),
        new T.MeshStandardMaterial({
          color:0xd9d9d9,
          metalness:1,
          roughness:0.2
        })
      );
      body.rotation.x=Math.PI/2;
      group.add(body);

      const glass=new T.Mesh(
        new T.CircleGeometry(0.30,64),
        new T.MeshStandardMaterial({
          color:0xffffff,
          transparent:true,
          opacity:0.12
        })
      );
      glass.position.z=0.07;
      group.add(glass);

      const strapGeo=new T.BoxGeometry(0.16,0.85,0.06);
      const strapMat=new T.MeshStandardMaterial({
        color:0x111111,
        roughness:0.9
      });

      const s1=new T.Mesh(strapGeo,strapMat);
      s1.position.y=0.65;
      group.add(s1);

      const s2=s1.clone();
      s2.position.y=-0.65;
      group.add(s2);

      /* POSIÇÃO MAIS "DE PULSO" */
      group.position.set(0,-0.35,0);
      group.scale.set(0.9,0.9,0.9);

      let t=0;

      function animate(){
        raf=requestAnimationFrame(animate);

        t+=0.01;

        /* movimento elegante */
        group.rotation.y = Math.sin(t)*0.2;
        group.rotation.x = -0.2;
        group.position.y = -0.35 + Math.sin(t*2)*0.02;

        renderer.render(scene,camera);
      }

      animate();
    }

    function loadScript(src){
      return new Promise(res=>{
        const s=document.createElement("script");
        s.src=src;
        s.onload=res;
        document.body.appendChild(s);
      });
    }

    init();

    return ()=>{
      if(stream) stream.getTracks().forEach(t=>t.stop());
      cancelAnimationFrame(raf);
    };

  },[cam]);

  return (
    <div style={{position:"fixed",inset:0}}>

      <canvas ref={canvasRef} style={{width:"100%",height:"100%"}}/>

      {/* UI overlay */}
      <button onClick={onBack}
        style={{
          position:"absolute",
          top:20,
          left:20,
          padding:"10px 16px",
          borderRadius:10,
          background:"rgba(0,0,0,.6)",
          color:"#fff"
        }}>
        ← Voltar
      </button>

      <div style={{
        position:"absolute",
        top:20,
        right:20,
        padding:"8px 14px",
        borderRadius:20,
        background:"rgba(20,60,40,.8)",
        color:"#4ade80",
        fontSize:10
      }}>
        ● GHOST PROJECT AR
      </div>

      <div style={{
        position:"absolute",
        bottom:20,
        width:"100%",
        textAlign:"center",
        color:"#aaa",
        fontSize:11
      }}>
        Arraste para girar
      </div>

    </div>
  );
}

/* ================= ROOT ================= */
export default function App(){
  const [screen,setScreen]=useState("splash");
  const [cam,setCam]=useState("environment");

  return (
    <>
      <style>{CSS}</style>
      {screen==="splash" && <Splash onDone={()=>setScreen("home")} />}
      {screen==="home" && <Home onStart={()=>setScreen("ar")} cam={cam} setCam={setCam} />}
      {screen==="ar" && <ARView cam={cam} onBack={()=>setScreen("home")} />}
    </>
  );
}

import { useEffect, useRef, useState } from "react";

export default function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [status, setStatus] = useState("init");

  const startAR = async () => {
    setStatus("loading");
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = s;
      videoRef.current.srcObject = s;
      setStatus("active");
    } catch (e) { alert("Erro na câmera"); setStatus("init"); }
  };

  return (
    <div style={{ background: '#000', color: '#fff', height: '100vh', textAlign: 'center' }}>
      <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute' }} autoPlay playsInline muted />
      <div style={{ position: 'relative', zIndex: 10, paddingTop: '50px' }}>
        <img src="https://i.postimg.cc/RVQVdBx3/1776216880651.jpg" style={{ width: '120px' }} alt="Logo" />
        <h1 style={{ color: '#d4af37' }}>GHOST PROJECT</h1>
        {status === "init" && <button onClick={startAR} style={{ padding: '10px 20px' }}>INICIAR</button>}
      </div>
    </div>
  );
}

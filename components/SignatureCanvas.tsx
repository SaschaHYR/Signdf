"use client";

import { useRef, useEffect, useState, useCallback } from "react";

interface Props {
  onChange: (dataUrl: string | null) => void;
}

export default function SignatureCanvas({ onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [isEmpty, setIsEmpty] = useState(true);

  const getPos = (e: { clientX: number; clientY: number }, rect: DOMRect) => ({
    x: (e.clientX - rect.left) * (canvasRef.current!.width / rect.width),
    y: (e.clientY - rect.top) * (canvasRef.current!.height / rect.height),
  });

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.strokeStyle = "#1a1a2e";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  const startDraw = useCallback((x: number, y: number) => {
    const ctx = canvasRef.current!.getContext("2d")!;
    drawing.current = true;
    ctx.beginPath();
    ctx.moveTo(x, y);
  }, []);

  const draw = useCallback((x: number, y: number) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.lineTo(x, y);
    ctx.stroke();
    if (isEmpty) {
      setIsEmpty(false);
      onChange(canvasRef.current!.toDataURL("image/png"));
    }
  }, [isEmpty, onChange]);

  const endDraw = useCallback(() => {
    if (!drawing.current) return;
    drawing.current = false;
    onChange(canvasRef.current!.toDataURL("image/png"));
  }, [onChange]);

  const clear = useCallback(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setIsEmpty(true);
    onChange(null);
  }, [onChange]);

  return (
    <div style={{ position: "relative" }}>
      <canvas
        ref={canvasRef}
        width={440}
        height={120}
        style={{ width: "100%", height: 120, background: "#f8f8f4", borderRadius: 2, cursor: "crosshair", touchAction: "none", display: "block" }}
        onMouseDown={(e) => { const r = canvasRef.current!.getBoundingClientRect(); startDraw(...Object.values(getPos(e.nativeEvent, r)) as [number, number]); }}
        onMouseMove={(e) => { const r = canvasRef.current!.getBoundingClientRect(); draw(...Object.values(getPos(e.nativeEvent, r)) as [number, number]); }}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={(e) => { e.preventDefault(); const r = canvasRef.current!.getBoundingClientRect(); startDraw(...Object.values(getPos(e.touches[0], r)) as [number, number]); }}
        onTouchMove={(e) => { e.preventDefault(); const r = canvasRef.current!.getBoundingClientRect(); draw(...Object.values(getPos(e.touches[0], r)) as [number, number]); }}
        onTouchEnd={endDraw}
      />
      <div style={{ position: "absolute", bottom: 6, left: 0, right: 0, borderTop: "1px dashed rgba(0,0,0,0.15)", margin: "0 12px", pointerEvents: "none" }} />
      {!isEmpty && (
        <button
          onClick={clear}
          style={{ position: "absolute", top: 6, right: 6, padding: "3px 8px", background: "transparent", border: "1px solid rgba(0,0,0,0.15)", borderRadius: 2, fontSize: 10, color: "#666", cursor: "pointer", fontFamily: "Orbitron,monospace", letterSpacing: 1 }}
        >
          EFFACER
        </button>
      )}
      {isEmpty && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <span style={{ fontFamily: "Rajdhani,sans-serif", fontSize: 13, color: "rgba(0,0,0,0.25)" }}>Signez ici avec votre doigt ou souris</span>
        </div>
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PlacementCoord } from "@/lib/signPdf";

interface DraggableBlock {
  id: "signature" | "paraphe";
  page: number;
  xRatio: number;
  yRatio: number;
}

interface Props {
  pdfUrl: string;
  signerName: string;
  withParaphe: boolean;
  onConfirm: (signature: PlacementCoord, paraphe: PlacementCoord | null) => void;
  onCancel: () => void;
}

interface PageInfo {
  canvas: HTMLCanvasElement;
  width: number;   // PDF points
  height: number;
}

const SIG_W_RATIO = 200 / 595;
const SIG_H_RATIO = 72 / 842;
const PAR_W_RATIO = 56 / 595;
const PAR_H_RATIO = 40 / 842;

export default function PdfPlacementEditor({ pdfUrl, signerName, withParaphe, onConfirm, onCancel }: Props) {
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [blocks, setBlocks] = useState<DraggableBlock[]>([
    { id: "signature", page: 0, xRatio: 0.6, yRatio: 0.85 },
    { id: "paraphe",   page: 0, xRatio: 0.05, yRatio: 0.85 },
  ]);
  const dragging = useRef<{ id: "signature" | "paraphe"; startX: number; startY: number; origXR: number; origYR: number } | null>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function renderPdf() {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const loadingTask = pdfjsLib.getDocument({ url: pdfUrl });
        const pdf = await loadingTask.promise;
        const rendered: PageInfo[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1.5 });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await page.render({ canvas, viewport } as any).promise;
          const pdfViewport = page.getViewport({ scale: 1 });
          rendered.push({ canvas, width: pdfViewport.width, height: pdfViewport.height });
        }
        if (!cancelled) {
          setPages(rendered);
          setBlocks(prev => {
            const lastPage = rendered.length - 1;
            return prev.map(b => ({ ...b, page: b.id === "signature" ? lastPage : Math.min(b.page, lastPage) }));
          });
          setLoading(false);
        }
      } catch (e) {
        console.error("PDF render error", e);
        if (!cancelled) setLoading(false);
      }
    }
    renderPdf();
    return () => { cancelled = true; };
  }, [pdfUrl]);

  const getPageRect = useCallback((pageIdx: number) => {
    return pageRefs.current[pageIdx]?.getBoundingClientRect() ?? null;
  }, []);

  const startDrag = useCallback((clientX: number, clientY: number, id: "signature" | "paraphe") => {
    const blk = blocks.find(b => b.id === id);
    if (!blk) return;
    dragging.current = { id, startX: clientX, startY: clientY, origXR: blk.xRatio, origYR: blk.yRatio };
  }, [blocks]);

  const onMouseDown = useCallback((e: React.MouseEvent, id: "signature" | "paraphe") => {
    e.preventDefault();
    startDrag(e.clientX, e.clientY, id);
  }, [startDrag]);

  const onTouchStart = useCallback((e: React.TouchEvent, id: "signature" | "paraphe") => {
    e.preventDefault();
    const t = e.touches[0];
    startDrag(t.clientX, t.clientY, id);
  }, [startDrag]);

  useEffect(() => {
    const move = (clientX: number, clientY: number) => {
      if (!dragging.current) return;
      const { id, startX, startY, origXR, origYR } = dragging.current;
      const blk = blocks.find(b => b.id === id);
      if (!blk) return;
      const rect = getPageRect(blk.page);
      if (!rect) return;
      const dx = (clientX - startX) / rect.width;
      const dy = (clientY - startY) / rect.height;
      const isSignature = id === "signature";
      const wR = isSignature ? SIG_W_RATIO : PAR_W_RATIO;
      const hR = isSignature ? SIG_H_RATIO : PAR_H_RATIO;
      const newXR = Math.min(Math.max(origXR + dx, 0), 1 - wR);
      const newYR = Math.min(Math.max(origYR + dy, 0), 1 - hR);
      setBlocks(prev => prev.map(b => b.id === id ? { ...b, xRatio: newXR, yRatio: newYR } : b));
    };
    const onMouseMove = (e: MouseEvent) => move(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => { if (!dragging.current) return; e.preventDefault(); move(e.touches[0].clientX, e.touches[0].clientY); };
    const onUp = () => { dragging.current = null; };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [blocks, getPageRect]);

  const handleConfirm = () => {
    const sig = blocks.find(b => b.id === "signature")!;
    const par = withParaphe ? blocks.find(b => b.id === "paraphe")! : null;
    onConfirm(
      { page: sig.page, xRatio: sig.xRatio, yRatio: sig.yRatio },
      par ? { page: par.page, xRatio: par.xRatio, yRatio: par.yRatio } : null
    );
  };

  const initiales = signerName.split(" ").map(w => w[0] ?? "").join("").toUpperCase().slice(0, 3);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 1000, display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ padding: "10px 16px", background: "rgba(24,24,27,0.98)", borderBottom: "1px solid rgba(224,48,48,0.3)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, gap: 12, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: "Orbitron,monospace", fontSize: 10, letterSpacing: 3, color: "var(--red)", textTransform: "uppercase", marginBottom: 2 }}>Placement des blocs</div>
          <div style={{ fontFamily: "Rajdhani,sans-serif", fontSize: 11, color: "var(--zinc-400)" }}>Glissez les blocs sur le document</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button onClick={onCancel} style={{ padding: "8px 14px", background: "transparent", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 2, color: "var(--zinc-400)", fontFamily: "Orbitron,monospace", fontSize: 9, letterSpacing: 2, cursor: "pointer" }}>
            ANNULER
          </button>
          <button onClick={handleConfirm} disabled={loading} style={{ padding: "8px 14px", background: "var(--red)", border: "none", borderRadius: 2, color: "#fff", fontFamily: "Orbitron,monospace", fontSize: 9, fontWeight: 700, letterSpacing: 2, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.5 : 1 }}>
            CONFIRMER →
          </button>
        </div>
      </div>

      {/* Legend */}
      <div style={{ padding: "8px 20px", background: "rgba(18,18,20,0.9)", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", gap: 20, flexShrink: 0 }}>
        <LegendItem color="#4f8ef7" label="Signature" />
        {withParaphe && <LegendItem color="#22C55E" label="Paraphe (toutes les pages)" />}
      </div>

      {/* PDF canvas area */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 16, WebkitOverflowScrolling: "touch" } as React.CSSProperties}>
        {loading && (
          <div style={{ padding: "60px 0", textAlign: "center" }}>
            <div style={{ width: 32, height: 32, border: "2px solid rgba(224,48,48,0.3)", borderTopColor: "var(--red)", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
            <div style={{ fontFamily: "Rajdhani,sans-serif", fontSize: 13, color: "var(--zinc-400)" }}>Chargement du document...</div>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        )}

        {pages.map((pageInfo, pageIdx) => {
          const canvasDataUrl = pageInfo.canvas.toDataURL();
          const sigBlock = blocks.find(b => b.id === "signature" && b.page === pageIdx);
          // Paraphe shows on every page — shared position
          const parPos = withParaphe ? blocks.find(b => b.id === "paraphe") : undefined;

          return (
            <div key={pageIdx} style={{ position: "relative", display: "inline-block" }}>
              <div style={{ fontFamily: "Orbitron,monospace", fontSize: 8, letterSpacing: 2, color: "var(--zinc-500)", textAlign: "center", marginBottom: 6, textTransform: "uppercase" }}>
                Page {pageIdx + 1}
              </div>
              <div
                ref={el => { pageRefs.current[pageIdx] = el; }}
                style={{ position: "relative", boxShadow: "0 4px 40px rgba(0,0,0,0.8)", border: "1px solid rgba(255,255,255,0.08)", userSelect: "none" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={canvasDataUrl} alt={`Page ${pageIdx + 1}`} style={{ display: "block", maxWidth: "88vw", maxHeight: "none" }} draggable={false} />

                {/* Signature block — only on its target page */}
                {sigBlock && (
                  <DragBlock
                    xRatio={sigBlock.xRatio}
                    yRatio={sigBlock.yRatio}
                    wRatio={SIG_W_RATIO}
                    hRatio={SIG_H_RATIO}
                    color="#4f8ef7"
                    label="SIGNATURE"
                    onMouseDown={(e) => onMouseDown(e, "signature")}
                    onTouchStart={(e) => onTouchStart(e, "signature")}
                  >
                    <div style={{ fontFamily: "'Great Vibes',cursive", fontSize: "clamp(10px, 3vw, 16px)", color: "#1a2744", lineHeight: 1.2 }}>{signerName}</div>
                    <div style={{ fontFamily: "Rajdhani,sans-serif", fontSize: "clamp(6px, 1.5vw, 9px)", color: "#666" }}>{new Date().toLocaleDateString("fr-FR")}</div>
                  </DragBlock>
                )}

                {/* Paraphe block — same position on every page */}
                {parPos && (
                  <DragBlock
                    xRatio={parPos.xRatio}
                    yRatio={parPos.yRatio}
                    wRatio={PAR_W_RATIO}
                    hRatio={PAR_H_RATIO}
                    color="#22C55E"
                    label="PARAPHE"
                    onMouseDown={(e) => onMouseDown(e, "paraphe")}
                    onTouchStart={(e) => onTouchStart(e, "paraphe")}
                  >
                    <div style={{ fontFamily: "'Pinyon Script',cursive", fontSize: "clamp(12px, 3vw, 20px)", color: "#1a2744" }}>{initiales}</div>
                  </DragBlock>
                )}
              </div>

              {/* Page selector only for signature block */}
              <PageMover
                pageIdx={pageIdx}
                totalPages={pages.length}
                sigBlock={sigBlock}
                onMove={(dir) => {
                  setBlocks(prev => prev.map(b => {
                    if (b.id !== "signature") return b;
                    const newPage = Math.min(Math.max(b.page + dir, 0), pages.length - 1);
                    return { ...b, page: newPage };
                  }));
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DragBlock({ xRatio, yRatio, wRatio, hRatio, color, label, onMouseDown, onTouchStart, children }: {
  xRatio: number; yRatio: number; wRatio: number; hRatio: number;
  color: string; label: string;
  onMouseDown: (e: React.MouseEvent) => void;
  onTouchStart: (e: React.TouchEvent) => void;
  children: React.ReactNode;
}) {
  return (
    <div
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      style={{ touchAction: "none",
        position: "absolute",
        left: `${xRatio * 100}%`,
        top: `${yRatio * 100}%`,
        width: `${wRatio * 100}%`,
        height: `${hRatio * 100}%`,
        border: `2px solid ${color}`,
        background: `rgba(255,255,255,0.88)`,
        boxShadow: `0 0 0 1px ${color}44, 0 2px 12px rgba(0,0,0,0.4)`,
        cursor: "grab",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "2px 4px",
        boxSizing: "border-box",
      }}
    >
      <div style={{ position: "absolute", top: 1, right: 3, fontFamily: "Orbitron,monospace", fontSize: "clamp(4px,1vw,6px)", color, letterSpacing: 1 }}>{label}</div>
      {children}
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ width: 12, height: 12, border: `2px solid ${color}`, background: "rgba(255,255,255,0.1)" }} />
      <span style={{ fontFamily: "Rajdhani,sans-serif", fontSize: 12, color: "var(--zinc-300)" }}>{label}</span>
    </div>
  );
}

function PageMover({ pageIdx, totalPages, sigBlock, onMove }: {
  pageIdx: number; totalPages: number;
  sigBlock?: DraggableBlock;
  onMove: (dir: -1 | 1) => void;
}) {
  if (totalPages <= 1 || !sigBlock) return null;
  const onThisPage = sigBlock.page === pageIdx;
  return (
    <div style={{ display: "flex", gap: 6, marginTop: 6, justifyContent: "center", alignItems: "center" }}>
      <span style={{ fontFamily: "Orbitron,monospace", fontSize: 8, color: "#4f8ef7" }}>SIGNATURE</span>
      <MoverBtn disabled={!onThisPage || pageIdx === 0} onClick={() => onMove(-1)}>↑ page préc.</MoverBtn>
      <MoverBtn disabled={!onThisPage || pageIdx === totalPages - 1} onClick={() => onMove(1)}>page suiv. ↓</MoverBtn>
    </div>
  );
}

function MoverBtn({ onClick, disabled, children }: { onClick: () => void; disabled: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ padding: "3px 8px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 2, color: disabled ? "rgba(255,255,255,0.2)" : "#fff", cursor: disabled ? "default" : "pointer", fontFamily: "Orbitron,monospace", fontSize: 7, letterSpacing: 1 }}>
      {children}
    </button>
  );
}

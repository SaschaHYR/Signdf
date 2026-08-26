"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PlacementCoord, TextOverlay } from "@/lib/signPdf";

interface DraggableBlock {
  id: "signature" | "paraphe";
  page: number;
  xRatio: number;
  yRatio: number;
}

interface TextBlock {
  id: string;
  page: number;
  xRatio: number;
  yRatio: number;
  wRatio: number;
  hRatio: number;
  text: string;
  fontSize: number;
}

interface Props {
  pdfUrl: string;
  signerName: string;
  withParaphe: boolean;
  onConfirm: (signature: PlacementCoord, paraphe: PlacementCoord | null, textOverlays: TextOverlay[]) => void;
  onCancel: () => void;
}

interface PageInfo {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
}

const SIG_W_RATIO = 200 / 595;
const SIG_H_RATIO = 72 / 842;
const PAR_W_RATIO = 56 / 595;
const PAR_H_RATIO = 40 / 842;
const TXT_W_INIT = 180 / 595;
const TXT_H_INIT = 28 / 842;
const TXT_MIN_W = 40 / 595;
const TXT_MIN_H = 16 / 842;

type DragTarget =
  | { kind: "block"; id: "signature" | "paraphe" }
  | { kind: "text"; id: string }
  | { kind: "resize"; id: string };

export default function PdfPlacementEditor({ pdfUrl, signerName, withParaphe, onConfirm, onCancel }: Props) {
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [parapheEnabled, setParapheEnabled] = useState(false);
  const [blocks, setBlocks] = useState<DraggableBlock[]>([
    { id: "signature", page: 0, xRatio: 0.6, yRatio: 0.85 },
    { id: "paraphe",   page: 0, xRatio: 0.05, yRatio: 0.85 },
  ]);
  const [textBlocks, setTextBlocks] = useState<TextBlock[]>([]);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);

  const dragging = useRef<{ target: DragTarget; startX: number; startY: number; origXR: number; origYR: number } | null>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function renderPdf() {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const pdf = await pdfjsLib.getDocument({ url: pdfUrl }).promise;
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

  const startDrag = useCallback((clientX: number, clientY: number, target: DragTarget) => {
    let origXR = 0, origYR = 0;
    if (target.kind === "block") {
      const blk = blocks.find(b => b.id === target.id);
      if (!blk) return;
      origXR = blk.xRatio; origYR = blk.yRatio;
    } else {
      const blk = textBlocks.find(b => b.id === target.id);
      if (!blk) return;
      // for resize, origXR = origW, origYR = origH
      origXR = target.kind === "resize" ? blk.wRatio : blk.xRatio;
      origYR = target.kind === "resize" ? blk.hRatio : blk.yRatio;
    }
    dragging.current = { target, startX: clientX, startY: clientY, origXR, origYR };
  }, [blocks, textBlocks]);

  const onMouseDownBlock = useCallback((e: React.MouseEvent, id: "signature" | "paraphe") => {
    e.preventDefault();
    startDrag(e.clientX, e.clientY, { kind: "block", id });
  }, [startDrag]);

  const onTouchStartBlock = useCallback((e: React.TouchEvent, id: "signature" | "paraphe") => {
    e.preventDefault();
    startDrag(e.touches[0].clientX, e.touches[0].clientY, { kind: "block", id });
  }, [startDrag]);

  const onMouseDownText = useCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault();
    startDrag(e.clientX, e.clientY, { kind: "text", id });
  }, [startDrag]);

  const onTouchStartText = useCallback((e: React.TouchEvent, id: string) => {
    e.preventDefault();
    startDrag(e.touches[0].clientX, e.touches[0].clientY, { kind: "text", id });
  }, [startDrag]);

  const onMouseDownResize = useCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    startDrag(e.clientX, e.clientY, { kind: "resize", id });
  }, [startDrag]);

  const onTouchStartResize = useCallback((e: React.TouchEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    startDrag(e.touches[0].clientX, e.touches[0].clientY, { kind: "resize", id });
  }, [startDrag]);

  useEffect(() => {
    const move = (clientX: number, clientY: number) => {
      if (!dragging.current) return;
      const { target, startX, startY, origXR, origYR } = dragging.current;

      const pageIdx = target.kind === "block"
        ? (blocks.find(b => b.id === target.id)?.page ?? 0)
        : (textBlocks.find(b => b.id === target.id)?.page ?? 0);

      const rect = getPageRect(pageIdx);
      if (!rect) return;
      const dx = (clientX - startX) / rect.width;
      const dy = (clientY - startY) / rect.height;

      if (target.kind === "block") {
        const isSignature = target.id === "signature";
        const wR = isSignature ? SIG_W_RATIO : PAR_W_RATIO;
        const hR = isSignature ? SIG_H_RATIO : PAR_H_RATIO;
        setBlocks(prev => prev.map(b => b.id === target.id
          ? { ...b, xRatio: Math.min(Math.max(origXR + dx, 0), 1 - wR), yRatio: Math.min(Math.max(origYR + dy, 0), 1 - hR) }
          : b));
      } else if (target.kind === "resize") {
        setTextBlocks(prev => prev.map(b => b.id === target.id
          ? { ...b, wRatio: Math.max(origXR + dx, TXT_MIN_W), hRatio: Math.max(origYR + dy, TXT_MIN_H) }
          : b));
      } else {
        setTextBlocks(prev => prev.map(b => b.id === target.id
          ? { ...b, xRatio: Math.min(Math.max(origXR + dx, 0), 1 - b.wRatio), yRatio: Math.min(Math.max(origYR + dy, 0), 1 - b.hRatio) }
          : b));
      }
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
  }, [blocks, textBlocks, getPageRect]);

  const addTextBlock = () => {
    const id = `txt_${Date.now()}`;
    setTextBlocks(prev => [...prev, {
      id, page: currentPage,
      xRatio: 0.1, yRatio: 0.3,
      wRatio: TXT_W_INIT, hRatio: TXT_H_INIT,
      text: "", fontSize: 11,
    }]);
    setEditingTextId(id);
  };

  const removeTextBlock = (id: string) => {
    setTextBlocks(prev => prev.filter(b => b.id !== id));
    if (editingTextId === id) setEditingTextId(null);
  };

  const handleConfirm = () => {
    const sig = blocks.find(b => b.id === "signature")!;
    const par = (withParaphe && parapheEnabled) ? blocks.find(b => b.id === "paraphe")! : null;
    const overlays: TextOverlay[] = textBlocks
      .filter(b => b.text.trim())
      .map(b => ({ id: b.id, page: b.page, xRatio: b.xRatio, yRatio: b.yRatio, text: b.text, fontSize: b.fontSize }));
    onConfirm(
      { page: sig.page, xRatio: sig.xRatio, yRatio: sig.yRatio },
      par ? { page: par.page, xRatio: par.xRatio, yRatio: par.yRatio } : null,
      overlays,
    );
  };

  const initiales = signerName.split(" ").map(w => w[0] ?? "").join("").toUpperCase().slice(0, 3);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 1000, display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ padding: "10px 16px", background: "rgba(24,24,27,0.98)", borderBottom: "1px solid rgba(224,48,48,0.3)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, gap: 12, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: "Orbitron,monospace", fontSize: 10, letterSpacing: 3, color: "var(--red)", textTransform: "uppercase", marginBottom: 2 }}>Placement</div>
          <div style={{ fontFamily: "Rajdhani,sans-serif", fontSize: 11, color: "var(--zinc-400)" }}>Glissez les blocs · ajoutez du texte libre</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
          <button onClick={addTextBlock} style={{ padding: "8px 12px", background: "rgba(255,200,0,0.1)", border: "1px solid rgba(255,200,0,0.4)", borderRadius: 2, color: "#fbbf24", fontFamily: "Orbitron,monospace", fontSize: 8, letterSpacing: 2, cursor: "pointer" }}>
            + TEXTE
          </button>
          <button onClick={onCancel} style={{ padding: "8px 12px", background: "transparent", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 2, color: "var(--zinc-400)", fontFamily: "Orbitron,monospace", fontSize: 8, letterSpacing: 2, cursor: "pointer" }}>
            ANNULER
          </button>
          <button onClick={handleConfirm} disabled={loading} style={{ padding: "8px 14px", background: "var(--red)", border: "none", borderRadius: 2, color: "#fff", fontFamily: "Orbitron,monospace", fontSize: 9, fontWeight: 700, letterSpacing: 2, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.5 : 1 }}>
            CONFIRMER →
          </button>
        </div>
      </div>

      {/* Legend */}
      <div style={{ padding: "6px 16px", background: "rgba(18,18,20,0.9)", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", gap: 16, flexShrink: 0, flexWrap: "wrap", alignItems: "center" }}>
        <LegendItem color="#4f8ef7" label="Signature" />
        {withParaphe && (
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontFamily: "Rajdhani,sans-serif", fontSize: 12, color: parapheEnabled ? "#22C55E" : "var(--zinc-400)" }}>
            <input type="checkbox" checked={parapheEnabled} onChange={e => setParapheEnabled(e.target.checked)} style={{ accentColor: "#22C55E", width: 14, height: 14, cursor: "pointer" }} />
            Paraphe (toutes pages)
          </label>
        )}
        {textBlocks.length > 0 && <LegendItem color="#fbbf24" label={`${textBlocks.length} texte(s) libre(s)`} />}
      </div>

      {/* PDF canvas area */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 16, WebkitOverflowScrolling: "touch" } as React.CSSProperties}>
        {loading && (
          <div style={{ padding: "60px 0", textAlign: "center" }}>
            <div style={{ width: 32, height: 32, border: "2px solid rgba(224,48,48,0.3)", borderTopColor: "var(--red)", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
            <div style={{ fontFamily: "Rajdhani,sans-serif", fontSize: 13, color: "var(--zinc-400)" }}>Chargement...</div>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        )}

        {pages.map((pageInfo, pageIdx) => {
          const canvasDataUrl = pageInfo.canvas.toDataURL();
          const sigBlock = blocks.find(b => b.id === "signature" && b.page === pageIdx);
          const parPos = (withParaphe && parapheEnabled) ? blocks.find(b => b.id === "paraphe") : undefined;
          const pageTexts = textBlocks.filter(b => b.page === pageIdx);

          return (
            <div key={pageIdx} style={{ position: "relative", display: "inline-block" }} onClick={() => setCurrentPage(pageIdx)}>
              <div style={{ fontFamily: "Orbitron,monospace", fontSize: 8, letterSpacing: 2, color: currentPage === pageIdx ? "var(--red)" : "var(--zinc-500)", textAlign: "center", marginBottom: 6, textTransform: "uppercase" }}>
                Page {pageIdx + 1}
              </div>
              <div
                ref={el => { pageRefs.current[pageIdx] = el; }}
                style={{ position: "relative", boxShadow: "0 4px 40px rgba(0,0,0,0.8)", border: `1px solid ${currentPage === pageIdx ? "rgba(224,48,48,0.4)" : "rgba(255,255,255,0.08)"}`, userSelect: "none" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={canvasDataUrl} alt={`Page ${pageIdx + 1}`} style={{ display: "block", maxWidth: "88vw" }} draggable={false} />

                {/* Signature */}
                {sigBlock && (
                  <DragBlock xRatio={sigBlock.xRatio} yRatio={sigBlock.yRatio} wRatio={SIG_W_RATIO} hRatio={SIG_H_RATIO} color="#4f8ef7" label="SIGNATURE"
                    onMouseDown={(e) => onMouseDownBlock(e, "signature")} onTouchStart={(e) => onTouchStartBlock(e, "signature")}>
                    <div style={{ fontFamily: "'Great Vibes',cursive", fontSize: "clamp(10px, 3vw, 16px)", color: "#1a2744", lineHeight: 1.2 }}>{signerName}</div>
                    <div style={{ fontFamily: "Rajdhani,sans-serif", fontSize: "clamp(5px, 1.2vw, 8px)", color: "#666" }}>{new Date().toLocaleDateString("fr-FR")}</div>
                  </DragBlock>
                )}

                {/* Paraphe — every page */}
                {parPos && (
                  <DragBlock xRatio={parPos.xRatio} yRatio={parPos.yRatio} wRatio={PAR_W_RATIO} hRatio={PAR_H_RATIO} color="#22C55E" label="PARAPHE"
                    onMouseDown={(e) => onMouseDownBlock(e, "paraphe")} onTouchStart={(e) => onTouchStartBlock(e, "paraphe")}>
                    <div style={{ fontFamily: "'Pinyon Script',cursive", fontSize: "clamp(12px, 3vw, 20px)", color: "#1a2744" }}>{initiales}</div>
                  </DragBlock>
                )}

                {/* Free text blocks */}
                {pageTexts.map(tb => (
                  <TextDragBlock
                    key={tb.id}
                    block={tb}
                    isEditing={editingTextId === tb.id}
                    onMouseDown={(e) => { if (editingTextId !== tb.id) onMouseDownText(e, tb.id); }}
                    onTouchStart={(e) => { if (editingTextId !== tb.id) onTouchStartText(e, tb.id); }}
                    onMouseDownResize={(e) => onMouseDownResize(e, tb.id)}
                    onTouchStartResize={(e) => onTouchStartResize(e, tb.id)}
                    onClick={() => setEditingTextId(tb.id)}
                    onChange={(text) => setTextBlocks(prev => prev.map(b => b.id === tb.id ? { ...b, text } : b))}
                    onFontSize={(fs) => setTextBlocks(prev => prev.map(b => b.id === tb.id ? { ...b, fontSize: fs } : b))}
                    onDelete={() => removeTextBlock(tb.id)}
                    onBlur={() => setEditingTextId(null)}
                  />
                ))}
              </div>

              {/* Page mover for signature */}
              <PageMover pageIdx={pageIdx} totalPages={pages.length} sigBlock={sigBlock}
                onMove={(dir) => setBlocks(prev => prev.map(b => {
                  if (b.id !== "signature") return b;
                  return { ...b, page: Math.min(Math.max(b.page + dir, 0), pages.length - 1) };
                }))}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TextDragBlock({ block, isEditing, onMouseDown, onTouchStart, onMouseDownResize, onTouchStartResize, onClick, onChange, onFontSize, onDelete, onBlur }: {
  block: TextBlock; isEditing: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onTouchStart: (e: React.TouchEvent) => void;
  onMouseDownResize: (e: React.MouseEvent) => void;
  onTouchStartResize: (e: React.TouchEvent) => void;
  onClick: () => void;
  onChange: (text: string) => void;
  onFontSize: (fs: number) => void;
  onDelete: () => void;
  onBlur: () => void;
}) {
  return (
    <div
      style={{ touchAction: "none", position: "absolute", left: `${block.xRatio * 100}%`, top: `${block.yRatio * 100}%`, width: `${block.wRatio * 100}%`, height: `${block.hRatio * 100}%`, border: `1.5px solid ${isEditing ? "#fbbf24" : "rgba(251,191,36,0.6)"}`, background: "rgba(255,255,240,0.92)", boxShadow: "0 2px 8px rgba(0,0,0,0.3)", boxSizing: "border-box", overflow: "hidden" }}
      onMouseDown={isEditing ? undefined : onMouseDown}
      onTouchStart={isEditing ? undefined : onTouchStart}
      onClick={onClick}
    >
      {/* toolbar when editing */}
      {isEditing && (
        <div style={{ position: "absolute", top: -26, left: 0, zIndex: 10, display: "flex", gap: 3, background: "rgba(24,24,27,0.97)", border: "1px solid rgba(251,191,36,0.4)", borderRadius: 2, padding: "2px 4px" }}>
          {[8, 10, 12, 14, 16].map(fs => (
            <button key={fs} onClick={(e) => { e.stopPropagation(); onFontSize(fs); }}
              style={{ padding: "1px 4px", background: block.fontSize === fs ? "rgba(251,191,36,0.3)" : "transparent", border: "none", color: "#fbbf24", fontFamily: "Orbitron,monospace", fontSize: 7, cursor: "pointer", borderRadius: 1 }}>
              {fs}
            </button>
          ))}
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }}
            style={{ padding: "1px 5px", background: "rgba(224,48,48,0.2)", border: "none", color: "#ff6b6b", fontFamily: "Orbitron,monospace", fontSize: 7, cursor: "pointer", borderRadius: 1, marginLeft: 4 }}>
            ✕
          </button>
        </div>
      )}
      {/* drag label */}
      {!isEditing && (
        <div style={{ position: "absolute", top: 1, right: 18, fontFamily: "Orbitron,monospace", fontSize: "clamp(4px,0.8vw,5px)", color: "#b45309", letterSpacing: 1, cursor: "grab", pointerEvents: "none" }}>TEXTE</div>
      )}
      {isEditing ? (
        <textarea
          autoFocus
          value={block.text}
          onChange={e => onChange(e.target.value)}
          onBlur={onBlur}
          onClick={e => e.stopPropagation()}
          placeholder="Saisir le texte..."
          style={{ width: "100%", height: "100%", background: "transparent", border: "none", outline: "none", fontFamily: "Helvetica,Arial,sans-serif", fontSize: block.fontSize, color: "#111", resize: "none", padding: "3px 5px", boxSizing: "border-box", cursor: "text" }}
        />
      ) : (
        <div style={{ fontFamily: "Helvetica,Arial,sans-serif", fontSize: block.fontSize, color: "#111", padding: "3px 5px", height: "100%", cursor: "grab", whiteSpace: "pre-wrap", wordBreak: "break-word", overflow: "hidden" }}>
          {block.text || <span style={{ color: "#aaa", fontSize: 9, fontStyle: "italic" }}>Cliquer pour éditer</span>}
        </div>
      )}
      {/* Resize handle — bottom-right corner */}
      <div
        onMouseDown={onMouseDownResize}
        onTouchStart={onTouchStartResize}
        style={{ position: "absolute", bottom: 0, right: 0, width: 14, height: 14, cursor: "se-resize", touchAction: "none", display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" style={{ display: "block" }}>
          <line x1="3" y1="10" x2="10" y2="3" stroke="#b45309" strokeWidth="1.5" />
          <line x1="6" y1="10" x2="10" y2="6" stroke="#b45309" strokeWidth="1.5" />
        </svg>
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
    <div onMouseDown={onMouseDown} onTouchStart={onTouchStart}
      style={{ touchAction: "none", position: "absolute", left: `${xRatio * 100}%`, top: `${yRatio * 100}%`, width: `${wRatio * 100}%`, height: `${hRatio * 100}%`, border: `2px solid ${color}`, background: "rgba(255,255,255,0.88)", boxShadow: `0 0 0 1px ${color}44, 0 2px 12px rgba(0,0,0,0.4)`, cursor: "grab", overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "center", padding: "2px 4px", boxSizing: "border-box" }}>
      <div style={{ position: "absolute", top: 1, right: 3, fontFamily: "Orbitron,monospace", fontSize: "clamp(4px,1vw,6px)", color, letterSpacing: 1 }}>{label}</div>
      {children}
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <div style={{ width: 10, height: 10, border: `2px solid ${color}`, background: "rgba(255,255,255,0.05)", flexShrink: 0 }} />
      <span style={{ fontFamily: "Rajdhani,sans-serif", fontSize: 11, color: "var(--zinc-300)" }}>{label}</span>
    </div>
  );
}

function PageMover({ pageIdx, totalPages, sigBlock, onMove }: {
  pageIdx: number; totalPages: number; sigBlock?: DraggableBlock; onMove: (dir: -1 | 1) => void;
}) {
  if (totalPages <= 1 || !sigBlock) return null;
  const here = sigBlock.page === pageIdx;
  return (
    <div style={{ display: "flex", gap: 6, marginTop: 6, justifyContent: "center", alignItems: "center" }}>
      <span style={{ fontFamily: "Orbitron,monospace", fontSize: 7, color: "#4f8ef7" }}>SIG</span>
      <MoverBtn disabled={!here || pageIdx === 0} onClick={() => onMove(-1)}>↑ préc.</MoverBtn>
      <MoverBtn disabled={!here || pageIdx === totalPages - 1} onClick={() => onMove(1)}>suiv. ↓</MoverBtn>
    </div>
  );
}

function MoverBtn({ onClick, disabled, children }: { onClick: () => void; disabled: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ padding: "3px 7px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 2, color: disabled ? "rgba(255,255,255,0.2)" : "#fff", cursor: disabled ? "default" : "pointer", fontFamily: "Orbitron,monospace", fontSize: 7 }}>
      {children}
    </button>
  );
}

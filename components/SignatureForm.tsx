"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { signPdf, downloadBytes } from "@/lib/signPdf";

type Status = "idle" | "processing" | "success" | "error";

export default function SignatureForm() {
  const [file, setFile] = useState<File | null>(null);
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [sigName, setSigName] = useState("Jean Dupont");
  const [sigDate, setSigDate] = useState("");
  const [sigId, setSigId] = useState("K3M9PR2A");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSigName(`${prenom || "Jean"} ${nom || "Dupont"}`);
  }, [prenom, nom]);

  const handleFile = useCallback((f: File) => {
    if (!f.name.toLowerCase().endsWith(".pdf") || f.type !== "application/pdf") {
      setErrorMsg("Seuls les fichiers PDF sont acceptés.");
      setStatus("error");
      return;
    }
    setFile(f);
    setStatus("idle");
    setErrorMsg("");
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const handleSubmit = async () => {
    if (!file) { setErrorMsg("Veuillez sélectionner un fichier PDF."); setStatus("error"); return; }
    if (!prenom.trim() || !nom.trim()) { setErrorMsg("Veuillez renseigner votre prénom et nom."); setStatus("error"); return; }

    setStatus("processing");
    setErrorMsg("");

    try {
      const bytes = await signPdf(file, { prenom: prenom.trim(), nom: nom.trim() });
      const signedName = file.name.replace(/\.pdf$/i, "_signé.pdf");
      downloadBytes(bytes, signedName);

      const now = new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" });
      setSigDate(`Le ${now}`);
      setSigId(btoa(prenom + nom + Date.now()).replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 8));
      setStatus("success");
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Une erreur est survenue.");
      setStatus("error");
    }
  };

  const reset = () => {
    setFile(null);
    setPrenom("");
    setNom("");
    setStatus("idle");
    setErrorMsg("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const isLarge = file && file.size > 20 * 1024 * 1024;

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden" style={{ background: "var(--bg)" }}>
      <div className="bg-grid" />
      <div className="scanlines" />
      <div className="corner corner-tl" />
      <div className="corner corner-tr" />
      <div className="corner corner-bl" />
      <div className="corner corner-br" />
      <Particles />

      <div className="relative z-10">
        <div
          className="animate-card-in"
          style={{
            background: "rgba(24, 24, 27, 0.92)",
            border: "1px solid rgba(224, 48, 48, 0.3)",
            borderRadius: "4px",
            padding: "40px 44px",
            width: "500px",
            backdropFilter: "blur(20px)",
            position: "relative",
            boxShadow: "0 0 40px rgba(224,48,48,0.08), 0 0 80px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.05)",
          }}
        >
          {/* Top glow line */}
          <div style={{ position: "absolute", top: -1, left: "10%", right: "10%", height: 1, background: "linear-gradient(90deg, transparent, #E03030, transparent)", filter: "blur(1px)" }} />
          <div style={{ position: "absolute", top: -1, left: "25%", right: "25%", height: 1, background: "#E03030", boxShadow: "0 0 12px #E03030" }} />

          {/* Header */}
          <div style={{ marginBottom: 32 }}>
            <div className="animate-badge-in" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "Orbitron, monospace", fontSize: 9, letterSpacing: 3, textTransform: "uppercase", color: "var(--red)", border: "1px solid rgba(224,48,48,0.3)", padding: "4px 10px", borderRadius: 2, marginBottom: 16 }}>
              <span className="badge-dot-pulse" style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--red)", boxShadow: "0 0 6px var(--red)", display: "inline-block" }} />
              SYSTÈME ACTIF
            </div>
            <div className="animate-title-in" style={{ fontFamily: "Orbitron, monospace", fontSize: 28, fontWeight: 900, color: "#fff", letterSpacing: 2, lineHeight: 1.1 }}>
              e-SIGN<span style={{ color: "var(--red)" }}>.</span>PDF
            </div>
            <div className="animate-subtitle-in" style={{ fontFamily: "Rajdhani, sans-serif", fontSize: 13, fontWeight: 400, color: "var(--zinc-400)", letterSpacing: 1.5, textTransform: "uppercase", marginTop: 6 }}>
              Signature électronique · Traitement local
            </div>
          </div>

          {status !== "success" ? (
            <>
              {/* Drop zone */}
              <div
                className="animate-drop-in"
                onClick={() => inputRef.current?.click()}
                onDrop={onDrop}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                style={{
                  border: `1px dashed ${dragging || file ? "var(--red)" : "rgba(224,48,48,0.4)"}`,
                  borderRadius: 3,
                  padding: "28px 20px",
                  textAlign: "center",
                  cursor: "pointer",
                  position: "relative",
                  overflow: "hidden",
                  marginBottom: 20,
                  background: file || dragging ? "rgba(224,48,48,0.05)" : "rgba(224,48,48,0.02)",
                  transition: "all 0.2s",
                  boxShadow: dragging ? "0 0 20px rgba(224,48,48,0.1), inset 0 0 20px rgba(224,48,48,0.03)" : "none",
                }}
              >
                <svg className="drop-icon-float" style={{ width: 40, height: 40, margin: "0 auto 10px", color: "var(--red)", opacity: 0.7, display: "block" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                {file ? (
                  <>
                    <div style={{ fontFamily: "Rajdhani, sans-serif", fontSize: 14, fontWeight: 600, color: "#fff", letterSpacing: 1 }}>📄 {file.name}</div>
                    <div style={{ fontSize: 11, color: "var(--zinc-400)", letterSpacing: 0.5, marginTop: 4, textTransform: "uppercase" }}>{(file.size / 1024).toFixed(0)} KB · PDF sélectionné</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontFamily: "Rajdhani, sans-serif", fontSize: 14, fontWeight: 600, color: "var(--zinc-300)", letterSpacing: 1 }}>Déposer le fichier PDF ici</div>
                    <div style={{ fontSize: 11, color: "var(--zinc-400)", letterSpacing: 0.5, marginTop: 4, textTransform: "uppercase" }}>ou cliquer pour sélectionner · max 20MB</div>
                  </>
                )}
                <input ref={inputRef} type="file" accept=".pdf,application/pdf" style={{ display: "none" }} onChange={onInputChange} />
              </div>

              {isLarge && (
                <div style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 2, padding: "8px 12px", marginBottom: 12, fontSize: 11, color: "#fbbf24", fontFamily: "Rajdhani, sans-serif", letterSpacing: 0.5 }}>
                  ⚠ Fichier volumineux ({(file!.size / 1024 / 1024).toFixed(1)} MB) — traitement peut être lent
                </div>
              )}

              {/* Fields */}
              <div className="animate-fields-in" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                <FieldGroup label="Prénom" value={prenom} onChange={setPrenom} placeholder="Jean" />
                <FieldGroup label="Nom" value={nom} onChange={setNom} placeholder="Dupont" />
              </div>

              {/* Divider */}
              <div className="animate-divider-in" style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <div style={{ flex: 1, height: 1, background: "var(--zinc-700)" }} />
                <div style={{ fontFamily: "Orbitron, monospace", fontSize: 8, letterSpacing: 2, textTransform: "uppercase", color: "var(--zinc-400)" }}>Apposer la signature</div>
                <div style={{ flex: 1, height: 1, background: "var(--zinc-700)" }} />
              </div>

              {/* Error */}
              {status === "error" && (
                <div style={{ background: "rgba(224,48,48,0.08)", border: "1px solid rgba(224,48,48,0.3)", borderRadius: 2, padding: "8px 12px", marginBottom: 12, fontSize: 12, color: "#ff6b6b", fontFamily: "Rajdhani, sans-serif", letterSpacing: 0.5 }}>
                  ✕ {errorMsg}
                </div>
              )}

              {/* Button */}
              <button
                className="animate-btn-in btn-shimmer"
                onClick={handleSubmit}
                disabled={status === "processing"}
                style={{
                  width: "100%", padding: "14px 20px",
                  background: status === "processing" ? "var(--red-dark)" : "var(--red)",
                  border: "none", borderRadius: 2,
                  color: "#fff",
                  fontFamily: "Orbitron, monospace",
                  fontSize: 12, fontWeight: 700,
                  letterSpacing: 3, textTransform: "uppercase",
                  cursor: status === "processing" ? "not-allowed" : "pointer",
                  position: "relative", overflow: "hidden",
                  transition: "background 0.2s, box-shadow 0.2s, transform 0.1s",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}
              >
                {status === "processing" ? (
                  <>
                    <span style={{ display: "inline-block", width: 12, height: 12, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                    TRAITEMENT EN COURS...
                  </>
                ) : "⏎ SIGNER LE DOCUMENT"}
              </button>

              <style>{`@keyframes spin { to { transform: rotate(360deg); } } .btn-shimmer:hover { background: #cc2020 !important; box-shadow: 0 0 24px rgba(224,48,48,0.5), 0 0 48px rgba(224,48,48,0.2); transform: translateY(-1px); } .btn-shimmer:active { transform: translateY(0) !important; }`}</style>
            </>
          ) : (
            /* Success state */
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <svg style={{ width: 56, height: 56, margin: "0 auto 16px", display: "block" }} viewBox="0 0 56 56">
                <circle className="check-circle" cx="28" cy="28" r="26" />
                <polyline className="check-tick" points="16,28 24,36 40,20" />
              </svg>
              <div style={{ fontFamily: "Orbitron, monospace", fontSize: 14, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", color: "#22C55E", textShadow: "0 0 20px rgba(34,197,94,0.4)", marginBottom: 8 }}>
                Document Signé
              </div>
              <div style={{ fontFamily: "Rajdhani, sans-serif", fontSize: 13, color: "var(--zinc-400)", letterSpacing: 0.5 }}>
                Téléchargement en cours...
              </div>

              <div style={{ marginTop: 20, border: "1px solid rgba(224,48,48,0.2)", borderRadius: 2, padding: "14px 16px", background: "rgba(224,48,48,0.03)", fontFamily: "Rajdhani, sans-serif", textAlign: "left" }}>
                <div style={{ fontFamily: "Orbitron, monospace", fontSize: 8, letterSpacing: 2, textTransform: "uppercase", color: "var(--red)", marginBottom: 8 }}>■ Bloc de signature apposé</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", letterSpacing: 1 }}>{sigName}</div>
                <div style={{ fontSize: 12, color: "var(--zinc-400)", marginTop: 3 }}>{sigDate}</div>
                <div style={{ fontFamily: "Orbitron, monospace", fontSize: 9, color: "var(--zinc-400)", marginTop: 3, letterSpacing: 1 }}>SIG ID · {sigId}</div>
                <div style={{ fontSize: 10, color: "var(--zinc-700)", marginTop: 6, fontStyle: "italic" }}>Signature électronique simple — valeur probante</div>
              </div>

              <button
                onClick={reset}
                style={{ marginTop: 16, width: "100%", padding: "10px 20px", background: "transparent", border: "1px solid rgba(224,48,48,0.3)", borderRadius: 2, color: "var(--zinc-400)", fontFamily: "Orbitron, monospace", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer", transition: "all 0.2s" }}
              >
                ← NOUVEAU DOCUMENT
              </button>
            </div>
          )}

          {/* Footer */}
          <div className="animate-footer-in" style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontFamily: "Orbitron, monospace", fontSize: 8, letterSpacing: 2, textTransform: "uppercase", color: "var(--zinc-400)" }}>
              V<span style={{ color: "rgba(224,48,48,0.6)" }}>2.0</span> · VERCEL + NEXT.JS
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontFamily: "Rajdhani, sans-serif", fontSize: 10, color: "var(--zinc-400)", letterSpacing: 0.5 }}>
              <svg style={{ width: 10, height: 10 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
              PDF traité localement
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldGroup({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <div style={{ fontFamily: "Orbitron, monospace", fontSize: 9, letterSpacing: 2, textTransform: "uppercase", color: "var(--zinc-400)" }}>{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          background: "var(--zinc-800)",
          border: "1px solid var(--zinc-700)",
          borderRadius: 2,
          padding: "10px 12px",
          color: "#fff",
          fontFamily: "Rajdhani, sans-serif",
          fontSize: 14, fontWeight: 500,
          letterSpacing: 0.5,
          width: "100%",
          outline: "none",
          transition: "border-color 0.2s, box-shadow 0.2s",
        }}
        onFocus={(e) => { e.target.style.borderColor = "var(--red)"; e.target.style.boxShadow = "0 0 0 1px rgba(224,48,48,0.2)"; }}
        onBlur={(e) => { e.target.style.borderColor = "var(--zinc-700)"; e.target.style.boxShadow = "none"; }}
      />
    </div>
  );
}

function Particles() {
  useEffect(() => {
    const container = document.querySelector(".particles") as HTMLElement;
    if (!container || container.childElementCount > 0) return;
    for (let i = 0; i < 18; i++) {
      const p = document.createElement("div");
      p.className = "particle";
      const size = 1 + Math.random() * 2;
      p.style.cssText = `left:${Math.random()*100}%;bottom:${Math.random()*20}%;--drift:${(Math.random()-0.5)*80}px;animation-duration:${6+Math.random()*10}s;animation-delay:${Math.random()*8}s;width:${size}px;height:${size}px;`;
      container.appendChild(p);
    }
  }, []);
  return <div className="particles" />;
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { uploadOriginalPdf, createSignatureDoc } from "@/lib/uploadPdf";
import { getSupabase } from "@/lib/supabase";
import { AnimateNumber } from "@/components/ui/animated-blur-number";

type Status = "idle" | "uploading" | "share" | "error";

function useSignatureCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const sb = getSupabase();

    sb.from("signatures").select("*", { count: "exact", head: true }).eq("status", "signed")
      .then(({ count: c }) => { if (c !== null) setCount(c); });

    const channel = sb.channel("signatures-count")
      .on("postgres_changes", { event: "*", schema: "public", table: "signatures" }, () => {
        sb.from("signatures").select("*", { count: "exact", head: true }).eq("status", "signed")
          .then(({ count: c }) => { if (c !== null) setCount(c); });
      })
      .subscribe();

    return () => { sb.removeChannel(channel); };
  }, []);

  return count;
}

export default function SignatureForm() {
  const [file, setFile] = useState<File | null>(null);
  const [emailExpediteur, setEmailExpediteur] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [dragging, setDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const handleSubmit = async () => {
    if (!file) { setErrorMsg("Veuillez sélectionner un fichier PDF."); setStatus("error"); return; }
    if (!emailExpediteur.trim() || !emailExpediteur.includes("@")) {
      setErrorMsg("Veuillez saisir une adresse email valide.");
      setStatus("error");
      return;
    }
    setStatus("uploading");
    setErrorMsg("");
    try {
      const token = crypto.randomUUID();
      await uploadOriginalPdf(file, token);
      await createSignatureDoc(token, emailExpediteur.trim(), file.name);
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
      setShareUrl(`${appUrl}/sign/${token}`);
      setStatus("share");
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Erreur lors de l'upload.");
      setStatus("error");
    }
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const reset = () => {
    setFile(null);
    setEmailExpediteur("");
    setStatus("idle");
    setErrorMsg("");
    setShareUrl("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const isLarge = file && file.size > 20 * 1024 * 1024;
  const signatureCount = useSignatureCount();

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
        <div className="animate-card-in" style={{ background: "rgba(24,24,27,0.92)", border: "1px solid rgba(224,48,48,0.3)", borderRadius: 4, padding: "40px 44px", width: 500, backdropFilter: "blur(20px)", position: "relative", boxShadow: "0 0 40px rgba(224,48,48,0.08),0 0 80px rgba(0,0,0,0.8),inset 0 1px 0 rgba(255,255,255,0.05)" }}>
          <div style={{ position: "absolute", top: -1, left: "10%", right: "10%", height: 1, background: "linear-gradient(90deg,transparent,#E03030,transparent)", filter: "blur(1px)" }} />
          <div style={{ position: "absolute", top: -1, left: "25%", right: "25%", height: 1, background: "#E03030", boxShadow: "0 0 12px #E03030" }} />

          <div style={{ marginBottom: 32 }}>
            <div className="animate-badge-in" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "Orbitron,monospace", fontSize: 9, letterSpacing: 3, textTransform: "uppercase", color: "var(--red)", border: "1px solid rgba(224,48,48,0.3)", padding: "4px 10px", borderRadius: 2, marginBottom: 16 }}>
              <span className="badge-dot-pulse" style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--red)", boxShadow: "0 0 6px var(--red)", display: "inline-block" }} />
              SYSTÈME ACTIF
            </div>
            <div className="animate-title-in" style={{ fontFamily: "Orbitron,monospace", fontSize: 28, fontWeight: 900, color: "#fff", letterSpacing: 2, lineHeight: 1.1 }}>
              e-SIGN<span style={{ color: "var(--red)" }}>.</span>PDF
            </div>
            <div className="animate-subtitle-in" style={{ fontFamily: "Rajdhani,sans-serif", fontSize: 13, color: "var(--zinc-400)", letterSpacing: 1.5, textTransform: "uppercase", marginTop: 6 }}>
              Signature électronique · Traitement local
            </div>

            {/* Live signature counter */}
            <div style={{ marginTop: 20, display: "inline-flex", alignItems: "center", gap: 12, padding: "10px 16px", background: "rgba(224,48,48,0.04)", border: "1px solid rgba(224,48,48,0.2)", borderRadius: 3 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <div style={{ fontFamily: "Orbitron,monospace", fontSize: 7, letterSpacing: 3, textTransform: "uppercase", color: "var(--zinc-500)" }}>Documents signés</div>
                <AnimateNumber
                  value={signatureCount}
                  format={{ useGrouping: true }}
                  duration={600}
                  blur={16}
                  className="an-counter"
                  style={{ fontFamily: "Orbitron,monospace", fontSize: 28, fontWeight: 900, color: "#fff", letterSpacing: 2 }}
                />
              </div>
              <div style={{ width: 1, height: 40, background: "rgba(224,48,48,0.2)" }} />
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22C55E", boxShadow: "0 0 8px #22C55E", display: "inline-block", animation: "dotPulse 2s ease-in-out infinite" }} />
                <span style={{ fontFamily: "Rajdhani,sans-serif", fontSize: 10, color: "#22C55E", letterSpacing: 1 }}>LIVE</span>
              </div>
            </div>
          </div>

          {status === "share" ? (
            <ShareState url={shareUrl} onReset={reset} onCopy={copyLink} copied={copied} />
          ) : (
            <>
              <div className="animate-drop-in"
                onClick={() => inputRef.current?.click()}
                onDrop={onDrop}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                style={{ border: `1px dashed ${dragging || file ? "var(--red)" : "rgba(224,48,48,0.4)"}`, borderRadius: 3, padding: "28px 20px", textAlign: "center", cursor: "pointer", marginBottom: 20, background: file || dragging ? "rgba(224,48,48,0.05)" : "rgba(224,48,48,0.02)", transition: "all 0.2s" }}
              >
                <svg className="drop-icon-float" style={{ width: 40, height: 40, margin: "0 auto 10px", color: "var(--red)", opacity: 0.7, display: "block" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
                {file ? (
                  <>
                    <div style={{ fontFamily: "Rajdhani,sans-serif", fontSize: 14, fontWeight: 600, color: "#fff" }}>📄 {file.name}</div>
                    <div style={{ fontSize: 11, color: "var(--zinc-400)", marginTop: 4, textTransform: "uppercase" }}>{(file.size / 1024).toFixed(0)} KB · PDF sélectionné</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontFamily: "Rajdhani,sans-serif", fontSize: 14, fontWeight: 600, color: "var(--zinc-300)" }}>Déposer le fichier PDF ici</div>
                    <div style={{ fontSize: 11, color: "var(--zinc-400)", marginTop: 4, textTransform: "uppercase" }}>ou cliquer pour sélectionner · max 20MB</div>
                  </>
                )}
                <input ref={inputRef} type="file" accept=".pdf,application/pdf" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              </div>

              {isLarge && (
                <div style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 2, padding: "8px 12px", marginBottom: 12, fontSize: 11, color: "#fbbf24", fontFamily: "Rajdhani,sans-serif" }}>
                  ⚠ Fichier volumineux ({(file!.size / 1024 / 1024).toFixed(1)} MB)
                </div>
              )}

              <div className="animate-fields-in" style={{ marginBottom: 20 }}>
                <FieldGroup label="Votre email" value={emailExpediteur} onChange={setEmailExpediteur} placeholder="vous@exemple.com" type="email" />
              </div>

              <div className="animate-divider-in" style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <div style={{ flex: 1, height: 1, background: "var(--zinc-700)" }} />
                <div style={{ fontFamily: "Orbitron,monospace", fontSize: 8, letterSpacing: 2, textTransform: "uppercase", color: "var(--zinc-400)" }}>Envoyer pour signature</div>
                <div style={{ flex: 1, height: 1, background: "var(--zinc-700)" }} />
              </div>

              {status === "error" && (
                <div style={{ background: "rgba(224,48,48,0.08)", border: "1px solid rgba(224,48,48,0.3)", borderRadius: 2, padding: "8px 12px", marginBottom: 12, fontSize: 12, color: "#ff6b6b", fontFamily: "Rajdhani,sans-serif" }}>
                  ✕ {errorMsg}
                </div>
              )}

              <button className="animate-btn-in btn-shimmer" onClick={handleSubmit} disabled={status === "uploading"}
                style={{ width: "100%", padding: "14px 20px", background: status === "uploading" ? "var(--red-dark)" : "var(--red)", border: "none", borderRadius: 2, color: "#fff", fontFamily: "Orbitron,monospace", fontSize: 12, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", cursor: status === "uploading" ? "not-allowed" : "pointer", position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              >
                {status === "uploading" ? (
                  <><span style={{ display: "inline-block", width: 12, height: 12, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />UPLOAD EN COURS...</>
                ) : "↑ GÉNÉRER LE LIEN DE SIGNATURE"}
              </button>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}} .btn-shimmer:hover{background:#cc2020!important;box-shadow:0 0 24px rgba(224,48,48,0.5);transform:translateY(-1px)} .btn-shimmer:active{transform:translateY(0)!important}`}</style>
            </>
          )}

          {/* SEA compliance badge */}
          <div style={{ marginTop: 16, padding: "10px 14px", background: "rgba(34,197,94,0.04)", border: "1px solid rgba(34,197,94,0.18)", borderRadius: 3, display: "flex", alignItems: "flex-start", gap: 10 }}>
            <div style={{ flexShrink: 0, marginTop: 1 }}>
              <svg style={{ width: 14, height: 14, color: "#22C55E" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
            </div>
            <div>
              <div style={{ fontFamily: "Orbitron,monospace", fontSize: 8, letterSpacing: 2, color: "#22C55E", textTransform: "uppercase", marginBottom: 4 }}>Habilité SEA · Signature Électronique Avancée</div>
              <div style={{ fontFamily: "Rajdhani,sans-serif", fontSize: 11, color: "var(--zinc-400)", lineHeight: 1.5 }}>
                Chaque signature embarque un identifiant unique de document, l&apos;horodatage certifié et l&apos;identité du signataire — conforme au règlement eIDAS (art. 26) pour la valeur probante des signatures avancées.
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function ShareState({ url, onReset, onCopy, copied }: { url: string; onReset: () => void; onCopy: () => void; copied: boolean }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.4)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
        <svg style={{ width: 24, height: 24, color: "#22C55E" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 015.656 0l1 1a4 4 0 01-5.656 5.656l-1.1-1.1" />
        </svg>
      </div>
      <div style={{ fontFamily: "Orbitron,monospace", fontSize: 13, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#22C55E", marginBottom: 6 }}>Lien généré</div>
      <div style={{ fontFamily: "Rajdhani,sans-serif", fontSize: 12, color: "var(--zinc-400)", marginBottom: 20 }}>Envoyez ce lien au signataire</div>
      <div style={{ background: "var(--zinc-800)", border: "1px solid var(--zinc-700)", borderRadius: 2, padding: "10px 12px", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, fontFamily: "Orbitron,monospace", fontSize: 8, color: "var(--zinc-300)", letterSpacing: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{url}</div>
        <button onClick={onCopy} style={{ flexShrink: 0, padding: "4px 10px", background: copied ? "rgba(34,197,94,0.2)" : "var(--red)", border: "none", borderRadius: 2, color: "#fff", fontFamily: "Orbitron,monospace", fontSize: 8, letterSpacing: 1, cursor: "pointer", transition: "all 0.2s" }}>
          {copied ? "✓ COPIÉ" : "COPIER"}
        </button>
      </div>
      <button onClick={onReset} style={{ width: "100%", padding: "10px 20px", background: "transparent", border: "1px solid rgba(224,48,48,0.3)", borderRadius: 2, color: "var(--zinc-400)", fontFamily: "Orbitron,monospace", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer" }}>
        ← NOUVEAU DOCUMENT
      </button>
    </div>
  );
}

function FieldGroup({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; type?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <div style={{ fontFamily: "Orbitron,monospace", fontSize: 9, letterSpacing: 2, textTransform: "uppercase", color: "var(--zinc-400)" }}>{label}</div>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        style={{ background: "var(--zinc-800)", border: "1px solid var(--zinc-700)", borderRadius: 2, padding: "10px 12px", color: "#fff", fontFamily: "Rajdhani,sans-serif", fontSize: 14, fontWeight: 500, width: "100%", outline: "none" }}
        onFocus={(e) => { e.target.style.borderColor = "var(--red)"; e.target.style.boxShadow = "0 0 0 1px rgba(224,48,48,0.2)"; }}
        onBlur={(e) => { e.target.style.borderColor = "var(--zinc-700)"; e.target.style.boxShadow = "none"; }}
      />
    </div>
  );
}

function Particles() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current || ref.current.childElementCount > 0) return;
    for (let i = 0; i < 18; i++) {
      const p = document.createElement("div");
      p.className = "particle";
      const size = 1 + Math.random() * 2;
      p.style.cssText = `left:${Math.random()*100}%;bottom:${Math.random()*20}%;--drift:${(Math.random()-0.5)*80}px;animation-duration:${6+Math.random()*10}s;animation-delay:${Math.random()*8}s;width:${size}px;height:${size}px;`;
      ref.current.appendChild(p);
    }
  }, []);
  return <div ref={ref} className="particles" />;
}

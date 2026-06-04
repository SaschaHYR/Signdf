"use client";

import { useEffect, useState, lazy, Suspense } from "react";
import { getSignatureDoc, getOriginalPdfUrl, uploadSignedPdf, markAsSigned, SignatureDoc } from "@/lib/uploadPdf";
import { signPdf, downloadBytes, PlacementCoord } from "@/lib/signPdf";
import { AnimatedBackground } from "@/components/ui/animated-background";
import { sendSignatureEmail } from "@/lib/emailjs";

const PdfPlacementEditor = lazy(() => import("./PdfPlacementEditor"));

type PageStatus = "loading" | "ready" | "placing" | "already-signed" | "expired" | "invalid" | "signing" | "success" | "error";

export default function SignPage({ token }: { token: string }) {
  const [pageStatus, setPageStatus] = useState<PageStatus>("loading");
  const [sigDoc, setSigDoc] = useState<SignatureDoc | null>(null);
  const [pdfUrl, setPdfUrl] = useState("");
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [signedUrl, setSignedUrl] = useState("");
  const [withParaphe, setWithParaphe] = useState(false);
  const [sigPlacement, setSigPlacement] = useState<PlacementCoord | undefined>();
  const [parPlacement, setParPlacement] = useState<PlacementCoord | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const docData = await getSignatureDoc(token);
        if (!docData) { setPageStatus("invalid"); return; }
        if (docData.status === "expired") { setPageStatus("expired"); return; }
        if (docData.status === "signed") {
          setSigDoc(docData);
          setSignedUrl(docData.signed_file_url ?? "");
          setPageStatus("already-signed");
          return;
        }
        const url = getOriginalPdfUrl(token);
        setSigDoc(docData);
        setPdfUrl(url);
        setPageStatus("ready");
      } catch {
        setPageStatus("invalid");
      }
    }
    load();
  }, [token]);

  const handleOpenPlacement = () => {
    if (!prenom.trim() || !nom.trim()) { setErrorMsg("Prénom et nom requis avant de placer la signature."); return; }
    if (!email.trim() || !email.includes("@")) { setErrorMsg("Email valide requis avant de placer la signature."); return; }
    setErrorMsg("");
    setPageStatus("placing");
  };

  const handlePlacementConfirm = (sig: PlacementCoord, par: PlacementCoord | null) => {
    setSigPlacement(sig);
    setParPlacement(par);
    setPageStatus("ready");
    // immediately sign after placement
    handleSign(sig, par);
  };

  const handleSign = async (sigPlace?: PlacementCoord, parPlace?: PlacementCoord | null) => {
    if (!prenom.trim() || !nom.trim()) { setErrorMsg("Prénom et nom requis."); return; }
    if (!email.trim() || !email.includes("@")) { setErrorMsg("Email valide requis."); return; }
    if (!sigDoc) return;

    const placement = sigPlace ?? sigPlacement;
    const paraphe = parPlace !== undefined ? parPlace : parPlacement;

    setPageStatus("signing");
    setErrorMsg("");

    try {
      const response = await fetch(pdfUrl);
      if (!response.ok) throw new Error(`Impossible de charger le PDF (${response.status})`);
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("pdf") && !contentType.includes("octet-stream")) {
        throw new Error("Le fichier récupéré n'est pas un PDF valide.");
      }
      const arrayBuffer = await response.arrayBuffer();
      const bytes = await signPdf(arrayBuffer, {
        prenom: prenom.trim(),
        nom: nom.trim(),
        token,
        placement: placement ?? undefined,
        paraphe: paraphe ?? undefined,
      });
      const signedFileUrl = await uploadSignedPdf(bytes, token);
      await markAsSigned(token, email.trim(), signedFileUrl);

      const fullName = `${prenom.trim()} ${nom.trim()}`;
      const fileName = sigDoc.file_name;

      try {
        await sendSignatureEmail({ toEmail: email.trim(), toName: fullName, signataireName: fullName, fileName, signedFileUrl, role: "signataire" });
        await sendSignatureEmail({ toEmail: sigDoc.email_expediteur, toName: "l'expéditeur", signataireName: fullName, fileName, signedFileUrl, role: "expediteur" });
      } catch (emailErr) {
        console.error("Email non envoyé:", emailErr);
      }

      downloadBytes(bytes, fileName.replace(/\.pdf$/i, "_signé.pdf"));
      setSignedUrl(signedFileUrl);
      setPageStatus("success");
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Erreur lors de la signature.");
      setPageStatus("ready");
    }
  };

  if (pageStatus === "placing") {
    return (
      <Suspense fallback={null}>
        <PdfPlacementEditor
          pdfUrl={pdfUrl}
          signerName={`${prenom.trim()} ${nom.trim()}`}
          withParaphe={withParaphe}
          onConfirm={handlePlacementConfirm}
          onCancel={() => setPageStatus("ready")}
        />
      </Suspense>
    );
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden" style={{ background: "var(--bg)" }}>
      <AnimatedBackground />
      <div className="corner corner-tl" />
      <div className="corner corner-tr" />
      <div className="corner corner-bl" />
      <div className="corner corner-br" />

      <div className="relative z-10" style={{ width: 500 }}>
        <div style={{ background: "rgba(24,24,27,0.92)", border: "1px solid rgba(224,48,48,0.3)", borderRadius: 4, padding: "40px 44px", backdropFilter: "blur(20px)", position: "relative", boxShadow: "0 0 40px rgba(224,48,48,0.08),0 0 80px rgba(0,0,0,0.8)" }}>
          <div style={{ position: "absolute", top: -1, left: "10%", right: "10%", height: 1, background: "linear-gradient(90deg,transparent,#E03030,transparent)", filter: "blur(1px)" }} />
          <div style={{ position: "absolute", top: -1, left: "25%", right: "25%", height: 1, background: "#E03030", boxShadow: "0 0 12px #E03030" }} />

          <div style={{ marginBottom: 28 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "Orbitron,monospace", fontSize: 9, letterSpacing: 3, textTransform: "uppercase", color: "var(--red)", border: "1px solid rgba(224,48,48,0.3)", padding: "4px 10px", borderRadius: 2, marginBottom: 14 }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--red)", boxShadow: "0 0 6px var(--red)", display: "inline-block", animation: "dotPulse 2s ease-in-out infinite" }} />
              DEMANDE DE SIGNATURE
            </div>
            <div style={{ fontFamily: "Orbitron,monospace", fontSize: 24, fontWeight: 900, color: "#fff", letterSpacing: 2 }}>
              e-SIGN<span style={{ color: "var(--red)" }}>.</span>PDF
            </div>
            {sigDoc && (
              <div style={{ fontFamily: "Rajdhani,sans-serif", fontSize: 12, color: "var(--zinc-400)", marginTop: 6 }}>
                Document : <span style={{ color: "var(--zinc-300)" }}>{sigDoc.file_name}</span>
              </div>
            )}
          </div>

          {pageStatus === "loading" && <LoadingState />}
          {pageStatus === "invalid" && <MessageState color="#ff6b6b" icon="✕" title="Lien invalide" sub="Ce lien de signature n'existe pas." />}
          {pageStatus === "expired" && <MessageState color="#f59e0b" icon="⏱" title="Lien expiré" sub="Ce document a été supprimé après 7 jours. Demandez un nouveau lien à l'expéditeur." />}

          {pageStatus === "already-signed" && (
            <div style={{ textAlign: "center" }}>
              <MessageState color="#22C55E" icon="✓" title="Document déjà signé" sub="Ce document a déjà été signé." />
              {signedUrl && (
                <a href={signedUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 16, padding: "10px 20px", background: "var(--red)", borderRadius: 2, color: "#fff", fontFamily: "Orbitron,monospace", fontSize: 10, letterSpacing: 2, textDecoration: "none" }}>
                  ↓ TÉLÉCHARGER LE PDF SIGNÉ
                </a>
              )}
            </div>
          )}

          {(pageStatus === "ready" || pageStatus === "signing" || pageStatus === "error") && (
            <>
              {pdfUrl && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontFamily: "Orbitron,monospace", fontSize: 8, letterSpacing: 2, textTransform: "uppercase", color: "var(--zinc-400)", marginBottom: 8 }}>Aperçu du document</div>
                  <a href={pdfUrl} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: "var(--zinc-800)", border: "1px solid var(--zinc-700)", borderRadius: 2, color: "var(--zinc-300)", fontFamily: "Rajdhani,sans-serif", fontSize: 13, textDecoration: "none" }}>
                    <svg style={{ width: 16, height: 16, color: "var(--red)", flexShrink: 0 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                    Ouvrir le document PDF →
                  </a>
                </div>
              )}

              <div style={{ marginBottom: 16, padding: "12px 14px", background: "rgba(224,48,48,0.03)", border: "1px solid rgba(224,48,48,0.15)", borderRadius: 2 }}>
                <div style={{ fontFamily: "Orbitron,monospace", fontSize: 8, letterSpacing: 2, textTransform: "uppercase", color: "var(--red)", marginBottom: 8 }}>Aperçu de votre signature</div>
                <div style={{ fontFamily: "'Dancing Script',cursive", fontSize: 22, color: "#fff" }}>
                  {prenom || "Prénom"} {nom || "Nom"}
                </div>
                {withParaphe && (
                  <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ fontFamily: "Orbitron,monospace", fontSize: 8, letterSpacing: 2, textTransform: "uppercase", color: "#22C55E" }}>Paraphe :</div>
                    <div style={{ fontFamily: "Caveat,cursive", fontSize: 20, color: "#fff" }}>
                      {(prenom[0] ?? "") + (nom[0] ?? "")}
                    </div>
                  </div>
                )}
                <div style={{ fontFamily: "Rajdhani,sans-serif", fontSize: 11, color: "var(--zinc-400)", marginTop: 4 }}>
                  {new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <FieldGroup label="Prénom" value={prenom} onChange={setPrenom} placeholder="Jean" />
                <FieldGroup label="Nom" value={nom} onChange={setNom} placeholder="Dupont" />
              </div>
              <div style={{ marginBottom: 16 }}>
                <FieldGroup label="Votre email" value={email} onChange={setEmail} placeholder="vous@exemple.com" type="email" />
              </div>

              {/* Paraphe toggle */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                  <div
                    onClick={() => setWithParaphe(p => !p)}
                    style={{ width: 36, height: 20, borderRadius: 10, background: withParaphe ? "#22C55E" : "var(--zinc-700)", position: "relative", transition: "background 0.2s", flexShrink: 0, cursor: "pointer" }}
                  >
                    <div style={{ position: "absolute", top: 3, left: withParaphe ? 18 : 3, width: 14, height: 14, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
                  </div>
                  <span style={{ fontFamily: "Rajdhani,sans-serif", fontSize: 13, color: "var(--zinc-300)" }}>
                    Ajouter un paraphe (initiales)
                  </span>
                </label>
              </div>

              {errorMsg && (
                <div style={{ background: "rgba(224,48,48,0.08)", border: "1px solid rgba(224,48,48,0.3)", borderRadius: 2, padding: "8px 12px", marginBottom: 12, fontSize: 12, color: "#ff6b6b", fontFamily: "Rajdhani,sans-serif" }}>
                  ✕ {errorMsg}
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 0 }}>
                <button
                  onClick={handleOpenPlacement}
                  disabled={pageStatus === "signing"}
                  style={{ padding: "13px 10px", background: "transparent", border: "1px solid rgba(224,48,48,0.4)", borderRadius: 2, color: "var(--red)", fontFamily: "Orbitron,monospace", fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", cursor: pageStatus === "signing" ? "not-allowed" : "pointer", opacity: pageStatus === "signing" ? 0.5 : 1 }}
                >
                  ✦ PLACER
                </button>
                <button
                  onClick={() => handleSign()}
                  disabled={pageStatus === "signing"}
                  style={{ padding: "13px 10px", background: pageStatus === "signing" ? "var(--red-dark)" : "var(--red)", border: "none", borderRadius: 2, color: "#fff", fontFamily: "Orbitron,monospace", fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", cursor: pageStatus === "signing" ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                >
                  {pageStatus === "signing" ? (
                    <><span style={{ display: "inline-block", width: 10, height: 10, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />EN COURS...</>
                  ) : "✍ SIGNER"}
                </button>
              </div>
              <div style={{ marginTop: 6, textAlign: "center", fontFamily: "Rajdhani,sans-serif", fontSize: 10, color: "var(--zinc-500)" }}>
                SIGNER place la signature en bas à droite de la dernière page · PLACER permet de choisir la position
              </div>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes dotPulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
            </>
          )}

          {pageStatus === "success" && (
            <div style={{ textAlign: "center" }}>
              <svg style={{ width: 56, height: 56, margin: "0 auto 16px", display: "block" }} viewBox="0 0 56 56">
                <circle className="check-circle" cx="28" cy="28" r="26" />
                <polyline className="check-tick" points="16,28 24,36 40,20" />
              </svg>
              <div style={{ fontFamily: "Orbitron,monospace", fontSize: 14, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", color: "#22C55E", textShadow: "0 0 20px rgba(34,197,94,0.4)", marginBottom: 8 }}>Document Signé</div>
              <div style={{ fontFamily: "Rajdhani,sans-serif", fontSize: 13, color: "var(--zinc-400)", marginBottom: 16 }}>Téléchargement démarré · Email envoyé</div>
              {signedUrl && (
                <a href={signedUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", padding: "10px 20px", background: "var(--red)", borderRadius: 2, color: "#fff", fontFamily: "Orbitron,monospace", fontSize: 10, letterSpacing: 2, textDecoration: "none" }}>
                  ↓ RETÉLÉCHARGER
                </a>
              )}
            </div>
          )}

          <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <svg style={{ width: 11, height: 11, color: "#22C55E", flexShrink: 0 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
            <div style={{ fontFamily: "Rajdhani,sans-serif", fontSize: 10, color: "var(--zinc-400)" }}>
              <span style={{ color: "#22C55E", fontWeight: 600 }}>SEA · eIDAS</span> — Signature Électronique Avancée · valeur probante
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div style={{ textAlign: "center", padding: "20px 0" }}>
      <div style={{ width: 32, height: 32, border: "2px solid rgba(224,48,48,0.3)", borderTopColor: "var(--red)", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
      <div style={{ fontFamily: "Rajdhani,sans-serif", fontSize: 13, color: "var(--zinc-400)" }}>Chargement du document...</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function MessageState({ color, icon, title, sub }: { color: string; icon: string; title: string; sub: string }) {
  return (
    <div style={{ textAlign: "center", padding: "10px 0" }}>
      <div style={{ fontSize: 32, marginBottom: 12, color }}>{icon}</div>
      <div style={{ fontFamily: "Orbitron,monospace", fontSize: 13, fontWeight: 700, letterSpacing: 2, color, marginBottom: 8 }}>{title}</div>
      <div style={{ fontFamily: "Rajdhani,sans-serif", fontSize: 13, color: "var(--zinc-400)" }}>{sub}</div>
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

"use client";

import { useState } from "react";
import { SignatureDoc, sha256Hex } from "@/lib/uploadPdf";
import { AnimatedBackground } from "@/components/ui/animated-background";

export default function VerifyClient({ doc, token }: { doc: SignatureDoc | null; token: string }) {
  const [verifyStatus, setVerifyStatus] = useState<"idle" | "match" | "mismatch">("idle");
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleFileVerify = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !doc?.pdf_hash) return;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const hash = await sha256Hex(bytes);
    setVerifyStatus(hash === doc.pdf_hash ? "match" : "mismatch");
  };

  const notFound = !doc;
  const hasTSR = !!doc?.timestamp_token;
  const hasSigned = doc?.status === "signed" || doc?.status === "expired";

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden" style={{ background: "var(--bg)" }}>
      <AnimatedBackground />
      <div className="corner corner-tl" /><div className="corner corner-tr" />
      <div className="corner corner-bl" /><div className="corner corner-br" />

      <div className="relative z-10" style={{ width: 560, maxWidth: "95vw" }}>
        <div style={{ background: "rgba(24,24,27,0.92)", border: "1px solid rgba(224,48,48,0.3)", borderRadius: 4, padding: "40px 44px", backdropFilter: "blur(20px)", boxShadow: "0 0 40px rgba(224,48,48,0.08),0 0 80px rgba(0,0,0,0.8)" }}>

          {/* Top accent */}
          <div style={{ position: "absolute", top: -1, left: "10%", right: "10%", height: 1, background: "linear-gradient(90deg,transparent,#E03030,transparent)", filter: "blur(1px)" }} />
          <div style={{ position: "absolute", top: -1, left: "25%", right: "25%", height: 1, background: "#E03030", boxShadow: "0 0 12px #E03030" }} />

          {/* Header */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "Orbitron,monospace", fontSize: 9, letterSpacing: 3, textTransform: "uppercase", color: "var(--red)", border: "1px solid rgba(224,48,48,0.3)", padding: "4px 10px", borderRadius: 2, marginBottom: 14 }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--red)", boxShadow: "0 0 6px var(--red)", display: "inline-block" }} />
              VÉRIFICATION
            </div>
            <div style={{ fontFamily: "Orbitron,monospace", fontSize: 22, fontWeight: 900, color: "#fff", letterSpacing: 2 }}>
              e-SIGN<span style={{ color: "var(--red)" }}>.</span>PDF
            </div>
          </div>

          {notFound && (
            <Msg color="#ff6b6b" icon="✕" title="Document introuvable" sub="Cet identifiant ne correspond à aucun document." />
          )}

          {!notFound && !hasSigned && (
            <Msg color="#f59e0b" icon="⏳" title="En attente de signature" sub="Ce document n'a pas encore été signé." />
          )}

          {!notFound && hasSigned && (
            <>
              {/* Status */}
              <div style={{ marginBottom: 20, padding: "14px 16px", background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 3, display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ fontSize: 28, color: "#22C55E" }}>✓</div>
                <div>
                  <div style={{ fontFamily: "Orbitron,monospace", fontSize: 11, fontWeight: 700, letterSpacing: 2, color: "#22C55E", textTransform: "uppercase" }}>Document authentifié</div>
                  <div style={{ fontFamily: "Rajdhani,sans-serif", fontSize: 12, color: "var(--zinc-400)", marginTop: 3 }}>
                    {hasTSR ? "Horodatage RFC 3161 certifié TSA" : "Signature enregistrée"}
                  </div>
                </div>
              </div>

              {/* Metadata */}
              <div style={{ background: "#0f0f11", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 3, padding: 16, marginBottom: 20 }}>
                <Row label="Document" value={doc.file_name} />
                <Row label="Signataire" value={doc.email_signataire ?? "—"} />
                <Row label="Expéditeur" value={doc.email_expediteur} />
                {doc.signed_at && <Row label="Signé le" value={new Date(doc.signed_at).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })} />}
                {doc.timestamp_date && <Row label="Horodaté le" value={new Date(doc.timestamp_date).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })} />}
                <Row label="ID document" value={token} mono />
              </div>

              {/* Hash */}
              {doc.pdf_hash && (
                <div style={{ marginBottom: 16 }}>
                  <Label>Empreinte SHA-256 du PDF signé</Label>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                    <div style={{ flex: 1, background: "var(--zinc-800)", border: "1px solid var(--zinc-700)", borderRadius: 2, padding: "8px 10px", fontFamily: "monospace", fontSize: 10, color: "var(--zinc-300)", wordBreak: "break-all" }}>
                      {doc.pdf_hash}
                    </div>
                    <CopyBtn onClick={() => copy(doc.pdf_hash!, "hash")} copied={copied === "hash"} />
                  </div>
                </div>
              )}

              {/* TSR */}
              {doc.timestamp_token && (
                <div style={{ marginBottom: 20 }}>
                  <Label>Token TSR RFC 3161 (base64)</Label>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 4 }}>
                    <div style={{ flex: 1, background: "var(--zinc-800)", border: "1px solid var(--zinc-700)", borderRadius: 2, padding: "8px 10px", fontFamily: "monospace", fontSize: 9, color: "var(--zinc-400)", wordBreak: "break-all", maxHeight: 60, overflow: "hidden" }}>
                      {doc.timestamp_token.slice(0, 120)}…
                    </div>
                    <CopyBtn onClick={() => copy(doc.timestamp_token!, "tsr")} copied={copied === "tsr"} />
                  </div>
                  <div style={{ marginTop: 8, fontFamily: "Rajdhani,sans-serif", fontSize: 10, color: "var(--zinc-500)", lineHeight: 1.5 }}>
                    Vérification offline :{" "}
                    <code style={{ color: "var(--zinc-400)", fontSize: 9 }}>
                      openssl ts -verify -in token.tsr -data signed.pdf -CAfile freetsa_ca.pem
                    </code>
                  </div>
                </div>
              )}

              {/* File verification */}
              {doc.pdf_hash && (
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 20 }}>
                  <Label>Vérifier l&apos;intégrité de votre exemplaire</Label>
                  <div style={{ marginTop: 8 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "var(--zinc-800)", border: "1px solid var(--zinc-700)", borderRadius: 2, cursor: "pointer" }}>
                      <svg style={{ width: 16, height: 16, color: "var(--red)", flexShrink: 0 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                      </svg>
                      <span style={{ fontFamily: "Rajdhani,sans-serif", fontSize: 13, color: "var(--zinc-300)" }}>Déposer le PDF signé pour vérification</span>
                      <input type="file" accept="application/pdf" onChange={handleFileVerify} style={{ display: "none" }} />
                    </label>

                    {verifyStatus === "match" && (
                      <div style={{ marginTop: 10, padding: "10px 14px", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 2, fontFamily: "Rajdhani,sans-serif", fontSize: 13, color: "#22C55E" }}>
                        ✓ Hash identique — document authentique, non altéré
                      </div>
                    )}
                    {verifyStatus === "mismatch" && (
                      <div style={{ marginTop: 10, padding: "10px 14px", background: "rgba(224,48,48,0.08)", border: "1px solid rgba(224,48,48,0.3)", borderRadius: 2, fontFamily: "Rajdhani,sans-serif", fontSize: 13, color: "#ff6b6b" }}>
                        ✕ Hash différent — ce fichier a été modifié ou ne correspond pas
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Footer */}
          <div style={{ marginTop: 24, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <svg style={{ width: 11, height: 11, color: "#22C55E" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
            <span style={{ fontFamily: "Rajdhani,sans-serif", fontSize: 10, color: "var(--zinc-400)" }}>
              <span style={{ color: "#22C55E", fontWeight: 600 }}>SEA · eIDAS · RFC 3161</span> — Signature Électronique Avancée
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontFamily: "Orbitron,monospace", fontSize: 7, letterSpacing: 2, textTransform: "uppercase", color: "var(--zinc-500)", marginBottom: 2 }}>{label}</div>
      <div style={{ fontFamily: mono ? "monospace" : "Rajdhani,sans-serif", fontSize: mono ? 11 : 13, color: "var(--zinc-200)", wordBreak: "break-all" }}>{value}</div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: "Orbitron,monospace", fontSize: 7, letterSpacing: 2, textTransform: "uppercase", color: "var(--zinc-400)" }}>{children}</div>;
}

function CopyBtn({ onClick, copied }: { onClick: () => void; copied: boolean }) {
  return (
    <button onClick={onClick} style={{ flexShrink: 0, padding: "6px 10px", background: copied ? "rgba(34,197,94,0.15)" : "var(--zinc-800)", border: `1px solid ${copied ? "rgba(34,197,94,0.4)" : "var(--zinc-700)"}`, borderRadius: 2, color: copied ? "#22C55E" : "var(--zinc-400)", fontFamily: "Orbitron,monospace", fontSize: 8, letterSpacing: 1, cursor: "pointer" }}>
      {copied ? "OK" : "COPY"}
    </button>
  );
}

function Msg({ color, icon, title, sub }: { color: string; icon: string; title: string; sub: string }) {
  return (
    <div style={{ textAlign: "center", padding: "20px 0" }}>
      <div style={{ fontSize: 32, marginBottom: 12, color }}>{icon}</div>
      <div style={{ fontFamily: "Orbitron,monospace", fontSize: 13, fontWeight: 700, letterSpacing: 2, color, marginBottom: 8 }}>{title}</div>
      <div style={{ fontFamily: "Rajdhani,sans-serif", fontSize: 13, color: "var(--zinc-400)" }}>{sub}</div>
    </div>
  );
}

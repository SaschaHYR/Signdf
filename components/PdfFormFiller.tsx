"use client";

import { useState } from "react";
import { PdfField } from "@/lib/detectPdfFields";

interface Props {
  fields: PdfField[];
  onConfirm: (values: Record<string, string>) => void;
  onSkip: () => void;
}

export default function PdfFormFiller({ fields, onConfirm, onSkip }: Props) {
  const fillableFields = fields.filter(f => f.type === "text" || f.type === "checkbox" || f.type === "select");
  const sigFields = fields.filter(f => f.type === "signature");
  const hasOther = fillableFields.length > 0;

  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of fillableFields) {
      init[f.name] = f.value ?? "";
    }
    return init;
  });

  const set = (name: string, val: string) => setValues(prev => ({ ...prev, [name]: val }));

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden" style={{ background: "var(--bg)", padding: "20px 16px", boxSizing: "border-box" }}>
      <div style={{ width: "100%", maxWidth: 540, boxSizing: "border-box" }}>
        <div style={{ background: "rgba(24,24,27,0.97)", border: "1px solid rgba(224,48,48,0.3)", borderRadius: 4, padding: "clamp(20px,5vw,36px) clamp(16px,5vw,40px)", backdropFilter: "blur(20px)", position: "relative", boxShadow: "0 0 40px rgba(224,48,48,0.08),0 0 80px rgba(0,0,0,0.8)" }}>
          {/* Top accent */}
          <div style={{ position: "absolute", top: -1, left: "10%", right: "10%", height: 1, background: "linear-gradient(90deg,transparent,#E03030,transparent)", filter: "blur(1px)" }} />
          <div style={{ position: "absolute", top: -1, left: "25%", right: "25%", height: 1, background: "#E03030", boxShadow: "0 0 12px #E03030" }} />

          {/* Header */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "Orbitron,monospace", fontSize: 9, letterSpacing: 3, textTransform: "uppercase", color: "var(--red)", border: "1px solid rgba(224,48,48,0.3)", padding: "4px 10px", borderRadius: 2, marginBottom: 12 }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--red)", boxShadow: "0 0 6px var(--red)", display: "inline-block" }} />
              FORMULAIRE DÉTECTÉ
            </div>
            <div style={{ fontFamily: "Orbitron,monospace", fontSize: 18, fontWeight: 900, color: "#fff", letterSpacing: 2 }}>
              e-SIGN<span style={{ color: "var(--red)" }}>.</span>PDF
            </div>
            <div style={{ fontFamily: "Rajdhani,sans-serif", fontSize: 13, color: "var(--zinc-400)", marginTop: 6 }}>
              Ce PDF contient {fields.length} champ{fields.length > 1 ? "s" : ""} — remplissez les champs puis signez.
            </div>
          </div>

          {/* Signature field detected notice */}
          {sigFields.length > 0 && (
            <div style={{ marginBottom: 20, padding: "10px 14px", background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 3, display: "flex", alignItems: "center", gap: 10 }}>
              <svg style={{ width: 14, height: 14, color: "#22C55E", flexShrink: 0 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              <div style={{ fontFamily: "Rajdhani,sans-serif", fontSize: 12, color: "#22C55E" }}>
                Champ signature détecté — votre signature sera placée automatiquement.
              </div>
            </div>
          )}

          {/* Fillable fields */}
          {hasOther && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 24 }}>
              {fillableFields.map(field => (
                <FieldInput
                  key={field.name}
                  field={field}
                  value={values[field.name] ?? ""}
                  onChange={(v) => set(field.name, v)}
                />
              ))}
            </div>
          )}

          {!hasOther && (
            <div style={{ marginBottom: 24, padding: "14px 16px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 3, fontFamily: "Rajdhani,sans-serif", fontSize: 13, color: "var(--zinc-400)" }}>
              Aucun champ texte à remplir — uniquement un champ signature détecté.
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={() => onConfirm(values)}
              style={{ flex: 1, minWidth: 140, padding: "13px 16px", background: "var(--red)", border: "none", borderRadius: 2, color: "#fff", fontFamily: "Orbitron,monospace", fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer" }}
            >
              CONTINUER → SIGNER
            </button>
            <button
              onClick={onSkip}
              style={{ padding: "13px 14px", background: "transparent", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 2, color: "var(--zinc-400)", fontFamily: "Orbitron,monospace", fontSize: 9, letterSpacing: 2, cursor: "pointer", whiteSpace: "nowrap" }}
            >
              IGNORER LE FORMULAIRE
            </button>
          </div>

          <div style={{ marginTop: 12, fontFamily: "Rajdhani,sans-serif", fontSize: 10, color: "var(--zinc-600)", textAlign: "center" }}>
            "Ignorer" passe directement au placement manuel de la signature
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldInput({ field, value, onChange }: { field: PdfField; value: string; onChange: (v: string) => void }) {
  const label = field.name.replace(/[_-]/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ fontFamily: "Orbitron,monospace", fontSize: 8, letterSpacing: 2, textTransform: "uppercase", color: "var(--zinc-400)" }}>{label}</div>
        {field.required && <span style={{ fontSize: 8, color: "var(--red)", fontFamily: "Orbitron,monospace" }}>REQUIS</span>}
        {field.value && !value && (
          <span style={{ fontSize: 8, color: "var(--zinc-600)", fontFamily: "Rajdhani,sans-serif" }}>pré-rempli</span>
        )}
      </div>
      {field.type === "checkbox" ? (
        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
          <div
            onClick={() => onChange(value === "On" ? "Off" : "On")}
            style={{ width: 36, height: 20, borderRadius: 10, background: value === "On" ? "#22C55E" : "var(--zinc-700)", position: "relative", transition: "background 0.2s", flexShrink: 0, cursor: "pointer" }}
          >
            <div style={{ position: "absolute", top: 3, left: value === "On" ? 18 : 3, width: 14, height: 14, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
          </div>
          <span style={{ fontFamily: "Rajdhani,sans-serif", fontSize: 13, color: "var(--zinc-300)" }}>{label}</span>
        </label>
      ) : (
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={field.value ? `Valeur actuelle : ${field.value}` : label}
          style={{ background: "var(--zinc-800)", border: "1px solid var(--zinc-700)", borderRadius: 2, padding: "10px 12px", color: "#fff", fontFamily: "Rajdhani,sans-serif", fontSize: 14, fontWeight: 500, width: "100%", outline: "none", boxSizing: "border-box" }}
          onFocus={e => { e.target.style.borderColor = "var(--red)"; e.target.style.boxShadow = "0 0 0 1px rgba(224,48,48,0.2)"; }}
          onBlur={e => { e.target.style.borderColor = "var(--zinc-700)"; e.target.style.boxShadow = "none"; }}
        />
      )}
    </div>
  );
}

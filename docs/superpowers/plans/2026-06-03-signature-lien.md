# Signature par lien Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre d'envoyer un PDF à signer via un lien unique — le signataire signe dans le navigateur, les deux parties reçoivent le PDF signé par email.

**Architecture:** Firebase Storage stocke les PDFs (original + signé), Firestore stocke les métadonnées (token, emails, statut). EmailJS envoie les deux emails côté client après signature. Tout reste client-side sauf Firebase SDK.

**Tech Stack:** Next.js 14 App Router, Firebase SDK v10, EmailJS, pdf-lib, Dancing Script TTF pour la font manuscrite dans le PDF.

---

## File Map

| Fichier | Action | Responsabilité |
|---|---|---|
| `lib/firebase.ts` | Créer | Init Firebase app, exports `db` (Firestore) + `storage` |
| `lib/uploadPdf.ts` | Créer | Upload/download PDF Firebase Storage, create/get/update Firestore doc |
| `lib/emailjs.ts` | Créer | Envoi 2 emails via EmailJS après signature |
| `lib/signPdf.ts` | Modifier | blockW=200 blockH=72, embed Dancing Script TTF, accept arrayBuffer en plus de File |
| `components/SignatureForm.tsx` | Modifier | Ajout champ email expéditeur, mode "share" (affiche lien + bouton copier) |
| `components/SignPage.tsx` | Créer | Formulaire signataire : fetch token, aperçu PDF, signature, upload, email |
| `app/sign/[token]/page.tsx` | Créer | Shell server component qui rend `<SignPage token={params.token} />` |
| `app/layout.tsx` | Modifier | Ajouter Dancing Script dans Google Fonts link |
| `public/fonts/DancingScript-Bold.ttf` | Ajouter | Font TTF pour pdf-lib (fetch côté client) |
| `.env.local` | Créer | Toutes les variables NEXT_PUBLIC_* |

---

## Task 1 — Dépendances + variables d'environnement

**Files:**
- Modify: `package.json`
- Create: `.env.local`

- [ ] **Step 1: Installer Firebase et EmailJS**

```bash
npm install firebase @emailjs/browser
```

Expected output: `added X packages`

- [ ] **Step 2: Créer `.env.local`**

```bash
cat > .env.local << 'EOF'
NEXT_PUBLIC_FIREBASE_API_KEY=REMPLACER
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=REMPLACER.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=REMPLACER
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=REMPLACER.appspot.com
NEXT_PUBLIC_FIREBASE_APP_ID=REMPLACER
NEXT_PUBLIC_EMAILJS_SERVICE_ID=REMPLACER
NEXT_PUBLIC_EMAILJS_TEMPLATE_ID=REMPLACER
NEXT_PUBLIC_EMAILJS_PUBLIC_KEY=REMPLACER
NEXT_PUBLIC_APP_URL=http://localhost:3000
EOF
```

> **Note manuelle requise :** Créer un projet Firebase sur console.firebase.google.com, activer Firestore + Storage, copier les clés dans `.env.local`. Créer un compte EmailJS sur emailjs.com, créer un service email et un template (voir Task 7 pour le template).

- [ ] **Step 3: Ajouter `.env.local` au `.gitignore`**

Vérifier que `.gitignore` contient `.env.local` (create-next-app l'inclut par défaut).

```bash
grep ".env.local" .gitignore
```

Expected: `.env.local`

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add firebase and emailjs dependencies"
```

---

## Task 2 — Télécharger Dancing Script TTF

**Files:**
- Create: `public/fonts/DancingScript-Bold.ttf`

- [ ] **Step 1: Télécharger la font**

```bash
mkdir -p public/fonts
curl -L "https://github.com/googlefonts/dancing-script/raw/main/fonts/ttf/DancingScript-Bold.ttf" \
  -o public/fonts/DancingScript-Bold.ttf
```

- [ ] **Step 2: Vérifier**

```bash
ls -lh public/fonts/DancingScript-Bold.ttf
```

Expected: fichier ~100KB

- [ ] **Step 3: Commit**

```bash
git add public/fonts/DancingScript-Bold.ttf
git commit -m "feat: add Dancing Script Bold TTF for PDF signatures"
```

---

## Task 3 — lib/firebase.ts

**Files:**
- Create: `lib/firebase.ts`

- [ ] **Step 1: Créer l'initialisation Firebase**

```typescript
// lib/firebase.ts
import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const db = getFirestore(app);
export const storage = getStorage(app);
```

- [ ] **Step 2: Vérifier compilation TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add lib/firebase.ts
git commit -m "feat: init Firebase SDK"
```

---

## Task 4 — lib/uploadPdf.ts

**Files:**
- Create: `lib/uploadPdf.ts`

- [ ] **Step 1: Créer le module upload/download/Firestore**

```typescript
// lib/uploadPdf.ts
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db, storage } from "./firebase";

export interface SignatureDoc {
  token: string;
  emailExpediteur: string;
  fileName: string;
  status: "pending" | "signed";
  createdAt: unknown;
  emailSignataire?: string;
  signedAt?: unknown;
  signedFileUrl?: string;
}

export async function uploadOriginalPdf(file: File, token: string): Promise<void> {
  const storageRef = ref(storage, `pdfs/${token}/original.pdf`);
  await uploadBytes(storageRef, file, { contentType: "application/pdf" });
}

export async function createSignatureDoc(
  token: string,
  emailExpediteur: string,
  fileName: string
): Promise<void> {
  await setDoc(doc(db, "signatures", token), {
    token,
    emailExpediteur,
    fileName,
    status: "pending",
    createdAt: serverTimestamp(),
  });
}

export async function getSignatureDoc(token: string): Promise<SignatureDoc | null> {
  const snap = await getDoc(doc(db, "signatures", token));
  if (!snap.exists()) return null;
  return snap.data() as SignatureDoc;
}

export async function getOriginalPdfUrl(token: string): Promise<string> {
  const storageRef = ref(storage, `pdfs/${token}/original.pdf`);
  return getDownloadURL(storageRef);
}

export async function uploadSignedPdf(bytes: Uint8Array, token: string): Promise<string> {
  const storageRef = ref(storage, `pdfs/${token}/signed.pdf`);
  const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
  await uploadBytes(storageRef, blob, { contentType: "application/pdf" });
  return getDownloadURL(storageRef);
}

export async function markAsSigned(
  token: string,
  emailSignataire: string,
  signedFileUrl: string
): Promise<void> {
  await updateDoc(doc(db, "signatures", token), {
    status: "signed",
    emailSignataire,
    signedAt: serverTimestamp(),
    signedFileUrl,
  });
}
```

- [ ] **Step 2: Vérifier compilation**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add lib/uploadPdf.ts
git commit -m "feat: Firebase Storage and Firestore helpers"
```

---

## Task 5 — lib/emailjs.ts

**Files:**
- Create: `lib/emailjs.ts`

- [ ] **Step 1: Créer le module email**

```typescript
// lib/emailjs.ts
import emailjs from "@emailjs/browser";

const SERVICE_ID = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID!;
const TEMPLATE_ID = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID!;
const PUBLIC_KEY = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY!;

export interface EmailParams {
  toEmail: string;
  toName: string;
  signataireName: string;
  fileName: string;
  signedFileUrl: string;
  role: "expediteur" | "signataire";
}

export async function sendSignatureEmail(params: EmailParams): Promise<void> {
  await emailjs.send(
    SERVICE_ID,
    TEMPLATE_ID,
    {
      to_email: params.toEmail,
      to_name: params.toName,
      signataire_name: params.signataireName,
      file_name: params.fileName,
      signed_file_url: params.signedFileUrl,
      role: params.role === "expediteur" ? "L'expéditeur" : "Le signataire",
    },
    PUBLIC_KEY
  );
}
```

> **Note EmailJS template :** Dans le dashboard EmailJS, créer un template avec ces variables :
> - `{{to_name}}` — nom du destinataire
> - `{{signataire_name}}` — nom du signataire
> - `{{file_name}}` — nom du fichier
> - `{{signed_file_url}}` — lien téléchargement PDF signé
> - `{{role}}` — "L'expéditeur" ou "Le signataire"
>
> Exemple de corps de template :
> ```
> Bonjour {{to_name}},
>
> {{role}} du document "{{file_name}}" a été signé par {{signataire_name}}.
>
> Télécharger le document signé : {{signed_file_url}}
>
> Signature électronique simple — valeur probante.
> ```

- [ ] **Step 2: Vérifier compilation**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add lib/emailjs.ts
git commit -m "feat: EmailJS helper for post-signature emails"
```

---

## Task 6 — lib/signPdf.ts — bloc réduit + Dancing Script

**Files:**
- Modify: `lib/signPdf.ts`

- [ ] **Step 1: Remplacer signPdf.ts complet**

```typescript
// lib/signPdf.ts
import { PDFDocument, rgb, PDFFont } from "pdf-lib";

export interface SignatureOptions {
  prenom: string;
  nom: string;
}

async function loadDancingScriptFont(doc: PDFDocument): Promise<PDFFont> {
  const url = "/fonts/DancingScript-Bold.ttf";
  const response = await fetch(url);
  const fontBytes = await response.arrayBuffer();
  return doc.embedFont(fontBytes);
}

export async function signPdf(
  source: File | ArrayBuffer,
  options: SignatureOptions
): Promise<Uint8Array> {
  const arrayBuffer = source instanceof File ? await source.arrayBuffer() : source;

  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: false });
  } catch {
    throw new Error("Ce PDF est protégé ou corrompu et ne peut pas être signé.");
  }

  const dancingScript = await loadDancingScriptFont(doc);

  const pages = doc.getPages();
  const lastPage = pages[pages.length - 1];
  const { width } = lastPage.getSize();

  const fullName = `${options.prenom} ${options.nom}`;
  const timestamp = Date.now();
  const sigId = btoa(fullName + timestamp).replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 8);
  const dateStr = new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" });

  const blockW = 200;
  const blockH = 72;
  const margin = 20;
  const x = width - blockW - margin;
  const y = margin;

  lastPage.drawRectangle({
    x,
    y,
    width: blockW,
    height: blockH,
    borderColor: rgb(0.102, 0.153, 0.267),
    borderWidth: 1,
    color: rgb(0.98, 0.98, 1),
  });

  lastPage.drawText("Signé électroniquement par", {
    x: x + 8,
    y: y + blockH - 14,
    size: 7,
    font: dancingScript,
    color: rgb(0.5, 0.5, 0.5),
  });

  lastPage.drawText(fullName, {
    x: x + 8,
    y: y + blockH - 30,
    size: 16,
    font: dancingScript,
    color: rgb(0.102, 0.153, 0.267),
  });

  lastPage.drawText(`Le ${dateStr}`, {
    x: x + 8,
    y: y + blockH - 44,
    size: 7,
    font: dancingScript,
    color: rgb(0.3, 0.3, 0.3),
  });

  lastPage.drawText(`SIG ID · ${sigId}`, {
    x: x + 8,
    y: y + blockH - 56,
    size: 7,
    font: dancingScript,
    color: rgb(0.4, 0.4, 0.4),
  });

  lastPage.drawLine({
    start: { x: x + 8, y: y + blockH - 62 },
    end:   { x: x + blockW - 8, y: y + blockH - 62 },
    thickness: 0.5,
    color: rgb(0.8, 0.8, 0.8),
  });

  lastPage.drawText("Signature électronique simple — valeur probante", {
    x: x + 8,
    y: y + blockH - 70,
    size: 6,
    font: dancingScript,
    color: rgb(0.6, 0.6, 0.6),
  });

  return doc.save();
}

export function downloadBytes(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 2: Vérifier compilation**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add lib/signPdf.ts
git commit -m "feat: reduced signature block 200x72, Dancing Script font in PDF"
```

---

## Task 7 — app/layout.tsx — ajouter Dancing Script CSS

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: Ajouter Dancing Script dans le link Google Fonts**

Remplacer la ligne `href` du link Google Fonts existant :

```typescript
// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "e-SIGN.PDF — Signature électronique",
  description: "Signez vos PDF électroniquement. Traitement local, aucune donnée envoyée.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Rajdhani:wght@300;400;500;600&family=Dancing+Script:wght@700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/layout.tsx
git commit -m "feat: add Dancing Script to Google Fonts"
```

---

## Task 8 — components/SignatureForm.tsx — mode expéditeur avec share link

**Files:**
- Modify: `components/SignatureForm.tsx`

- [ ] **Step 1: Réécrire SignatureForm.tsx**

Le composant passe en mode "share" après upload. Remplacer le fichier complet :

```typescript
"use client";

import { useCallback, useRef, useState } from "react";
import { uploadOriginalPdf, createSignatureDoc } from "@/lib/uploadPdf";

type Status = "idle" | "uploading" | "share" | "error";

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

          {status === "share" ? (
            <ShareState url={shareUrl} onReset={reset} onCopy={copyLink} copied={copied} />
          ) : (
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
                  borderRadius: 3, padding: "28px 20px", textAlign: "center",
                  cursor: "pointer", position: "relative", overflow: "hidden",
                  marginBottom: 20,
                  background: file || dragging ? "rgba(224,48,48,0.05)" : "rgba(224,48,48,0.02)",
                  transition: "all 0.2s",
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
                <input ref={inputRef} type="file" accept=".pdf,application/pdf" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              </div>

              {isLarge && (
                <div style={{ background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 2, padding: "8px 12px", marginBottom: 12, fontSize: 11, color: "#fbbf24", fontFamily: "Rajdhani, sans-serif" }}>
                  ⚠ Fichier volumineux ({(file!.size / 1024 / 1024).toFixed(1)} MB)
                </div>
              )}

              {/* Email expéditeur */}
              <div className="animate-fields-in" style={{ marginBottom: 20 }}>
                <FieldGroup label="Votre email" value={emailExpediteur} onChange={setEmailExpediteur} placeholder="vous@exemple.com" type="email" />
              </div>

              <div className="animate-divider-in" style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <div style={{ flex: 1, height: 1, background: "var(--zinc-700)" }} />
                <div style={{ fontFamily: "Orbitron, monospace", fontSize: 8, letterSpacing: 2, textTransform: "uppercase", color: "var(--zinc-400)" }}>Envoyer pour signature</div>
                <div style={{ flex: 1, height: 1, background: "var(--zinc-700)" }} />
              </div>

              {status === "error" && (
                <div style={{ background: "rgba(224,48,48,0.08)", border: "1px solid rgba(224,48,48,0.3)", borderRadius: 2, padding: "8px 12px", marginBottom: 12, fontSize: 12, color: "#ff6b6b", fontFamily: "Rajdhani, sans-serif" }}>
                  ✕ {errorMsg}
                </div>
              )}

              <button
                className="animate-btn-in btn-shimmer"
                onClick={handleSubmit}
                disabled={status === "uploading"}
                style={{
                  width: "100%", padding: "14px 20px",
                  background: status === "uploading" ? "var(--red-dark)" : "var(--red)",
                  border: "none", borderRadius: 2, color: "#fff",
                  fontFamily: "Orbitron, monospace", fontSize: 12, fontWeight: 700,
                  letterSpacing: 3, textTransform: "uppercase",
                  cursor: status === "uploading" ? "not-allowed" : "pointer",
                  position: "relative", overflow: "hidden",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}
              >
                {status === "uploading" ? (
                  <>
                    <span style={{ display: "inline-block", width: 12, height: 12, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                    UPLOAD EN COURS...
                  </>
                ) : "↑ GÉNÉRER LE LIEN DE SIGNATURE"}
              </button>

              <style>{`@keyframes spin { to { transform: rotate(360deg); } } .btn-shimmer:hover { background: #cc2020 !important; box-shadow: 0 0 24px rgba(224,48,48,0.5); transform: translateY(-1px); } .btn-shimmer:active { transform: translateY(0) !important; }`}</style>
            </>
          )}

          {/* Footer */}
          <div className="animate-footer-in" style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontFamily: "Orbitron, monospace", fontSize: 8, letterSpacing: 2, textTransform: "uppercase", color: "var(--zinc-400)" }}>
              V<span style={{ color: "rgba(224,48,48,0.6)" }}>2.0</span> · FIREBASE + NEXT.JS
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontFamily: "Rajdhani, sans-serif", fontSize: 10, color: "var(--zinc-400)" }}>
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

function ShareState({ url, onReset, onCopy, copied }: { url: string; onReset: () => void; onCopy: () => void; copied: boolean }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.4)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
        <svg style={{ width: 24, height: 24, color: "#22C55E" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 015.656 0l1 1a4 4 0 01-5.656 5.656l-1.1-1.1" />
        </svg>
      </div>
      <div style={{ fontFamily: "Orbitron, monospace", fontSize: 13, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#22C55E", marginBottom: 6 }}>
        Lien généré
      </div>
      <div style={{ fontFamily: "Rajdhani, sans-serif", fontSize: 12, color: "var(--zinc-400)", marginBottom: 20 }}>
        Envoyez ce lien au signataire
      </div>

      <div style={{ background: "var(--zinc-800)", border: "1px solid var(--zinc-700)", borderRadius: 2, padding: "10px 12px", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, fontFamily: "Orbitron, monospace", fontSize: 8, color: "var(--zinc-300)", letterSpacing: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {url}
        </div>
        <button
          onClick={onCopy}
          style={{ flexShrink: 0, padding: "4px 10px", background: copied ? "rgba(34,197,94,0.2)" : "var(--red)", border: "none", borderRadius: 2, color: "#fff", fontFamily: "Orbitron, monospace", fontSize: 8, letterSpacing: 1, cursor: "pointer", transition: "all 0.2s" }}
        >
          {copied ? "✓ COPIÉ" : "COPIER"}
        </button>
      </div>

      <button
        onClick={onReset}
        style={{ width: "100%", padding: "10px 20px", background: "transparent", border: "1px solid rgba(224,48,48,0.3)", borderRadius: 2, color: "var(--zinc-400)", fontFamily: "Orbitron, monospace", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer" }}
      >
        ← NOUVEAU DOCUMENT
      </button>
    </div>
  );
}

function FieldGroup({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; type?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <div style={{ fontFamily: "Orbitron, monospace", fontSize: 9, letterSpacing: 2, textTransform: "uppercase", color: "var(--zinc-400)" }}>{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ background: "var(--zinc-800)", border: "1px solid var(--zinc-700)", borderRadius: 2, padding: "10px 12px", color: "#fff", fontFamily: "Rajdhani, sans-serif", fontSize: 14, fontWeight: 500, letterSpacing: 0.5, width: "100%", outline: "none" }}
        onFocus={(e) => { e.target.style.borderColor = "var(--red)"; e.target.style.boxShadow = "0 0 0 1px rgba(224,48,48,0.2)"; }}
        onBlur={(e) => { e.target.style.borderColor = "var(--zinc-700)"; e.target.style.boxShadow = "none"; }}
      />
    </div>
  );
}

function Particles() {
  const mounted = useRef(false);
  const ref = useRef<HTMLDivElement>(null);
  useCallback(() => {
    if (mounted.current || !ref.current) return;
    mounted.current = true;
    for (let i = 0; i < 18; i++) {
      const p = document.createElement("div");
      p.className = "particle";
      const size = 1 + Math.random() * 2;
      p.style.cssText = `left:${Math.random()*100}%;bottom:${Math.random()*20}%;--drift:${(Math.random()-0.5)*80}px;animation-duration:${6+Math.random()*10}s;animation-delay:${Math.random()*8}s;width:${size}px;height:${size}px;`;
      ref.current.appendChild(p);
    }
  }, [])();
  return <div ref={ref} className="particles" />;
}
```

- [ ] **Step 2: Vérifier compilation**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/SignatureForm.tsx
git commit -m "feat: sender form with Firebase upload and share link"
```

---

## Task 9 — components/SignPage.tsx

**Files:**
- Create: `components/SignPage.tsx`

- [ ] **Step 1: Créer le composant signataire**

```typescript
"use client";

import { useEffect, useState } from "react";
import { getSignatureDoc, getOriginalPdfUrl, uploadSignedPdf, markAsSigned, SignatureDoc } from "@/lib/uploadPdf";
import { signPdf, downloadBytes } from "@/lib/signPdf";
import { sendSignatureEmail } from "@/lib/emailjs";

type PageStatus = "loading" | "ready" | "already-signed" | "invalid" | "signing" | "success" | "error";

export default function SignPage({ token }: { token: string }) {
  const [pageStatus, setPageStatus] = useState<PageStatus>("loading");
  const [sigDoc, setSigDoc] = useState<SignatureDoc | null>(null);
  const [pdfUrl, setPdfUrl] = useState("");
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [signedUrl, setSignedUrl] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const doc = await getSignatureDoc(token);
        if (!doc) { setPageStatus("invalid"); return; }
        if (doc.status === "signed") {
          setSigDoc(doc);
          setSignedUrl(doc.signedFileUrl ?? "");
          setPageStatus("already-signed");
          return;
        }
        const url = await getOriginalPdfUrl(token);
        setSigDoc(doc);
        setPdfUrl(url);
        setPageStatus("ready");
      } catch {
        setPageStatus("invalid");
      }
    }
    load();
  }, [token]);

  const handleSign = async () => {
    if (!prenom.trim() || !nom.trim()) { setErrorMsg("Prénom et nom requis."); return; }
    if (!email.trim() || !email.includes("@")) { setErrorMsg("Email valide requis."); return; }
    if (!sigDoc) return;

    setPageStatus("signing");
    setErrorMsg("");

    try {
      const response = await fetch(pdfUrl);
      const arrayBuffer = await response.arrayBuffer();
      const bytes = await signPdf(arrayBuffer, { prenom: prenom.trim(), nom: nom.trim() });
      const signedFileUrl = await uploadSignedPdf(bytes, token);
      await markAsSigned(token, email.trim(), signedFileUrl);

      const fullName = `${prenom.trim()} ${nom.trim()}`;
      const fileName = sigDoc.fileName;

      try {
        await sendSignatureEmail({ toEmail: email.trim(), toName: fullName, signataireName: fullName, fileName, signedFileUrl, role: "signataire" });
        await sendSignatureEmail({ toEmail: sigDoc.emailExpediteur, toName: "l'expéditeur", signataireName: fullName, fileName, signedFileUrl, role: "expediteur" });
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

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden" style={{ background: "var(--bg)" }}>
      <div className="bg-grid" />
      <div className="scanlines" />
      <div className="corner corner-tl" />
      <div className="corner corner-tr" />
      <div className="corner corner-bl" />
      <div className="corner corner-br" />

      <div className="relative z-10" style={{ width: "500px" }}>
        <div
          style={{
            background: "rgba(24, 24, 27, 0.92)",
            border: "1px solid rgba(224, 48, 48, 0.3)",
            borderRadius: "4px",
            padding: "40px 44px",
            backdropFilter: "blur(20px)",
            position: "relative",
            boxShadow: "0 0 40px rgba(224,48,48,0.08), 0 0 80px rgba(0,0,0,0.8)",
          }}
        >
          <div style={{ position: "absolute", top: -1, left: "10%", right: "10%", height: 1, background: "linear-gradient(90deg, transparent, #E03030, transparent)", filter: "blur(1px)" }} />
          <div style={{ position: "absolute", top: -1, left: "25%", right: "25%", height: 1, background: "#E03030", boxShadow: "0 0 12px #E03030" }} />

          {/* Header */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "Orbitron, monospace", fontSize: 9, letterSpacing: 3, textTransform: "uppercase", color: "var(--red)", border: "1px solid rgba(224,48,48,0.3)", padding: "4px 10px", borderRadius: 2, marginBottom: 14 }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--red)", boxShadow: "0 0 6px var(--red)", display: "inline-block", animation: "dotPulse 2s ease-in-out infinite" }} />
              DEMANDE DE SIGNATURE
            </div>
            <div style={{ fontFamily: "Orbitron, monospace", fontSize: 24, fontWeight: 900, color: "#fff", letterSpacing: 2 }}>
              e-SIGN<span style={{ color: "var(--red)" }}>.</span>PDF
            </div>
            {sigDoc && (
              <div style={{ fontFamily: "Rajdhani, sans-serif", fontSize: 12, color: "var(--zinc-400)", marginTop: 6, letterSpacing: 0.5 }}>
                Document : <span style={{ color: "var(--zinc-300)" }}>{sigDoc.fileName}</span>
              </div>
            )}
          </div>

          {pageStatus === "loading" && (
            <LoadingState />
          )}

          {pageStatus === "invalid" && (
            <MessageState color="#ff6b6b" icon="✕" title="Lien invalide ou expiré" sub="Ce lien de signature n'existe pas ou a déjà été utilisé." />
          )}

          {pageStatus === "already-signed" && (
            <div style={{ textAlign: "center" }}>
              <MessageState color="#22C55E" icon="✓" title="Document déjà signé" sub="Ce document a déjà été signé." />
              {signedUrl && (
                <a href={signedUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 16, padding: "10px 20px", background: "var(--red)", borderRadius: 2, color: "#fff", fontFamily: "Orbitron, monospace", fontSize: 10, letterSpacing: 2, textDecoration: "none" }}>
                  ↓ TÉLÉCHARGER LE PDF SIGNÉ
                </a>
              )}
            </div>
          )}

          {(pageStatus === "ready" || pageStatus === "signing" || pageStatus === "error") && (
            <>
              {pdfUrl && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontFamily: "Orbitron, monospace", fontSize: 8, letterSpacing: 2, textTransform: "uppercase", color: "var(--zinc-400)", marginBottom: 8 }}>Aperçu du document</div>
                  <a href={pdfUrl} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: "var(--zinc-800)", border: "1px solid var(--zinc-700)", borderRadius: 2, color: "var(--zinc-300)", fontFamily: "Rajdhani, sans-serif", fontSize: 13, textDecoration: "none" }}>
                    <svg style={{ width: 16, height: 16, color: "var(--red)", flexShrink: 0 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                    Ouvrir le document PDF →
                  </a>
                </div>
              )}

              {/* Signature preview */}
              <div style={{ marginBottom: 16, padding: "12px 14px", background: "rgba(224,48,48,0.03)", border: "1px solid rgba(224,48,48,0.15)", borderRadius: 2 }}>
                <div style={{ fontFamily: "Orbitron, monospace", fontSize: 8, letterSpacing: 2, textTransform: "uppercase", color: "var(--red)", marginBottom: 8 }}>Aperçu de votre signature</div>
                <div style={{ fontFamily: "'Dancing Script', cursive", fontSize: 22, color: "#fff" }}>
                  {prenom || "Prénom"} {nom || "Nom"}
                </div>
                <div style={{ fontFamily: "Rajdhani, sans-serif", fontSize: 11, color: "var(--zinc-400)", marginTop: 4 }}>
                  {new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}
                </div>
              </div>

              {/* Form */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <FieldGroup label="Prénom" value={prenom} onChange={setPrenom} placeholder="Jean" />
                <FieldGroup label="Nom" value={nom} onChange={setNom} placeholder="Dupont" />
              </div>
              <div style={{ marginBottom: 20 }}>
                <FieldGroup label="Votre email" value={email} onChange={setEmail} placeholder="vous@exemple.com" type="email" />
              </div>

              {errorMsg && (
                <div style={{ background: "rgba(224,48,48,0.08)", border: "1px solid rgba(224,48,48,0.3)", borderRadius: 2, padding: "8px 12px", marginBottom: 12, fontSize: 12, color: "#ff6b6b", fontFamily: "Rajdhani, sans-serif" }}>
                  ✕ {errorMsg}
                </div>
              )}

              <button
                onClick={handleSign}
                disabled={pageStatus === "signing"}
                style={{
                  width: "100%", padding: "14px 20px",
                  background: pageStatus === "signing" ? "var(--red-dark)" : "var(--red)",
                  border: "none", borderRadius: 2, color: "#fff",
                  fontFamily: "Orbitron, monospace", fontSize: 12, fontWeight: 700,
                  letterSpacing: 3, textTransform: "uppercase",
                  cursor: pageStatus === "signing" ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}
              >
                {pageStatus === "signing" ? (
                  <>
                    <span style={{ display: "inline-block", width: 12, height: 12, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                    SIGNATURE EN COURS...
                  </>
                ) : "✍ SIGNER LE DOCUMENT"}
              </button>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes dotPulse { 0%,100%{opacity:1;} 50%{opacity:0.4;} }`}</style>
            </>
          )}

          {pageStatus === "success" && (
            <div style={{ textAlign: "center" }}>
              <svg style={{ width: 56, height: 56, margin: "0 auto 16px", display: "block" }} viewBox="0 0 56 56">
                <circle className="check-circle" cx="28" cy="28" r="26" />
                <polyline className="check-tick" points="16,28 24,36 40,20" />
              </svg>
              <div style={{ fontFamily: "Orbitron, monospace", fontSize: 14, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", color: "#22C55E", textShadow: "0 0 20px rgba(34,197,94,0.4)", marginBottom: 8 }}>
                Document Signé
              </div>
              <div style={{ fontFamily: "Rajdhani, sans-serif", fontSize: 13, color: "var(--zinc-400)", marginBottom: 16 }}>
                Téléchargement démarré · Email envoyé
              </div>
              {signedUrl && (
                <a href={signedUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", padding: "10px 20px", background: "var(--red)", borderRadius: 2, color: "#fff", fontFamily: "Orbitron, monospace", fontSize: 10, letterSpacing: 2, textDecoration: "none" }}>
                  ↓ RETÉLÉCHARGER
                </a>
              )}
            </div>
          )}

          <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "center" }}>
            <div style={{ fontFamily: "Rajdhani, sans-serif", fontSize: 10, color: "var(--zinc-400)" }}>
              Signature électronique simple — valeur probante
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
      <div style={{ fontFamily: "Rajdhani, sans-serif", fontSize: 13, color: "var(--zinc-400)" }}>Chargement du document...</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function MessageState({ color, icon, title, sub }: { color: string; icon: string; title: string; sub: string }) {
  return (
    <div style={{ textAlign: "center", padding: "10px 0" }}>
      <div style={{ fontSize: 32, marginBottom: 12, color }}>{icon}</div>
      <div style={{ fontFamily: "Orbitron, monospace", fontSize: 13, fontWeight: 700, letterSpacing: 2, color, marginBottom: 8 }}>{title}</div>
      <div style={{ fontFamily: "Rajdhani, sans-serif", fontSize: 13, color: "var(--zinc-400)" }}>{sub}</div>
    </div>
  );
}

function FieldGroup({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; type?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <div style={{ fontFamily: "Orbitron, monospace", fontSize: 9, letterSpacing: 2, textTransform: "uppercase", color: "var(--zinc-400)" }}>{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ background: "var(--zinc-800)", border: "1px solid var(--zinc-700)", borderRadius: 2, padding: "10px 12px", color: "#fff", fontFamily: "Rajdhani, sans-serif", fontSize: 14, fontWeight: 500, width: "100%", outline: "none" }}
        onFocus={(e) => { e.target.style.borderColor = "var(--red)"; e.target.style.boxShadow = "0 0 0 1px rgba(224,48,48,0.2)"; }}
        onBlur={(e) => { e.target.style.borderColor = "var(--zinc-700)"; e.target.style.boxShadow = "none"; }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Vérifier compilation**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/SignPage.tsx
git commit -m "feat: SignPage component for recipient signing flow"
```

---

## Task 10 — app/sign/[token]/page.tsx

**Files:**
- Create: `app/sign/[token]/page.tsx`

- [ ] **Step 1: Créer la route dynamique**

```bash
mkdir -p app/sign/\[token\]
```

```typescript
// app/sign/[token]/page.tsx
import SignPage from "@/components/SignPage";

export default function SignRoute({ params }: { params: { token: string } }) {
  return <SignPage token={params.token} />;
}
```

- [ ] **Step 2: Build complet**

```bash
npm run build
```

Expected: ✓ Compiled successfully, no type errors

- [ ] **Step 3: Commit**

```bash
git add app/sign/
git commit -m "feat: dynamic /sign/[token] route"
```

---

## Task 11 — Firebase Rules

**Files:**
- Create: `firestore.rules`
- Create: `storage.rules`

- [ ] **Step 1: Créer firestore.rules**

```
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /signatures/{token} {
      allow read: if true;
      allow create: if true;
      allow update: if resource.data.status == 'pending'
                    && request.resource.data.status == 'signed';
    }
  }
}
```

- [ ] **Step 2: Créer storage.rules**

```
// storage.rules
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /pdfs/{token}/{file} {
      allow read: if true;
      allow write: if true;
    }
  }
}
```

> **Note manuelle requise :** Déployer ces règles dans la console Firebase (Firestore → Rules, Storage → Rules) ou via `firebase deploy --only firestore:rules,storage`.

- [ ] **Step 3: Commit**

```bash
git add firestore.rules storage.rules
git commit -m "chore: Firebase security rules"
```

---

## Task 12 — Test manuel + push final

- [ ] **Step 1: Démarrer le serveur local**

```bash
npm run dev
```

- [ ] **Step 2: Tester le flow expéditeur**

1. Ouvrir `http://localhost:3000`
2. Uploader un PDF
3. Saisir un email valide
4. Cliquer "GÉNÉRER LE LIEN"
5. Vérifier que le lien apparaît (format `http://localhost:3000/sign/[uuid]`)
6. Cliquer COPIER → vérifier feedback "COPIÉ"

- [ ] **Step 3: Tester le flow signataire**

1. Ouvrir le lien `/sign/[token]`
2. Vérifier l'aperçu du PDF (lien cliquable)
3. Saisir Prénom, Nom, Email
4. Vérifier l'aperçu signature en Dancing Script live
5. Cliquer SIGNER
6. Vérifier téléchargement automatique du PDF signé
7. Vérifier les 2 emails reçus avec lien téléchargement

- [ ] **Step 4: Tester les cas d'erreur**

1. Ouvrir `/sign/token-inexistant` → doit afficher "Lien invalide ou expiré"
2. Signer un doc déjà signé → doit afficher "Document déjà signé"

- [ ] **Step 5: Push final**

```bash
git push -u origin claude/trusting-cerf-268s1
```

---

## Variables Vercel (à configurer dans le dashboard)

Lors du déploiement sur Vercel, ajouter toutes les variables `NEXT_PUBLIC_*` du `.env.local` dans Settings → Environment Variables, et mettre `NEXT_PUBLIC_APP_URL=https://ton-domaine.vercel.app`.

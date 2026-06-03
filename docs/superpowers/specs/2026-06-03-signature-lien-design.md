# Design — Signature par lien + bloc réduit

Date: 2026-06-03

## Objectif

Permettre à un expéditeur d'envoyer un PDF à signer via un lien. Le signataire ouvre le lien, signe, et les deux parties reçoivent le PDF signé par email. Bloc signature réduit et nom en style manuscrit.

## Stack

- Firebase Spark (gratuit) — Firestore (métadonnées) + Storage (PDF)
- EmailJS (200 emails/mois gratuit) — envoi emails client-side
- pdf-lib — signature PDF existante
- Next.js App Router — nouvelle route dynamique `/sign/[token]`

## Flow expéditeur

1. Page principale : upload PDF + champ email expéditeur
2. Submit → PDF uploadé dans Firebase Storage (`pdfs/[token]/original.pdf`)
3. Document Firestore créé : `{ token, emailExpediteur, fileName, status: 'pending', createdAt }`
4. App affiche le lien `https://[app]/sign/[token]` avec bouton copier
5. Expéditeur envoie le lien manuellement au signataire

## Flow signataire

1. Ouvre `/sign/[token]`
2. Fetch Firestore → vérifie token valide + status `pending`
3. Télécharge PDF depuis Storage → affiche aperçu (iframe ou lien)
4. Formulaire : Prénom, Nom, Email (champs requis)
5. Aperçu du bloc signature en font manuscrite (CSS `font-family: 'Dancing Script'`)
6. Clique Signer → pdf-lib appose bloc sur dernière page → PDF signé uploadé (`pdfs/[token]/signed.pdf`)
7. Firestore mis à jour : `status: 'signed', emailSignataire, signedAt`
8. EmailJS envoie 2 emails avec lien de téléchargement du PDF signé

## Bloc signature réduit

```
blockW = 200pt
blockH = 72pt
```

Contenu (4 lignes, sans double disclaimer) :
- Label "Signé électroniquement par" (7pt, gris)
- Nom complet (12pt bold, navy) — rendu manuscrit via font Helvetica-Oblique
- Date (8pt, gris)
- `SIG ID · XXXXXXXX` (7pt, gris clair)
- Ligne séparatrice fine
- "Signature électronique simple — valeur probante" (6pt, italic)

## Font manuscrite

- UI (aperçu CSS) : Google Fonts `Dancing Script` — chargée dans layout.tsx
- PDF (pdf-lib) : embed font TTF `DancingScript-Bold.ttf` téléchargée dans `/public/fonts/`
  - `await doc.embedFont(fs.readFileSync(...))` → remplacé par `fetch('/fonts/DancingScript-Bold.ttf')` côté client

## Nouvelles pages / composants

```
app/
  page.tsx                    — modifié : ajout champ email + affichage lien généré
  sign/
    [token]/
      page.tsx                — page signataire (server component shell)
components/
  SignatureForm.tsx            — modifié : ajout email + lien share
  SignPage.tsx                — nouveau : formulaire signataire
lib/
  firebase.ts                 — init Firebase SDK (env vars)
  uploadPdf.ts                — upload/download Firebase Storage
  emailjs.ts                  — envoi emails via EmailJS
  signPdf.ts                  — modifié : blockW/H réduit, font manuscrite, embed TTF
public/
  fonts/
    DancingScript-Bold.ttf    — font manuscrite pour pdf-lib
```

## Variables d'environnement

```
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_APP_ID
NEXT_PUBLIC_EMAILJS_SERVICE_ID
NEXT_PUBLIC_EMAILJS_TEMPLATE_ID
NEXT_PUBLIC_EMAILJS_PUBLIC_KEY
NEXT_PUBLIC_APP_URL
```

## Gestion d'erreurs

- Token invalide → page 404 custom "Lien invalide ou expiré"
- Status déjà `signed` → page "Document déjà signé" avec lien téléchargement
- Firebase Storage > 5GB → silencieux (Spark limit, peu probable)
- EmailJS échoue → log console, signature quand même complète, message UI "Email non envoyé"

## Sécurité

- Token = `crypto.randomUUID()` (128-bit, non-guessable)
- Firestore rules : lecture publique sur token connu, écriture uniquement status pending→signed
- Storage rules : lecture publique sur path `pdfs/[token]/`, écriture auth ou token match
- Pas d'auth utilisateur — sécurité par obscurité du token (acceptable pour usage devis)

## Non-inclus (YAGNI)

- Expiration automatique des liens
- Tableau de bord expéditeur
- Authentification
- Multi-signataires
- IP dans la signature (abandonné)

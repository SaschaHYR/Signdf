import { db } from "./firebase";
import {
  doc, setDoc, getDoc, updateDoc, collection,
  query, where, onSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { upload } from "@vercel/blob/client";

export interface SignatureDoc {
  token: string;
  email_expediteur: string;
  file_name: string;
  status: "pending" | "signed" | "expired";
  created_at: string;
  email_signataire?: string;
  signed_at?: string;
  signed_file_url?: string;
  pdf_hash?: string;
  timestamp_token?: string;
  timestamp_date?: string;
  expires_at?: string;
  original_pdf_url?: string;
}

const COL = "signatures";

async function blobUpload(pathname: string, body: File | Blob): Promise<string> {
  const { url } = await upload(pathname, body, {
    access: "public",
    handleUploadUrl: "/api/blob-upload",
  });
  return url;
}

export async function uploadOriginalPdf(file: File, token: string): Promise<string> {
  return blobUpload(`pdfs/${token}/original.pdf`, file);
}

export async function createSignatureDoc(
  token: string,
  emailExpediteur: string,
  fileName: string,
  originalPdfUrl?: string,
): Promise<void> {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await setDoc(doc(db, COL, token), {
    token,
    email_expediteur: emailExpediteur,
    file_name: fileName,
    status: "pending",
    created_at: new Date().toISOString(),
    expires_at: expiresAt,
    ...(originalPdfUrl ? { original_pdf_url: originalPdfUrl } : {}),
  });
}

export async function getSignatureDoc(token: string): Promise<SignatureDoc | null> {
  const snap = await getDoc(doc(db, COL, token));
  if (!snap.exists()) return null;
  const data = snap.data() as SignatureDoc;
  if (data.expires_at && new Date(data.expires_at) < new Date() && data.status === "pending") {
    await updateDoc(doc(db, COL, token), { status: "expired" });
    return { ...data, status: "expired" };
  }
  return data;
}

export async function getOriginalPdfUrl(token: string): Promise<string> {
  const snap = await getDoc(doc(db, COL, token));
  if (!snap.exists()) throw new Error("Document not found");
  const data = snap.data() as SignatureDoc;
  if (data.original_pdf_url) return data.original_pdf_url;
  throw new Error("No original_pdf_url stored for this document");
}

export async function uploadSignedPdf(bytes: Uint8Array, token: string): Promise<string> {
  const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
  return blobUpload(`pdfs/${token}/signed.pdf`, blob);
}

export async function markAsSigned(
  token: string,
  emailSignataire: string,
  signedFileUrl: string,
  pdfHash?: string,
  timestampToken?: string,
  timestampDate?: string,
): Promise<void> {
  const update: Record<string, unknown> = {
    status: "signed",
    email_signataire: emailSignataire,
    signed_at: new Date().toISOString(),
    signed_file_url: signedFileUrl,
  };
  if (pdfHash)        update.pdf_hash        = pdfHash;
  if (timestampToken) update.timestamp_token = timestampToken;
  if (timestampDate)  update.timestamp_date  = timestampDate;
  await updateDoc(doc(db, COL, token), update);
}

export function subscribeSignedCount(cb: (count: number) => void): Unsubscribe {
  const q = query(collection(db, COL), where("status", "==", "signed"));
  return onSnapshot(q, (snap) => cb(snap.size));
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", bytes.buffer as ArrayBuffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

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

const WORKER_URL = process.env.NEXT_PUBLIC_CF_WORKER_URL!;
const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_CF_R2_PUBLIC_URL!;

async function uploadToR2(key: string, data: File | Blob): Promise<string> {
  const res = await fetch(`${WORKER_URL}/${key}`, {
    method: "PUT",
    body: data,
    headers: { "Content-Type": "application/pdf" },
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  const json = await res.json() as { url: string };
  return json.url;
}

export async function uploadOriginalPdf(file: File, token: string): Promise<void> {
  await uploadToR2(`pdfs/${token}/original.pdf`, file);
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

export function getOriginalPdfUrl(token: string): string {
  return `${R2_PUBLIC_URL}/pdfs/${token}/original.pdf`;
}

export async function uploadSignedPdf(bytes: Uint8Array, token: string): Promise<string> {
  const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
  return uploadToR2(`pdfs/${token}/signed.pdf`, blob);
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

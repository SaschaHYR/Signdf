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

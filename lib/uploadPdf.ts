import { getSupabase } from "./supabase";

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
}

export async function uploadOriginalPdf(file: File, token: string): Promise<void> {
  const { error } = await getSupabase().storage
    .from("pdfs")
    .upload(`${token}/original.pdf`, file, { contentType: "application/pdf", upsert: true });
  if (error) throw new Error(error.message);
}

export async function createSignatureDoc(
  token: string,
  emailExpediteur: string,
  fileName: string
): Promise<void> {
  const { error } = await getSupabase().from("signatures").insert({
    token,
    email_expediteur: emailExpediteur,
    file_name: fileName,
    status: "pending",
  });
  if (error) throw new Error(error.message);
}

export async function getSignatureDoc(token: string): Promise<SignatureDoc | null> {
  const { data, error } = await getSupabase()
    .from("signatures")
    .select("*")
    .eq("token", token)
    .single();
  if (error || !data) return null;
  return data as SignatureDoc;
}

export function getOriginalPdfUrl(token: string): string {
  const { data } = getSupabase().storage
    .from("pdfs")
    .getPublicUrl(`${token}/original.pdf`);
  return data.publicUrl;
}

export async function uploadSignedPdf(bytes: Uint8Array, token: string): Promise<string> {
  const blob = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
  const { error } = await getSupabase().storage
    .from("pdfs")
    .upload(`${token}/signed.pdf`, blob, { contentType: "application/pdf", upsert: true });
  if (error) throw new Error(error.message);
  const { data } = getSupabase().storage
    .from("pdfs")
    .getPublicUrl(`${token}/signed.pdf`);
  return data.publicUrl;
}

export async function markAsSigned(
  token: string,
  emailSignataire: string,
  signedFileUrl: string,
  pdfHash?: string,
  timestampToken?: string,
  timestampDate?: string,
): Promise<void> {
  const { error } = await getSupabase()
    .from("signatures")
    .update({
      status: "signed",
      email_signataire: emailSignataire,
      signed_at: new Date().toISOString(),
      signed_file_url: signedFileUrl,
      ...(pdfHash && { pdf_hash: pdfHash }),
      ...(timestampToken && { timestamp_token: timestampToken }),
      ...(timestampDate && { timestamp_date: timestampDate }),
    })
    .eq("token", token);
  if (error) throw new Error(error.message);
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", bytes.buffer as ArrayBuffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

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

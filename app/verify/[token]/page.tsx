import { getSignatureDoc } from "@/lib/uploadPdf";
import VerifyClient from "./VerifyClient";

export default async function VerifyPage({ params }: { params: { token: string } }) {
  const doc = await getSignatureDoc(params.token);
  return <VerifyClient doc={doc} token={params.token} />;
}

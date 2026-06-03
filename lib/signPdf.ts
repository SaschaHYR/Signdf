import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export interface SignatureOptions {
  prenom: string;
  nom: string;
}

export async function signPdf(file: File, options: SignatureOptions): Promise<Uint8Array> {
  const arrayBuffer = await file.arrayBuffer();

  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: false });
  } catch {
    throw new Error("Ce PDF est protégé ou corrompu et ne peut pas être signé.");
  }

  const helvetica = await doc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const pages = doc.getPages();
  const lastPage = pages[pages.length - 1];
  const { width } = lastPage.getSize();

  const fullName = `${options.prenom} ${options.nom}`;
  const timestamp = Date.now();
  const sigId = btoa(fullName + timestamp).replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 8);
  const dateStr = new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" });

  const blockW = 240;
  const blockH = 105;
  const margin = 20;
  const x = width - blockW - margin;
  const y = margin;

  // border
  lastPage.drawRectangle({
    x,
    y,
    width: blockW,
    height: blockH,
    borderColor: rgb(0.102, 0.153, 0.267), // navy
    borderWidth: 1,
    color: rgb(0.98, 0.98, 1),
  });

  // label
  lastPage.drawText("Signé électroniquement par", {
    x: x + 8,
    y: y + blockH - 16,
    size: 7,
    font: helvetica,
    color: rgb(0.5, 0.5, 0.5),
  });

  // name
  lastPage.drawText(fullName, {
    x: x + 8,
    y: y + blockH - 32,
    size: 13,
    font: helveticaBold,
    color: rgb(0.102, 0.153, 0.267),
  });

  // date
  lastPage.drawText(`Le ${dateStr}`, {
    x: x + 8,
    y: y + blockH - 48,
    size: 8,
    font: helvetica,
    color: rgb(0.3, 0.3, 0.3),
  });

  // sig ID
  lastPage.drawText(`SIG ID · ${sigId}`, {
    x: x + 8,
    y: y + blockH - 62,
    size: 7,
    font: helvetica,
    color: rgb(0.4, 0.4, 0.4),
  });

  // separator line
  lastPage.drawLine({
    start: { x: x + 8, y: y + blockH - 70 },
    end:   { x: x + blockW - 8, y: y + blockH - 70 },
    thickness: 0.5,
    color: rgb(0.8, 0.8, 0.8),
  });

  // disclaimer
  lastPage.drawText("Signature électronique simple — valeur probante", {
    x: x + 8,
    y: y + blockH - 82,
    size: 6,
    font: helvetica,
    color: rgb(0.6, 0.6, 0.6),
  });

  lastPage.drawText("Document traité localement — aucune donnée transmise", {
    x: x + 8,
    y: y + blockH - 92,
    size: 6,
    font: helvetica,
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

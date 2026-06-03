import { PDFDocument, rgb, PDFFont } from "pdf-lib";

export interface SignatureOptions {
  prenom: string;
  nom: string;
}

async function loadDancingScriptFont(doc: PDFDocument): Promise<PDFFont> {
  const response = await fetch("/fonts/DancingScript-Bold.ttf");
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
    x, y, width: blockW, height: blockH,
    borderColor: rgb(0.102, 0.153, 0.267),
    borderWidth: 1,
    color: rgb(0.98, 0.98, 1),
  });

  lastPage.drawText("Signé électroniquement par", {
    x: x + 8, y: y + blockH - 14,
    size: 7, font: dancingScript, color: rgb(0.5, 0.5, 0.5),
  });

  lastPage.drawText(fullName, {
    x: x + 8, y: y + blockH - 30,
    size: 16, font: dancingScript, color: rgb(0.102, 0.153, 0.267),
  });

  lastPage.drawText(`Le ${dateStr}`, {
    x: x + 8, y: y + blockH - 44,
    size: 7, font: dancingScript, color: rgb(0.3, 0.3, 0.3),
  });

  lastPage.drawText(`SIG ID · ${sigId}`, {
    x: x + 8, y: y + blockH - 56,
    size: 7, font: dancingScript, color: rgb(0.4, 0.4, 0.4),
  });

  lastPage.drawLine({
    start: { x: x + 8, y: y + blockH - 62 },
    end:   { x: x + blockW - 8, y: y + blockH - 62 },
    thickness: 0.5, color: rgb(0.8, 0.8, 0.8),
  });

  lastPage.drawText("Signature électronique simple — valeur probante", {
    x: x + 8, y: y + blockH - 70,
    size: 6, font: dancingScript, color: rgb(0.6, 0.6, 0.6),
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

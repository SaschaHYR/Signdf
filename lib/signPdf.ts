import { PDFDocument, rgb, PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

export interface PlacementCoord {
  page: number;   // 0-indexed
  xRatio: number; // 0-1 from left
  yRatio: number; // 0-1 from top
}

export interface SignatureOptions {
  prenom: string;
  nom: string;
  placement?: PlacementCoord;
  paraphe?: PlacementCoord;
}

async function loadFont(doc: PDFDocument, path: string): Promise<PDFFont> {
  const response = await fetch(path);
  const fontBytes = await response.arrayBuffer();
  return doc.embedFont(fontBytes);
}

export async function signPdf(
  source: File | ArrayBuffer,
  options: SignatureOptions
): Promise<Uint8Array> {
  const arrayBuffer = source instanceof File ? await source.arrayBuffer() : source;

  const header = new Uint8Array(arrayBuffer.slice(0, 5));
  const headerStr = Array.from(header).map(b => String.fromCharCode(b)).join("");
  if (!headerStr.startsWith("%PDF")) {
    throw new Error("Le fichier reçu n'est pas un PDF valide (en-tête incorrect).");
  }

  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: false });
  } catch (e) {
    throw new Error(`PDF illisible : ${e instanceof Error ? e.message : "format inconnu"}`);
  }

  doc.registerFontkit(fontkit);
  const dancingScript = await loadFont(doc, "/fonts/DancingScript-Bold.ttf");
  const whisper = await loadFont(doc, "/fonts/Whisper-Regular.ttf");

  const pages = doc.getPages();
  const fullName = `${options.prenom} ${options.nom}`;
  const timestamp = Date.now();
  const sigId = btoa(fullName + timestamp).replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 8);
  const dateStr = new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" });

  // Signature block
  {
    const sigPlacement = options.placement;
    const pageIdx = sigPlacement ? Math.min(sigPlacement.page, pages.length - 1) : pages.length - 1;
    const page = pages[pageIdx];
    const { width, height } = page.getSize();

    const blockW = 200;
    const blockH = 72;
    const margin = 20;

    let x: number, y: number;
    if (sigPlacement) {
      x = Math.min(sigPlacement.xRatio * width, width - blockW);
      y = Math.max((1 - sigPlacement.yRatio) * height - blockH, 0);
    } else {
      x = width - blockW - margin;
      y = margin;
    }

    page.drawRectangle({
      x, y, width: blockW, height: blockH,
      borderColor: rgb(0.102, 0.153, 0.267),
      borderWidth: 1,
      color: rgb(0.98, 0.98, 1),
    });

    page.drawText("Signé électroniquement par", {
      x: x + 8, y: y + blockH - 14,
      size: 7, font: dancingScript, color: rgb(0.5, 0.5, 0.5),
    });

    page.drawText(fullName, {
      x: x + 8, y: y + blockH - 30,
      size: 16, font: dancingScript, color: rgb(0.102, 0.153, 0.267),
    });

    page.drawText(`Le ${dateStr}`, {
      x: x + 8, y: y + blockH - 44,
      size: 7, font: dancingScript, color: rgb(0.3, 0.3, 0.3),
    });

    page.drawText(`SIG ID · ${sigId}`, {
      x: x + 8, y: y + blockH - 56,
      size: 7, font: dancingScript, color: rgb(0.4, 0.4, 0.4),
    });

    page.drawLine({
      start: { x: x + 8, y: y + blockH - 62 },
      end:   { x: x + blockW - 8, y: y + blockH - 62 },
      thickness: 0.5, color: rgb(0.8, 0.8, 0.8),
    });

    page.drawText("Signature électronique simple — valeur probante", {
      x: x + 8, y: y + blockH - 70,
      size: 6, font: dancingScript, color: rgb(0.6, 0.6, 0.6),
    });
  }

  // Paraphe block
  if (options.paraphe) {
    const ph = options.paraphe;
    const pageIdx = Math.min(ph.page, pages.length - 1);
    const page = pages[pageIdx];
    const { width, height } = page.getSize();

    const blockW = 56;
    const blockH = 40;

    const x = Math.min(ph.xRatio * width, width - blockW);
    const y = Math.max((1 - ph.yRatio) * height - blockH, 0);

    const initiales = (options.prenom[0] ?? "") + (options.nom[0] ?? "");

    page.drawRectangle({
      x, y, width: blockW, height: blockH,
      borderColor: rgb(0.102, 0.153, 0.267),
      borderWidth: 0.8,
      color: rgb(0.98, 0.98, 1),
    });

    page.drawText(initiales.toUpperCase(), {
      x: x + 6, y: y + blockH - 28,
      size: 18, font: whisper, color: rgb(0.102, 0.153, 0.267),
    });

    page.drawText("Paraphe", {
      x: x + 6, y: y + 5,
      size: 5, font: dancingScript, color: rgb(0.6, 0.6, 0.6),
    });
  }

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

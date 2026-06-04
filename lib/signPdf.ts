import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export interface PlacementCoord {
  page: number;   // 0-indexed
  xRatio: number; // 0-1 from left
  yRatio: number; // 0-1 from top
}

export interface SignatureOptions {
  prenom: string;
  nom: string;
  token: string;
  placement?: PlacementCoord;
  paraphe?: PlacementCoord;
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

  const fontItalic = await doc.embedFont(StandardFonts.TimesRomanItalic);
  const fontRoman  = await doc.embedFont(StandardFonts.TimesRoman);
  const fontHelv   = await doc.embedFont(StandardFonts.Helvetica);

  const pages = doc.getPages();
  const fullName = `${options.prenom} ${options.nom}`;
  const dateStr = new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" });

  // Signature block
  {
    const sigPlacement = options.placement;
    const pageIdx = sigPlacement ? Math.min(sigPlacement.page, pages.length - 1) : pages.length - 1;
    const page = pages[pageIdx];
    const { width, height } = page.getSize();

    const blockW = 210;
    const blockH = 78;
    const margin = 20;

    let x: number, y: number;
    if (sigPlacement) {
      x = Math.min(sigPlacement.xRatio * width, width - blockW);
      y = Math.max((1 - sigPlacement.yRatio) * height - blockH, 0);
    } else {
      x = width - blockW - margin;
      y = margin;
    }

    // Background + border
    page.drawRectangle({
      x, y, width: blockW, height: blockH,
      borderColor: rgb(0.102, 0.153, 0.267),
      borderWidth: 1,
      color: rgb(0.97, 0.97, 1),
    });

    // Top accent line
    page.drawLine({
      start: { x, y: y + blockH },
      end:   { x: x + blockW, y: y + blockH },
      thickness: 2, color: rgb(0.878, 0.188, 0.188),
    });

    // Label
    page.drawText("SIGNÉ ÉLECTRONIQUEMENT", {
      x: x + 8, y: y + blockH - 12,
      size: 6, font: fontHelv, color: rgb(0.878, 0.188, 0.188),
    });

    // Name (italic, prominent)
    page.drawText(fullName, {
      x: x + 8, y: y + blockH - 28,
      size: 15, font: fontItalic, color: rgb(0.08, 0.12, 0.22),
    });

    // Date
    page.drawText(`Le ${dateStr}`, {
      x: x + 8, y: y + blockH - 43,
      size: 7, font: fontRoman, color: rgb(0.3, 0.3, 0.3),
    });

    // Divider
    page.drawLine({
      start: { x: x + 8, y: y + blockH - 50 },
      end:   { x: x + blockW - 8, y: y + blockH - 50 },
      thickness: 0.4, color: rgb(0.75, 0.75, 0.85),
    });

    // Token ID (for SEA traceability)
    page.drawText(`ID : ${options.token}`, {
      x: x + 8, y: y + blockH - 60,
      size: 5.5, font: fontHelv, color: rgb(0.4, 0.4, 0.5),
    });

    // SEA mention
    page.drawText("Signature Électronique Avancée — valeur probante conforme eIDAS", {
      x: x + 8, y: y + blockH - 70,
      size: 5, font: fontHelv, color: rgb(0.55, 0.55, 0.65),
    });
  }

  // Paraphe block
  if (options.paraphe) {
    const ph = options.paraphe;
    const pageIdx = Math.min(ph.page, pages.length - 1);
    const page = pages[pageIdx];
    const { width, height } = page.getSize();

    const blockW = 60;
    const blockH = 44;

    const x = Math.min(ph.xRatio * width, width - blockW);
    const y = Math.max((1 - ph.yRatio) * height - blockH, 0);

    const initiales = (options.prenom[0] ?? "") + (options.nom[0] ?? "");

    page.drawRectangle({
      x, y, width: blockW, height: blockH,
      borderColor: rgb(0.102, 0.153, 0.267),
      borderWidth: 0.8,
      color: rgb(0.97, 0.97, 1),
    });

    page.drawLine({
      start: { x, y: y + blockH },
      end:   { x: x + blockW, y: y + blockH },
      thickness: 1.5, color: rgb(0.878, 0.188, 0.188),
    });

    page.drawText(initiales.toUpperCase(), {
      x: x + 10, y: y + blockH - 26,
      size: 18, font: fontItalic, color: rgb(0.08, 0.12, 0.22),
    });

    page.drawText("Paraphe", {
      x: x + 8, y: y + 5,
      size: 5, font: fontHelv, color: rgb(0.6, 0.6, 0.6),
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

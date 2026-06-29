import { PDFDocument, rgb, StandardFonts, PDFTextField, PDFCheckBox } from "@cantoo/pdf-lib";

export interface PlacementCoord {
  page: number;   // 0-indexed
  xRatio: number; // 0-1 from left
  yRatio: number; // 0-1 from top
}

export interface TextOverlay {
  id: string;
  page: number;
  xRatio: number;
  yRatio: number; // 0-1 from top
  text: string;
  fontSize: number;
}

export interface SignatureOptions {
  prenom: string;
  nom: string;
  token: string;
  placement?: PlacementCoord;
  paraphe?: PlacementCoord;
  fieldValues?: Record<string, string>;
  textOverlays?: TextOverlay[];
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

  // Fill AcroForm fields if provided
  if (options.fieldValues && Object.keys(options.fieldValues).length > 0) {
    try {
      const form = doc.getForm();
      for (const [name, value] of Object.entries(options.fieldValues)) {
        if (!value) continue;
        try {
          const field = form.getField(name);
          if (field instanceof PDFTextField) {
            field.setText(value);
          } else if (field instanceof PDFCheckBox) {
            if (value === "On") field.check();
            else field.uncheck();
          }
        } catch { /* field not found or wrong type — skip */ }
      }
      try { form.flatten(); } catch { /* flatten may fail on some PDFs — non-fatal */ }
    } catch { /* no AcroForm — skip */ }
  }

  const fontItalic = await doc.embedFont(StandardFonts.TimesRomanItalic);
  const fontRoman  = await doc.embedFont(StandardFonts.TimesRoman);
  const fontHelv   = await doc.embedFont(StandardFonts.Helvetica);

  const pages = doc.getPages();

  // Draw free text overlays
  if (options.textOverlays?.length) {
    for (const overlay of options.textOverlays) {
      if (!overlay.text.trim()) continue;
      const pageIdx = Math.min(overlay.page, pages.length - 1);
      const page = pages[pageIdx];
      const { width, height } = page.getSize();
      const x = overlay.xRatio * width;
      const y = (1 - overlay.yRatio) * height;
      page.drawText(overlay.text, {
        x: Math.max(2, Math.min(x, width - 200)),
        y: Math.max(2, Math.min(y, height - overlay.fontSize)),
        size: overlay.fontSize,
        font: fontRoman,
        color: rgb(0.05, 0.05, 0.05),
      });
    }
  }

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

  // Paraphe block — applied on every page
  if (options.paraphe) {
    const ph = options.paraphe;
    const initiales = (options.prenom[0] ?? "") + (options.nom[0] ?? "");

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const { width, height } = page.getSize();

      const blockW = 60;
      const blockH = 44;

      const x = Math.min(ph.xRatio * width, width - blockW);
      const y = Math.max((1 - ph.yRatio) * height - blockH, 0);

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
  }

  // Lock PDF: opens without password, modifications blocked (owner password = token)
  doc.encrypt({
    userPassword: "",
    ownerPassword: options.token,
    permissions: {
      printing: "highResolution",
      modifying: false,
      copying: false,
      annotating: false,
      fillingForms: false,
      contentAccessibility: true,
      documentAssembly: false,
    },
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

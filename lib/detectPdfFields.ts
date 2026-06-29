export interface PdfField {
  name: string;
  type: "text" | "checkbox" | "radio" | "select" | "signature" | "unknown";
  page: number;       // 0-indexed
  x: number;          // in PDF points
  y: number;          // in PDF points (bottom-left origin)
  width: number;
  height: number;
  pageWidth: number;
  pageHeight: number;
  value?: string;     // existing value if pre-filled
  required?: boolean;
}

export interface DetectionResult {
  hasForm: boolean;
  fields: PdfField[];
  signatureField: PdfField | null;
}

export async function detectPdfFields(pdfUrl: string): Promise<DetectionResult> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const pdf = await pdfjsLib.getDocument({ url: pdfUrl }).promise;
  const fields: PdfField[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1 });
    const annotations = await page.getAnnotations();

    for (const ann of annotations) {
      if (ann.subtype !== "Widget") continue;

      // pdfjs viewport transform: PDF y=0 is bottom, viewport y=0 is top
      const [x, y, x2, y2] = ann.rect;
      const pdfY = Math.min(y, y2);

      const field: PdfField = {
        name: ann.fieldName ?? ann.id ?? `field_${fields.length}`,
        type: mapFieldType(ann.fieldType),
        page: pageNum - 1,
        x,
        y: pdfY,
        width: Math.abs(x2 - x),
        height: Math.abs(y2 - y),
        pageWidth: viewport.width,
        pageHeight: viewport.height,
        value: ann.fieldValue ?? undefined,
        required: !!(ann.fieldFlags & 2),
      };

      fields.push(field);
    }
  }

  const signatureField = fields.find(f => f.type === "signature") ?? null;

  return {
    hasForm: fields.length > 0,
    fields,
    signatureField,
  };
}

function mapFieldType(ft: string | undefined): PdfField["type"] {
  switch (ft) {
    case "Tx": return "text";
    case "Btn": return "checkbox";
    case "Ch": return "select";
    case "Sig": return "signature";
    default: return "unknown";
  }
}

export function signatureFieldToPlacement(field: PdfField): { page: number; xRatio: number; yRatio: number } {
  return {
    page: field.page,
    xRatio: field.x / field.pageWidth,
    // yRatio is from top: convert PDF bottom-origin y to top-origin ratio
    yRatio: 1 - (field.y + field.height) / field.pageHeight,
  };
}

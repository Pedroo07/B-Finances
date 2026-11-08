type PdfJsWorkerGlobal = typeof globalThis & {
  pdfjsWorker?: unknown;
};

const CORRUPTED_PDF_MESSAGE =
  "Não foi possível ler este PDF. O arquivo parece estar corrompido. Baixe novamente ou envie CSV ou OFX.";

export const SCANNED_PDF_MESSAGE =
  "Este PDF não possui texto selecionável (parece escaneado). Exporte a fatura em CSV ou OFX no aplicativo do banco.";

async function loadPdfJs() {
  const globalWithWorker = globalThis as PdfJsWorkerGlobal;
  if (!globalWithWorker.pdfjsWorker) {
    const workerModule = await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
    globalWithWorker.pdfjsWorker = workerModule;
  }

  return import("pdfjs-dist/legacy/build/pdf.mjs");
}

function hasPdfSignature(bytes: Uint8Array): boolean {
  const headerSlice = bytes.subarray(0, Math.min(bytes.length, 1024));
  const headerText = new TextDecoder("latin1").decode(headerSlice);
  return headerText.includes("%PDF-");
}

export function assertSelectablePdfText(text: string): string {
  const normalized = text.replace(/\r\n?/g, "\n").trim();
  const nonWhitespaceLength = normalized.replace(/\s+/g, "").length;

  if (nonWhitespaceLength < 10) {
    throw new Error(SCANNED_PDF_MESSAGE);
  }

  return normalized;
}

export async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buffer.slice(0));
  if (bytes.byteLength < 8 || !hasPdfSignature(bytes)) {
    throw new Error(CORRUPTED_PDF_MESSAGE);
  }

  const pdfjs = await loadPdfJs();
  const loadingTask = pdfjs.getDocument({
    data: bytes,
    useSystemFonts: true,
    disableFontFace: true,
    verbosity: pdfjs.VerbosityLevel.ERRORS,
  });

  let rawText = "";

  try {
    const doc = await loadingTask.promise;
    const pages: string[] = [];

    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent();
      let pageText = "";

      for (const item of content.items) {
        if ("str" in item) {
          pageText += item.str + (item.hasEOL ? "\n" : " ");
        }
      }

      pages.push(pageText.trim());
    }

    rawText = pages.filter(Boolean).join("\n");
  } catch {
    throw new Error(CORRUPTED_PDF_MESSAGE);
  } finally {
    await loadingTask.destroy().catch(() => undefined);
  }

  return assertSelectablePdfText(rawText);
}

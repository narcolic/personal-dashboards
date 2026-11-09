import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { parseZenith } from "./parser";
import type { Draft, PdfTextPage } from "./types";

GlobalWorkerOptions.workerSrc = workerUrl;
export { getDocument };
export type { PDFDocumentProxy };
export const MAX_PDF_BYTES = 15 * 1024 * 1024;

export async function extractBill(file: File): Promise<Draft> {
  if (file.size > MAX_PDF_BYTES) throw new Error("fileSize");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!new TextDecoder().decode(bytes.subarray(0, 1024)).includes("%PDF-"))
    throw new Error("notPdf");
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hash = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  const task = getDocument({ data: bytes });
  try {
    const pdf = await task.promise;
    if (pdf.numPages > 12) throw new Error("pageLimit");
    const pages: PdfTextPage[] = [];
    let count = 0;
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const items = content.items.flatMap((item) =>
        "str" in item
          ? [
              {
                text: item.str,
                x: item.transform[4],
                y: item.transform[5],
                width: item.width,
                height: item.height,
              },
            ]
          : [],
      );
      count += items.length;
      if (count > 100000) throw new Error("pageLimit");
      pages.push({ items, width: viewport.width, height: viewport.height });
      page.cleanup();
    }
    const draft = pages.every((page) => page.items.every((item) => !item.text.trim()))
      ? { values: {}, warnings: ["noText"] }
      : parseZenith(pages);
    return {
      ...draft,
      values: { ...draft.values, documentHash: hash, fileName: file.name.slice(0, 255) },
    };
  } finally {
    await task.destroy();
  }
}

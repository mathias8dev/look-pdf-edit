import { PDFDocument } from "pdf-lib";

/**
 * Build a synthetic PDF whose pages have DISTINCT widths (100, 110, 120, …)
 * so tests can identify a page by its size after reorder/delete — no text
 * extraction needed. Height is fixed at 200.
 */
export async function makePdf(pageCount: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    doc.addPage([100 + i * 10, 200]);
  }
  return doc.save();
}

/** Read back the width of every page, in order — the fingerprint of page order. */
export async function pageWidths(bytes: Uint8Array): Promise<number[]> {
  const doc = await PDFDocument.load(bytes);
  return doc.getPages().map((p) => Math.round(p.getSize().width));
}

/** Read back the rotation angle of every page, in order. */
export async function pageRotations(bytes: Uint8Array): Promise<number[]> {
  const doc = await PDFDocument.load(bytes);
  return doc.getPages().map((p) => p.getRotation().angle);
}

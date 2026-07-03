import { PDFDocument, degrees } from "pdf-lib";
import type { PageItem, Rotation } from "@/types";

/**
 * Rebuild a PDF from the original bytes applying the current page list:
 * reorder, delete (pages simply absent from `pages`), and rotation deltas.
 * The original bytes are never mutated — we copy pages into a fresh doc.
 */
export async function buildEditedPdf(
  originalBytes: Uint8Array,
  pages: PageItem[],
): Promise<Uint8Array> {
  const src = await PDFDocument.load(originalBytes);
  const out = await PDFDocument.create();

  const srcIndices = pages.map((p) => p.srcIndex);
  const copied = await out.copyPages(src, srcIndices);

  copied.forEach((page, i) => {
    const delta = pages[i].rotation as Rotation;
    const base = page.getRotation().angle;
    page.setRotation(degrees((base + delta) % 360));
    out.addPage(page);
  });

  return out.save();
}

/** Trigger a browser download of the given bytes. */
export function downloadBytes(bytes: Uint8Array, fileName: string) {
  const ab = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(ab).set(bytes);
  const blob = new Blob([ab], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

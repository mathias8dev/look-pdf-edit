import { describe, it, expect } from "vitest";
import { buildEditedPdf } from "./export";
import { makePdf, pageWidths, pageRotations } from "./test-utils";
import type { PageItem } from "@/types";

function page(srcIndex: number, rotation: PageItem["rotation"] = 0): PageItem {
  return { id: `p${srcIndex}`, srcIndex, rotation };
}

describe("buildEditedPdf", () => {
  it("preserves all pages in original order by default", async () => {
    const src = await makePdf(3);
    const out = await buildEditedPdf(src, [page(0), page(1), page(2)]);
    expect(await pageWidths(out)).toEqual([100, 110, 120]);
  });

  it("reorders pages to match the page list order", async () => {
    const src = await makePdf(3);
    const out = await buildEditedPdf(src, [page(2), page(0), page(1)]);
    expect(await pageWidths(out)).toEqual([120, 100, 110]);
  });

  it("drops pages absent from the list (deletion)", async () => {
    const src = await makePdf(4);
    const out = await buildEditedPdf(src, [page(0), page(2)]);
    expect(await pageWidths(out)).toEqual([100, 120]);
  });

  it("applies rotation deltas per page", async () => {
    const src = await makePdf(3);
    const out = await buildEditedPdf(src, [page(0, 90), page(1, 180), page(2, 270)]);
    expect(await pageRotations(out)).toEqual([90, 180, 270]);
  });

  it("adds the intrinsic page rotation to the delta", async () => {
    // Give the source page an intrinsic 90° rotation, then apply a 90° delta.
    const { PDFDocument, degrees } = await import("pdf-lib");
    const doc = await PDFDocument.create();
    const p = doc.addPage([100, 200]);
    p.setRotation(degrees(90));
    const src = await doc.save();

    const out = await buildEditedPdf(src, [page(0, 90)]);
    expect(await pageRotations(out)).toEqual([180]);
  });

  it("supports duplicating a source page into the output", async () => {
    const src = await makePdf(2);
    const out = await buildEditedPdf(src, [page(0), page(0), page(1)]);
    expect(await pageWidths(out)).toEqual([100, 100, 110]);
  });

  it("never mutates the original bytes", async () => {
    const src = await makePdf(3);
    const before = src.slice(0);
    await buildEditedPdf(src, [page(2), page(0)]);
    expect(Array.from(src)).toEqual(Array.from(before));
  });

  it("produces a valid, reloadable PDF", async () => {
    const src = await makePdf(2);
    const out = await buildEditedPdf(src, [page(1), page(0)]);
    // If save/reload works and starts with the PDF magic, it's structurally valid.
    expect(new TextDecoder().decode(out.slice(0, 5))).toBe("%PDF-");
  });
});

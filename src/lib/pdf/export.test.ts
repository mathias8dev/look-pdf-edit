import { describe, it, expect } from "vitest";
import { buildEditedPdf } from "./export";
import { makePdf, pageWidths, pageRotations } from "./test-utils";
import type { PageItem } from "@/types";

const DOC = "d0";

function page(srcIndex: number, rotation: PageItem["rotation"] = 0): PageItem {
  return { id: `p${srcIndex}`, docId: DOC, srcIndex, rotation };
}

describe("buildEditedPdf (single source)", () => {
  it("preserves all pages in original order by default", async () => {
    const src = await makePdf(3);
    const out = await buildEditedPdf({ [DOC]: src }, [page(0), page(1), page(2)]);
    expect(await pageWidths(out)).toEqual([100, 110, 120]);
  });

  it("reorders pages to match the page list order", async () => {
    const src = await makePdf(3);
    const out = await buildEditedPdf({ [DOC]: src }, [page(2), page(0), page(1)]);
    expect(await pageWidths(out)).toEqual([120, 100, 110]);
  });

  it("drops pages absent from the list (deletion / extraction)", async () => {
    const src = await makePdf(4);
    const out = await buildEditedPdf({ [DOC]: src }, [page(0), page(2)]);
    expect(await pageWidths(out)).toEqual([100, 120]);
  });

  it("applies rotation deltas per page", async () => {
    const src = await makePdf(3);
    const out = await buildEditedPdf({ [DOC]: src }, [page(0, 90), page(1, 180), page(2, 270)]);
    expect(await pageRotations(out)).toEqual([90, 180, 270]);
  });

  it("adds the intrinsic page rotation to the delta", async () => {
    const { PDFDocument, degrees } = await import("pdf-lib");
    const doc = await PDFDocument.create();
    const p = doc.addPage([100, 200]);
    p.setRotation(degrees(90));
    const src = await doc.save();

    const out = await buildEditedPdf({ [DOC]: src }, [page(0, 90)]);
    expect(await pageRotations(out)).toEqual([180]);
  });

  it("supports duplicating a source page into the output", async () => {
    const src = await makePdf(2);
    const out = await buildEditedPdf({ [DOC]: src }, [page(0), page(0), page(1)]);
    expect(await pageWidths(out)).toEqual([100, 100, 110]);
  });

  it("never mutates the original bytes", async () => {
    const src = await makePdf(3);
    const before = src.slice(0);
    await buildEditedPdf({ [DOC]: src }, [page(2), page(0)]);
    expect(Array.from(src)).toEqual(Array.from(before));
  });

  it("produces a valid, reloadable PDF", async () => {
    const src = await makePdf(2);
    const out = await buildEditedPdf({ [DOC]: src }, [page(1), page(0)]);
    expect(new TextDecoder().decode(out.slice(0, 5))).toBe("%PDF-");
  });
});

describe("buildEditedPdf (multi-source assembly)", () => {
  it("merges pages from two documents, preserving interleaved order", async () => {
    // Doc A widths 100,110,120 ; Doc B widths 100,110 — same widths, so use a
    // distinct base to tell them apart.
    const a = await makePdf(3);
    const { PDFDocument } = await import("pdf-lib");
    const bDoc = await PDFDocument.create();
    bDoc.addPage([300, 200]); // width 300
    bDoc.addPage([310, 200]); // width 310
    const b = await bDoc.save();

    const pages: PageItem[] = [
      { id: "b1", docId: "B", srcIndex: 1, rotation: 0 }, // 310
      { id: "a0", docId: "A", srcIndex: 0, rotation: 0 }, // 100
      { id: "b0", docId: "B", srcIndex: 0, rotation: 0 }, // 300
      { id: "a2", docId: "A", srcIndex: 2, rotation: 0 }, // 120
    ];
    const out = await buildEditedPdf({ A: a, B: b }, pages);
    expect(await pageWidths(out)).toEqual([310, 100, 300, 120]);
  });

  it("throws if a page references an unknown source document", async () => {
    const src = await makePdf(1);
    await expect(
      buildEditedPdf({ A: src }, [{ id: "x", docId: "MISSING", srcIndex: 0, rotation: 0 }]),
    ).rejects.toThrow(/Missing source/);
  });
});

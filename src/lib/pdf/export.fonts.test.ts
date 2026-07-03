import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import { buildEditedPdf, type FontBytesLoader } from "./export";
import { makePdf } from "./test-utils";
import type { Annotation, PageItem } from "@/types";

const DOC = "d0";
const page = (id: string, i: number): PageItem => ({ id, docId: DOC, srcIndex: i, rotation: 0 });

// In the browser the loader fetches /fonts/*; here we read the vendored file.
const loadFontBytes: FontBytesLoader = async (url) =>
  new Uint8Array(readFileSync(`public${url}`));

function textAnn(over: Partial<Annotation>): Annotation {
  return {
    id: "t",
    pageId: "p0",
    kind: "text",
    x: 10,
    y: 150,
    text: "Sample",
    fontSize: 14,
    color: "#000000",
    ...over,
  } as Annotation;
}

describe("text font export", () => {
  it("embeds a self-hosted google font (output is larger than the standard-font one)", async () => {
    const src = await makePdf(1);
    const embedded = await buildEditedPdf(
      { [DOC]: src },
      [page("p0", 0)],
      [textAnn({ fontFamily: "roboto", bold: true })],
      { loadFontBytes },
    );
    const standard = await buildEditedPdf(
      { [DOC]: src },
      [page("p0", 0)],
      [textAnn({ fontFamily: "helvetica" })],
    );

    expect((await PDFDocument.load(embedded)).getPageCount()).toBe(1);
    // Embedding a real font program makes the file meaningfully bigger.
    expect(embedded.byteLength).toBeGreaterThan(standard.byteLength + 2000);
  });

  it("uses a standard-font style variant with no embedding", async () => {
    const src = await makePdf(1);
    const out = await buildEditedPdf(
      { [DOC]: src },
      [page("p0", 0)],
      [textAnn({ fontFamily: "times", bold: true, italic: true })],
    );
    expect((await PDFDocument.load(out)).getPageCount()).toBe(1);
  });

  it("still exports legacy text with no font fields (defaults to Helvetica)", async () => {
    const src = await makePdf(1);
    const out = await buildEditedPdf({ [DOC]: src }, [page("p0", 0)], [textAnn({})]);
    expect((await PDFDocument.load(out)).getPageCount()).toBe(1);
  });
});

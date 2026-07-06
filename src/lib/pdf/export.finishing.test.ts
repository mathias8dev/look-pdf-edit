import { describe, it, expect } from "vitest";
import { inflateSync } from "node:zlib";
import { PDFDocument } from "pdf-lib";
import { buildEditedPdf } from "./export";
import { makePdf } from "./test-utils";
import { DEFAULT_FINISHING, type FinishingSettings } from "@/lib/finishing";
import type { PageItem } from "@/types";

const DOC = "d0";
const page = (id: string, i: number): PageItem => ({ id, docId: DOC, srcIndex: i, rotation: 0 });

/** Raw + inflated stream text, for scanning drawn content. */
function decode(bytes: Uint8Array): string {
  const buf = Buffer.from(bytes);
  let text = buf.toString("latin1");
  let i = 0;
  while ((i = buf.indexOf(Buffer.from("stream"), i)) !== -1) {
    if (buf.subarray(i - 3, i).toString("latin1") === "end") {
      i += 6;
      continue;
    }
    let s = i + 6;
    if (buf[s] === 0x0d) s++;
    if (buf[s] === 0x0a) s++;
    const e = buf.indexOf(Buffer.from("endstream"), s);
    if (e === -1) break;
    try {
      text += inflateSync(buf.subarray(s, e)).toString("latin1");
    } catch {
      // not a zlib stream
    }
    i = e + 1;
  }
  return text;
}

const hex = (s: string) => Buffer.from(s, "latin1").toString("hex").toLowerCase();

function finishing(over: Partial<FinishingSettings>): FinishingSettings {
  return {
    pageNumbers: { ...DEFAULT_FINISHING.pageNumbers, ...over.pageNumbers },
    watermark: { ...DEFAULT_FINISHING.watermark, ...over.watermark },
    crop: { ...DEFAULT_FINISHING.crop, ...over.crop },
  };
}

describe("finishing on export", () => {
  it("sets the crop box from the given margins", async () => {
    const src = await makePdf(1); // page 0 is 100 x 200
    const out = await buildEditedPdf({ [DOC]: src }, [page("p0", 0)], [], {
      finishing: finishing({
        crop: { enabled: true, left: 10, right: 20, top: 30, bottom: 40 },
      }),
    });
    const box = (await PDFDocument.load(out)).getPage(0).getCropBox();
    expect(box).toEqual({ x: 10, y: 40, width: 70, height: 130 });
  });

  it("sets crop only on the current page when scoped to current", async () => {
    const src = await makePdf(2);
    const out = await buildEditedPdf(
      { [DOC]: src },
      [page("p0", 0), page("p1", 1)],
      [],
      {
        currentPageId: "p1",
        finishing: finishing({
          crop: {
            enabled: true,
            scope: "current",
            left: 10,
            right: 10,
            top: 20,
            bottom: 20,
          },
        }),
      },
    );
    const doc = await PDFDocument.load(out);
    expect(doc.getPage(0).getCropBox()).toEqual({ x: 0, y: 0, width: 100, height: 200 });
    expect(doc.getPage(1).getCropBox()).toEqual({ x: 10, y: 20, width: 90, height: 160 });
  });

  it("uses the stored crop target page instead of the later selected page", async () => {
    const src = await makePdf(2);
    const out = await buildEditedPdf(
      { [DOC]: src },
      [page("p0", 0), page("p1", 1)],
      [],
      {
        currentPageId: "p0",
        finishing: finishing({
          crop: {
            enabled: true,
            scope: "current",
            targetPageId: "p1",
            left: 10,
            right: 10,
            top: 20,
            bottom: 20,
          },
        }),
      },
    );
    const doc = await PDFDocument.load(out);
    expect(doc.getPage(0).getCropBox()).toEqual({ x: 0, y: 0, width: 100, height: 200 });
    expect(doc.getPage(1).getCropBox()).toEqual({ x: 10, y: 20, width: 90, height: 160 });
  });

  it("stamps page numbers onto every page", async () => {
    const src = await makePdf(3);
    const out = await buildEditedPdf(
      { [DOC]: src },
      [page("p0", 0), page("p1", 1), page("p2", 2)],
      [],
      { finishing: finishing({ pageNumbers: { ...DEFAULT_FINISHING.pageNumbers, enabled: true } }) },
    );
    const text = decode(out).toLowerCase();
    expect(text).toContain(hex("1 / 3"));
    expect(text).toContain(hex("3 / 3"));
  });

  it("draws a watermark on the page", async () => {
    const src = await makePdf(1);
    const out = await buildEditedPdf({ [DOC]: src }, [page("p0", 0)], [], {
      finishing: finishing({
        watermark: { ...DEFAULT_FINISHING.watermark, enabled: true, text: "CONFIDENTIAL" },
      }),
    });
    expect(decode(out).toLowerCase()).toContain(hex("CONFIDENTIAL"));
  });

  it("draws a watermark only on the current page when scoped to current", async () => {
    const src = await makePdf(2);
    const out = await buildEditedPdf(
      { [DOC]: src },
      [page("p0", 0), page("p1", 1)],
      [],
      {
        currentPageId: "p1",
        finishing: finishing({
          watermark: {
            ...DEFAULT_FINISHING.watermark,
            enabled: true,
            scope: "current",
            text: "CONFIDENTIAL",
          },
        }),
      },
    );
    const text = decode(out).toLowerCase();
    expect(text.split(hex("CONFIDENTIAL")).length - 1).toBe(1);
  });

  it("uses the stored watermark target page instead of the later selected page", async () => {
    const src = await makePdf(2);
    const out = await buildEditedPdf(
      { [DOC]: src },
      [page("p0", 0), page("p1", 1)],
      [],
      {
        currentPageId: "missing",
        finishing: finishing({
          watermark: {
            ...DEFAULT_FINISHING.watermark,
            enabled: true,
            scope: "current",
            targetPageId: "p1",
            text: "CONFIDENTIAL",
          },
        }),
      },
    );
    const text = decode(out).toLowerCase();
    expect(text.split(hex("CONFIDENTIAL")).length - 1).toBe(1);
  });

  it("repeats the watermark many times when tiled", async () => {
    const src = await makePdf(3); // page 2 is 120 x 200
    const out = await buildEditedPdf({ [DOC]: src }, [page("p2", 2)], [], {
      finishing: finishing({
        watermark: {
          ...DEFAULT_FINISHING.watermark,
          enabled: true,
          text: "DRAFT",
          tile: true,
          fontSize: 16,
        },
      }),
    });
    const text = decode(out).toLowerCase();
    const count = text.split(hex("DRAFT")).length - 1;
    expect(count).toBeGreaterThan(3);
  });

  it("spacing controls tile density (wider spacing => fewer copies)", async () => {
    const src = await makePdf(3);
    const countFor = async (spacing: number) => {
      const out = await buildEditedPdf({ [DOC]: src }, [page("p2", 2)], [], {
        finishing: finishing({
          watermark: {
            ...DEFAULT_FINISHING.watermark,
            enabled: true,
            text: "DRAFT",
            tile: true,
            fontSize: 16,
            spacing,
          },
        }),
      });
      return decode(out).toLowerCase().split(hex("DRAFT")).length - 1;
    };
    const dense = await countFor(0.5);
    const sparse = await countFor(3);
    expect(dense).toBeGreaterThan(sparse);
  });

  it("does nothing when finishing sections are disabled", async () => {
    const src = await makePdf(1);
    const out = await buildEditedPdf({ [DOC]: src }, [page("p0", 0)], [], {
      finishing: DEFAULT_FINISHING,
    });
    const doc = await PDFDocument.load(out);
    // Crop box unchanged (full page) and still valid.
    expect(doc.getPage(0).getCropBox()).toEqual({ x: 0, y: 0, width: 100, height: 200 });
  });
});

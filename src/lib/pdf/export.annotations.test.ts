import { describe, it, expect } from "vitest";
import { inflateSync } from "node:zlib";
import { PDFDocument } from "pdf-lib";
import { buildEditedPdf } from "./export";
import { makePdf } from "./test-utils";
import type { Annotation, PageItem } from "@/types";

const DOC = "d0";

function page(id: string, srcIndex: number): PageItem {
  return { id, docId: DOC, srcIndex, rotation: 0 };
}

/** pdf-lib writes drawn text as a hex string (`<48454C…> Tj`). */
function hex(s: string): string {
  return Buffer.from(s, "latin1").toString("hex").toLowerCase();
}

/**
 * pdf-lib Flate-compresses content/object streams, so drawn text is not in the
 * raw bytes. Return the raw bytes PLUS every inflatable stream, decoded as
 * latin1, so tests can scan the actual page content.
 */
function decode(bytes: Uint8Array): string {
  const buf = Buffer.from(bytes);
  let text = buf.toString("latin1");
  const marker = Buffer.from("stream");
  let i = 0;
  while ((i = buf.indexOf(marker, i)) !== -1) {
    // Skip the "stream" embedded inside a preceding "endstream" keyword.
    if (buf.subarray(i - 3, i).toString("latin1") === "end") {
      i += marker.length;
      continue;
    }
    let start = i + marker.length;
    if (buf[start] === 0x0d) start++; // \r
    if (buf[start] === 0x0a) start++; // \n
    const end = buf.indexOf(Buffer.from("endstream"), start);
    if (end === -1) break;
    try {
      text += inflateSync(buf.subarray(start, end)).toString("latin1");
    } catch {
      // Not a zlib stream (e.g. an image) — skip.
    }
    i = end + 1;
  }
  return text;
}

// A 1x1 transparent PNG.
const PNG_1PX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

describe("buildEditedPdf with annotations", () => {
  it("draws a text annotation into the page content stream", async () => {
    const src = await makePdf(1);
    const ann: Annotation = {
      id: "a1",
      pageId: "p0",
      kind: "text",
      x: 20,
      y: 150,
      text: "HELLOPDF",
      fontSize: 12,
      color: "#000000",
    };
    const out = await buildEditedPdf({ [DOC]: src }, [page("p0", 0)], [ann]);
    expect(decode(out).toLowerCase()).toContain(hex("HELLOPDF"));
  });

  it("only draws annotations for pages present in the output", async () => {
    const src = await makePdf(2);
    const anns: Annotation[] = [
      { id: "a1", pageId: "keep", kind: "text", x: 10, y: 100, text: "KEEPME", fontSize: 10, color: "#000" },
      { id: "a2", pageId: "gone", kind: "text", x: 10, y: 100, text: "DROPME", fontSize: 10, color: "#000" },
    ];
    // Only the "keep" page item is exported; "gone" is deleted.
    const out = await buildEditedPdf({ [DOC]: src }, [page("keep", 0)], anns);
    const text = decode(out).toLowerCase();
    expect(text).toContain(hex("KEEPME"));
    expect(text).not.toContain(hex("DROPME"));
  });

  it("embeds an image annotation as an XObject", async () => {
    const src = await makePdf(1);
    const withImg = await buildEditedPdf({ [DOC]: src }, [page("p0", 0)], [
      { id: "i1", pageId: "p0", kind: "image", x: 10, y: 10, w: 50, h: 50, dataUrl: PNG_1PX },
    ]);
    const plain = await buildEditedPdf({ [DOC]: src }, [page("p0", 0)]);
    // The image adds an XObject and real bytes.
    expect(decode(withImg)).toContain("/XObject");
    expect(withImg.byteLength).toBeGreaterThan(plain.byteLength);
  });

  it("produces a valid, reloadable PDF for every annotation kind", async () => {
    const src = await makePdf(1);
    const anns: Annotation[] = [
      { id: "t", pageId: "p0", kind: "text", x: 10, y: 180, text: "hi", fontSize: 12, color: "#111111" },
      { id: "r", pageId: "p0", kind: "rect", x: 10, y: 10, w: 40, h: 30, color: "#22ff00", strokeWidth: 2 },
      { id: "h", pageId: "p0", kind: "highlight", x: 5, y: 5, w: 60, h: 20, color: "#ffff00", opacity: 0.4 },
      { id: "d", pageId: "p0", kind: "draw", points: [0, 0, 10, 10, 20, 5], color: "#0000ff", strokeWidth: 3 },
      { id: "i", pageId: "p0", kind: "image", x: 0, y: 0, w: 20, h: 20, dataUrl: PNG_1PX },
    ];
    const out = await buildEditedPdf({ [DOC]: src }, [page("p0", 0)], anns);
    const reloaded = await PDFDocument.load(out);
    expect(reloaded.getPageCount()).toBe(1);
  });

  it("keeps working when no annotations are supplied (back-compat)", async () => {
    const src = await makePdf(2);
    const out = await buildEditedPdf({ [DOC]: src }, [page("p0", 0), page("p1", 1)]);
    const reloaded = await PDFDocument.load(out);
    expect(reloaded.getPageCount()).toBe(2);
  });
});

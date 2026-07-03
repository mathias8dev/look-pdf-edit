import {
  PDFDocument,
  PDFPage,
  StandardFonts,
  degrees,
  rgb,
  type PDFFont,
} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { Annotation, PageItem, Rotation, TextAnnotation } from "@/types";
import { hexToRgb01, mapFlatPoints } from "./coords";
import { standardFontKey, embeddedFontUrl } from "@/lib/fonts";

/** Fetches the bytes for an embedded font URL. Overridable for tests. */
export type FontBytesLoader = (url: string) => Promise<Uint8Array>;

const fetchFontBytes: FontBytesLoader = async (url) =>
  new Uint8Array(await (await fetch(url)).arrayBuffer());

/** Group annotations by the page id they are attached to. */
function groupByPage(annotations: Annotation[]): Map<string, Annotation[]> {
  const map = new Map<string, Annotation[]>();
  for (const a of annotations) {
    const list = map.get(a.pageId);
    if (list) list.push(a);
    else map.set(a.pageId, [a]);
  }
  return map;
}

/** docId -> original bytes for every source document in the assembly. */
export type SourceBytes = Record<string, Uint8Array>;

/**
 * Rebuild a PDF from one or more source documents applying the given page
 * list: reorder, delete (pages simply absent from `pages`), cross-document
 * assembly (each page copied from its own `docId`), rotation deltas, and any
 * annotations attached to each page. Source bytes are never mutated.
 *
 * Extraction and splitting are just this function over a subset of `pages`.
 */
export async function buildEditedPdf(
  sources: SourceBytes,
  pages: PageItem[],
  annotations: Annotation[] = [],
  opts: { loadFontBytes?: FontBytesLoader } = {},
): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  const loaded = new Map<string, PDFDocument>();
  const byPage = groupByPage(annotations);
  const getTextFont = makeFontResolver(out, opts.loadFontBytes ?? fetchFontBytes);

  async function sourceDoc(docId: string): Promise<PDFDocument> {
    let doc = loaded.get(docId);
    if (!doc) {
      const bytes = sources[docId];
      if (!bytes) throw new Error(`Missing source bytes for doc "${docId}"`);
      doc = await PDFDocument.load(bytes);
      loaded.set(docId, doc);
    }
    return doc;
  }

  for (const item of pages) {
    const src = await sourceDoc(item.docId);
    const [page] = await out.copyPages(src, [item.srcIndex]);

    const delta = item.rotation as Rotation;
    const base = page.getRotation().angle;
    page.setRotation(degrees((base + delta) % 360));

    for (const a of byPage.get(item.id) ?? []) {
      await drawAnnotation(out, page, a, getTextFont);
    }

    out.addPage(page);
  }

  return out.save();
}

/** Resolves + caches the pdf-lib font for a text annotation (standard or embedded). */
function makeFontResolver(out: PDFDocument, loadFontBytes: FontBytesLoader) {
  const cache = new Map<string, PDFFont>();
  let fontkitReady = false;

  return async function getTextFont(a: TextAnnotation): Promise<PDFFont> {
    const stdKey = standardFontKey(a.fontFamily, a.bold, a.italic);
    if (stdKey) {
      const hit = cache.get(stdKey);
      if (hit) return hit;
      const f = await out.embedFont(StandardFonts[stdKey as keyof typeof StandardFonts]);
      cache.set(stdKey, f);
      return f;
    }
    const url = embeddedFontUrl(a.fontFamily, a.bold, a.italic)!;
    const hit = cache.get(url);
    if (hit) return hit;
    if (!fontkitReady) {
      out.registerFontkit(fontkit);
      fontkitReady = true;
    }
    const f = await out.embedFont(await loadFontBytes(url), { subset: true });
    cache.set(url, f);
    return f;
  };
}

async function drawAnnotation(
  doc: PDFDocument,
  page: PDFPage,
  a: Annotation,
  getTextFont: (a: TextAnnotation) => Promise<PDFFont>,
): Promise<void> {
  switch (a.kind) {
    case "text": {
      const c = hexToRgb01(a.color);
      const font = await getTextFont(a);
      // Stored y is the top of the text box; pdf-lib anchors at the baseline.
      page.drawText(a.text, {
        x: a.x,
        y: a.y - a.fontSize,
        size: a.fontSize,
        font,
        color: rgb(c.r, c.g, c.b),
      });
      return;
    }
    case "rect": {
      const c = hexToRgb01(a.color);
      page.drawRectangle({
        x: a.x,
        y: a.y,
        width: a.w,
        height: a.h,
        borderColor: rgb(c.r, c.g, c.b),
        borderWidth: a.strokeWidth,
      });
      return;
    }
    case "highlight": {
      const c = hexToRgb01(a.color);
      page.drawRectangle({
        x: a.x,
        y: a.y,
        width: a.w,
        height: a.h,
        color: rgb(c.r, c.g, c.b),
        opacity: a.opacity,
      });
      return;
    }
    case "draw": {
      const c = hexToRgb01(a.color);
      const pts = a.points;
      for (let i = 0; i + 3 < pts.length; i += 2) {
        page.drawLine({
          start: { x: pts[i], y: pts[i + 1] },
          end: { x: pts[i + 2], y: pts[i + 3] },
          thickness: a.strokeWidth,
          color: rgb(c.r, c.g, c.b),
        });
      }
      return;
    }
    case "image": {
      const img = await embedDataUrl(doc, a.dataUrl);
      if (img) {
        page.drawImage(img, {
          x: a.x,
          y: a.y,
          width: a.w,
          height: a.h,
          opacity: a.opacity ?? 1,
        });
      }
      return;
    }
  }
}

async function embedDataUrl(doc: PDFDocument, dataUrl: string) {
  const comma = dataUrl.indexOf(",");
  if (comma === -1) return null;
  const header = dataUrl.slice(0, comma);
  const bytes = base64ToBytes(dataUrl.slice(comma + 1));
  return /image\/jpe?g/i.test(header)
    ? doc.embedJpg(bytes)
    : doc.embedPng(bytes);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Re-export so callers converting overlay geometry stay in one import site.
export { mapFlatPoints };

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

"use client";

import type { PDFDocumentProxy } from "pdfjs-dist";
import type { Rotation } from "@/types";

// pdf.js references browser globals (DOMMatrix, etc.) at module-eval time, so
// it must NEVER be imported on the server. We load it lazily on first use and
// cache the module promise. The worker is served from /public (no CDN, fully
// client-side).
let libPromise: Promise<typeof import("pdfjs-dist")> | null = null;

function getLib() {
  if (!libPromise) {
    libPromise = import("pdfjs-dist").then((lib) => {
      lib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      return lib;
    });
  }
  return libPromise;
}

/**
 * Open a PDF from raw bytes. We hand pdf.js a COPY because getDocument
 * transfers (detaches) the buffer to the worker, and we need the original
 * bytes intact for pdf-lib export.
 */
export async function openPdf(bytes: Uint8Array): Promise<PDFDocumentProxy> {
  const lib = await getLib();
  const copy = bytes.slice(0);
  return lib.getDocument({ data: copy }).promise;
}

/** Render a single page (1-based) into a canvas at the given scale + rotation. */
export async function renderPage(
  doc: PDFDocumentProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  opts: { scale?: number; rotation?: Rotation } = {},
): Promise<void> {
  const { scale = 1, rotation = 0 } = opts;
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale, rotation });

  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  canvas.width = Math.floor(viewport.width * dpr);
  canvas.height = Math.floor(viewport.height * dpr);
  canvas.style.width = `${Math.floor(viewport.width)}px`;
  canvas.style.height = `${Math.floor(viewport.height)}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
}

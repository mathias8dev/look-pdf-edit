"use client";

import { create } from "zustand";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { Annotation, PageItem, Rotation, ToolId } from "@/types";
import { nextId } from "@/lib/utils";

/** An uploaded source PDF: original bytes (for pdf-lib) + live pdf.js doc. */
export interface SourceDoc {
  id: string;
  fileName: string;
  bytes: Uint8Array;
  pdfDoc: PDFDocumentProxy;
}

interface EditorState {
  /** Uploaded source documents, keyed for lookup during render/export. */
  docs: SourceDoc[];
  pages: PageItem[];
  selectedId: string | null;

  // Annotation state (flat list; each annotation carries its pageId).
  annotations: Annotation[];
  selectedAnnotationId: string | null;
  activeTool: ToolId;
  /** Current drawing colour (#rrggbb) applied to new annotations. */
  color: string;
  /** Zoom factor for the main editing view. */
  scale: number;

  /** Load the first document, replacing any current session. */
  loadDocument: (fileName: string, bytes: Uint8Array, doc: PDFDocumentProxy) => void;
  /** Append another document's pages to the end of the assembly (merge). */
  addDocument: (fileName: string, bytes: Uint8Array, doc: PDFDocumentProxy) => void;
  reset: () => void;

  select: (id: string) => void;
  rotatePage: (id: string, dir: 1 | -1) => void;
  deletePage: (id: string) => void;
  movePage: (id: string, dir: 1 | -1) => void;

  setTool: (tool: ToolId) => void;
  setColor: (color: string) => void;
  setScale: (scale: number) => void;

  addAnnotation: (a: Annotation) => void;
  updateAnnotation: (id: string, patch: Partial<Annotation>) => void;
  removeAnnotation: (id: string) => void;
  selectAnnotation: (id: string | null) => void;
}

function rotate(r: Rotation, dir: 1 | -1): Rotation {
  return ((((r + dir * 90) % 360) + 360) % 360) as Rotation;
}

/** Build one PageItem per page in a freshly-loaded source document. */
function pagesForDoc(docId: string, pageCount: number): PageItem[] {
  return Array.from({ length: pageCount }, (_, i) => ({
    id: nextId("page"),
    docId,
    srcIndex: i,
    rotation: 0,
  }));
}

const DEFAULT_COLOR = "#ef4444";

const EMPTY = {
  docs: [] as SourceDoc[],
  pages: [] as PageItem[],
  selectedId: null,
  annotations: [] as Annotation[],
  selectedAnnotationId: null,
  activeTool: "select" as ToolId,
};

export const useEditorStore = create<EditorState>((set) => ({
  ...EMPTY,
  color: DEFAULT_COLOR,
  scale: 1.4,

  loadDocument: (fileName, bytes, doc) => {
    const source: SourceDoc = { id: nextId("doc"), fileName, bytes, pdfDoc: doc };
    const pages = pagesForDoc(source.id, doc.numPages);
    set({
      ...EMPTY,
      docs: [source],
      pages,
      selectedId: pages[0]?.id ?? null,
    });
  },

  addDocument: (fileName, bytes, doc) =>
    set((s) => {
      const source: SourceDoc = { id: nextId("doc"), fileName, bytes, pdfDoc: doc };
      const newPages = pagesForDoc(source.id, doc.numPages);
      return {
        docs: [...s.docs, source],
        pages: [...s.pages, ...newPages],
        selectedId: s.selectedId ?? newPages[0]?.id ?? null,
      };
    }),

  reset: () => set({ ...EMPTY }),

  select: (id) => set({ selectedId: id, selectedAnnotationId: null }),

  rotatePage: (id, dir) =>
    set((s) => ({
      pages: s.pages.map((p) =>
        p.id === id ? { ...p, rotation: rotate(p.rotation, dir) } : p,
      ),
    })),

  deletePage: (id) =>
    set((s) => {
      const idx = s.pages.findIndex((p) => p.id === id);
      if (idx === -1) return s;
      const pages = s.pages.filter((p) => p.id !== id);
      let selectedId = s.selectedId;
      if (selectedId === id) {
        selectedId = pages[Math.min(idx, pages.length - 1)]?.id ?? null;
      }
      // Drop annotations on the removed page, and any source doc no longer used.
      const annotations = s.annotations.filter((a) => a.pageId !== id);
      const usedDocs = new Set(pages.map((p) => p.docId));
      const docs = s.docs.filter((d) => usedDocs.has(d.id));
      return { pages, selectedId, annotations, docs };
    }),

  movePage: (id, dir) =>
    set((s) => {
      const idx = s.pages.findIndex((p) => p.id === id);
      const target = idx + dir;
      if (idx === -1 || target < 0 || target >= s.pages.length) return s;
      const pages = [...s.pages];
      [pages[idx], pages[target]] = [pages[target], pages[idx]];
      return { pages };
    }),

  setTool: (activeTool) => set({ activeTool }),
  setColor: (color) => set({ color }),
  setScale: (scale) => set({ scale: Math.min(4, Math.max(0.25, scale)) }),

  addAnnotation: (a) =>
    set((s) => ({
      annotations: [...s.annotations, a],
      selectedAnnotationId: a.id,
    })),

  updateAnnotation: (id, patch) =>
    set((s) => ({
      annotations: s.annotations.map((a) =>
        a.id === id ? ({ ...a, ...patch } as Annotation) : a,
      ),
    })),

  removeAnnotation: (id) =>
    set((s) => ({
      annotations: s.annotations.filter((a) => a.id !== id),
      selectedAnnotationId:
        s.selectedAnnotationId === id ? null : s.selectedAnnotationId,
    })),

  selectAnnotation: (selectedAnnotationId) => set({ selectedAnnotationId }),
}));

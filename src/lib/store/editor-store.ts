"use client";

import { create } from "zustand";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { Annotation, PageItem, Rotation, ToolId } from "@/types";
import { nextId } from "@/lib/utils";

interface EditorState {
  fileName: string | null;
  /** Original uploaded PDF bytes, kept intact for export. */
  originalBytes: Uint8Array | null;
  /** Live pdf.js document for rendering. Non-persisted; cleared on reset. */
  pdfDoc: PDFDocumentProxy | null;
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

  loadDocument: (
    fileName: string,
    bytes: Uint8Array,
    doc: PDFDocumentProxy,
  ) => void;
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

const DEFAULT_COLOR = "#ef4444";

export const useEditorStore = create<EditorState>((set) => ({
  fileName: null,
  originalBytes: null,
  pdfDoc: null,
  pages: [],
  selectedId: null,

  annotations: [],
  selectedAnnotationId: null,
  activeTool: "select",
  color: DEFAULT_COLOR,
  scale: 1.4,

  loadDocument: (fileName, bytes, doc) => {
    const pages: PageItem[] = Array.from({ length: doc.numPages }, (_, i) => ({
      id: nextId("page"),
      srcIndex: i,
      rotation: 0,
    }));
    set({
      fileName,
      originalBytes: bytes,
      pdfDoc: doc,
      pages,
      selectedId: pages[0]?.id ?? null,
      annotations: [],
      selectedAnnotationId: null,
      activeTool: "select",
    });
  },

  reset: () =>
    set({
      fileName: null,
      originalBytes: null,
      pdfDoc: null,
      pages: [],
      selectedId: null,
      annotations: [],
      selectedAnnotationId: null,
      activeTool: "select",
    }),

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
      // Drop annotations attached to the removed page.
      const annotations = s.annotations.filter((a) => a.pageId !== id);
      return { pages, selectedId, annotations };
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

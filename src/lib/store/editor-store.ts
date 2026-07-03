"use client";

import { create } from "zustand";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { Annotation, PageItem, Rotation, ToolId } from "@/types";
import type { FormField, FieldValue } from "@/lib/pdf/forms";
import { nextId } from "@/lib/utils";

/** An uploaded source PDF: original bytes (for pdf-lib) + live pdf.js doc. */
export interface SourceDoc {
  id: string;
  fileName: string;
  bytes: Uint8Array;
  pdfDoc: PDFDocumentProxy;
  /** AcroForm fields detected at load time (empty if the PDF has no form). */
  formFields: FormField[];
}

interface EditorState {
  /** Uploaded source documents, keyed for lookup during render/export. */
  docs: SourceDoc[];
  pages: PageItem[];
  selectedId: string | null;

  // Annotation state (flat list; each annotation carries its pageId).
  annotations: Annotation[];
  /** Ids of the currently selected drawn objects (multi-select). */
  selectedAnnotationIds: string[];
  activeTool: ToolId;
  /** Current drawing colour (#rrggbb) applied to new annotations. */
  color: string;
  /** Zoom factor for the main editing view. */
  scale: number;

  /** Edited form-field values, keyed by docId then field name. */
  forms: Record<string, Record<string, FieldValue>>;

  /** Load the first document, replacing any current session. */
  loadDocument: (
    fileName: string,
    bytes: Uint8Array,
    doc: PDFDocumentProxy,
    formFields?: FormField[],
  ) => void;
  /** Append another document's pages to the end of the assembly (merge). */
  addDocument: (
    fileName: string,
    bytes: Uint8Array,
    doc: PDFDocumentProxy,
    formFields?: FormField[],
  ) => void;
  reset: () => void;

  setFormValue: (docId: string, name: string, value: FieldValue) => void;

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
  /** Delete several objects at once (e.g. the current selection). */
  removeAnnotations: (ids: string[]) => void;
  /** Select exactly this object, or clear the selection when passed null. */
  selectAnnotation: (id: string | null) => void;
  /** Add/remove one object from the selection (shift/ctrl-click). */
  toggleAnnotation: (id: string) => void;
  /** Replace the selection with the given set (e.g. "select all"). */
  selectAnnotations: (ids: string[]) => void;
  /** Change an annotation's z-order among others on the SAME page. dir +1 = forward. */
  reorderAnnotation: (id: string, dir: 1 | -1) => void;
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
  selectedAnnotationIds: [] as string[],
  activeTool: "select" as ToolId,
  forms: {} as Record<string, Record<string, FieldValue>>,
};

export const useEditorStore = create<EditorState>((set) => ({
  ...EMPTY,
  color: DEFAULT_COLOR,
  scale: 1.4,

  loadDocument: (fileName, bytes, doc, formFields = []) => {
    const source: SourceDoc = {
      id: nextId("doc"),
      fileName,
      bytes,
      pdfDoc: doc,
      formFields,
    };
    const pages = pagesForDoc(source.id, doc.numPages);
    set({
      ...EMPTY,
      docs: [source],
      pages,
      selectedId: pages[0]?.id ?? null,
    });
  },

  addDocument: (fileName, bytes, doc, formFields = []) =>
    set((s) => {
      const source: SourceDoc = {
        id: nextId("doc"),
        fileName,
        bytes,
        pdfDoc: doc,
        formFields,
      };
      const newPages = pagesForDoc(source.id, doc.numPages);
      return {
        docs: [...s.docs, source],
        pages: [...s.pages, ...newPages],
        selectedId: s.selectedId ?? newPages[0]?.id ?? null,
      };
    }),

  reset: () => set({ ...EMPTY }),

  setFormValue: (docId, name, value) =>
    set((s) => ({
      forms: {
        ...s.forms,
        [docId]: { ...s.forms[docId], [name]: value },
      },
    })),

  select: (id) => set({ selectedId: id, selectedAnnotationIds: [] }),

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
      const kept = new Set(annotations.map((a) => a.id));
      const selectedAnnotationIds = s.selectedAnnotationIds.filter((x) => kept.has(x));
      const usedDocs = new Set(pages.map((p) => p.docId));
      const docs = s.docs.filter((d) => usedDocs.has(d.id));
      const forms = Object.fromEntries(
        Object.entries(s.forms).filter(([docId]) => usedDocs.has(docId)),
      );
      return { pages, selectedId, annotations, selectedAnnotationIds, docs, forms };
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
      selectedAnnotationIds: [a.id],
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
      selectedAnnotationIds: s.selectedAnnotationIds.filter((x) => x !== id),
    })),

  removeAnnotations: (ids) =>
    set((s) => {
      const drop = new Set(ids);
      return {
        annotations: s.annotations.filter((a) => !drop.has(a.id)),
        selectedAnnotationIds: s.selectedAnnotationIds.filter((x) => !drop.has(x)),
      };
    }),

  selectAnnotation: (id) => set({ selectedAnnotationIds: id ? [id] : [] }),

  toggleAnnotation: (id) =>
    set((s) => ({
      selectedAnnotationIds: s.selectedAnnotationIds.includes(id)
        ? s.selectedAnnotationIds.filter((x) => x !== id)
        : [...s.selectedAnnotationIds, id],
    })),

  selectAnnotations: (ids) => set({ selectedAnnotationIds: [...ids] }),

  reorderAnnotation: (id, dir) =>
    set((s) => {
      const arr = [...s.annotations];
      const idx = arr.findIndex((a) => a.id === id);
      if (idx === -1) return s;
      // Swap with the nearest neighbour on the same page in the given direction;
      // array order is z-order (later = drawn on top).
      let j = idx + dir;
      while (j >= 0 && j < arr.length && arr[j].pageId !== arr[idx].pageId) {
        j += dir;
      }
      if (j < 0 || j >= arr.length) return s;
      [arr[idx], arr[j]] = [arr[j], arr[idx]];
      return { annotations: arr };
    }),
}));

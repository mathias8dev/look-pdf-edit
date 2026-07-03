"use client";

import { create } from "zustand";
import type { PageItem, Rotation } from "@/types";
import { nextId } from "@/lib/utils";

interface EditorState {
  fileName: string | null;
  /** Original uploaded PDF bytes, kept intact for export. */
  originalBytes: Uint8Array | null;
  pages: PageItem[];
  selectedId: string | null;

  loadDocument: (fileName: string, bytes: Uint8Array, pageCount: number) => void;
  reset: () => void;

  select: (id: string) => void;
  rotatePage: (id: string, dir: 1 | -1) => void;
  deletePage: (id: string) => void;
  movePage: (id: string, dir: 1 | -1) => void;
}

function rotate(r: Rotation, dir: 1 | -1): Rotation {
  return (((r + dir * 90) % 360) + 360) % 360 as Rotation;
}

export const useEditorStore = create<EditorState>((set) => ({
  fileName: null,
  originalBytes: null,
  pages: [],
  selectedId: null,

  loadDocument: (fileName, bytes, pageCount) => {
    const pages: PageItem[] = Array.from({ length: pageCount }, (_, i) => ({
      id: nextId("page"),
      srcIndex: i,
      rotation: 0,
    }));
    set({ fileName, originalBytes: bytes, pages, selectedId: pages[0]?.id ?? null });
  },

  reset: () =>
    set({ fileName: null, originalBytes: null, pages: [], selectedId: null }),

  select: (id) => set({ selectedId: id }),

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
      return { pages, selectedId };
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
}));

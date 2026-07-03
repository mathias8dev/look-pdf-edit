import { describe, it, expect, beforeEach } from "vitest";
import { useEditorStore } from "./editor-store";
import type { Annotation } from "@/types";

const bytes = new Uint8Array([1, 2, 3]);
const get = () => useEditorStore.getState();

function loadPages(n: number) {
  // Minimal pdf.js document stand-in — the store only reads numPages.
  const fakeDoc = { numPages: n } as import("pdfjs-dist").PDFDocumentProxy;
  get().loadDocument("doc.pdf", bytes, fakeDoc);
}

/** Convenience: the current page order expressed as source indices. */
const order = () => get().pages.map((p) => p.srcIndex);

describe("editor-store", () => {
  beforeEach(() => {
    get().reset();
  });

  it("loadDocument creates one page item per source page and selects the first", () => {
    loadPages(3);
    expect(get().fileName).toBe("doc.pdf");
    expect(get().originalBytes).toBe(bytes);
    expect(order()).toEqual([0, 1, 2]);
    expect(get().pages.every((p) => p.rotation === 0)).toBe(true);
    expect(get().selectedId).toBe(get().pages[0].id);
  });

  it("reset clears everything", () => {
    loadPages(2);
    get().reset();
    expect(get().fileName).toBeNull();
    expect(get().originalBytes).toBeNull();
    expect(get().pages).toEqual([]);
    expect(get().selectedId).toBeNull();
  });

  it("rotatePage rotates forward and wraps 270 -> 0", () => {
    loadPages(1);
    const id = get().pages[0].id;
    get().rotatePage(id, 1);
    expect(get().pages[0].rotation).toBe(90);
    get().rotatePage(id, 1);
    get().rotatePage(id, 1);
    expect(get().pages[0].rotation).toBe(270);
    get().rotatePage(id, 1);
    expect(get().pages[0].rotation).toBe(0);
  });

  it("rotatePage rotates backward and wraps 0 -> 270", () => {
    loadPages(1);
    const id = get().pages[0].id;
    get().rotatePage(id, -1);
    expect(get().pages[0].rotation).toBe(270);
  });

  it("movePage swaps adjacent pages and is a no-op at the edges", () => {
    loadPages(3);
    const [a, b, c] = get().pages.map((p) => p.id);
    get().movePage(b, -1);
    expect(order()).toEqual([1, 0, 2]);
    get().movePage(c, 1); // c already last -> no-op
    expect(order()).toEqual([1, 0, 2]);
    // ids intact, just reordered
    expect(new Set(get().pages.map((p) => p.id))).toEqual(new Set([a, b, c]));
  });

  it("deletePage removes the page", () => {
    loadPages(3);
    const id = get().pages[1].id;
    get().deletePage(id);
    expect(order()).toEqual([0, 2]);
  });

  it("deletePage moves selection to a neighbour when the selected page is removed", () => {
    loadPages(3);
    const second = get().pages[1].id;
    get().select(second);
    get().deletePage(second);
    // selection falls to the page now occupying that index (old index 2)
    expect(get().selectedId).toBe(get().pages[1].id);
    expect(get().pages.find((p) => p.id === second)).toBeUndefined();
  });

  it("deleting the last remaining page clears selection", () => {
    loadPages(1);
    const id = get().pages[0].id;
    get().deletePage(id);
    expect(get().pages).toEqual([]);
    expect(get().selectedId).toBeNull();
  });
});

function textAnn(id: string, pageId: string): Annotation {
  return { id, pageId, kind: "text", x: 0, y: 0, text: "x", fontSize: 12, color: "#000" };
}

describe("editor-store annotations", () => {
  beforeEach(() => {
    get().reset();
  });

  it("addAnnotation appends and selects it", () => {
    loadPages(1);
    const pid = get().pages[0].id;
    get().addAnnotation(textAnn("a1", pid));
    expect(get().annotations).toHaveLength(1);
    expect(get().selectedAnnotationId).toBe("a1");
  });

  it("updateAnnotation patches by id", () => {
    loadPages(1);
    const pid = get().pages[0].id;
    get().addAnnotation(textAnn("a1", pid));
    get().updateAnnotation("a1", { x: 42 } as Partial<Annotation>);
    expect(get().annotations[0]).toMatchObject({ id: "a1", x: 42 });
  });

  it("removeAnnotation deletes and clears its selection", () => {
    loadPages(1);
    const pid = get().pages[0].id;
    get().addAnnotation(textAnn("a1", pid));
    get().removeAnnotation("a1");
    expect(get().annotations).toEqual([]);
    expect(get().selectedAnnotationId).toBeNull();
  });

  it("deleting a page drops that page's annotations", () => {
    loadPages(2);
    const [p0, p1] = get().pages.map((p) => p.id);
    get().addAnnotation(textAnn("a0", p0));
    get().addAnnotation(textAnn("a1", p1));
    get().deletePage(p0);
    expect(get().annotations.map((a) => a.id)).toEqual(["a1"]);
  });

  it("setScale clamps to [0.25, 4]", () => {
    get().setScale(99);
    expect(get().scale).toBe(4);
    get().setScale(0.01);
    expect(get().scale).toBe(0.25);
  });

  it("setTool and setColor update state", () => {
    get().setTool("rect");
    get().setColor("#00ff00");
    expect(get().activeTool).toBe("rect");
    expect(get().color).toBe("#00ff00");
  });

  it("selecting a page clears annotation selection", () => {
    loadPages(1);
    const pid = get().pages[0].id;
    get().addAnnotation(textAnn("a1", pid));
    get().select(pid);
    expect(get().selectedAnnotationId).toBeNull();
  });
});

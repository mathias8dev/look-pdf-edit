import { describe, it, expect, beforeEach } from "vitest";
import { useEditorStore } from "./editor-store";

const bytes = new Uint8Array([1, 2, 3]);
const get = () => useEditorStore.getState();

function loadPages(n: number) {
  get().loadDocument("doc.pdf", bytes, n);
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

import { describe, it, expect } from "vitest";
import {
  pdfToView,
  viewToPdf,
  viewRectToPdf,
  pdfRectToView,
  mapFlatPoints,
  hexToRgb01,
} from "./coords";

const PAGE_H = 200;

describe("pdf <-> view point conversion", () => {
  it("flips the Y axis and scales", () => {
    // PDF (10, 180) on a 200-tall page at scale 2 -> view (20, 40)
    expect(pdfToView({ x: 10, y: 180 }, 2, PAGE_H)).toEqual({ x: 20, y: 40 });
  });

  it("is an exact round-trip at any scale", () => {
    for (const scale of [0.5, 1, 1.4, 3]) {
      const p = { x: 37, y: 123 };
      const back = viewToPdf(pdfToView(p, scale, PAGE_H), scale, PAGE_H);
      expect(back.x).toBeCloseTo(p.x, 9);
      expect(back.y).toBeCloseTo(p.y, 9);
    }
  });

  it("maps the PDF origin (bottom-left) to the view bottom-left", () => {
    expect(pdfToView({ x: 0, y: 0 }, 1, PAGE_H)).toEqual({ x: 0, y: 200 });
  });
});

describe("rect conversion", () => {
  it("view rect (top-left) -> PDF rect (bottom-left)", () => {
    // A 40x20 view rect at (10,10), scale 1, page 200 tall.
    // bottom-left in PDF = (10, 200 - (10+20)) = (10, 170)
    expect(viewRectToPdf({ x: 10, y: 10, w: 40, h: 20 }, 1, PAGE_H)).toEqual({
      x: 10,
      y: 170,
      w: 40,
      h: 20,
    });
  });

  it("is an exact rect round-trip", () => {
    const r = { x: 12, y: 8, w: 33, h: 21 };
    const back = pdfRectToView(viewRectToPdf(r, 1.4, PAGE_H), 1.4, PAGE_H);
    expect(back.x).toBeCloseTo(r.x, 9);
    expect(back.y).toBeCloseTo(r.y, 9);
    expect(back.w).toBeCloseTo(r.w, 9);
    expect(back.h).toBeCloseTo(r.h, 9);
  });
});

describe("mapFlatPoints", () => {
  it("applies the conversion to each (x,y) pair", () => {
    const view = mapFlatPoints([0, 0, 10, 20], (p) => pdfToView(p, 1, PAGE_H));
    expect(view).toEqual([0, 200, 10, 180]);
  });

  it("ignores a trailing odd coordinate", () => {
    expect(mapFlatPoints([1, 2, 3], (p) => p)).toEqual([1, 2]);
  });
});

describe("hexToRgb01", () => {
  it("parses #rrggbb", () => {
    expect(hexToRgb01("#ff0000")).toEqual({ r: 1, g: 0, b: 0 });
    expect(hexToRgb01("#000000")).toEqual({ r: 0, g: 0, b: 0 });
  });

  it("expands #rgb shorthand", () => {
    expect(hexToRgb01("#fff")).toEqual({ r: 1, g: 1, b: 1 });
  });

  it("falls back to black on garbage", () => {
    expect(hexToRgb01("nope")).toEqual({ r: 0, g: 0, b: 0 });
  });
});

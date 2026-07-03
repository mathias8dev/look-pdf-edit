/**
 * Coordinate conversion between two spaces used throughout the editor.
 *
 * PDF space  — origin BOTTOM-LEFT, y-up, units = PDF points, page UNROTATED.
 *              This is what pdf-lib draws in and what we persist, so annotations
 *              survive zoom changes and rotate with the page on export.
 * View space — origin TOP-LEFT, y-DOWN, units = CSS pixels = PDF points * scale.
 *              This is what the Konva overlay and the browser use.
 *
 * Every function here is pure so the coordinate math (the crux of annotation
 * fidelity) is unit-tested in isolation.
 */

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** PDF point -> view pixel. `pageH` is the unrotated page height in PDF points. */
export function pdfToView(p: Point, scale: number, pageH: number): Point {
  return { x: p.x * scale, y: (pageH - p.y) * scale };
}

/** View pixel -> PDF point. */
export function viewToPdf(p: Point, scale: number, pageH: number): Point {
  return { x: p.x / scale, y: pageH - p.y / scale };
}

/**
 * View rect (top-left origin) -> PDF rect (bottom-left origin). The returned
 * x/y is the bottom-left corner — the anchor pdf-lib's drawRectangle expects.
 */
export function viewRectToPdf(r: Rect, scale: number, pageH: number): Rect {
  return {
    x: r.x / scale,
    y: pageH - (r.y + r.h) / scale,
    w: r.w / scale,
    h: r.h / scale,
  };
}

/** PDF rect (bottom-left origin) -> view rect (top-left origin). */
export function pdfRectToView(r: Rect, scale: number, pageH: number): Rect {
  return {
    x: r.x * scale,
    y: (pageH - (r.y + r.h)) * scale,
    w: r.w * scale,
    h: r.h * scale,
  };
}

/** Convert a flat [x0,y0,x1,y1,…] polyline between spaces via `fn`. */
export function mapFlatPoints(
  pts: number[],
  fn: (p: Point) => Point,
): number[] {
  const out: number[] = [];
  for (let i = 0; i + 1 < pts.length; i += 2) {
    const p = fn({ x: pts[i], y: pts[i + 1] });
    out.push(p.x, p.y);
  }
  return out;
}

/** "#rrggbb" (or "#rgb") -> {r,g,b} in 0..1. Falls back to black. */
export function hexToRgb01(hex: string): { r: number; g: number; b: number } {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (h.length !== 6 || /[^0-9a-fA-F]/.test(h)) {
    return { r: 0, g: 0, b: 0 };
  }
  return {
    r: parseInt(h.slice(0, 2), 16) / 255,
    g: parseInt(h.slice(2, 4), 16) / 255,
    b: parseInt(h.slice(4, 6), 16) / 255,
  };
}

import { describe, it, expect } from "vitest";
import {
  contentRect,
  formatPageNumber,
  pageNumberAnchor,
  watermarkAnchor,
  watermarkPlacements,
  tileGrid,
  type CropSettings,
  type Rect,
} from "./finishing";

const crop = (over: Partial<CropSettings>): CropSettings => ({
  enabled: true,
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  ...over,
});

describe("contentRect", () => {
  it("is the full page when crop is disabled/absent", () => {
    expect(contentRect(200, 300)).toEqual({ x: 0, y: 0, w: 200, h: 300 });
    expect(contentRect(200, 300, crop({ enabled: false, left: 10 }))).toEqual({
      x: 0,
      y: 0,
      w: 200,
      h: 300,
    });
  });

  it("trims each edge (origin bottom-left)", () => {
    // left 10, right 20, top 30, bottom 40 on a 200x300 page.
    const r = contentRect(200, 300, crop({ left: 10, right: 20, top: 30, bottom: 40 }));
    expect(r).toEqual({ x: 10, y: 40, w: 170, h: 230 });
  });

  it("never collapses the page below 1x1", () => {
    const r = contentRect(100, 100, crop({ left: 80, right: 80, top: 80, bottom: 80 }));
    expect(r.w).toBe(1);
    expect(r.h).toBe(1);
  });
});

describe("formatPageNumber", () => {
  it("renders each format", () => {
    expect(formatPageNumber("n", 3, 10)).toBe("3");
    expect(formatPageNumber("n-of-N", 3, 10)).toBe("3 / 10");
    expect(formatPageNumber("page-n", 3, 10)).toBe("Page 3");
    expect(formatPageNumber("page-n-of-N", 3, 10)).toBe("Page 3 of 10");
  });
});

describe("pageNumberAnchor", () => {
  const rect: Rect = { x: 0, y: 0, w: 200, h: 300 };

  it("positions horizontally by left/center/right", () => {
    expect(pageNumberAnchor("bottom-left", rect, 40, 12, 24).x).toBe(24);
    expect(pageNumberAnchor("bottom-right", rect, 40, 12, 24).x).toBe(200 - 24 - 40);
    expect(pageNumberAnchor("bottom-center", rect, 40, 12, 24).x).toBe(100 - 20);
  });

  it("positions vertically by top/bottom", () => {
    expect(pageNumberAnchor("bottom-center", rect, 40, 12, 24).y).toBe(24);
    expect(pageNumberAnchor("top-center", rect, 40, 12, 24).y).toBe(300 - 24 - 12);
  });

  it("respects the cropped rect origin", () => {
    const cropped: Rect = { x: 10, y: 40, w: 170, h: 230 };
    const at = pageNumberAnchor("bottom-left", cropped, 40, 12, 24);
    expect(at).toEqual({ x: 34, y: 64 });
  });
});

describe("watermarkAnchor", () => {
  const rect: Rect = { x: 0, y: 0, w: 200, h: 300 };
  // Unrotated: bboxW = textWidth (100), bboxH = textHeight (48).

  it("centers the visible text rectangle for the center position", () => {
    // The drawText origin is the baseline start; the visible box center is (100, 150).
    expect(watermarkAnchor("center", rect, 100, 48, 0, 16)).toEqual({ x: 50, y: 126 });
  });

  it("insets the visible bounding box for a bottom-left placement", () => {
    // Center is (66, 40), so the baseline origin is lower by half the text height.
    expect(watermarkAnchor("bottom-left", rect, 100, 48, 0, 16)).toEqual({ x: 16, y: 16 });
  });

  it("insets the visible bounding box for a top-right placement", () => {
    // Center is (134, 260), so the top of the unrotated visible box is 284.
    expect(watermarkAnchor("top-right", rect, 100, 48, 0, 16)).toEqual({ x: 84, y: 236 });
  });

  it("accounts for rotation in the visual text rectangle", () => {
    // 90 deg: origin + width/2 along baseline + height/2 perpendicular = page center.
    const at = watermarkAnchor("center", rect, 100, 48, 90, 16);
    expect(at.x).toBeCloseTo(124, 6);
    expect(at.y).toBeCloseTo(100, 6);
  });

  it("returns visual centers along with drawText origins", () => {
    const [at] = watermarkPlacements(
      rect,
      { width: 100, height: 48 },
      { position: "center", rotation: 0, tile: false, spacing: 1, margin: 16 },
    );
    expect(at).toEqual({ x: 50, y: 126, cx: 100, cy: 150 });
  });
});

describe("tileGrid", () => {
  const rect: Rect = { x: 0, y: 0, w: 200, h: 300 };

  it("lays a regular grid (unrotated) covering the rect and beyond", () => {
    // radius = hypot(200,300)/2 = 180.27; steps of 100 -> ni=nj=2 -> 5x5 = 25.
    const pts = tileGrid(rect, 100, 100, 0);
    expect(pts).toHaveLength(25);
    expect(pts).toContainEqual({ x: 100, y: 150 }); // centre cell
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    // Grid overhangs every edge so there are no gaps at the borders.
    expect(Math.min(...xs)).toBeLessThanOrEqual(rect.x);
    expect(Math.max(...xs)).toBeGreaterThanOrEqual(rect.x + rect.w);
    expect(Math.min(...ys)).toBeLessThanOrEqual(rect.y);
    expect(Math.max(...ys)).toBeGreaterThanOrEqual(rect.y + rect.h);
  });

  it("covers the whole rect at 45 deg too - every corner is within a cell of a point", () => {
    const spacing = 60;
    const pts = tileGrid(rect, spacing, spacing, 45);
    const corners = [
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      { x: 0, y: 300 },
      { x: 200, y: 300 },
      { x: 100, y: 150 },
    ];
    for (const corner of corners) {
      const nearest = Math.min(
        ...pts.map((p) => Math.hypot(p.x - corner.x, p.y - corner.y)),
      );
      // No point is further than one cell's diagonal from a grid centre.
      expect(nearest).toBeLessThanOrEqual(spacing * Math.SQRT2);
    }
  });
});


// Document-wide "finishing" applied at export time: page numbers, watermark,
// and crop. Pure helpers here are unit-tested; the drawing lives in export.ts.

export type PageNumberFormat = "n" | "n-of-N" | "page-n" | "page-n-of-N";

export type PageNumberPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export interface PageNumberSettings {
  enabled: boolean;
  format: PageNumberFormat;
  position: PageNumberPosition;
  fontSize: number;
  margin: number;
  start: number;
}

export type WatermarkPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "middle-left"
  | "center"
  | "middle-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export interface WatermarkSettings {
  enabled: boolean;
  text: string;
  fontSize: number;
  color: string;
  opacity: number;
  rotation: number; // degrees
  /** Anchor within the page (ignored when tiling). */
  position: WatermarkPosition;
  tile: boolean;
  /** Tile spacing multiplier (1 = default density; larger = more spread out). */
  spacing: number;
}

/** Crop margins in PDF points, trimmed from each edge. */
export interface CropSettings {
  enabled: boolean;
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface FinishingSettings {
  pageNumbers: PageNumberSettings;
  watermark: WatermarkSettings;
  crop: CropSettings;
}

export const DEFAULT_FINISHING: FinishingSettings = {
  pageNumbers: {
    enabled: false,
    format: "n-of-N",
    position: "bottom-center",
    fontSize: 12,
    margin: 24,
    start: 1,
  },
  watermark: {
    enabled: false,
    text: "DRAFT",
    fontSize: 48,
    color: "#ff0000",
    opacity: 0.2,
    rotation: 45,
    position: "center",
    tile: false,
    spacing: 1,
  },
  crop: { enabled: false, top: 0, right: 0, bottom: 0, left: 0 },
};

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WatermarkMetrics {
  width: number;
  height: number;
}

export interface WatermarkPlacement {
  /** PDF drawText origin: left end of the text baseline. */
  x: number;
  y: number;
  /** Visual center of the rotated text rectangle. */
  cx: number;
  cy: number;
}

/** The effective content rectangle (PDF points, origin bottom-left) after crop. */
export function contentRect(
  pageWidth: number,
  pageHeight: number,
  crop?: CropSettings,
): Rect {
  if (!crop || !crop.enabled) return { x: 0, y: 0, w: pageWidth, h: pageHeight };
  const left = Math.max(0, crop.left);
  const right = Math.max(0, crop.right);
  const top = Math.max(0, crop.top);
  const bottom = Math.max(0, crop.bottom);
  // Never collapse the page to nothing.
  const w = Math.max(1, pageWidth - left - right);
  const h = Math.max(1, pageHeight - top - bottom);
  return { x: left, y: bottom, w, h };
}

/** Render the page-number label for a given number/total. */
export function formatPageNumber(
  format: PageNumberFormat,
  num: number,
  total: number,
): string {
  switch (format) {
    case "n":
      return `${num}`;
    case "n-of-N":
      return `${num} / ${total}`;
    case "page-n":
      return `Page ${num}`;
    case "page-n-of-N":
      return `Page ${num} of ${total}`;
  }
}

/**
 * Centre points of a rotated regular grid that fully covers `rect`.
 *
 * The standard tiled-watermark technique: work in a coordinate frame rotated by
 * the watermark angle and lay out a regular grid there. Iterating +/- the rect's
 * half-diagonal along both rotated axes guarantees every point of the rect is
 * covered with evenly-spaced, parallel copies and no gaps - at any angle.
 * `spacingX` is the step along the text baseline, `spacingY` between lines.
 */
export function tileGrid(
  rect: Rect,
  spacingX: number,
  spacingY: number,
  rotationDeg: number,
): { x: number; y: number }[] {
  const rad = (rotationDeg * Math.PI) / 180;
  const ux = Math.cos(rad);
  const uy = Math.sin(rad); // along the baseline
  const vx = -Math.sin(rad);
  const vy = Math.cos(rad); // perpendicular (line-to-line)

  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const radius = 0.5 * Math.hypot(rect.w, rect.h);
  const ni = Math.ceil(radius / spacingX);
  const nj = Math.ceil(radius / spacingY);

  const points: { x: number; y: number }[] = [];
  for (let j = -nj; j <= nj; j++) {
    for (let i = -ni; i <= ni; i++) {
      points.push({
        x: cx + i * spacingX * ux + j * spacingY * vx,
        y: cy + i * spacingX * uy + j * spacingY * vy,
      });
    }
  }
  return points;
}

/** Split a watermark position into vertical + horizontal parts. */
function watermarkParts(
  p: WatermarkPosition,
): ["top" | "middle" | "bottom", "left" | "center" | "right"] {
  const s = p === "center" ? "middle-center" : p;
  return s.split("-") as ["top" | "middle" | "bottom", "left" | "center" | "right"];
}

/**
 * PDF drawText anchor for a rotated watermark. The visible text rectangle,
 * approximated as width x height above the baseline, is centered/inset within
 * `rect`; the returned x/y is the baseline origin pdf-lib expects.
 */
export function watermarkAnchor(
  position: WatermarkPosition,
  rect: Rect,
  textWidth: number,
  textHeight: number,
  rotationDeg: number,
  margin: number,
): { x: number; y: number } {
  const placement = watermarkPlacementForCenter(
    watermarkCenter(position, rect, textWidth, textHeight, rotationDeg, margin),
    { width: textWidth, height: textHeight },
    rotationDeg,
  );
  return { x: placement.x, y: placement.y };
}

/** Watermark placements in PDF space, ready for pdf-lib drawText. */
export function watermarkPlacements(
  rect: Rect,
  metrics: WatermarkMetrics,
  opts: {
    position: WatermarkPosition;
    rotation: number;
    tile: boolean;
    spacing: number;
    margin: number;
  },
): WatermarkPlacement[] {
  if (!opts.tile) {
    return [
      watermarkPlacementForCenter(
        watermarkCenter(
          opts.position,
          rect,
          metrics.width,
          metrics.height,
          opts.rotation,
          opts.margin,
        ),
        metrics,
        opts.rotation,
      ),
    ];
  }

  const s = Math.max(0.25, opts.spacing ?? 1);
  const spacingX = (metrics.width + metrics.height * 1.5) * s;
  const spacingY = metrics.height * 2.4 * s;
  return tileGrid(rect, spacingX, spacingY, opts.rotation).map((center) =>
    watermarkPlacementForCenter(center, metrics, opts.rotation),
  );
}

function watermarkCenter(
  position: WatermarkPosition,
  rect: Rect,
  textWidth: number,
  textHeight: number,
  rotationDeg: number,
  margin: number,
): { x: number; y: number } {
  const rad = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const bboxW = Math.abs(textWidth * cos) + Math.abs(textHeight * sin);
  const bboxH = Math.abs(textWidth * sin) + Math.abs(textHeight * cos);

  const [v, h] = watermarkParts(position);
  let cx: number;
  if (h === "left") cx = rect.x + bboxW / 2 + margin;
  else if (h === "right") cx = rect.x + rect.w - bboxW / 2 - margin;
  else cx = rect.x + rect.w / 2;

  let cy: number;
  if (v === "bottom") cy = rect.y + bboxH / 2 + margin;
  else if (v === "top") cy = rect.y + rect.h - bboxH / 2 - margin;
  else cy = rect.y + rect.h / 2;

  return { x: cx, y: cy };
}

function watermarkPlacementForCenter(
  center: { x: number; y: number },
  metrics: WatermarkMetrics,
  rotationDeg: number,
): WatermarkPlacement {
  const rad = (rotationDeg * Math.PI) / 180;
  const ux = Math.cos(rad);
  const uy = Math.sin(rad);
  const vx = -Math.sin(rad);
  const vy = Math.cos(rad);
  const x = center.x - (metrics.width / 2) * ux - (metrics.height / 2) * vx;
  const y = center.y - (metrics.width / 2) * uy - (metrics.height / 2) * vy;
  return { x, y, cx: center.x, cy: center.y };
}

/** Baseline anchor for a page number of the given text width within `rect`. */
export function pageNumberAnchor(
  position: PageNumberPosition,
  rect: Rect,
  textWidth: number,
  fontSize: number,
  margin: number,
): { x: number; y: number } {
  const [v, h] = position.split("-") as ["top" | "bottom", "left" | "center" | "right"];
  let x: number;
  if (h === "left") x = rect.x + margin;
  else if (h === "right") x = rect.x + rect.w - margin - textWidth;
  else x = rect.x + rect.w / 2 - textWidth / 2;

  const y =
    v === "bottom" ? rect.y + margin : rect.y + rect.h - margin - fontSize;
  return { x, y };
}


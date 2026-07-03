"use client";

import { useEditorStore } from "@/lib/store/editor-store";
import {
  contentRect,
  formatPageNumber,
  watermarkPlacements,
  type PageNumberSettings,
  type Rect,
  type WatermarkSettings,
} from "@/lib/finishing";
import { pdfToView } from "@/lib/pdf/coords";

interface Props {
  /** Unrotated page size in PDF points. */
  pageWidth: number;
  pageHeight: number;
  scale: number;
  /** 0-based position of the shown page in the output order. */
  pageIndex: number;
  total: number;
}

/**
 * Live, non-interactive preview of the finishing (crop mask, watermark, page
 * number) drawn over the page so users can see what the export will apply.
 * Approximates the export positioning - pixel-exactness isn't required here.
 */
export default function FinishingPreview({
  pageWidth,
  pageHeight,
  scale,
  pageIndex,
  total,
}: Props) {
  const { pageNumbers, watermark, crop } = useEditorStore((s) => s.finishing);

  const leftPx = (crop.enabled ? crop.left : 0) * scale;
  const rightPx = (crop.enabled ? crop.right : 0) * scale;
  const topPx = (crop.enabled ? crop.top : 0) * scale;
  const bottomPx = (crop.enabled ? crop.bottom : 0) * scale;

  const contentWpx = pageWidth * scale - leftPx - rightPx;
  const rect = contentRect(pageWidth, pageHeight, crop);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {crop.enabled && (
        <div
          className="absolute border-2 border-dashed border-blue-500"
          style={{
            left: leftPx,
            top: topPx,
            right: rightPx,
            bottom: bottomPx,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
          }}
        />
      )}

      {watermark.enabled && watermark.text && (
        <WatermarkPreview
          watermark={watermark}
          scale={scale}
          pageHeight={pageHeight}
          rect={rect}
        />
      )}

      {pageNumbers.enabled && (
        <div
          className="absolute whitespace-nowrap font-sans text-black"
          style={pageNumberStyle(pageNumbers, {
            leftPx,
            rightPx,
            topPx,
            bottomPx,
            contentWpx,
            scale,
          })}
        >
          {formatPageNumber(pageNumbers.format, pageNumbers.start + pageIndex, total)}
        </div>
      )}
    </div>
  );
}

function WatermarkPreview({
  watermark: wm,
  scale,
  pageHeight,
  rect,
}: {
  watermark: WatermarkSettings;
  scale: number;
  pageHeight: number;
  rect: Rect;
}) {
  const metrics = {
    width: estimateWatermarkTextWidth(wm.text, wm.fontSize),
    height: wm.fontSize,
  };
  const placements = watermarkPlacements(rect, metrics, {
    position: wm.position,
    rotation: wm.rotation,
    tile: wm.tile,
    spacing: wm.spacing,
    margin: 16,
  });

  const base: React.CSSProperties = {
    position: "absolute",
    whiteSpace: "nowrap",
    fontFamily: "Arial, Helvetica, sans-serif",
    fontSize: wm.fontSize * scale,
    color: wm.color,
    opacity: wm.opacity,
    userSelect: "none",
    transform: `translate(-50%, -50%) rotate(${-wm.rotation}deg)`,
  };

  return (
    <>
      {placements.map((p, idx) => {
        const view = pdfToView({ x: p.cx, y: p.cy }, scale, pageHeight);
        return (
          <span
            key={idx}
            style={{
              ...base,
              left: view.x,
              top: view.y,
            }}
          >
            {wm.text}
          </span>
        );
      })}
    </>
  );
}

function estimateWatermarkTextWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.55;
}

function pageNumberStyle(
  pn: PageNumberSettings,
  px: {
    leftPx: number;
    rightPx: number;
    topPx: number;
    bottomPx: number;
    contentWpx: number;
    scale: number;
  },
): React.CSSProperties {
  const [v, h] = pn.position.split("-") as [
    "top" | "bottom",
    "left" | "center" | "right",
  ];
  const margin = pn.margin * px.scale;
  const style: React.CSSProperties = { fontSize: pn.fontSize * px.scale };

  if (h === "left") style.left = px.leftPx + margin;
  else if (h === "right") style.right = px.rightPx + margin;
  else {
    style.left = px.leftPx + px.contentWpx / 2;
    style.transform = "translateX(-50%)";
  }

  if (v === "bottom") style.bottom = px.bottomPx + margin;
  else style.top = px.topPx + margin;

  return style;
}



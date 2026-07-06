"use client";

import { useRef, type CSSProperties, type PointerEvent } from "react";
import { useEditorStore } from "@/lib/store/editor-store";
import {
  appliesToFinishingPage,
  contentRect,
  formatPageNumber,
  watermarkPlacements,
  type CropSettings,
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
  pageId: string;
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
  pageId,
  pageIndex,
  total,
}: Props) {
  const { pageNumbers, watermark, crop } = useEditorStore((s) => s.finishing);
  const setCrop = useEditorStore((s) => s.setCrop);
  const cropApplies = appliesToFinishingPage(crop, pageId);
  const watermarkApplies = appliesToFinishingPage(watermark, pageId);
  const effectiveCrop = cropApplies ? crop : undefined;

  const leftPx = (effectiveCrop?.enabled ? effectiveCrop.left : 0) * scale;
  const rightPx = (effectiveCrop?.enabled ? effectiveCrop.right : 0) * scale;
  const topPx = (effectiveCrop?.enabled ? effectiveCrop.top : 0) * scale;
  const bottomPx = (effectiveCrop?.enabled ? effectiveCrop.bottom : 0) * scale;

  const contentWpx = pageWidth * scale - leftPx - rightPx;
  const rect = contentRect(pageWidth, pageHeight, effectiveCrop);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {crop.enabled && cropApplies && (
        <CropOverlay
          crop={crop}
          pageWidth={pageWidth}
          pageHeight={pageHeight}
          scale={scale}
          onChange={setCrop}
        />
      )}

      {watermark.enabled && watermarkApplies && watermark.text && (
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

type CropDragKind =
  | "move"
  | "top"
  | "right"
  | "bottom"
  | "left"
  | "top-left"
  | "top-right"
  | "bottom-right"
  | "bottom-left";

interface CropDragState {
  kind: CropDragKind;
  pointerId: number;
  grabX: number;
  grabY: number;
  start: CropViewRect;
}

interface CropViewRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const MIN_CROP_SIZE_PX = 12;

const HANDLES: { kind: CropDragKind; className: string }[] = [
  {
    kind: "top-left",
    className: "left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize",
  },
  {
    kind: "top",
    className: "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize",
  },
  {
    kind: "top-right",
    className: "right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize",
  },
  {
    kind: "right",
    className: "right-0 top-1/2 -translate-y-1/2 translate-x-1/2 cursor-ew-resize",
  },
  {
    kind: "bottom-right",
    className: "bottom-0 right-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize",
  },
  {
    kind: "bottom",
    className: "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 cursor-ns-resize",
  },
  {
    kind: "bottom-left",
    className: "bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize",
  },
  {
    kind: "left",
    className: "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize",
  },
];

function CropOverlay({
  crop,
  pageWidth,
  pageHeight,
  scale,
  onChange,
}: {
  crop: CropSettings;
  pageWidth: number;
  pageHeight: number;
  scale: number;
  onChange: (patch: Partial<CropSettings>) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const drag = useRef<CropDragState | null>(null);
  const pageW = pageWidth * scale;
  const pageH = pageHeight * scale;
  const rect = cropToViewRect(crop, pageW, pageH, scale);

  function startDrag(kind: CropDragKind, e: PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = pointerInPage(e);
    drag.current = {
      kind,
      pointerId: e.pointerId,
      grabX: p.x - rect.left,
      grabY: p.y - rect.top,
      start: rect,
    };
  }

  function updateDrag(e: PointerEvent<HTMLDivElement>) {
    const state = drag.current;
    if (!state || state.pointerId !== e.pointerId) return;
    e.preventDefault();
    e.stopPropagation();
    const p = pointerInPage(e);
    onChange(viewRectToCrop(nextCropRect(state, p, pageW, pageH), pageW, pageH, scale));
  }

  function endDrag(e: PointerEvent<HTMLDivElement>) {
    if (drag.current?.pointerId !== e.pointerId) return;
    e.preventDefault();
    e.stopPropagation();
    drag.current = null;
  }

  function pointerInPage(e: PointerEvent<HTMLDivElement>) {
    const bounds = rootRef.current?.getBoundingClientRect();
    return {
      x: clamp(e.clientX - (bounds?.left ?? 0), 0, pageW),
      y: clamp(e.clientY - (bounds?.top ?? 0), 0, pageH),
    };
  }

  return (
    <div ref={rootRef} className="absolute inset-0">
      <div
        className="absolute border-2 border-dashed border-blue-500"
        style={{
          left: rect.left,
          top: rect.top,
          width: rect.right - rect.left,
          height: rect.bottom - rect.top,
          boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
        }}
      >
        <div
          className="pointer-events-auto absolute inset-0 cursor-move touch-none"
          onPointerDown={(e) => startDrag("move", e)}
          onPointerMove={updateDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        />
        {HANDLES.map((h) => (
          <div
            key={h.kind}
            className={`pointer-events-auto absolute size-4 touch-none rounded-sm border border-blue-700 bg-white shadow ${h.className}`}
            onPointerDown={(e) => startDrag(h.kind, e)}
            onPointerMove={updateDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          />
        ))}
      </div>
    </div>
  );
}

function cropToViewRect(
  crop: CropSettings,
  pageW: number,
  pageH: number,
  scale: number,
): CropViewRect {
  const left = clamp(crop.left * scale, 0, pageW - MIN_CROP_SIZE_PX);
  const top = clamp(crop.top * scale, 0, pageH - MIN_CROP_SIZE_PX);
  const right = clamp(pageW - crop.right * scale, left + MIN_CROP_SIZE_PX, pageW);
  const bottom = clamp(pageH - crop.bottom * scale, top + MIN_CROP_SIZE_PX, pageH);
  return { left, top, right, bottom };
}

function nextCropRect(
  state: CropDragState,
  p: { x: number; y: number },
  pageW: number,
  pageH: number,
): CropViewRect {
  const next = { ...state.start };
  const kind = state.kind;

  if (kind === "move") {
    const w = state.start.right - state.start.left;
    const h = state.start.bottom - state.start.top;
    const left = clamp(p.x - state.grabX, 0, pageW - w);
    const top = clamp(p.y - state.grabY, 0, pageH - h);
    return { left, top, right: left + w, bottom: top + h };
  }

  if (kind.includes("left")) {
    next.left = clamp(p.x, 0, next.right - MIN_CROP_SIZE_PX);
  }
  if (kind.includes("right")) {
    next.right = clamp(p.x, next.left + MIN_CROP_SIZE_PX, pageW);
  }
  if (kind.includes("top")) {
    next.top = clamp(p.y, 0, next.bottom - MIN_CROP_SIZE_PX);
  }
  if (kind.includes("bottom")) {
    next.bottom = clamp(p.y, next.top + MIN_CROP_SIZE_PX, pageH);
  }
  return next;
}

function viewRectToCrop(
  rect: CropViewRect,
  pageW: number,
  pageH: number,
  scale: number,
): Partial<CropSettings> {
  return {
    left: Math.round(rect.left / scale),
    top: Math.round(rect.top / scale),
    right: Math.round((pageW - rect.right) / scale),
    bottom: Math.round((pageH - rect.bottom) / scale),
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
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

  const base: CSSProperties = {
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
): CSSProperties {
  const [v, h] = pn.position.split("-") as [
    "top" | "bottom",
    "left" | "center" | "right",
  ];
  const margin = pn.margin * px.scale;
  const style: CSSProperties = { fontSize: pn.fontSize * px.scale };

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

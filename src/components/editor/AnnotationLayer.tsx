"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Rect, Text, Line, Image as KImage, Transformer } from "react-konva";
import type Konva from "konva";
import type { Annotation } from "@/types";
import { useEditorStore } from "@/lib/store/editor-store";
import { nextId } from "@/lib/utils";
import {
  pdfToView,
  viewToPdf,
  pdfRectToView,
  viewRectToPdf,
  mapFlatPoints,
} from "@/lib/pdf/coords";

interface Props {
  pageId: string;
  /** Unrotated page size in PDF points. */
  pageSize: { width: number; height: number };
  scale: number;
}

/** A rectangle being dragged out for the rect / highlight tools. */
interface DragRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Konva overlay for one page. Renders in view space (top-left, y-down) but
 * persists every annotation in PDF points (bottom-left, y-up), so geometry is
 * zoom-independent and rotates with the page on export. Browser-only — mounted
 * via next/dynamic({ ssr: false }).
 */
export default function AnnotationLayer({ pageId, pageSize, scale }: Props) {
  const annotations = useEditorStore((s) => s.annotations);
  const activeTool = useEditorStore((s) => s.activeTool);
  const color = useEditorStore((s) => s.color);
  const selectedAnnotationId = useEditorStore((s) => s.selectedAnnotationId);
  const addAnnotation = useEditorStore((s) => s.addAnnotation);
  const updateAnnotation = useEditorStore((s) => s.updateAnnotation);
  const selectAnnotation = useEditorStore((s) => s.selectAnnotation);
  const setTool = useEditorStore((s) => s.setTool);

  const pageH = pageSize.height;
  const width = pageSize.width * scale;
  const height = pageSize.height * scale;

  const pageAnnotations = useMemo(
    () => annotations.filter((a) => a.pageId === pageId),
    [annotations, pageId],
  );

  // In-progress drawing state (view space).
  const [dragRect, setDragRect] = useState<DragRect | null>(null);
  const [freePoints, setFreePoints] = useState<number[] | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);

  const isSelect = activeTool === "select";

  function pointer(stage: Konva.Stage | null): { x: number; y: number } | null {
    return stage?.getPointerPosition() ?? null;
  }

  function onStageMouseDown(e: Konva.KonvaEventObject<MouseEvent>) {
    const stage = e.target.getStage();
    const clickedEmpty = e.target === stage;

    if (isSelect) {
      if (clickedEmpty) selectAnnotation(null);
      return;
    }
    const p = pointer(stage);
    if (!p) return;

    if (activeTool === "text") {
      const value = window.prompt("Text");
      if (value) {
        const pdf = viewToPdf(p, scale, pageH);
        addAnnotation({
          id: nextId("ann"),
          pageId,
          kind: "text",
          x: pdf.x,
          y: pdf.y,
          text: value,
          fontSize: 16,
          color,
        });
      }
      setTool("select");
      return;
    }

    if (activeTool === "rect" || activeTool === "highlight") {
      origin.current = p;
      setDragRect({ x: p.x, y: p.y, w: 0, h: 0 });
      return;
    }

    if (activeTool === "draw") {
      origin.current = p;
      setFreePoints([p.x, p.y]);
    }
  }

  function onStageMouseMove(e: Konva.KonvaEventObject<MouseEvent>) {
    const p = pointer(e.target.getStage());
    if (!p || !origin.current) return;

    if (dragRect) {
      const o = origin.current;
      setDragRect({
        x: Math.min(o.x, p.x),
        y: Math.min(o.y, p.y),
        w: Math.abs(p.x - o.x),
        h: Math.abs(p.y - o.y),
      });
    } else if (freePoints) {
      setFreePoints((pts) => (pts ? [...pts, p.x, p.y] : [p.x, p.y]));
    }
  }

  function onStageMouseUp() {
    if (dragRect && (dragRect.w > 3 || dragRect.h > 3)) {
      const r = viewRectToPdf(dragRect, scale, pageH);
      if (activeTool === "highlight") {
        addAnnotation({
          id: nextId("ann"),
          pageId,
          kind: "highlight",
          ...r,
          color,
          opacity: 0.4,
        });
      } else {
        addAnnotation({
          id: nextId("ann"),
          pageId,
          kind: "rect",
          ...r,
          color,
          strokeWidth: 2,
        });
      }
      setTool("select");
    }

    if (freePoints && freePoints.length >= 4) {
      const pdfPts = mapFlatPoints(freePoints, (pt) => viewToPdf(pt, scale, pageH));
      addAnnotation({
        id: nextId("ann"),
        pageId,
        kind: "draw",
        points: pdfPts,
        color,
        strokeWidth: 2,
      });
      setTool("select");
    }

    origin.current = null;
    setDragRect(null);
    setFreePoints(null);
  }

  return (
    <Stage
      width={width}
      height={height}
      onMouseDown={onStageMouseDown}
      onMouseMove={onStageMouseMove}
      onMouseUp={onStageMouseUp}
      style={{ cursor: isSelect ? "default" : "crosshair" }}
    >
      <Layer>
        {pageAnnotations.map((a) => (
          <AnnotationNode
            key={a.id}
            annotation={a}
            scale={scale}
            pageH={pageH}
            selectable={isSelect}
            selected={a.id === selectedAnnotationId}
            onSelect={() => selectAnnotation(a.id)}
            onChange={(patch) => updateAnnotation(a.id, patch)}
          />
        ))}

        {dragRect && (
          <Rect
            x={dragRect.x}
            y={dragRect.y}
            width={dragRect.w}
            height={dragRect.h}
            stroke={color}
            strokeWidth={2}
            fill={activeTool === "highlight" ? color : undefined}
            opacity={activeTool === "highlight" ? 0.4 : 1}
            listening={false}
          />
        )}

        {freePoints && (
          <Line
            points={freePoints}
            stroke={color}
            strokeWidth={2}
            lineCap="round"
            lineJoin="round"
            listening={false}
          />
        )}
      </Layer>
    </Stage>
  );
}

// --- Per-annotation node ---------------------------------------------------

interface NodeProps {
  annotation: Annotation;
  scale: number;
  pageH: number;
  selectable: boolean;
  selected: boolean;
  onSelect: () => void;
  onChange: (patch: Partial<Annotation>) => void;
}

function AnnotationNode({
  annotation: a,
  scale,
  pageH,
  selectable,
  selected,
  onSelect,
  onChange,
}: NodeProps) {
  const shapeRef = useRef<Konva.Node>(null);
  const trRef = useRef<Konva.Transformer>(null);

  const resizable = a.kind === "rect" || a.kind === "highlight" || a.kind === "image";

  // Attach the Transformer to the selected, resizable node.
  useEffect(() => {
    if (selected && resizable && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [selected, resizable]);

  const common = {
    draggable: selectable,
    onMouseDown: onSelect,
    onTap: onSelect,
  };

  if (a.kind === "text") {
    const v = pdfToView({ x: a.x, y: a.y }, scale, pageH);
    return (
      <Text
        ref={shapeRef as React.Ref<Konva.Text>}
        {...common}
        x={v.x}
        y={v.y}
        text={a.text}
        fontSize={a.fontSize * scale}
        fill={a.color}
        onDblClick={() => {
          const value = window.prompt("Text", a.text);
          if (value != null) onChange({ text: value } as Partial<Annotation>);
        }}
        onDragEnd={(e) => {
          const pdf = viewToPdf({ x: e.target.x(), y: e.target.y() }, scale, pageH);
          onChange({ x: pdf.x, y: pdf.y } as Partial<Annotation>);
        }}
      />
    );
  }

  if (a.kind === "draw") {
    const pts = mapFlatPoints(a.points, (p) => pdfToView(p, scale, pageH));
    return (
      <Line
        ref={shapeRef as React.Ref<Konva.Line>}
        {...common}
        points={pts}
        stroke={a.color}
        strokeWidth={a.strokeWidth * scale}
        lineCap="round"
        lineJoin="round"
        hitStrokeWidth={12}
        onDragEnd={(e) => {
          // Fold the drag offset back into each point, then reset the node.
          const dx = e.target.x();
          const dy = e.target.y();
          e.target.position({ x: 0, y: 0 });
          const moved = mapFlatPoints(a.points, (p) => {
            const view = pdfToView(p, scale, pageH);
            return viewToPdf({ x: view.x + dx, y: view.y + dy }, scale, pageH);
          });
          onChange({ points: moved } as Partial<Annotation>);
        }}
      />
    );
  }

  if (a.kind === "image") {
    return (
      <ImageNode
        a={a}
        scale={scale}
        pageH={pageH}
        common={common}
        shapeRef={shapeRef as React.Ref<Konva.Image>}
        trRef={trRef}
        selected={selected}
        onChange={onChange}
      />
    );
  }

  // rect | highlight
  const r = pdfRectToView({ x: a.x, y: a.y, w: a.w, h: a.h }, scale, pageH);
  const isHighlight = a.kind === "highlight";
  return (
    <>
      <Rect
        ref={shapeRef as React.Ref<Konva.Rect>}
        {...common}
        x={r.x}
        y={r.y}
        width={r.w}
        height={r.h}
        stroke={isHighlight ? undefined : a.color}
        strokeWidth={isHighlight ? 0 : a.strokeWidth * scale}
        fill={isHighlight ? a.color : undefined}
        opacity={isHighlight ? a.opacity : 1}
        onDragEnd={(e) => commitRect(e.target as Konva.Rect)}
        onTransformEnd={(e) => commitRect(e.target as Konva.Rect)}
      />
      {selected && selectable && (
        <Transformer ref={trRef} rotateEnabled={false} ignoreStroke />
      )}
    </>
  );

  function commitRect(node: Konva.Rect) {
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    const view = {
      x: node.x(),
      y: node.y(),
      w: Math.max(4, node.width() * scaleX),
      h: Math.max(4, node.height() * scaleY),
    };
    node.scaleX(1);
    node.scaleY(1);
    onChange(viewRectToPdf(view, scale, pageH) as Partial<Annotation>);
  }
}

// --- Image node (needs an async-loaded HTMLImageElement) -------------------

function ImageNode({
  a,
  scale,
  pageH,
  common,
  shapeRef,
  trRef,
  selected,
  onChange,
}: {
  a: Extract<Annotation, { kind: "image" }>;
  scale: number;
  pageH: number;
  common: object;
  shapeRef: React.Ref<Konva.Image>;
  trRef: React.RefObject<Konva.Transformer | null>;
  selected: boolean;
  onChange: (patch: Partial<Annotation>) => void;
}) {
  const img = useHtmlImage(a.dataUrl);
  const r = pdfRectToView({ x: a.x, y: a.y, w: a.w, h: a.h }, scale, pageH);
  if (!img) return null;

  return (
    <>
      <KImage
        ref={shapeRef}
        {...common}
        image={img}
        x={r.x}
        y={r.y}
        width={r.w}
        height={r.h}
        onDragEnd={(e) => commit(e.target as Konva.Image)}
        onTransformEnd={(e) => commit(e.target as Konva.Image)}
      />
      {selected && (
        <Transformer ref={trRef} rotateEnabled={false} keepRatio />
      )}
    </>
  );

  function commit(node: Konva.Image) {
    const view = {
      x: node.x(),
      y: node.y(),
      w: Math.max(4, node.width() * node.scaleX()),
      h: Math.max(4, node.height() * node.scaleY()),
    };
    node.scaleX(1);
    node.scaleY(1);
    onChange(viewRectToPdf(view, scale, pageH) as Partial<Annotation>);
  }
}

/** Load a data URL into an HTMLImageElement (browser-only). */
function useHtmlImage(src: string): HTMLImageElement | null {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    const image = new window.Image();
    image.src = src;
    image.onload = () => setImg(image);
    return () => {
      image.onload = null;
    };
  }, [src]);
  return img;
}

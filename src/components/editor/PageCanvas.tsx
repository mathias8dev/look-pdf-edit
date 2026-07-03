"use client";

import { useEffect, useRef } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { renderPage } from "@/lib/pdf/pdfjs";
import type { Rotation } from "@/types";
import { cn } from "@/lib/utils";

interface Props {
  doc: PDFDocumentProxy;
  pageNumber: number; // 1-based
  rotation: Rotation;
  scale: number;
  className?: string;
}

/** Renders a single PDF page to a canvas, re-rendering on rotation/scale change. */
export default function PageCanvas({ doc, pageNumber, rotation, scale, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return;

    renderPage(doc, pageNumber, canvas, { scale, rotation }).catch((err) => {
      if (!cancelled) console.error("render failed", err);
    });

    return () => {
      cancelled = true;
    };
  }, [doc, pageNumber, rotation, scale]);

  return <canvas ref={canvasRef} className={cn("block", className)} />;
}

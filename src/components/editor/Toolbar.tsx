"use client";

import { useState } from "react";
import {
  Download,
  FilePlus2,
  Loader2,
  MousePointer2,
  Type,
  Highlighter,
  Square,
  PenTool,
  Signature,
  Trash2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useEditorStore } from "@/lib/store/editor-store";
import { buildEditedPdf, downloadBytes } from "@/lib/pdf/export";
import type { ToolId } from "@/types";
import { cn } from "@/lib/utils";

const TOOLS: { id: ToolId; label: string; Icon: typeof Type }[] = [
  { id: "select", label: "Select", Icon: MousePointer2 },
  { id: "text", label: "Text", Icon: Type },
  { id: "highlight", label: "Highlight", Icon: Highlighter },
  { id: "draw", label: "Draw", Icon: PenTool },
  { id: "rect", label: "Rectangle", Icon: Square },
  { id: "signature", label: "Signature", Icon: Signature },
];

export default function Toolbar() {
  const fileName = useEditorStore((s) => s.fileName);
  const originalBytes = useEditorStore((s) => s.originalBytes);
  const pages = useEditorStore((s) => s.pages);
  const annotations = useEditorStore((s) => s.annotations);
  const activeTool = useEditorStore((s) => s.activeTool);
  const color = useEditorStore((s) => s.color);
  const scale = useEditorStore((s) => s.scale);
  const selectedAnnotationId = useEditorStore((s) => s.selectedAnnotationId);
  const setTool = useEditorStore((s) => s.setTool);
  const setColor = useEditorStore((s) => s.setColor);
  const setScale = useEditorStore((s) => s.setScale);
  const removeAnnotation = useEditorStore((s) => s.removeAnnotation);
  const reset = useEditorStore((s) => s.reset);

  const [exporting, setExporting] = useState(false);
  const hasDoc = !!fileName && pages.length > 0;
  const outName = fileName ? fileName.replace(/\.pdf$/i, "") + "-edited.pdf" : "edited.pdf";

  async function handleDownload() {
    if (!originalBytes || pages.length === 0) return;
    setExporting(true);
    try {
      const bytes = await buildEditedPdf(originalBytes, pages, annotations);
      downloadBytes(bytes, outName);
    } catch (err) {
      console.error(err);
      alert("Export failed — see console.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-neutral-800 bg-neutral-950 px-4">
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-neutral-100">look-pdf-edit</span>
        {fileName && (
          <span className="max-w-[28ch] truncate text-sm text-neutral-500">{fileName}</span>
        )}
      </div>

      {hasDoc && (
        <div className="flex items-center gap-1">
          {TOOLS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              title={label}
              onClick={() => setTool(id)}
              className={cn(
                "rounded-md p-2 text-neutral-300 transition-colors hover:bg-neutral-800",
                activeTool === id && "bg-blue-600 text-white hover:bg-blue-600",
              )}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}

          <label className="ml-1 flex items-center" title="Colour">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-7 w-7 cursor-pointer rounded border border-neutral-700 bg-transparent"
            />
          </label>

          {selectedAnnotationId && (
            <button
              type="button"
              title="Delete annotation"
              onClick={() => removeAnnotation(selectedAnnotationId)}
              className="rounded-md p-2 text-neutral-300 hover:bg-neutral-800 hover:text-red-400"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}

          <div className="mx-1 h-6 w-px bg-neutral-800" />

          <button
            type="button"
            title="Zoom out"
            onClick={() => setScale(scale - 0.2)}
            className="rounded-md p-2 text-neutral-300 hover:bg-neutral-800"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="w-10 text-center text-xs tabular-nums text-neutral-400">
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            title="Zoom in"
            onClick={() => setScale(scale + 0.2)}
            className="rounded-md p-2 text-neutral-300 hover:bg-neutral-800"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={reset}
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800"
        >
          <FilePlus2 className="h-4 w-4" />
          New
        </button>
        <button
          type="button"
          onClick={handleDownload}
          disabled={exporting || pages.length === 0}
          className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {exporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Download
        </button>
      </div>
    </header>
  );
}

"use client";

import { useRef, useState } from "react";
import {
  Download,
  FilePlus,
  FilePlus2,
  FileDown,
  FileText,
  Scissors,
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
import { buildEditedPdf, downloadBytes, type SourceBytes } from "@/lib/pdf/export";
import { openPdf } from "@/lib/pdf/pdfjs";
import { readFormFields, fillAndFlatten } from "@/lib/pdf/forms";
import type { ToolId } from "@/types";
import { cn } from "@/lib/utils";

interface Props {
  hasForm: boolean;
  formOpen: boolean;
  onToggleForm: () => void;
}

const TOOLS: { id: ToolId; label: string; Icon: typeof Type }[] = [
  { id: "select", label: "Select", Icon: MousePointer2 },
  { id: "text", label: "Text", Icon: Type },
  { id: "highlight", label: "Highlight", Icon: Highlighter },
  { id: "draw", label: "Draw", Icon: PenTool },
  { id: "rect", label: "Rectangle", Icon: Square },
  { id: "signature", label: "Signature", Icon: Signature },
];

export default function Toolbar({ hasForm, formOpen, onToggleForm }: Props) {
  const docs = useEditorStore((s) => s.docs);
  const pages = useEditorStore((s) => s.pages);
  const annotations = useEditorStore((s) => s.annotations);
  const forms = useEditorStore((s) => s.forms);
  const activeTool = useEditorStore((s) => s.activeTool);
  const color = useEditorStore((s) => s.color);
  const scale = useEditorStore((s) => s.scale);
  const selectedId = useEditorStore((s) => s.selectedId);
  const selectedAnnotationId = useEditorStore((s) => s.selectedAnnotationId);
  const setTool = useEditorStore((s) => s.setTool);
  const setColor = useEditorStore((s) => s.setColor);
  const setScale = useEditorStore((s) => s.setScale);
  const removeAnnotation = useEditorStore((s) => s.removeAnnotation);
  const addDocument = useEditorStore((s) => s.addDocument);
  const reset = useEditorStore((s) => s.reset);

  const [exporting, setExporting] = useState(false);
  const addInputRef = useRef<HTMLInputElement>(null);

  const hasDoc = pages.length > 0;
  const baseName = docs[0]?.fileName.replace(/\.pdf$/i, "") ?? "document";
  const title = docs.length === 1 ? docs[0].fileName : `${docs.length} PDFs`;

  const selectedIndex = pages.findIndex((p) => p.id === selectedId);
  const canSplit = selectedIndex > 0; // both halves non-empty

  // Prepare each source's bytes for export: form documents are filled with the
  // edited values and flattened so they survive the copyPages assembly.
  async function buildSources(): Promise<SourceBytes> {
    const entries = await Promise.all(
      docs.map(async (d) => {
        const bytes =
          d.formFields.length > 0
            ? await fillAndFlatten(d.bytes, forms[d.id] ?? {})
            : d.bytes;
        return [d.id, bytes] as const;
      }),
    );
    return Object.fromEntries(entries);
  }

  async function exportPages(pageSubset: typeof pages, name: string) {
    setExporting(true);
    try {
      const bytes = await buildEditedPdf(await buildSources(), pageSubset, annotations);
      downloadBytes(bytes, name);
    } catch (err) {
      console.error(err);
      alert("Export failed — see console.");
    } finally {
      setExporting(false);
    }
  }

  async function handleAddPdf(file: File) {
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const doc = await openPdf(bytes);
      const fields = await readFormFields(bytes);
      addDocument(file.name, bytes, doc, fields);
    } catch (err) {
      console.error(err);
      alert("Could not open that PDF — see console.");
    }
  }

  function handleSplit() {
    if (selectedIndex <= 0) return;
    const part1 = pages.slice(0, selectedIndex);
    const part2 = pages.slice(selectedIndex);
    exportPages(part1, `${baseName}-part1.pdf`).then(() =>
      exportPages(part2, `${baseName}-part2.pdf`),
    );
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-neutral-800 bg-neutral-950 px-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className="text-sm font-semibold text-neutral-100">look-pdf-edit</span>
        {hasDoc && (
          <span className="max-w-[24ch] truncate text-sm text-neutral-500">{title}</span>
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
        {hasDoc && (
          <>
            <input
              ref={addInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleAddPdf(file);
                e.target.value = "";
              }}
            />
            <IconAction title="Add PDF (merge)" onClick={() => addInputRef.current?.click()}>
              <FilePlus className="h-4 w-4" />
            </IconAction>
            <IconAction
              title="Extract current page"
              disabled={selectedIndex < 0}
              onClick={() =>
                exportPages([pages[selectedIndex]], `${baseName}-page-${selectedIndex + 1}.pdf`)
              }
            >
              <FileDown className="h-4 w-4" />
            </IconAction>
            <IconAction
              title="Split before current page"
              disabled={!canSplit}
              onClick={handleSplit}
            >
              <Scissors className="h-4 w-4" />
            </IconAction>
            {hasForm && (
              <button
                type="button"
                title="Fill form fields"
                onClick={onToggleForm}
                className={cn(
                  "rounded-md p-2 text-neutral-300 transition-colors hover:bg-neutral-800",
                  formOpen && "bg-blue-600 text-white hover:bg-blue-600",
                )}
              >
                <FileText className="h-4 w-4" />
              </button>
            )}
            <div className="mx-1 h-6 w-px bg-neutral-800" />
          </>
        )}

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
          onClick={() => exportPages(pages, `${baseName}-edited.pdf`)}
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

function IconAction({
  children,
  onClick,
  title,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="rounded-md p-2 text-neutral-300 transition-colors hover:bg-neutral-800 disabled:opacity-40 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

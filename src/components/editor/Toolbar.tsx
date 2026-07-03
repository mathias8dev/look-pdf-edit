"use client";

import { useRef, useState } from "react";
import {
  Download,
  FilePlus,
  FilePlus2,
  FileDown,
  FileText,
  Layers,
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
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

interface Props {
  hasForm: boolean;
  formOpen: boolean;
  onToggleForm: () => void;
  objectsOpen: boolean;
  onToggleObjects: () => void;
}

const TOOLS: { id: ToolId; label: string; Icon: typeof Type }[] = [
  { id: "select", label: "Select", Icon: MousePointer2 },
  { id: "text", label: "Text", Icon: Type },
  { id: "highlight", label: "Highlight", Icon: Highlighter },
  { id: "draw", label: "Draw", Icon: PenTool },
  { id: "rect", label: "Rectangle", Icon: Square },
  { id: "signature", label: "Signature", Icon: Signature },
];

export default function Toolbar({
  hasForm,
  formOpen,
  onToggleForm,
  objectsOpen,
  onToggleObjects,
}: Props) {
  const docs = useEditorStore((s) => s.docs);
  const pages = useEditorStore((s) => s.pages);
  const annotations = useEditorStore((s) => s.annotations);
  const forms = useEditorStore((s) => s.forms);
  const activeTool = useEditorStore((s) => s.activeTool);
  const color = useEditorStore((s) => s.color);
  const scale = useEditorStore((s) => s.scale);
  const selectedId = useEditorStore((s) => s.selectedId);
  const selectedAnnotationIds = useEditorStore((s) => s.selectedAnnotationIds);
  const setTool = useEditorStore((s) => s.setTool);
  const setColor = useEditorStore((s) => s.setColor);
  const setScale = useEditorStore((s) => s.setScale);
  const removeAnnotations = useEditorStore((s) => s.removeAnnotations);
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
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-card px-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className="text-sm font-semibold">look-pdf-edit</span>
        {hasDoc && (
          <span className="max-w-[24ch] truncate text-sm text-muted-foreground">{title}</span>
        )}
      </div>

      {hasDoc && (
        <div className="flex items-center gap-1">
          {TOOLS.map(({ id, label, Icon }) => (
            <TipButton
              key={id}
              label={label}
              active={activeTool === id}
              onClick={() => setTool(id)}
            >
              <Icon className="size-4" />
            </TipButton>
          ))}

          <label className="ml-1 flex items-center" title="Colour">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="size-7 cursor-pointer rounded border border-input bg-transparent"
            />
          </label>

          {selectedAnnotationIds.length > 0 && (
            <TipButton
              label={
                selectedAnnotationIds.length > 1
                  ? `Delete ${selectedAnnotationIds.length} objects`
                  : "Delete object"
              }
              onClick={() => removeAnnotations(selectedAnnotationIds)}
            >
              <Trash2 className="size-4" />
            </TipButton>
          )}

          <div className="mx-1 h-6 w-px bg-border" />

          <TipButton label="Zoom out" onClick={() => setScale(scale - 0.2)}>
            <ZoomOut className="size-4" />
          </TipButton>
          <span className="w-10 text-center text-xs tabular-nums text-muted-foreground">
            {Math.round(scale * 100)}%
          </span>
          <TipButton label="Zoom in" onClick={() => setScale(scale + 0.2)}>
            <ZoomIn className="size-4" />
          </TipButton>
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
            <TipButton label="Add PDF (merge)" onClick={() => addInputRef.current?.click()}>
              <FilePlus className="size-4" />
            </TipButton>
            <TipButton
              label="Extract current page"
              disabled={selectedIndex < 0}
              onClick={() =>
                exportPages([pages[selectedIndex]], `${baseName}-page-${selectedIndex + 1}.pdf`)
              }
            >
              <FileDown className="size-4" />
            </TipButton>
            <TipButton label="Split before current page" disabled={!canSplit} onClick={handleSplit}>
              <Scissors className="size-4" />
            </TipButton>
            <TipButton label="Objects" active={objectsOpen} onClick={onToggleObjects}>
              <Layers className="size-4" />
            </TipButton>
            {hasForm && (
              <TipButton label="Fill form fields" active={formOpen} onClick={onToggleForm}>
                <FileText className="size-4" />
              </TipButton>
            )}
            <div className="mx-1 h-6 w-px bg-border" />
          </>
        )}

        <Button variant="ghost" onClick={reset}>
          <FilePlus2 className="size-4" />
          New
        </Button>
        <Button
          onClick={() => exportPages(pages, `${baseName}-edited.pdf`)}
          disabled={exporting || pages.length === 0}
        >
          {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          Download
        </Button>
      </div>
    </header>
  );
}

function TipButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={active ? "default" : "ghost"}
          size="icon"
          disabled={disabled}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

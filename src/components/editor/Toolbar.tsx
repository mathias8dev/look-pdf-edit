"use client";

import { useState } from "react";
import { Download, FilePlus2, Loader2 } from "lucide-react";
import { useEditorStore } from "@/lib/store/editor-store";
import { buildEditedPdf, downloadBytes } from "@/lib/pdf/export";

export default function Toolbar() {
  const fileName = useEditorStore((s) => s.fileName);
  const originalBytes = useEditorStore((s) => s.originalBytes);
  const pages = useEditorStore((s) => s.pages);
  const reset = useEditorStore((s) => s.reset);
  const [exporting, setExporting] = useState(false);

  const outName = fileName ? fileName.replace(/\.pdf$/i, "") + "-edited.pdf" : "edited.pdf";

  async function handleDownload() {
    if (!originalBytes || pages.length === 0) return;
    setExporting(true);
    try {
      const bytes = await buildEditedPdf(originalBytes, pages);
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
          <span className="max-w-[40ch] truncate text-sm text-neutral-500">
            {fileName}
          </span>
        )}
      </div>
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

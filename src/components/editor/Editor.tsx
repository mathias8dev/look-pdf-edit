"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { RotateCw } from "lucide-react";
import { openPdf, getPageSize } from "@/lib/pdf/pdfjs";
import { readFormFields } from "@/lib/pdf/forms";
import { useEditorStore } from "@/lib/store/editor-store";
import Uploader from "./Uploader";
import Toolbar from "./Toolbar";
import Thumbnails from "./Thumbnails";
import PageCanvas from "./PageCanvas";
import SignatureDialog from "./SignatureDialog";
import FormPanel from "./FormPanel";
import { TooltipProvider } from "@/components/ui/tooltip";

// Konva is browser-only (touches window/canvas at module load), so the overlay
// must never render on the server. See lazy-loading.md: ssr:false requires a
// Client Component — Editor is one.
const AnnotationLayer = dynamic(() => import("./AnnotationLayer"), { ssr: false });

interface PageSize {
  width: number;
  height: number;
}

export default function Editor() {
  const [loading, setLoading] = useState(false);
  const [pageSize, setPageSize] = useState<PageSize | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const docs = useEditorStore((s) => s.docs);
  const pages = useEditorStore((s) => s.pages);
  const selectedId = useEditorStore((s) => s.selectedId);
  const scale = useEditorStore((s) => s.scale);
  const activeTool = useEditorStore((s) => s.activeTool);
  const setTool = useEditorStore((s) => s.setTool);
  const loadDocument = useEditorStore((s) => s.loadDocument);

  const selected = pages.find((p) => p.id === selectedId);
  // The source document the selected page belongs to (assembly can mix docs).
  const selectedSource = selected
    ? docs.find((d) => d.id === selected.docId)
    : undefined;
  const selectedDoc = selectedSource?.pdfDoc ?? null;
  const selectedSrc = selected?.srcIndex;
  const formFields = selectedSource?.formFields ?? [];

  // Fetch the selected page's intrinsic (unrotated) size in PDF points.
  useEffect(() => {
    let cancelled = false;
    if (!selectedDoc || selectedSrc == null) return;
    getPageSize(selectedDoc, selectedSrc + 1).then((size) => {
      if (!cancelled) setPageSize(size);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedDoc, selectedSrc]);

  async function handleFile(file: File) {
    setLoading(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const pdfDoc = await openPdf(bytes);
      const fields = await readFormFields(bytes);
      loadDocument(file.name, bytes, pdfDoc, fields);
    } catch (err) {
      console.error(err);
      alert("Could not open that PDF — see console.");
    } finally {
      setLoading(false);
    }
  }

  const hasDoc = docs.length > 0;
  const showSignature = activeTool === "signature" && !!selected && !!pageSize;
  const showForm = formOpen && formFields.length > 0 && !!selectedSource;

  return (
    <TooltipProvider>
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <Toolbar
        hasForm={formFields.length > 0}
        formOpen={formOpen}
        onToggleForm={() => setFormOpen((o) => !o)}
      />
      <div className="flex min-h-0 flex-1">
        {hasDoc && <Thumbnails />}
        <main className="min-h-0 flex-1 overflow-auto">
          {loading ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              Opening PDF…
            </div>
          ) : hasDoc && selectedDoc && selected && pageSize ? (
            <div className="flex min-h-full justify-center bg-muted p-8">
              <div className="relative">
                {selected.rotation !== 0 && (
                  <div className="absolute -top-6 right-0 flex items-center gap-1 text-xs text-muted-foreground">
                    <RotateCw className="h-3 w-3" />
                    Rotated {selected.rotation}° — applied on export
                  </div>
                )}
                <div
                  className="relative shadow-2xl ring-1 ring-black/40"
                  style={{ width: pageSize.width * scale, height: pageSize.height * scale }}
                >
                  {/* Main view renders UNROTATED so annotation coordinates align
                      with the overlay; page rotation is baked in on export. */}
                  <PageCanvas
                    doc={selectedDoc}
                    pageNumber={selected.srcIndex + 1}
                    rotation={0}
                    scale={scale}
                  />
                  <div className="absolute inset-0">
                    <AnnotationLayer
                      pageId={selected.id}
                      pageSize={pageSize}
                      scale={scale}
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <Uploader onFile={handleFile} />
          )}
        </main>
        {showForm && selectedSource && (
          <FormPanel
            docId={selectedSource.id}
            fields={formFields}
            onClose={() => setFormOpen(false)}
          />
        )}
      </div>

      {showSignature && selected && pageSize && (
        <SignatureDialog
          pageId={selected.id}
          pageSize={pageSize}
          onClose={() => setTool("select")}
        />
      )}
    </div>
    </TooltipProvider>
  );
}

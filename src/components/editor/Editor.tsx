"use client";

import { useEffect, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { openPdf } from "@/lib/pdf/pdfjs";
import { useEditorStore } from "@/lib/store/editor-store";
import Uploader from "./Uploader";
import Toolbar from "./Toolbar";
import Thumbnails from "./Thumbnails";
import PageCanvas from "./PageCanvas";

export default function Editor() {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [loading, setLoading] = useState(false);

  const fileName = useEditorStore((s) => s.fileName);
  const pages = useEditorStore((s) => s.pages);
  const selectedId = useEditorStore((s) => s.selectedId);
  const loadDocument = useEditorStore((s) => s.loadDocument);

  // When the store is reset (New button), drop the local pdf.js document too.
  useEffect(() => {
    if (!fileName && doc) setDoc(null);
  }, [fileName, doc]);

  async function handleFile(file: File) {
    setLoading(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const pdfDoc = await openPdf(bytes);
      setDoc(pdfDoc);
      loadDocument(file.name, bytes, pdfDoc.numPages);
    } catch (err) {
      console.error(err);
      alert("Could not open that PDF — see console.");
    } finally {
      setLoading(false);
    }
  }

  const hasDoc = !!fileName && !!doc;
  const selected = pages.find((p) => p.id === selectedId);

  return (
    <div className="flex h-dvh flex-col bg-neutral-900 text-neutral-100">
      <Toolbar />
      <div className="flex min-h-0 flex-1">
        {hasDoc && doc && <Thumbnails doc={doc} />}
        <main className="min-h-0 flex-1 overflow-auto">
          {loading ? (
            <div className="flex h-full items-center justify-center text-neutral-500">
              Opening PDF…
            </div>
          ) : hasDoc && doc && selected ? (
            <div className="flex min-h-full justify-center bg-neutral-800 p-8">
              <div className="shadow-2xl ring-1 ring-black/40">
                <PageCanvas
                  doc={doc}
                  pageNumber={selected.srcIndex + 1}
                  rotation={selected.rotation}
                  scale={1.4}
                />
              </div>
            </div>
          ) : (
            <Uploader onFile={handleFile} />
          )}
        </main>
      </div>
    </div>
  );
}

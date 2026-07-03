"use client";

import { useMemo } from "react";
import { ChevronUp, ChevronDown, RotateCw, Trash2 } from "lucide-react";
import PageCanvas from "./PageCanvas";
import { useEditorStore } from "@/lib/store/editor-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// Distinct badge colours to mark which source document a page came from.
const DOC_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-fuchsia-500",
  "bg-rose-500",
  "bg-cyan-500",
];

/** Left sidebar: page thumbnails with reorder / rotate / delete controls. */
export default function Thumbnails() {
  const docs = useEditorStore((s) => s.docs);
  const pages = useEditorStore((s) => s.pages);
  const selectedId = useEditorStore((s) => s.selectedId);
  const select = useEditorStore((s) => s.select);
  const rotatePage = useEditorStore((s) => s.rotatePage);
  const deletePage = useEditorStore((s) => s.deletePage);
  const movePage = useEditorStore((s) => s.movePage);

  // Look up each doc's pdf.js instance and stable colour index by docId.
  const docMap = useMemo(() => {
    const map = new Map<string, { pdfDoc: (typeof docs)[number]["pdfDoc"]; index: number }>();
    docs.forEach((d, i) => map.set(d.id, { pdfDoc: d.pdfDoc, index: i }));
    return map;
  }, [docs]);

  const multiDoc = docs.length > 1;

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-card">
      <div className="border-b border-border px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Pages · {pages.length}
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {pages.map((p, i) => {
          const doc = docMap.get(p.docId);
          return (
            <div
              key={p.id}
              className={cn(
                "group rounded-lg border p-2 transition-colors",
                p.id === selectedId
                  ? "border-primary bg-primary/10"
                  : "border-border bg-background hover:border-muted-foreground/40",
              )}
            >
              <button
                type="button"
                onClick={() => select(p.id)}
                className="relative flex w-full justify-center overflow-hidden rounded bg-muted"
              >
                {doc && (
                  <PageCanvas
                    doc={doc.pdfDoc}
                    pageNumber={p.srcIndex + 1}
                    rotation={p.rotation}
                    scale={0.22}
                  />
                )}
                {multiDoc && doc && (
                  <span
                    title="Source document"
                    className={cn(
                      "absolute left-1 top-1 h-2.5 w-2.5 rounded-full ring-1 ring-black/50",
                      DOC_COLORS[doc.index % DOC_COLORS.length],
                    )}
                  />
                )}
              </button>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{i + 1}</span>
                <div className="flex gap-0.5 opacity-70 group-hover:opacity-100">
                  <IconBtn title="Move up" onClick={() => movePage(p.id, -1)}>
                    <ChevronUp className="size-3.5" />
                  </IconBtn>
                  <IconBtn title="Move down" onClick={() => movePage(p.id, 1)}>
                    <ChevronDown className="size-3.5" />
                  </IconBtn>
                  <IconBtn title="Rotate" onClick={() => rotatePage(p.id, 1)}>
                    <RotateCw className="size-3.5" />
                  </IconBtn>
                  <IconBtn title="Delete" danger onClick={() => deletePage(p.id)}>
                    <Trash2 className="size-3.5" />
                  </IconBtn>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function IconBtn({
  children,
  onClick,
  title,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  danger?: boolean;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      title={title}
      onClick={onClick}
      className={cn("size-7 text-muted-foreground", danger && "hover:text-destructive")}
    >
      {children}
    </Button>
  );
}

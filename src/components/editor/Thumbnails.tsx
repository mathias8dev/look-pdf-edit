"use client";

import type { PDFDocumentProxy } from "pdfjs-dist";
import { ChevronUp, ChevronDown, RotateCw, Trash2 } from "lucide-react";
import PageCanvas from "./PageCanvas";
import { useEditorStore } from "@/lib/store/editor-store";
import { cn } from "@/lib/utils";

interface Props {
  doc: PDFDocumentProxy;
}

/** Left sidebar: page thumbnails with reorder / rotate / delete controls. */
export default function Thumbnails({ doc }: Props) {
  const pages = useEditorStore((s) => s.pages);
  const selectedId = useEditorStore((s) => s.selectedId);
  const select = useEditorStore((s) => s.select);
  const rotatePage = useEditorStore((s) => s.rotatePage);
  const deletePage = useEditorStore((s) => s.deletePage);
  const movePage = useEditorStore((s) => s.movePage);

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-neutral-800 bg-neutral-950">
      <div className="border-b border-neutral-800 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">
        Pages · {pages.length}
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {pages.map((p, i) => (
          <div
            key={p.id}
            className={cn(
              "group rounded-lg border p-2 transition-colors",
              p.id === selectedId
                ? "border-blue-500 bg-blue-500/10"
                : "border-neutral-800 bg-neutral-900 hover:border-neutral-600",
            )}
          >
            <button
              type="button"
              onClick={() => select(p.id)}
              className="flex w-full justify-center overflow-hidden rounded bg-neutral-800"
            >
              <PageCanvas
                doc={doc}
                pageNumber={p.srcIndex + 1}
                rotation={p.rotation}
                scale={0.22}
              />
            </button>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-neutral-500">{i + 1}</span>
              <div className="flex gap-0.5 opacity-70 group-hover:opacity-100">
                <IconBtn title="Move up" onClick={() => movePage(p.id, -1)}>
                  <ChevronUp className="h-3.5 w-3.5" />
                </IconBtn>
                <IconBtn title="Move down" onClick={() => movePage(p.id, 1)}>
                  <ChevronDown className="h-3.5 w-3.5" />
                </IconBtn>
                <IconBtn title="Rotate" onClick={() => rotatePage(p.id, 1)}>
                  <RotateCw className="h-3.5 w-3.5" />
                </IconBtn>
                <IconBtn
                  title="Delete"
                  danger
                  onClick={() => deletePage(p.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </IconBtn>
              </div>
            </div>
          </div>
        ))}
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
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "rounded p-1 text-neutral-400 transition-colors hover:bg-neutral-700",
        danger ? "hover:text-red-400" : "hover:text-neutral-100",
      )}
    >
      {children}
    </button>
  );
}

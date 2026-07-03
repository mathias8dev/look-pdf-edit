"use client";

import { useMemo } from "react";
import {
  Type,
  Highlighter,
  Square,
  PenTool,
  Image as ImageIcon,
  ChevronUp,
  ChevronDown,
  Trash2,
  X,
  Layers,
} from "lucide-react";
import { useEditorStore } from "@/lib/store/editor-store";
import type { Annotation, AnnotationKind } from "@/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  /** Id of the page whose drawn objects are shown. */
  pageId: string;
  onClose: () => void;
}

const KIND_ICON: Record<AnnotationKind, typeof Type> = {
  text: Type,
  highlight: Highlighter,
  rect: Square,
  draw: PenTool,
  image: ImageIcon,
};

function labelFor(a: Annotation): string {
  switch (a.kind) {
    case "text":
      return a.text.trim() || "Text";
    case "highlight":
      return "Highlight";
    case "rect":
      return "Rectangle";
    case "draw":
      return "Freehand";
    case "image":
      return "Image";
  }
}

/**
 * Right-hand "layers" panel: every drawn object on the current page, top-most
 * first. Click to select, reorder z-order, or delete.
 */
export default function ObjectsPanel({ pageId, onClose }: Props) {
  const annotations = useEditorStore((s) => s.annotations);
  const selectedIds = useEditorStore((s) => s.selectedAnnotationIds);
  const selectAnnotation = useEditorStore((s) => s.selectAnnotation);
  const toggleAnnotation = useEditorStore((s) => s.toggleAnnotation);
  const selectAnnotations = useEditorStore((s) => s.selectAnnotations);
  const removeAnnotation = useEditorStore((s) => s.removeAnnotation);
  const reorderAnnotation = useEditorStore((s) => s.reorderAnnotation);
  const setTool = useEditorStore((s) => s.setTool);

  // Top-most object first (last in the array is drawn on top).
  const items = useMemo(
    () => annotations.filter((a) => a.pageId === pageId).reverse(),
    [annotations, pageId],
  );

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const pageSelectedCount = items.filter((a) => selectedSet.has(a.id)).length;
  const allSelected = items.length > 0 && pageSelectedCount === items.length;

  function select(id: string, additive: boolean) {
    setTool("select");
    if (additive) toggleAnnotation(id);
    else selectAnnotation(id);
  }

  function toggleAll() {
    setTool("select");
    if (allSelected) selectAnnotation(null);
    else selectAnnotations(items.map((a) => a.id));
  }

  return (
    <aside className="flex w-64 shrink-0 flex-col border-l border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Layers className="size-3.5" />
          Objects · {items.length}
        </span>
        <Button variant="ghost" size="icon" className="size-7" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>

      {items.length > 0 && (
        <div className="flex items-center justify-between border-b border-border px-3 py-2 text-xs text-muted-foreground">
          <span>
            {pageSelectedCount > 0 ? `${pageSelectedCount} selected` : "None selected"}
          </span>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={toggleAll}>
            {allSelected ? "Deselect all" : "Select all"}
          </Button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-2">
        {items.length === 0 && (
          <p className="px-2 py-3 text-sm text-muted-foreground">
            No objects on this page yet. Use the drawing tools to add some.
          </p>
        )}

        {items.map((a) => {
          const Icon = KIND_ICON[a.kind];
          const selected = selectedSet.has(a.id);
          return (
            <div
              key={a.id}
              className={cn(
                "group flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors",
                selected ? "bg-primary/15" : "hover:bg-accent",
              )}
            >
              <button
                type="button"
                onClick={(e) => select(a.id, e.metaKey || e.ctrlKey || e.shiftKey)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <span
                  className="grid size-6 shrink-0 place-items-center rounded"
                  style={{ color: colorOf(a) }}
                >
                  <Icon className="size-4" />
                </span>
                <span className="truncate text-sm">{labelFor(a)}</span>
              </button>

              <div className="flex shrink-0 items-center opacity-0 group-hover:opacity-100 data-[sel=true]:opacity-100" data-sel={selected}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 text-muted-foreground"
                  title="Bring forward"
                  onClick={() => reorderAnnotation(a.id, 1)}
                >
                  <ChevronUp className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 text-muted-foreground"
                  title="Send backward"
                  onClick={() => reorderAnnotation(a.id, -1)}
                >
                  <ChevronDown className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 text-muted-foreground hover:text-destructive"
                  title="Delete"
                  onClick={() => removeAnnotation(a.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

/** A representative swatch colour for the object's icon. */
function colorOf(a: Annotation): string {
  switch (a.kind) {
    case "text":
    case "rect":
    case "highlight":
    case "draw":
      return a.color;
    case "image":
      return "var(--muted-foreground)";
  }
}

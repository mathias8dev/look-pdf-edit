"use client";

import { Bold, Italic, X } from "lucide-react";
import { useEditorStore } from "@/lib/store/editor-store";
import type { Annotation, FontId, TextAnnotation } from "@/types";
import { FONTS } from "@/lib/fonts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface Props {
  annotation: TextAnnotation;
  onClose: () => void;
}

/** Right-hand panel for editing the selected text object's content and style. */
export default function TextPanel({ annotation: a, onClose }: Props) {
  const updateAnnotation = useEditorStore((s) => s.updateAnnotation);
  const patch = (p: Partial<Annotation>) => updateAnnotation(a.id, p);

  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Text
        </span>
        <Button variant="ghost" size="icon" className="size-7" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div className="space-y-1.5">
          <Label className="text-muted-foreground">Content</Label>
          <textarea
            value={a.text}
            onChange={(e) => patch({ text: e.target.value })}
            rows={3}
            className="w-full resize-y rounded-md border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-muted-foreground">Font</Label>
          <Select
            value={a.fontFamily ?? "helvetica"}
            onValueChange={(v) => patch({ fontFamily: v as FontId })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONTS.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  <span style={{ fontFamily: f.css }}>{f.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-end gap-3">
          <div className="w-24 space-y-1.5">
            <Label className="text-muted-foreground">Size</Label>
            <Input
              type="number"
              min={4}
              max={400}
              value={a.fontSize}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n)) {
                  patch({ fontSize: Math.min(400, Math.max(4, Math.round(n))) });
                }
              }}
            />
          </div>

          <div className="flex items-center gap-1">
            <ToggleButton active={!!a.bold} label="Bold" onClick={() => patch({ bold: !a.bold })}>
              <Bold className="size-4" />
            </ToggleButton>
            <ToggleButton
              active={!!a.italic}
              label="Italic"
              onClick={() => patch({ italic: !a.italic })}
            >
              <Italic className="size-4" />
            </ToggleButton>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-muted-foreground">Colour</Label>
          <input
            type="color"
            value={a.color}
            onChange={(e) => patch({ color: e.target.value })}
            className="h-9 w-full cursor-pointer rounded-md border border-input bg-transparent"
          />
        </div>

        <p
          className="rounded-md border border-border p-3 text-center"
          style={{
            fontFamily: FONTS.find((f) => f.id === (a.fontFamily ?? "helvetica"))?.css,
            fontWeight: a.bold ? 700 : 400,
            fontStyle: a.italic ? "italic" : "normal",
            color: a.color,
          }}
        >
          {a.text || "Preview"}
        </p>
      </div>
    </aside>
  );
}

function ToggleButton({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant={active ? "default" : "outline"}
      size="icon"
      title={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn("size-9")}
    >
      {children}
    </Button>
  );
}

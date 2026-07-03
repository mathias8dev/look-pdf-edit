"use client";

import { Bold, Italic, X } from "lucide-react";
import { useEditorStore } from "@/lib/store/editor-store";
import type { Annotation, AnnotationKind, FontId, TextAnnotation } from "@/types";
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

const KIND_LABEL: Record<AnnotationKind, string> = {
  text: "Text",
  highlight: "Highlight",
  rect: "Rectangle",
  draw: "Freehand",
  image: "Image",
};

interface Props {
  annotation: Annotation;
  onClose: () => void;
}

/** Right-hand panel for editing the selected object's properties. */
export default function PropertiesPanel({ annotation: a, onClose }: Props) {
  const updateAnnotation = useEditorStore((s) => s.updateAnnotation);
  const patch = (p: Partial<Annotation>) => updateAnnotation(a.id, p);

  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {KIND_LABEL[a.kind]}
        </span>
        <Button variant="ghost" size="icon" className="size-7" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {a.kind === "text" && <TextControls a={a} patch={patch} />}

        {(a.kind === "rect" || a.kind === "draw") && (
          <>
            <ColorRow label="Colour" value={a.color} onChange={(c) => patch({ color: c })} />
            <NumberRow
              label="Stroke width"
              value={a.strokeWidth}
              min={0.5}
              max={40}
              step={0.5}
              onChange={(n) => patch({ strokeWidth: n })}
            />
          </>
        )}

        {a.kind === "highlight" && (
          <>
            <ColorRow label="Colour" value={a.color} onChange={(c) => patch({ color: c })} />
            <RangeRow
              label="Opacity"
              value={a.opacity}
              onChange={(n) => patch({ opacity: n })}
            />
          </>
        )}

        {a.kind === "image" && (
          <RangeRow
            label="Opacity"
            value={a.opacity ?? 1}
            onChange={(n) => patch({ opacity: n })}
          />
        )}
      </div>
    </aside>
  );
}

// --- Text-specific controls ------------------------------------------------

function TextControls({
  a,
  patch,
}: {
  a: TextAnnotation;
  patch: (p: Partial<Annotation>) => void;
}) {
  return (
    <>
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

      <ColorRow label="Colour" value={a.color} onChange={(c) => patch({ color: c })} />

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
    </>
  );
}

// --- Shared control rows ---------------------------------------------------

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-muted-foreground">{label}</Label>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full cursor-pointer rounded-md border border-input bg-transparent"
      />
    </div>
  );
}

function NumberRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="w-28 space-y-1.5">
      <Label className="text-muted-foreground">{label}</Label>
      <Input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
        }}
      />
    </div>
  );
}

function RangeRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-muted-foreground">{label}</Label>
        <span className="text-xs tabular-nums text-muted-foreground">
          {Math.round(value * 100)}%
        </span>
      </div>
      <input
        type="range"
        min={0.05}
        max={1}
        step={0.05}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary"
      />
    </div>
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

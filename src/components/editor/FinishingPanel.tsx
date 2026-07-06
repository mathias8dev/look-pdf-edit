"use client";

import { X } from "lucide-react";
import { useEditorStore } from "@/lib/store/editor-store";
import type {
  FinishingScope,
  PageNumberFormat,
  PageNumberPosition,
  WatermarkPosition,
} from "@/lib/finishing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const FORMATS: { value: PageNumberFormat; label: string }[] = [
  { value: "n", label: "1" },
  { value: "n-of-N", label: "1 / N" },
  { value: "page-n", label: "Page 1" },
  { value: "page-n-of-N", label: "Page 1 of N" },
];

const POSITIONS: { value: PageNumberPosition; label: string }[] = [
  { value: "top-left", label: "Top left" },
  { value: "top-center", label: "Top center" },
  { value: "top-right", label: "Top right" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "bottom-center", label: "Bottom center" },
  { value: "bottom-right", label: "Bottom right" },
];

const WM_POSITIONS: { value: WatermarkPosition; label: string }[] = [
  { value: "top-left", label: "Top left" },
  { value: "top-center", label: "Top center" },
  { value: "top-right", label: "Top right" },
  { value: "middle-left", label: "Middle left" },
  { value: "center", label: "Center" },
  { value: "middle-right", label: "Middle right" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "bottom-center", label: "Bottom center" },
  { value: "bottom-right", label: "Bottom right" },
];

const SCOPES: { value: FinishingScope; label: string }[] = [
  { value: "current", label: "Current page" },
  { value: "all", label: "All pages" },
];

interface Props {
  onClose: () => void;
}

/** Right-hand panel for document-wide finishing applied on export. */
export default function FinishingPanel({ onClose }: Props) {
  const { pageNumbers, watermark, crop } = useEditorStore((s) => s.finishing);
  const selectedId = useEditorStore((s) => s.selectedId);
  const setPageNumbers = useEditorStore((s) => s.setPageNumbers);
  const setWatermark = useEditorStore((s) => s.setWatermark);
  const setCrop = useEditorStore((s) => s.setCrop);

  const targetFor = (scope: FinishingScope) =>
    scope === "current" ? selectedId ?? undefined : undefined;

  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Finishing
        </span>
        <Button variant="ghost" size="icon" className="size-7" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        {/* Page numbers */}
        <Section
          title="Page numbers"
          enabled={pageNumbers.enabled}
          onToggle={(v) => setPageNumbers({ enabled: v })}
        >
          <Field label="Format">
            <Select
              value={pageNumbers.format}
              onValueChange={(v) => setPageNumbers({ format: v as PageNumberFormat })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FORMATS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Position">
            <Select
              value={pageNumbers.position}
              onValueChange={(v) => setPageNumbers({ position: v as PageNumberPosition })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {POSITIONS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Size">
              <Num value={pageNumbers.fontSize} min={6} max={72} onChange={(n) => setPageNumbers({ fontSize: n })} />
            </Field>
            <Field label="Margin">
              <Num value={pageNumbers.margin} min={0} max={200} onChange={(n) => setPageNumbers({ margin: n })} />
            </Field>
            <Field label="Start">
              <Num value={pageNumbers.start} min={0} max={9999} onChange={(n) => setPageNumbers({ start: n })} />
            </Field>
          </div>
        </Section>

        {/* Watermark */}
        <Section
          title="Watermark"
          enabled={watermark.enabled}
          onToggle={(v) =>
            setWatermark({
              enabled: v,
              targetPageId: v ? targetFor(watermark.scope ?? "all") : undefined,
            })
          }
        >
          <Field label="Text">
            <Input value={watermark.text} onChange={(e) => setWatermark({ text: e.target.value })} />
          </Field>
          <ScopeField
            value={watermark.scope ?? "all"}
            onChange={(scope) => setWatermark({ scope, targetPageId: targetFor(scope) })}
          />
          <div className="grid grid-cols-2 gap-2">
            <Field label="Size">
              <Num value={watermark.fontSize} min={8} max={200} onChange={(n) => setWatermark({ fontSize: n })} />
            </Field>
            <Field label="Rotation">
              <Num value={watermark.rotation} min={-90} max={90} onChange={(n) => setWatermark({ rotation: n })} />
            </Field>
          </div>
          <Field label="Layout">
            <Select
              value={watermark.tile ? "tiled" : "single"}
              onValueChange={(v) => setWatermark({ tile: v === "tiled" })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single">Single</SelectItem>
                <SelectItem value="tiled">Tiled (repeat across page)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {!watermark.tile && (
            <Field label="Placement">
              <Select
                value={watermark.position}
                onValueChange={(v) => setWatermark({ position: v as WatermarkPosition })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WM_POSITIONS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          {watermark.tile && (
            <Field label={`Spacing · ${watermark.spacing.toFixed(1)}×`}>
              <input
                type="range"
                min={0.5}
                max={3}
                step={0.1}
                value={watermark.spacing}
                onChange={(e) => setWatermark({ spacing: Number(e.target.value) })}
                className="w-full accent-primary"
              />
            </Field>
          )}
          <Field label={`Opacity · ${Math.round(watermark.opacity * 100)}%`}>
            <input
              type="range"
              min={0.05}
              max={1}
              step={0.05}
              value={watermark.opacity}
              onChange={(e) => setWatermark({ opacity: Number(e.target.value) })}
              className="w-full accent-primary"
            />
          </Field>
          <Field label="Colour">
            <input
              type="color"
              value={watermark.color}
              onChange={(e) => setWatermark({ color: e.target.value })}
              className="h-9 w-16 cursor-pointer rounded-md border border-input bg-transparent"
            />
          </Field>
        </Section>

        {/* Crop */}
        <Section
          title="Crop"
          enabled={crop.enabled}
          onToggle={(v) =>
            setCrop({
              enabled: v,
              targetPageId: v ? targetFor(crop.scope ?? "all") : undefined,
            })
          }
        >
          <p className="text-xs text-muted-foreground">Margins trimmed from each edge (pt).</p>
          <ScopeField
            value={crop.scope ?? "all"}
            onChange={(scope) => setCrop({ scope, targetPageId: targetFor(scope) })}
          />
          <div className="grid grid-cols-2 gap-2">
            <Field label="Top">
              <Num value={crop.top} min={0} max={2000} onChange={(n) => setCrop({ top: n })} />
            </Field>
            <Field label="Bottom">
              <Num value={crop.bottom} min={0} max={2000} onChange={(n) => setCrop({ bottom: n })} />
            </Field>
            <Field label="Left">
              <Num value={crop.left} min={0} max={2000} onChange={(n) => setCrop({ left: n })} />
            </Field>
            <Field label="Right">
              <Num value={crop.right} min={0} max={2000} onChange={(n) => setCrop({ right: n })} />
            </Field>
          </div>
        </Section>
      </div>
    </aside>
  );
}

function ScopeField({
  value,
  onChange,
}: {
  value: FinishingScope;
  onChange: (scope: FinishingScope) => void;
}) {
  return (
    <Field label="Apply to">
      <Select value={value} onValueChange={(v) => onChange(v as FinishingScope)}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SCOPES.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

function Section({
  title,
  enabled,
  onToggle,
  children,
}: {
  title: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <label className="flex items-center gap-2 text-sm font-medium">
        <Checkbox checked={enabled} onCheckedChange={(c) => onToggle(c === true)} />
        {title}
      </label>
      <div className={cn("space-y-3", !enabled && "pointer-events-none opacity-50")}>
        {children}
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Num({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <Input
      type="number"
      min={min}
      max={max}
      value={value}
      onChange={(e) => {
        const n = Number(e.target.value);
        if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, Math.round(n))));
      }}
    />
  );
}

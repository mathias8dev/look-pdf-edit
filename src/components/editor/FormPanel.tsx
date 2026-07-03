"use client";

import { X } from "lucide-react";
import { useEditorStore } from "@/lib/store/editor-store";
import type { FormField, FieldValue } from "@/lib/pdf/forms";
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

interface Props {
  docId: string;
  fields: FormField[];
  onClose: () => void;
}

const NONE = "__none__";

/**
 * Right-hand panel listing the current document's AcroForm fields. Edits are
 * stored per-doc and baked in (fill + flatten) on export.
 */
export default function FormPanel({ docId, fields, onClose }: Props) {
  const values = useEditorStore((s) => s.forms[docId]);
  const setFormValue = useEditorStore((s) => s.setFormValue);

  const valueOf = (f: FormField): FieldValue => values?.[f.name] ?? f.value;

  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Form · {fields.length}
        </span>
        <Button variant="ghost" size="icon" className="size-7" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {fields.map((f) => (
          <div key={f.name} className="space-y-1.5">
            {f.type !== "checkbox" && (
              <Label className="block truncate text-muted-foreground" title={f.name}>
                {f.name}
              </Label>
            )}
            <Field
              field={f}
              value={valueOf(f)}
              onChange={(v) => setFormValue(docId, f.name, v)}
            />
          </div>
        ))}
        {fields.length === 0 && (
          <p className="text-sm text-muted-foreground">This document has no form fields.</p>
        )}
      </div>

      <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
        Field values are flattened into the page on download.
      </div>
    </aside>
  );
}

function Field({
  field,
  value,
  onChange,
}: {
  field: FormField;
  value: FieldValue;
  onChange: (v: FieldValue) => void;
}) {
  switch (field.type) {
    case "checkbox":
      return (
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={value === true}
            onCheckedChange={(c) => onChange(c === true)}
          />
          <span className="truncate" title={field.name}>
            {field.name}
          </span>
        </label>
      );

    case "dropdown":
    case "radio":
      return (
        <Select
          value={typeof value === "string" && value ? value : NONE}
          onValueChange={(v) => onChange(v === NONE ? "" : v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="— none —" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>— none —</SelectItem>
            {field.options?.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case "optionlist":
      return (
        <div className="space-y-1 rounded-md border border-input p-2">
          {field.options?.map((opt) => {
            const selected = Array.isArray(value) && value.includes(opt);
            return (
              <label key={opt} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={selected}
                  onCheckedChange={(c) => {
                    const current = Array.isArray(value) ? value : [];
                    onChange(
                      c === true ? [...current, opt] : current.filter((o) => o !== opt),
                    );
                  }}
                />
                {opt}
              </label>
            );
          })}
        </div>
      );

    case "text":
      return (
        <Input
          type="text"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    default:
      return <p className="text-xs italic text-muted-foreground">Unsupported field type.</p>;
  }
}

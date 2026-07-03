"use client";

import { X } from "lucide-react";
import { useEditorStore } from "@/lib/store/editor-store";
import type { FormField, FieldValue } from "@/lib/pdf/forms";

interface Props {
  docId: string;
  fields: FormField[];
  onClose: () => void;
}

/**
 * Right-hand panel listing the current document's AcroForm fields. Edits are
 * stored per-doc and baked in (fill + flatten) on export.
 */
export default function FormPanel({ docId, fields, onClose }: Props) {
  const values = useEditorStore((s) => s.forms[docId]);
  const setFormValue = useEditorStore((s) => s.setFormValue);

  const valueOf = (f: FormField): FieldValue => values?.[f.name] ?? f.value;

  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-neutral-800 bg-neutral-950">
      <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
          Form · {fields.length}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {fields.map((f) => (
          <div key={f.name} className="space-y-1.5">
            {f.type !== "checkbox" && (
              <label className="block truncate text-xs font-medium text-neutral-400" title={f.name}>
                {f.name}
              </label>
            )}
            <Field
              field={f}
              value={valueOf(f)}
              onChange={(v) => setFormValue(docId, f.name, v)}
            />
          </div>
        ))}
        {fields.length === 0 && (
          <p className="text-sm text-neutral-500">This document has no form fields.</p>
        )}
      </div>

      <div className="border-t border-neutral-800 px-4 py-3 text-xs text-neutral-500">
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
  const inputClass =
    "w-full rounded-md border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 text-sm text-neutral-100 outline-none focus:border-blue-500";

  switch (field.type) {
    case "checkbox":
      return (
        <label className="flex items-center gap-2 text-sm text-neutral-200">
          <input
            type="checkbox"
            checked={value === true}
            onChange={(e) => onChange(e.target.checked)}
            className="h-4 w-4 accent-blue-500"
          />
          <span className="truncate" title={field.name}>
            {field.name}
          </span>
        </label>
      );

    case "dropdown":
    case "radio":
      return (
        <select
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        >
          <option value="">— none —</option>
          {field.options?.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );

    case "optionlist":
      return (
        <div className="space-y-1 rounded-md border border-neutral-700 bg-neutral-900 p-2">
          {field.options?.map((opt) => {
            const selected = Array.isArray(value) && value.includes(opt);
            return (
              <label key={opt} className="flex items-center gap-2 text-sm text-neutral-200">
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={(e) => {
                    const current = Array.isArray(value) ? value : [];
                    onChange(
                      e.target.checked
                        ? [...current, opt]
                        : current.filter((o) => o !== opt),
                    );
                  }}
                  className="h-4 w-4 accent-blue-500"
                />
                {opt}
              </label>
            );
          })}
        </div>
      );

    case "text":
      return (
        <input
          type="text"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      );

    default:
      return (
        <p className="text-xs italic text-neutral-600">Unsupported field type.</p>
      );
  }
}

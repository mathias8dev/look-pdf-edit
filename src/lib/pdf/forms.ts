import {
  PDFDocument,
  PDFTextField,
  PDFCheckBox,
  PDFRadioGroup,
  PDFDropdown,
  PDFOptionList,
} from "pdf-lib";

export type FieldType =
  | "text"
  | "checkbox"
  | "radio"
  | "dropdown"
  | "optionlist"
  | "unknown";

/** A user-editable value for a form field. */
export type FieldValue = string | boolean | string[];

export interface FormField {
  name: string;
  type: FieldType;
  value: FieldValue;
  /** Selectable options for radio / dropdown / option-list fields. */
  options?: string[];
}

/** Read the AcroForm fields (with current values) from a PDF's bytes. */
export async function readFormFields(bytes: Uint8Array): Promise<FormField[]> {
  const doc = await PDFDocument.load(bytes);
  const form = doc.getForm();

  return form.getFields().map((f): FormField => {
    const name = f.getName();
    if (f instanceof PDFTextField) {
      return { name, type: "text", value: f.getText() ?? "" };
    }
    if (f instanceof PDFCheckBox) {
      return { name, type: "checkbox", value: f.isChecked() };
    }
    if (f instanceof PDFRadioGroup) {
      return { name, type: "radio", value: f.getSelected() ?? "", options: f.getOptions() };
    }
    if (f instanceof PDFDropdown) {
      return {
        name,
        type: "dropdown",
        value: f.getSelected()[0] ?? "",
        options: f.getOptions(),
      };
    }
    if (f instanceof PDFOptionList) {
      return { name, type: "optionlist", value: f.getSelected(), options: f.getOptions() };
    }
    return { name, type: "unknown", value: "" };
  });
}

/**
 * Apply `values` to a PDF's form fields and FLATTEN the form, returning fresh
 * bytes. Flattening bakes the field appearances into the page content so they
 * survive the copyPages assembly pipeline (interactive widgets do not).
 * Unknown or mistyped field names are skipped rather than throwing.
 */
export async function fillAndFlatten(
  bytes: Uint8Array,
  values: Record<string, FieldValue>,
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes);
  const form = doc.getForm();

  for (const [name, value] of Object.entries(values)) {
    try {
      const field = form.getField(name);
      if (field instanceof PDFTextField && typeof value === "string") {
        field.setText(value);
      } else if (field instanceof PDFCheckBox && typeof value === "boolean") {
        if (value) field.check();
        else field.uncheck();
      } else if (field instanceof PDFRadioGroup && typeof value === "string") {
        if (value) field.select(value);
      } else if (field instanceof PDFDropdown && typeof value === "string") {
        if (value) field.select(value);
      } else if (field instanceof PDFOptionList && Array.isArray(value)) {
        if (value.length) field.select(value);
      }
    } catch {
      // Field absent or value type mismatch — skip it.
    }
  }

  form.flatten();
  return doc.save();
}

import { describe, it, expect } from "vitest";
import { inflateSync } from "node:zlib";
import { PDFDocument } from "pdf-lib";
import { readFormFields, fillAndFlatten } from "./forms";

/** A PDF with a text field, a checkbox, and a dropdown. */
async function makeFormPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([300, 300]);
  const form = doc.getForm();

  const name = form.createTextField("fullName");
  name.setText("");
  name.addToPage(page, { x: 20, y: 250, width: 200, height: 20 });

  const agree = form.createCheckBox("agree");
  agree.addToPage(page, { x: 20, y: 220, width: 12, height: 12 });

  const plan = form.createDropdown("plan");
  plan.setOptions(["free", "pro", "team"]);
  plan.addToPage(page, { x: 20, y: 190, width: 120, height: 20 });

  return doc.save();
}

/** Raw + inflated stream text, for scanning flattened content. */
function decode(bytes: Uint8Array): string {
  const buf = Buffer.from(bytes);
  let text = buf.toString("latin1");
  let i = 0;
  while ((i = buf.indexOf(Buffer.from("stream"), i)) !== -1) {
    if (buf.subarray(i - 3, i).toString("latin1") === "end") {
      i += 6;
      continue;
    }
    let s = i + 6;
    if (buf[s] === 0x0d) s++;
    if (buf[s] === 0x0a) s++;
    const e = buf.indexOf(Buffer.from("endstream"), s);
    if (e === -1) break;
    try {
      text += inflateSync(buf.subarray(s, e)).toString("latin1");
    } catch {
      // not a zlib stream
    }
    i = e + 1;
  }
  return text;
}

const hex = (s: string) => Buffer.from(s, "latin1").toString("hex").toLowerCase();

describe("readFormFields", () => {
  it("lists every field with its type and options", async () => {
    const fields = await readFormFields(await makeFormPdf());
    const byName = Object.fromEntries(fields.map((f) => [f.name, f]));

    expect(byName.fullName.type).toBe("text");
    expect(byName.agree.type).toBe("checkbox");
    expect(byName.agree.value).toBe(false);
    expect(byName.plan.type).toBe("dropdown");
    expect(byName.plan.options).toEqual(["free", "pro", "team"]);
  });

  it("returns an empty list for a PDF with no form", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([100, 100]);
    expect(await readFormFields(await doc.save())).toEqual([]);
  });
});

describe("fillAndFlatten", () => {
  it("writes text values into the flattened page content", async () => {
    const out = await fillAndFlatten(await makeFormPdf(), { fullName: "ADALOVELACE" });
    expect(decode(out).toLowerCase()).toContain(hex("ADALOVELACE"));
  });

  it("removes the interactive form after flattening", async () => {
    const out = await fillAndFlatten(await makeFormPdf(), { fullName: "x", agree: true });
    const reloaded = await PDFDocument.load(out);
    expect(reloaded.getForm().getFields()).toHaveLength(0);
  });

  it("selects a dropdown option", async () => {
    const out = await fillAndFlatten(await makeFormPdf(), { plan: "pro" });
    expect(decode(out).toLowerCase()).toContain(hex("pro"));
  });

  it("ignores unknown field names and type mismatches", async () => {
    // Should not throw; nonexistent + wrong-typed values are skipped.
    const out = await fillAndFlatten(await makeFormPdf(), {
      nope: "x",
      agree: "not-a-boolean" as unknown as boolean,
      fullName: "OK",
    });
    const reloaded = await PDFDocument.load(out);
    expect(reloaded.getPageCount()).toBe(1);
    expect(decode(out).toLowerCase()).toContain(hex("OK"));
  });
});

# Session context — resume here

> Handoff notes for `look-pdf-edit`. Read this first to continue without re-deriving decisions. Last updated: 2026-07-03.

## What this project is

A **web-based PDF editor**. User uploads PDF(s) and edits them. Everything runs **client-side** — files never leave the browser (privacy-first, no server cost, works offline).

## Roadmap status — ALL SHIPPED

| # | Milestone | Status |
| --- | --- | --- |
| 0 | Project scaffold (Next 16, pdf.js, pdf-lib, Zustand, Tailwind v4) | ✅ |
| 1 | Page assembly — reorder / rotate / delete → download | ✅ |
| 2 | Verify page-assembly round-trip (Vitest) | ✅ |
| 3 | Annotation overlay — text, highlight, draw, shapes, signatures (Konva) | ✅ |
| 4 | Multi-document assembly — merge / split / extract | ✅ |
| 5 | Form filling — AcroForm detect + fill + flatten | ✅ |
| 6 | Adopt shadcn/ui design system | ✅ |

Each step is its own commit; `git log` reads as the build history.

## Architecture / key decisions

- **Client-only.** No backend. Original bytes kept immutable; the output PDF is rebuilt fresh with pdf-lib on every download.
- **Coordinate model (annotations):** geometry is stored in **PDF points** (bottom-left origin, y-up, unrotated page). Survives zoom exactly and rotates with the page on export. Pure conversions live in `lib/pdf/coords.ts` (unit-tested). The main editing surface renders the page **unrotated**; page rotation is baked into the output on export — this keeps the overlay math pure (no rotated-handle math). See the `RotateCw` badge in the main view.
- **Assembly model:** `PageItem { id, docId, srcIndex, rotation }`. The store holds `docs[]` (each = original bytes + live pdf.js doc + detected form fields). `buildEditedPdf(sources, pages, annotations)` copies each page from its own `docId`. Extraction/splitting are just this over a subset of `pages` — no separate code path.
- **Forms:** filled values are **flattened** into page content on export, because interactive widgets do not reliably survive pdf-lib `copyPages`. This composes cleanly with reorder/rotate/annotations/multi-doc.
- **pdf.js is imported lazily** (`lib/pdf/pdfjs.ts`) — it touches `DOMMatrix` at module load and crashes server prerender otherwise. Do NOT convert to a top-level import. The Konva overlay is loaded via `next/dynamic({ ssr:false })` (browser-only) — see `Editor.tsx`.
- **Worker** vendored at `public/pdf.worker.min.mjs` (offline, no CDN). Re-copy from `node_modules/pdfjs-dist/build/` if pdfjs-dist is upgraded.
- **shadcn/ui:** components live in `src/components/ui/` (Button, Dialog, Tabs, Select, Checkbox, Input, Label, Tooltip). Design tokens (Tailwind v4 `@theme inline` + `.dark`) are in `src/app/globals.css`; the app is forced dark via `class="dark"` on `<html>`. `components.json` marks the project shadcn-enabled — future components can be added with `npx shadcn@latest add <name>`.

## File map

```
src/
  app/                 layout.tsx (dark, fonts), page.tsx (<Editor/>), globals.css (shadcn tokens)
  components/
    ui/                shadcn: button, dialog, tabs, select, checkbox, input, label, tooltip
    editor/
      Editor.tsx       orchestrator: upload, layout, main viewport, dialogs/panels
      Uploader.tsx     drag-drop / click upload
      Toolbar.tsx      tools, colour, zoom, Add-PDF/Extract/Split, Form toggle, New, Download
      Thumbnails.tsx   per-page reorder/rotate/delete + source-doc colour badge
      PageCanvas.tsx   pdf.js page → canvas renderer
      AnnotationLayer.tsx  Konva overlay (create/move/resize/select) — ssr:false
      SignatureDialog.tsx  draw / type / upload → one image stamp
      FormPanel.tsx    AcroForm field editor (right panel)
  lib/pdf/
    pdfjs.ts           lazy pdf.js loader, renderPage(), getPageSize()
    export.ts          buildEditedPdf(sources, pages, annotations) + downloadBytes()
    coords.ts          pure PDF<->view conversions + hexToRgb01
    forms.ts           readFormFields() + fillAndFlatten()
    test-utils.ts      synthetic PDFs (distinct page widths) for tests
  lib/store/editor-store.ts   Zustand: docs, pages, annotations, forms, tool/colour/zoom
  types/index.ts       PageItem, Rotation, Annotation union, ToolId
```

## Tests

`npm test` (Vitest, jsdom) — **52 tests**, all green. Cover: coordinate round-trips at multiple scales; `buildEditedPdf` reorder/delete/rotate/duplicate/intrinsic-rotation + multi-source merge order + unknown-doc throw; per-kind annotation baking (text present as hex, image XObject, deleted-page exclusion); form field enumeration + fill/flatten; store reducers (pages, annotations, multi-doc, forms). Also gated: `npx tsc --noEmit`, `npx eslint src`, `npm run build` — all clean.

## What is NOT yet done / next ideas

- **Real-browser E2E** of the interactive Konva/Radix surfaces (drawing, drag/resize, dialogs) is not automated — logic is unit-tested, the app builds & SSRs, but a manual pass (or Playwright) with a real multi-page PDF + a real AcroForm is the recommended confidence check.
- True in-place **text editing** (reflow existing body text) is deliberately out of scope — needs heavy WASM (mupdf). Overlay editing only.
- Possible follow-ups: undo/redo, drag-to-reorder thumbnails, page-range extract UI (multi-select), light-theme toggle (tokens already support it), keyboard shortcuts.

## Running locally (this machine)

Node is managed by **nvm-windows** and is NOT on PATH in a fresh shell.

```powershell
$env:Path = "C:\Program Files\nodejs;C:\ProgramData\nvm\v26.3.1;" + $env:Path
nvm use 26.3.1                                    # v26.3.1 / npm 11.16.0
npm run dev                                        # http://localhost:3000
npm run build
npm test
```

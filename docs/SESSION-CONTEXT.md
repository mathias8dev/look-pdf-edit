# Session context — resume here

> Handoff notes for `look-pdf-edit`. Read this first to continue the conversation/build without re-deriving decisions. Last updated: 2026-07-03.

## What this project is

A **web-based PDF editor**. User uploads a PDF and edits it. Everything runs **client-side** — files never leave the browser (privacy-first, no server cost, works offline).

## Decisions locked in (from the brainstorm)

| Decision | Choice | Notes |
| --- | --- | --- |
| MVP scope | **Overlay + page assembly** | Annotate (text/highlight/draw/shapes/signature) + merge/split/insert/extract + form filling. NOT true in-place text editing. |
| Processing | **Client-only** | No accounts/persistence/backend for now. Add API routes later only if we want save/share/large files. |
| UI / styling | **Tailwind + shadcn/ui** | Tailwind v4 is installed. shadcn components NOT added yet — currently hand-rolled Tailwind. |

**Key architectural insight from the brainstorm:** "PDF editing" splits into (1) *overlay editing* — draw on top, achievable; and (2) *true content editing* — reflow existing body text, very hard (glyphs at fixed coords, needs heavy WASM like mupdf). We deliberately build the overlay editor first; true text editing is a later scoped experiment, if ever.

## What's built and VERIFIED

Working vertical slice: **upload → render → page assembly (reorder / rotate / delete) → download edited PDF.**

Verification done this session:
- `npx tsc --noEmit` → clean
- `npm run build` → passes (static prerender OK)
- dev server boots, `/` SSRs with the uploader, `/pdf.worker.min.mjs` served (1.25 MB)
- NOT yet exercised in a real browser with a real PDF end-to-end (upload→canvas→download round-trip). That's the first thing to manually confirm.

## Stack (installed)

Next.js 16.2.10 (App Router, Turbopack, React 19.2) · `pdfjs-dist` 6 (render) · `pdf-lib` (manipulate) · `konva` + `react-konva` (annotation layer — installed, NOT used yet) · `zustand` (state) · Tailwind v4 · `lucide-react` · `clsx` + `tailwind-merge`.

## How the pipeline works

```
Upload → File → Uint8Array (kept in memory, in the Zustand store)
   ├─ pdf.js  → renders each page to <canvas> (thumbnails + main view)
   └─ pdf-lib → on Download, rebuilds a FRESH PDF from the ORIGINAL bytes,
                applying page order + deletions + rotation deltas
```

- Original bytes are **never mutated**. Page ops = an ordered list of `{ id, srcIndex, rotation }` (`PageItem`). Array order = output order; delete removes the item; rotation is a user delta on top of the page's intrinsic rotation.
- `pdfjs-dist` is imported **lazily** (`src/lib/pdf/pdfjs.ts`) — it touches `DOMMatrix` at module-eval time and crashes server prerender otherwise. This bug was hit and fixed this session; do NOT convert it back to a top-level import.
- pdf.js worker is copied to `public/pdf.worker.min.mjs` (no CDN → offline). If `pdfjs-dist` is upgraded, re-copy the worker from `node_modules/pdfjs-dist/build/`.
- `openPdf` hands pdf.js a `bytes.slice(0)` COPY because `getDocument` detaches the buffer; the store keeps the original intact for pdf-lib export.

## File map

```
src/
  app/                 layout.tsx (metadata set), page.tsx (renders <Editor/>)
  components/editor/
    Editor.tsx         orchestrator: file load, layout, main viewport, holds pdf.js doc in state
    Uploader.tsx       drag-drop / click upload (accepts application/pdf)
    Toolbar.tsx        New (reset) + Download (pdf-lib export → buildEditedPdf)
    Thumbnails.tsx     left sidebar: per-page reorder (up/down) / rotate / delete / select
    PageCanvas.tsx     reusable pdf.js page → canvas renderer (re-renders on rotation/scale)
  lib/
    pdf/pdfjs.ts       lazy pdf.js loader + renderPage()
    pdf/export.ts      buildEditedPdf() + downloadBytes()
    store/editor-store.ts   Zustand: fileName, originalBytes, pages[], selectedId + actions
    utils.ts           cn(), nextId()
  types/index.ts       PageItem, Rotation
public/pdf.worker.min.mjs
```

## Next steps (in recommended order)

1. **Manually verify** the round-trip in a browser with a real multi-page PDF (upload, rotate/delete/reorder, download, reopen the result).
2. **Annotation overlay** (the big one) — a Konva stage layered over each page for text boxes, highlight, freehand, rectangles/lines, image/signature stamps. Fiddliest part is coordinate mapping: screen px ↔ PDF points ↔ rotation. Export bakes annotations via pdf-lib `drawText`/`drawRectangle`/`drawImage`. Extend the store with an `annotations[]` per page.
3. **Multi-doc assembly** — merge multiple PDFs, split, insert/extract pages. Extends the `PageItem` model (add a source-document id so pages can come from >1 file).
4. **Form filling** — detect AcroForm fields, fill, optionally flatten.
5. Consider adding **shadcn/ui** properly (currently hand-rolled Tailwind) before the UI grows.

## Open questions for the user (were pending when this was written)

- **Annotation coordinate fidelity:** perfect survival across re-rotation + zoom (more math up front), or "good enough at 100%" for a first pass?
- **Signatures:** draw-with-mouse pad, type-a-name, upload-an-image — which / all three?
- **Build order:** annotation overlay next, or multi-doc merge/split first?

## Running locally (this machine)

Node is managed by **nvm-windows** and is NOT on PATH in a fresh shell.

```powershell
nvm use 26.3.1                                   # v26.3.1 installed; npm 11.16.0
$env:Path = "C:\Program Files\nodejs;" + $env:Path
npm run dev                                       # http://localhost:3000
npm run build
```

Direct binary if needed: `C:\ProgramData\nvm\v26.3.1\node.exe`.

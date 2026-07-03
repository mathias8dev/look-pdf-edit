# look-pdf-edit

A browser-based PDF editor. Upload a PDF and edit it — **everything runs client-side**; files never leave the browser.

## Status

**Vertical slice working:** upload → render → page assembly (reorder / rotate / delete) → download edited PDF.

Planned next: annotations (text, highlight, freehand, shapes, signatures) via a Konva overlay layer; merge/split/insert/extract; form filling.

## Stack

| Concern | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, Turbopack) |
| PDF rendering | [pdf.js](https://github.com/mozilla/pdf.js) (`pdfjs-dist`) |
| PDF manipulation | [pdf-lib](https://pdf-lib.js.org/) |
| Annotation layer (planned) | Konva / react-konva |
| State | Zustand |
| Styling | Tailwind CSS v4 |
| Icons | lucide-react |

## How it works

```
Upload → File → Uint8Array (kept in memory)
   │
   ├─ pdf.js  → renders each page to <canvas> (thumbnails + main view)
   │
   └─ pdf-lib → on Download, rebuilds a fresh PDF from the ORIGINAL bytes,
                applying page order, deletions, and rotation deltas
```

- The original bytes are never mutated. Page operations are modeled as a list
  of `{ srcIndex, rotation }` items (`src/lib/store/editor-store.ts`); export
  copies pages into a new document in that order (`src/lib/pdf/export.ts`).
- `pdfjs-dist` is imported **lazily** (`src/lib/pdf/pdfjs.ts`) so it never
  evaluates during server-side prerender (it touches `DOMMatrix` at module load).
- The pdf.js worker is copied to `public/pdf.worker.min.mjs` — no CDN, works offline.

## Project structure

```
src/
  app/                 layout.tsx, page.tsx (renders <Editor/>)
  components/editor/
    Editor.tsx         orchestrator: file load, layout, main viewport
    Uploader.tsx       drag-and-drop / click upload
    Toolbar.tsx        New + Download (pdf-lib export)
    Thumbnails.tsx     page sidebar: reorder / rotate / delete
    PageCanvas.tsx     reusable pdf.js page → canvas renderer
  lib/
    pdf/pdfjs.ts       lazy pdf.js loader + renderPage
    pdf/export.ts      pdf-lib rebuild + download
    store/editor-store.ts   Zustand state
    utils.ts           cn(), id helper
  types/index.ts       PageItem, Rotation
```

## Running locally

Node 20.9+ required.

```bash
npm run dev     # http://localhost:3000
npm run build
npm start
```

> On this machine Node is managed by nvm-windows and may not be on PATH in a
> fresh shell. Activate it first: `nvm use 26.3.1` (adds `C:\Program Files\nodejs`).

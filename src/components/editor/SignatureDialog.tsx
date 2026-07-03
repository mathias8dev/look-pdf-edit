"use client";

import { useEffect, useRef, useState } from "react";
import { X, Eraser } from "lucide-react";
import { useEditorStore } from "@/lib/store/editor-store";
import { nextId } from "@/lib/utils";
import { cn } from "@/lib/utils";

type Tab = "draw" | "type" | "upload";

interface Props {
  pageId: string;
  /** Unrotated page size in PDF points, for placing the stamp. */
  pageSize: { width: number; height: number };
  onClose: () => void;
}

/**
 * Create a signature stamp. All three inputs (draw / type / upload) resolve to
 * a PNG data URL, which becomes a single image annotation — one uniform export
 * path. Placed centred near the bottom of the current page.
 */
export default function SignatureDialog({ pageId, pageSize, onClose }: Props) {
  const [tab, setTab] = useState<Tab>("draw");
  const addAnnotation = useEditorStore((s) => s.addAnnotation);

  const drawRef = useRef<HTMLCanvasElement>(null);
  const [typed, setTyped] = useState("");
  const [uploaded, setUploaded] = useState<string | null>(null);

  function place(dataUrl: string, aspect: number) {
    const w = Math.min(220, pageSize.width * 0.5);
    const h = w / aspect;
    addAnnotation({
      id: nextId("ann"),
      pageId,
      kind: "image",
      x: (pageSize.width - w) / 2,
      y: 48,
      w,
      h,
      dataUrl,
    });
    onClose();
  }

  function confirm() {
    if (tab === "draw") {
      const canvas = drawRef.current;
      if (!canvas) return;
      place(canvas.toDataURL("image/png"), canvas.width / canvas.height);
    } else if (tab === "type") {
      const rendered = renderTypedSignature(typed.trim());
      if (rendered) place(rendered.dataUrl, rendered.aspect);
    } else if (uploaded) {
      const img = new window.Image();
      img.onload = () => place(uploaded, img.width / img.height);
      img.src = uploaded;
    }
  }

  const canConfirm =
    (tab === "type" && typed.trim().length > 0) ||
    (tab === "upload" && !!uploaded) ||
    tab === "draw";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-xl border border-neutral-700 bg-neutral-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
          <h2 className="text-sm font-semibold text-neutral-100">Add signature</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex gap-1 border-b border-neutral-800 px-4 pt-3">
          {(["draw", "type", "upload"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "rounded-t-md px-3 py-1.5 text-sm capitalize",
                tab === t
                  ? "bg-neutral-800 text-neutral-100"
                  : "text-neutral-400 hover:text-neutral-200",
              )}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="p-4">
          {tab === "draw" && <DrawPad canvasRef={drawRef} />}
          {tab === "type" && (
            <div className="space-y-3">
              <input
                autoFocus
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder="Type your name"
                className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-blue-500"
              />
              <div className="flex h-24 items-center justify-center rounded-md bg-white">
                <span
                  className="text-4xl text-black"
                  style={{ fontFamily: SIGNATURE_FONT }}
                >
                  {typed || "Preview"}
                </span>
              </div>
            </div>
          )}
          {tab === "upload" && (
            <div className="space-y-3">
              <input
                type="file"
                accept="image/png,image/jpeg"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => setUploaded(String(reader.result));
                  reader.readAsDataURL(file);
                }}
                className="block w-full text-sm text-neutral-300 file:mr-3 file:rounded-md file:border-0 file:bg-neutral-800 file:px-3 file:py-1.5 file:text-neutral-100"
              />
              {uploaded && (
                <div className="flex justify-center rounded-md bg-white p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={uploaded} alt="Signature preview" className="max-h-28" />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-neutral-800 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={!canConfirm}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

const SIGNATURE_FONT = '"Segoe Script", "Brush Script MT", cursive';

/** Freehand signature pad. Draws black strokes on a transparent canvas. */
function DrawPad({ canvasRef }: { canvasRef: React.RefObject<HTMLCanvasElement | null> }) {
  const drawing = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111827";
  }, [canvasRef]);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        width={468}
        height={180}
        className="w-full cursor-crosshair touch-none rounded-md bg-white"
        onPointerDown={(e) => {
          drawing.current = true;
          const ctx = e.currentTarget.getContext("2d")!;
          const p = pos(e);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const ctx = e.currentTarget.getContext("2d")!;
          const p = pos(e);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
        }}
        onPointerUp={() => (drawing.current = false)}
      />
      <button
        type="button"
        onClick={() => {
          const c = canvasRef.current;
          c?.getContext("2d")?.clearRect(0, 0, c.width, c.height);
        }}
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
      >
        <Eraser className="h-3.5 w-3.5" />
        Clear
      </button>
    </div>
  );
}

/** Render typed text in a signature font to a trimmed PNG data URL. */
function renderTypedSignature(
  text: string,
): { dataUrl: string; aspect: number } | null {
  if (!text) return null;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const fontSize = 64;
  ctx.font = `${fontSize}px ${SIGNATURE_FONT}`;
  const metrics = ctx.measureText(text);
  const w = Math.ceil(metrics.width) + 40;
  const h = Math.ceil(fontSize * 1.6);
  canvas.width = w;
  canvas.height = h;

  // Re-apply after resize (resizing clears the context state).
  ctx.font = `${fontSize}px ${SIGNATURE_FONT}`;
  ctx.fillStyle = "#111827";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 20, h / 2);

  return { dataUrl: canvas.toDataURL("image/png"), aspect: w / h };
}

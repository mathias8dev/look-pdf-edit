"use client";

import { useCallback, useRef, useState } from "react";
import { FileUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  onFile: (file: File) => void;
}

/** Drag-and-drop / click-to-browse PDF upload zone. */
export default function Uploader({ onFile }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (file && file.type === "application/pdf") onFile(file);
    },
    [onFile],
  );

  return (
    <div className="flex h-full w-full items-center justify-center p-8">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex w-full max-w-xl flex-col items-center gap-4 rounded-2xl border-2 border-dashed px-8 py-20 transition-colors",
          dragging
            ? "border-blue-400 bg-blue-500/10"
            : "border-neutral-700 bg-neutral-900/40 hover:border-neutral-500",
        )}
      >
        <FileUp className="h-10 w-10 text-neutral-400" />
        <div className="text-center">
          <p className="text-base font-medium text-neutral-100">
            Drop a PDF here, or click to browse
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            Files stay in your browser — nothing is uploaded to a server.
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </button>
    </div>
  );
}

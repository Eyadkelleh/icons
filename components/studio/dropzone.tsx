"use client";

import { useRef, useState } from "react";

import { cn } from "@/lib/utils";

type DropzoneProps = {
  onFile: (file: File) => void;
  onPaste: (markup: string) => void;
  compact?: boolean;
};

const isSvgFile = (file: File) =>
  file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg");

export const Dropzone = ({
  onFile,
  onPaste,
  compact = false,
}: DropzoneProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [pasted, setPasted] = useState("");

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (file) {
      onFile(file);
    }
  };

  return (
    <div className="flex w-full flex-col gap-3">
      <button
        className={cn(
          "supports-[corner-shape:squircle]:corner-squircle flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-[20px] border border-dashed bg-white px-6 font-mono text-sm transition-[border-color,background-color] duration-150 focus-visible:outline-1 focus-visible:outline-primary supports-[corner-shape:squircle]:rounded-[30px] dark:bg-[#0A0A0A]",
          compact ? "py-6" : "py-16",
          dragging
            ? "border-primary bg-primary/5"
            : "border-neutral-300 hover:border-neutral-500 dark:border-neutral-700 dark:hover:border-neutral-500"
        )}
        data-testid="studio-dropzone"
        onClick={() => inputRef.current?.click()}
        onDragLeave={() => setDragging(false)}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          handleFiles(event.dataTransfer.files);
        }}
        type="button"
      >
        <span className="font-sans text-lg">
          {compact ? "Drop another SVG" : "Drop an SVG here"}
        </span>
        <span className="text-secondary text-xs">
          or click to choose a file
        </span>
      </button>
      <input
        accept=".svg,image/svg+xml"
        aria-label="Upload SVG file"
        className="sr-only"
        data-testid="studio-file-input"
        onChange={(event) => {
          handleFiles(event.target.files);
          event.target.value = "";
        }}
        ref={inputRef}
        type="file"
      />
      <details className="font-mono text-secondary text-xs">
        <summary className="cursor-pointer select-none">
          or paste SVG markup
        </summary>
        <div className="mt-2 flex flex-col gap-2">
          <textarea
            aria-label="SVG markup"
            className="min-h-28 w-full rounded-[12px] border border-neutral-300 bg-white p-3 font-mono text-foreground text-xs outline-none focus:border-primary dark:border-neutral-700 dark:bg-[#0A0A0A]"
            data-testid="studio-paste"
            onChange={(event) => setPasted(event.target.value)}
            placeholder='<svg viewBox="0 0 24 24">…</svg>'
            value={pasted}
          />
          <button
            className="self-start rounded-[10px] bg-primary px-3 py-1.5 font-mono text-white text-xs disabled:opacity-40"
            disabled={pasted.trim().length === 0}
            onClick={() => onPaste(pasted)}
            type="button"
          >
            Analyze markup
          </button>
        </div>
      </details>
    </div>
  );
};

export { isSvgFile };

import { useEffect, useRef, useState } from "react";

/** Image files dropped anywhere on the window or pasted with Ctrl+V. Returns whether a drag is over the window. */
export function useWindowFileDrop(onFiles: (files: File[]) => void): boolean {
  const [dragging, setDragging] = useState(false);
  const onFilesRef = useRef(onFiles);
  useEffect(() => {
    onFilesRef.current = onFiles;
  });

  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) => e.dataTransfer?.types.includes("Files") ?? false;
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth += 1;
      setDragging(true);
    };
    const leave = () => {
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const over = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      onFilesRef.current(imagesOf(e.dataTransfer?.files));
    };
    const paste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea")) return;
      const files = imagesOf(e.clipboardData?.files);
      if (files.length === 0) return;
      e.preventDefault();
      onFilesRef.current(files);
    };
    const listeners = [
      ["dragenter", enter],
      ["dragleave", leave],
      ["dragover", over],
      ["drop", drop],
      ["paste", paste],
    ] as const;
    for (const [type, listener] of listeners)
      window.addEventListener(type, listener as EventListener);
    return () => {
      for (const [type, listener] of listeners)
        window.removeEventListener(type, listener as EventListener);
    };
  }, []);

  return dragging;
}

export const imagesOf = (list: FileList | null | undefined): File[] =>
  [...(list ?? [])].filter((file) => file.type.startsWith("image/"));

"use client";

import { useRef, useState } from "react";

const MAX_SIDE = 2000;
// Four images must fit in one ~4 MB upload (next.config.ts), so shrink early.
const SHRINK_OVER_BYTES = 900 * 1024;

/** Big photos and screenshots are scaled down to fit under the upload limit. */
async function shrink(file: File): Promise<File> {
  if (file.type === "image/gif" || file.size <= SHRINK_OVER_BYTES) return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
  return blob ? new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : file;
}

/** A file picker for dev log screenshots (up to 4 at a time). */
export function DevlogImageInput({ className }: { className?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState<string | null>(null);

  async function onChange() {
    const input = ref.current;
    if (!input?.files?.length) return setNote(null);
    const picked = [...input.files].slice(0, 4);
    setNote("Preparing…");
    const ready = await Promise.all(picked.map((f) => shrink(f).catch(() => f)));
    const dt = new DataTransfer();
    ready.forEach((f) => dt.items.add(f));
    input.files = dt.files;
    setNote(`${ready.length} image${ready.length > 1 ? "s" : ""} ready`);
  }

  return (
    <label className={`flex cursor-pointer items-center gap-2 text-sm text-muted hover:text-foreground ${className ?? ""}`}>
      <input ref={ref} type="file" name="images" accept="image/png,image/jpeg,image/webp,image/gif" multiple onChange={onChange} className="sr-only" />
      <span className="hud-tag">+ Images</span>
      {note && <span className="text-xs">{note}</span>}
    </label>
  );
}

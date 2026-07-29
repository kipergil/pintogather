import { useCallback, useEffect, useRef, useState } from "react";
import { ImageIcon, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";

export const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
/** Matches the server's multer limit; 4MB leaves headroom under Anthropic's ~5MB base64 image cap. */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
/** Matches the server's `files` maxCount. */
export const MAX_IMAGES = 4;

export interface ImageRejection {
  name: string;
  reason: "type" | "size" | "count";
}

/**
 * Filters a raw file list down to acceptable images, reporting what it threw
 * away and why so the caller can explain itself rather than silently
 * dropping a file the user just chose.
 */
export function screenImages(
  incoming: File[],
  alreadyHeld: number,
): { accepted: File[]; rejected: ImageRejection[] } {
  const accepted: File[] = [];
  const rejected: ImageRejection[] = [];
  for (const file of incoming) {
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      rejected.push({ name: file.name, reason: "type" });
    } else if (file.size > MAX_IMAGE_BYTES) {
      rejected.push({ name: file.name, reason: "size" });
    } else if (alreadyHeld + accepted.length >= MAX_IMAGES) {
      rejected.push({ name: file.name, reason: "count" });
    } else {
      accepted.push(file);
    }
  }
  return { accepted, rejected };
}

/**
 * Watches the document for a clipboard paste carrying image data. Screenshots
 * mostly arrive on the clipboard (Cmd-Shift-4, Win-Shift-S, "copy image"),
 * never as a file on disk, so a file picker alone misses the most common way
 * people actually have an image to hand.
 */
export function useImagePaste(onImages: (files: File[]) => void, enabled = true) {
  // Kept in a ref so the listener doesn't need re-binding on every render.
  const handlerRef = useRef(onImages);
  handlerRef.current = onImages;

  useEffect(() => {
    if (!enabled) return;
    const onPaste = (event: ClipboardEvent) => {
      const files = Array.from(event.clipboardData?.items ?? [])
        .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
        .map((item) => item.getAsFile())
        .filter((file): file is File => file !== null);
      if (files.length === 0) return;
      // Only swallow the paste once we know it carried an image, so pasting
      // text into a textarea on the same page still behaves normally.
      event.preventDefault();
      handlerRef.current(files);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [enabled]);
}

interface ImageDropzoneProps {
  images: File[];
  onChange: (images: File[]) => void;
  /** Surfaced to the user when a file is refused — the caller decides how (toast, inline text). */
  onRejected?: (rejections: ImageRejection[]) => void;
  disabled?: boolean;
  /** Overrides the default prompt, e.g. to say what will be done with the image. */
  label?: string;
  className?: string;
  testId?: string;
}

/**
 * Accepts images by click, drag-and-drop, or clipboard paste, and shows what
 * it's holding as removable thumbnails. Used by every add method that can
 * take a screenshot so they behave identically.
 */
export function ImageDropzone({
  images,
  onChange,
  onRejected,
  disabled = false,
  label,
  className,
  testId = "image-dropzone",
}: ImageDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const accept = useCallback(
    (incoming: File[]) => {
      if (disabled || incoming.length === 0) return;
      const { accepted, rejected } = screenImages(incoming, images.length);
      if (accepted.length > 0) onChange([...images, ...accepted]);
      if (rejected.length > 0) onRejected?.(rejected);
    },
    [disabled, images, onChange, onRejected],
  );

  useImagePaste(accept, !disabled);

  const atCapacity = images.length >= MAX_IMAGES;

  return (
    <div className={cn("space-y-2", className)} data-testid={testId}>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        multiple
        className="hidden"
        onChange={(e) => {
          accept(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
        data-testid={`${testId}-input`}
      />

      {!atCapacity && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setIsDraggingOver(true);
          }}
          onDragLeave={() => setIsDraggingOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDraggingOver(false);
            accept(Array.from(e.dataTransfer.files ?? []));
          }}
          className={cn(
            "w-full rounded-md border border-dashed px-3 py-4 text-xs transition-colors",
            "flex flex-col items-center gap-1.5 text-muted-foreground",
            isDraggingOver ? "border-primary bg-primary/5 text-primary" : "border-border hover:bg-accent",
            disabled && "opacity-50 cursor-not-allowed hover:bg-transparent",
          )}
          data-testid={`${testId}-target`}
        >
          <Upload className="h-4 w-4" />
          <span>{label ?? "Paste a screenshot, drop an image, or click to browse"}</span>
        </button>
      )}

      {images.length > 0 && (
        <div className="flex flex-wrap gap-2" data-testid={`${testId}-thumbs`}>
          {images.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="relative h-16 w-16 overflow-hidden rounded-md border border-border bg-muted"
            >
              <img
                src={URL.createObjectURL(file)}
                alt={file.name}
                className="h-full w-full object-cover"
                // Revoking straight after load keeps this from leaking a blob
                // URL per thumbnail on every re-render.
                onLoad={(e) => URL.revokeObjectURL((e.target as HTMLImageElement).src)}
              />
              <button
                type="button"
                onClick={() => onChange(images.filter((_, i) => i !== index))}
                className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80"
                aria-label={`Remove ${file.name}`}
                data-testid={`${testId}-remove-${index}`}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          {atCapacity && (
            <div className="flex h-16 items-center gap-1.5 rounded-md border border-dashed border-border px-3 text-xs text-muted-foreground">
              <ImageIcon className="h-3.5 w-3.5" />
              Max {MAX_IMAGES}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

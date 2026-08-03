import { useCallback, useEffect, useRef, useState } from "react";
import { ClipboardPaste, ImageIcon, Loader2, Upload, X } from "lucide-react";
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

const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export type ClipboardReadFailure = "unsupported" | "denied" | "empty";

/** Thrown by `readClipboardImages` so the caller can explain which of the three ways it failed. */
export class ClipboardReadError extends Error {
  constructor(readonly reason: ClipboardReadFailure) {
    super(reason);
    this.name = "ClipboardReadError";
  }
}

/**
 * Whether the browser can be *asked* for the clipboard's contents, as opposed
 * to only being told about a paste the user performed. Chrome, Edge, and
 * Safari (including iOS) implement this; older Firefox does not.
 */
export function canReadClipboardImages(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.clipboard?.read === "function";
}

/**
 * Pulls images off the clipboard on demand.
 *
 * The keyboard `paste` listener below only ever fires when the user presses
 * Ctrl/Cmd-V, which is not something that exists on a phone: iOS and Android
 * only offer "Paste" from the selection menu of a focused editable field, so
 * a page-level listener never hears about it. Reading the clipboard directly
 * from a tap gives touch users the same capability — Safari and Chrome both
 * prompt the user to confirm, which is why this must run inside a click
 * handler and can't be done speculatively.
 */
export async function readClipboardImages(): Promise<File[]> {
  if (!canReadClipboardImages()) throw new ClipboardReadError("unsupported");

  let contents: Awaited<ReturnType<Clipboard["read"]>>;
  try {
    contents = await navigator.clipboard.read();
  } catch {
    // Refused at the permission prompt, or no clipboard access in this context.
    throw new ClipboardReadError("denied");
  }

  const files: File[] = [];
  for (const item of contents) {
    const type =
      item.types.find((candidate) => ALLOWED_IMAGE_TYPES.has(candidate)) ??
      item.types.find((candidate) => candidate.startsWith("image/"));
    if (!type) continue;
    const blob = await item.getType(type);
    const mime = blob.type || type;
    files.push(
      new File([blob], `pasted-image-${files.length + 1}.${EXTENSION_BY_TYPE[mime] ?? "png"}`, { type: mime }),
    );
  }

  // Text on the clipboard and an empty clipboard are the same thing here, and
  // both deserve "there's no image to paste" rather than silence.
  if (files.length === 0) throw new ClipboardReadError("empty");
  return files;
}

interface ImageDropzoneProps {
  images: File[];
  onChange: (images: File[]) => void;
  /** Surfaced to the user when a file is refused — the caller decides how (toast, inline text). */
  onRejected?: (rejections: ImageRejection[]) => void;
  /** Surfaced when the explicit Paste button couldn't get anything from the clipboard. */
  onClipboardError?: (reason: ClipboardReadFailure) => void;
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
  onClipboardError,
  disabled = false,
  label,
  className,
  testId = "image-dropzone",
}: ImageDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isReadingClipboard, setIsReadingClipboard] = useState(false);
  // Read once at mount: feature support can't change under us, and calling it
  // during render on the server would touch `navigator`.
  const [clipboardReadable] = useState(canReadClipboardImages);

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

  const pasteFromClipboard = async () => {
    if (disabled || isReadingClipboard) return;
    setIsReadingClipboard(true);
    try {
      accept(await readClipboardImages());
    } catch (error) {
      onClipboardError?.(error instanceof ClipboardReadError ? error.reason : "denied");
    } finally {
      setIsReadingClipboard(false);
    }
  };

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
          <span>{label ?? "Tap to choose a screenshot or photo, or drag one in"}</span>
        </button>
      )}

      {/* A tappable paste, because Ctrl/Cmd-V doesn't exist on a phone — the
          keyboard listener above can only ever serve desktop. Hidden entirely
          where the browser won't let us read the clipboard, rather than
          offering a button that can only fail. */}
      {!atCapacity && clipboardReadable && (
        <button
          type="button"
          disabled={disabled || isReadingClipboard}
          onClick={pasteFromClipboard}
          className={cn(
            "w-full rounded-md border border-border px-3 py-2 text-xs font-medium",
            "flex items-center justify-center gap-1.5 text-foreground transition-colors hover:bg-accent",
            (disabled || isReadingClipboard) && "opacity-50 cursor-not-allowed hover:bg-transparent",
          )}
          data-testid={`${testId}-paste`}
        >
          {isReadingClipboard ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ClipboardPaste className="h-3.5 w-3.5" />
          )}
          Paste from clipboard
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

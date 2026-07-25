export type SharePlatform = "instagram" | "twitter" | "whatsapp" | "facebook";

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Opens the web share-intent URL for platforms that support one (X and WhatsApp accept prefilled text+link this way; Instagram and Facebook have no such intent). */
export function openLinkIntent(platform: "twitter" | "whatsapp" | "facebook", url: string, text: string) {
  const encodedUrl = encodeURIComponent(url);
  const encodedText = encodeURIComponent(text);
  const intentUrl =
    platform === "twitter"
      ? `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`
      : platform === "whatsapp"
        ? `https://wa.me/?text=${encodedText}%20${encodedUrl}`
        : `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
  window.open(intentUrl, "_blank", "noopener,noreferrer");
}

/**
 * The only real way to hand an image + caption to Instagram (it has no web
 * share-intent URL at all) is the OS-level share sheet via the Web Share API
 * — which also happens to be the best path for X/WhatsApp on mobile, since
 * unlike their URL intents it can carry the image alongside the text. The
 * OS decides which installed apps show up; we can't force a specific one.
 */
export async function shareImageNatively(file: File, title: string, text: string): Promise<boolean> {
  if (!navigator.share || !navigator.canShare || !navigator.canShare({ files: [file] })) {
    return false;
  }
  try {
    await navigator.share({ files: [file], title, text });
    return true;
  } catch (error) {
    // AbortError just means the user closed the share sheet — not a failure.
    if (error instanceof DOMException && error.name === "AbortError") return true;
    return false;
  }
}

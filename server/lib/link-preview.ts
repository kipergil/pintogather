import dns from "node:dns/promises";
import { isIP } from "node:net";

/** What the "link" item-type add-form shows to prefill title/note/photo — see server/routes.ts's POST /api/link-preview. */
export interface LinkPreview {
  title: string | null;
  description: string | null;
  imageUrl: string | null;
}

const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 5000;
const MAX_BODY_BYTES = 2 * 1024 * 1024; // 2MB — plenty for a page's <head>, well short of most full HTML documents

class LinkPreviewError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LinkPreviewError";
  }
}

/**
 * IPv4 ranges that should never be reachable from a server-side fetch of a
 * user-supplied URL: loopback, private (RFC1918), link-local, CGNAT, and
 * "this network". Deliberately hand-rolled rather than pulling in a CIDR
 * library — it's a small, static set that doesn't change.
 */
function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true; // malformed — fail closed
  const [a, b] = parts;
  if (a === 127) return true; // loopback
  if (a === 10) return true; // RFC1918
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
  if (a === 192 && b === 168) return true; // RFC1918
  if (a === 169 && b === 254) return true; // link-local
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT (RFC6598)
  if (a === 0) return true; // "this network"
  return false;
}

/** IPv6 loopback (::1), unique-local (fc00::/7), and link-local (fe80::/10). */
function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === "::1" || normalized === "::") return true;
  const firstGroup = normalized.split(":")[0];
  if (/^fe[89ab][0-9a-f]$/.test(firstGroup)) return true; // fe80::/10
  if (/^f[cd][0-9a-f]{2}$/.test(firstGroup)) return true; // fc00::/7
  // IPv4-mapped (::ffff:a.b.c.d) — check the embedded v4 address too.
  const v4Match = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (v4Match) return isPrivateIPv4(v4Match[1]);
  return false;
}

function isPrivateAddress(ip: string): boolean {
  return isIP(ip) === 6 ? isPrivateIPv6(ip) : isPrivateIPv4(ip);
}

/** Resolves the hostname and rejects it if any resolved address is private/internal — the actual SSRF guard, since checking the URL string alone can't catch DNS rebinding to an internal IP. */
async function assertPublicHost(hostname: string): Promise<void> {
  if (isIP(hostname)) {
    if (isPrivateAddress(hostname)) throw new LinkPreviewError("That URL points to a private address.");
    return;
  }
  if (hostname === "localhost") throw new LinkPreviewError("That URL points to a private address.");

  let addresses: { address: string }[];
  try {
    addresses = await dns.lookup(hostname, { all: true });
  } catch {
    throw new LinkPreviewError("Couldn't resolve that URL's host.");
  }
  if (addresses.length === 0 || addresses.some((a) => isPrivateAddress(a.address))) {
    throw new LinkPreviewError("That URL points to a private address.");
  }
}

function assertFetchableUrl(url: URL): void {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new LinkPreviewError("Only http/https URLs are supported.");
  }
}

/**
 * Fetches `rawUrl` server-side with SSRF guards (public-host-only, capped
 * redirects re-validated at each hop, response-size cap, timeout) and pulls
 * a title/description/image out of its HTML head — Open Graph tags first,
 * falling back to <title>/meta description. Used to prefill a "link"-type
 * item's title/note/photo from a pasted URL (see POST /api/link-preview).
 */
export async function fetchLinkPreview(rawUrl: string): Promise<LinkPreview> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new LinkPreviewError("That doesn't look like a valid URL.");
  }

  let finalHtml: string | null = null;
  let finalUrl = url;

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
    assertFetchableUrl(finalUrl);
    await assertPublicHost(finalUrl.hostname);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(finalUrl, {
        signal: controller.signal,
        redirect: "manual",
        headers: { "User-Agent": "Mozilla/5.0 (compatible; PinGatherLinkPreview/1.0)" },
      });
    } catch {
      throw new LinkPreviewError("Couldn't fetch that URL.");
    } finally {
      clearTimeout(timeout);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new LinkPreviewError("That URL redirected without a destination.");
      finalUrl = new URL(location, finalUrl);
      continue;
    }

    if (!response.ok) throw new LinkPreviewError(`That URL returned an error (${response.status}).`);

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) throw new LinkPreviewError("That URL isn't a web page.");

    const reader = response.body?.getReader();
    if (!reader) throw new LinkPreviewError("Couldn't read that URL's response.");
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_BODY_BYTES) {
        await reader.cancel();
        break;
      }
      chunks.push(value);
    }
    finalHtml = Buffer.concat(chunks).toString("utf8");
    finalUrl = new URL(response.url || finalUrl.toString());
    break;
  }

  if (finalHtml === null) throw new LinkPreviewError("Too many redirects.");

  return parseHtmlPreview(finalHtml, finalUrl);
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

function extractMetaContent(html: string, attr: "property" | "name", key: string): string | null {
  const pattern = new RegExp(
    `<meta[^>]+${attr}=["']${key}["'][^>]*content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]*${attr}=["']${key}["']`,
    "i",
  );
  const match = html.match(pattern);
  const raw = match?.[1] ?? match?.[2];
  return raw ? decodeHtmlEntities(raw.trim()) : null;
}

function parseHtmlPreview(html: string, finalUrl: URL): LinkPreview {
  // Only the <head> is relevant and it keeps the regexes above from ever
  // scanning a multi-megabyte <body> (already capped, but this is cheap
  // insurance against a pathological head-less page).
  const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  const head = headMatch ? headMatch[1] : html;

  const ogTitle = extractMetaContent(head, "property", "og:title");
  const titleTagMatch = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = ogTitle ?? (titleTagMatch ? decodeHtmlEntities(titleTagMatch[1].trim()) : null);

  const description = extractMetaContent(head, "property", "og:description") ?? extractMetaContent(head, "name", "description");

  const ogImage = extractMetaContent(head, "property", "og:image");
  const imageUrl = ogImage ? new URL(ogImage, finalUrl).toString() : null;

  return {
    title: title ? title.slice(0, 255) : null,
    description: description ? description.slice(0, 1000) : null,
    imageUrl,
  };
}

export { LinkPreviewError };

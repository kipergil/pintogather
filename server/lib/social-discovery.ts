import { fetchHtml } from "./link-preview.js";

/**
 * Finds a venue's own social profiles by reading its website.
 *
 * The point is to stop guessing. A pin for a restaurant used to inherit
 * whichever handles happened to be on the contributor's own profile, which
 * is almost never what the pin is about. The venue's website, on the other
 * hand, usually links its real accounts in the header or footer.
 *
 * Everything here is a *suggestion*. Nothing is written to a pin without
 * someone accepting it — a site can link a partner's account, a web
 * agency's, or a "follow us on X" that belongs to a parent brand.
 */

export type SocialPlatform = "twitter" | "instagram" | "linkedin";

export type SocialSuggestions = Partial<Record<SocialPlatform, string>>;

/** Hosts that count as each platform. x.com and twitter.com are the same account. */
const PLATFORM_HOSTS: Record<SocialPlatform, RegExp> = {
  twitter: /^(www\.)?(twitter|x)\.com$/i,
  instagram: /^(www\.)?instagram\.com$/i,
  linkedin: /^([a-z]{2}\.)?(www\.)?linkedin\.com$/i,
};

/**
 * First path segments that are never a profile.
 *
 * This is the whole difficulty of the job: almost every page on the web
 * links twitter.com and facebook.com already, via share buttons. Treating
 * `twitter.com/intent/tweet?url=…` as the venue's handle would give nearly
 * every pin the handle "intent".
 */
const NOT_A_PROFILE = new Set([
  // Sharing and auth endpoints.
  "intent",
  "share",
  "sharer",
  "shareartic",
  "sharearticle",
  "share-offsite",
  "sharing",
  "home",
  "login",
  "signup",
  "session",
  "oauth",
  "privacy",
  "tos",
  "terms",
  "about",
  "help",
  "settings",
  "search",
  "explore",
  "hashtag",
  "i",
  // Content rather than an account.
  "p",
  "reel",
  "reels",
  "tv",
  "stories",
  "status",
  "posts",
  "feed",
  "pulse",
  "jobs",
  "learning",
  "directory",
  "widgets",
  "embed",
]);

/** LinkedIn keeps profiles one level down; the prefix is part of the handle. */
const LINKEDIN_PREFIXES = new Set(["in", "company", "school", "showcase"]);

const HANDLE_PATTERN = /^[A-Za-z0-9._-]{1,40}$/;

/**
 * Turns one URL into a platform + handle, or null when it isn't a profile.
 * Exported because this single-URL decision is where the false positives
 * live, and it's far easier to test directly than through a page of HTML.
 */
export function socialHandleFromUrl(rawUrl: string): { platform: SocialPlatform; handle: string } | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  const platform = (Object.keys(PLATFORM_HOSTS) as SocialPlatform[]).find((p) =>
    PLATFORM_HOSTS[p].test(url.hostname),
  );
  if (!platform) return null;

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  const first = segments[0].toLowerCase();
  if (NOT_A_PROFILE.has(first)) return null;

  if (platform === "linkedin") {
    // Bare linkedin.com/foo isn't a profile — it needs in/, company/, etc.
    if (!LINKEDIN_PREFIXES.has(first)) return null;
    const slug = segments[1];
    if (!slug || !HANDLE_PATTERN.test(slug)) return null;
    return { platform, handle: `${first}/${slug}` };
  }

  if (segments.length > 1) {
    // twitter.com/someone/status/123 is a tweet, not the account — but the
    // account is still in there, so keep it rather than dropping the URL.
    const second = segments[1].toLowerCase();
    if (!["status", "statuses", "with_replies", "photo", "likes"].includes(second)) return null;
  }

  const handle = segments[0].replace(/^@/, "");
  if (!HANDLE_PATTERN.test(handle)) return null;
  return { platform, handle };
}

/** Every href in a page, in document order. Deliberately crude — we only need the URLs. */
function hrefsIn(html: string): string[] {
  const found: string[] = [];
  const pattern = /<a\b[^>]*?\shref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s">]+))/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    found.push(match[1] ?? match[2] ?? match[3] ?? "");
  }
  return found;
}

/**
 * Reads a page's links and returns at most one handle per platform.
 *
 * First match wins, which in practice favours the header or the top of the
 * footer — where a site puts its own accounts — over anything further down.
 */
export function parseSocialLinks(html: string, baseUrl: URL): SocialSuggestions {
  const found: SocialSuggestions = {};
  for (const href of hrefsIn(html)) {
    let absolute: string;
    try {
      absolute = new URL(href, baseUrl).toString();
    } catch {
      continue;
    }
    const hit = socialHandleFromUrl(absolute);
    if (hit && !found[hit.platform]) found[hit.platform] = hit.handle;
  }
  return found;
}

/**
 * Fetches a venue's website and reports whatever profiles it links to.
 *
 * Never throws for an unreachable or unparseable site: a venue with a dead
 * website should mean "no suggestions", not a visible error on a form the
 * person didn't ask to interact with.
 */
export async function discoverSocialLinks(website: string): Promise<SocialSuggestions> {
  try {
    const { html, finalUrl } = await fetchHtml(website);
    return parseSocialLinks(html, finalUrl);
  } catch {
    return {};
  }
}

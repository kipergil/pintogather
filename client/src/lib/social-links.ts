export type SocialPlatform = "twitter" | "instagram" | "linkedin";

const PLATFORM_DOMAIN: Record<SocialPlatform, RegExp> = {
  twitter: /^(www\.)?(twitter|x)\.com\//i,
  instagram: /^(www\.)?instagram\.com\//i,
  linkedin: /^(www\.)?linkedin\.com\//i,
};

const PLATFORM_BASE_URL: Record<SocialPlatform, string> = {
  twitter: "https://twitter.com/",
  instagram: "https://instagram.com/",
  linkedin: "https://linkedin.com/in/",
};

/**
 * Builds a clickable profile URL from a saved social field, which may be
 * either a bare handle (e.g. "pintogather", optionally with a leading "@")
 * or a full profile URL pasted directly — LinkedIn in particular is often a
 * full URL like linkedin.com/company/foo that a fixed "/in/" prefix would
 * mangle. Returns null for an empty value.
 */
export function buildSocialUrl(platform: SocialPlatform, value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (PLATFORM_DOMAIN[platform].test(trimmed)) return `https://${trimmed}`;

  return `${PLATFORM_BASE_URL[platform]}${trimmed.replace(/^@/, "")}`;
}

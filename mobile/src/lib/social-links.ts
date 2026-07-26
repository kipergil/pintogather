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

/** Same logic as client/src/lib/social-links.ts's buildSocialUrl, duplicated rather than imported since mobile only reaches into ../shared, not ../client. */
export function buildSocialUrl(platform: SocialPlatform, value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (PLATFORM_DOMAIN[platform].test(trimmed)) return `https://${trimmed}`;

  return `${PLATFORM_BASE_URL[platform]}${trimmed.replace(/^@/, "")}`;
}

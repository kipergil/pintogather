export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface PageMeta {
  title: string;
  description: string;
  url: string;
}

/**
 * Swaps the static homepage title/description/OG/Twitter tags baked into
 * the built HTML shell for per-page ones, and inserts an og:url (not
 * present in the static template — every page shares one canonical URL
 * otherwise). Matches by tag+attribute shape rather than exact wording, so
 * it keeps working if the static copy in client/index.html changes later.
 * og:image stays the app-wide static fallback — untouched here.
 */
export function injectPageMeta(html: string, meta: PageMeta): string {
  const title = escapeHtml(meta.title);
  const description = escapeHtml(meta.description);
  const url = escapeHtml(meta.url);

  let result = html
    .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${description}">`)
    .replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${title}">`)
    .replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${description}">`)
    .replace(/<meta name="twitter:title" content="[^"]*">/, `<meta name="twitter:title" content="${title}">`)
    .replace(/<meta name="twitter:description" content="[^"]*">/, `<meta name="twitter:description" content="${description}">`);

  if (/<meta property="og:url" content="[^"]*">/.test(result)) {
    result = result.replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${url}">`);
  } else {
    result = result.replace(
      /<meta property="og:type" content="website">/,
      `<meta property="og:type" content="website">\n    <meta property="og:url" content="${url}">`,
    );
  }

  return result;
}

import type { ItemType } from "../../shared/enums.js";
import { DESCRIPTION_MAX_CHARS, stripDecoration, truncateDescription } from "../../shared/text.js";

/** The title column caps here (see pinFieldsSchema), and a name past it would fail the whole bulk insert rather than just itself. */
const NAME_MAX_CHARS = 255;

/**
 * Extraction prompts per collection item type. All three return the same
 * JSON-object shape so the client's staging pipeline can treat every source
 * (prompt, screenshot, pasted text) identically — `name` is the only
 * required key, `url`/`note` fill in when the source actually carries them.
 */
const EXTRACT_SHAPE_INSTRUCTION =
  'Respond with ONLY a JSON array of up to 15 objects — no explanation, no markdown fences. Each object has ' +
  '"name" (required, a short title) and optionally "url" (an absolute http/https link) and "note" (one or two ' +
  `sentences of context, at most ${DESCRIPTION_MAX_CHARS} characters). Use plain text only — no emoji, stars, ` +
  "arrows or other decorative symbols. Omit a key entirely rather than sending an empty string. If you find " +
  "nothing, respond with [].";

export const EXTRACT_SYSTEM_PROMPTS: Record<ItemType, { fromPrompt: string; fromImages: string }> = {
  location: {
    fromPrompt:
      "You suggest real, specific, well-known venues or places for a collaborative map-pinning app. Given the " +
      'user\'s theme, each "name" must be a real place specific enough to find on Google Maps; include the city ' +
      'or neighborhood if it helps disambiguate (e.g. "Ichiran Ramen Shibuya" rather than just "Ichiran"). ' +
      EXTRACT_SHAPE_INSTRUCTION,
    fromImages:
      "You extract real, specific venues or places mentioned or shown in images for a collaborative map-pinning " +
      "app. The images may be screenshots of a text conversation, a social media post, a list, or photos with " +
      'visible signage — find every distinct venue or place across all of them. Each "name" must be specific ' +
      'enough to find on Google Maps; include the city or neighborhood if it helps disambiguate (e.g. "Ichiran ' +
      'Ramen Shibuya" rather than just "Ichiran"). ' +
      EXTRACT_SHAPE_INSTRUCTION,
  },
  link: {
    fromPrompt:
      "You suggest real, specific web pages, articles, or resources for a collection of saved links. Given the " +
      'user\'s theme, each object should carry a "url" pointing at a real, canonical page you are confident ' +
      'exists, a "name" that is the page\'s actual title, and a "note" saying why it is worth reading. Never ' +
      "invent a URL you are not confident about — omit the url rather than guessing. " +
      EXTRACT_SHAPE_INSTRUCTION,
    fromImages:
      "You extract web links and the pages they point at from images for a collection of saved links. The images " +
      "may be screenshots of a browser, a chat, a bookmarks list, or a social feed — find every distinct URL or " +
      'clearly-identified page. Put the link in "url" (reconstruct it exactly as shown; do not guess at parts ' +
      'that are cut off), the page or post title in "name", and any visible context in "note". ' +
      EXTRACT_SHAPE_INSTRUCTION,
  },
  recommendation: {
    fromPrompt:
      "You suggest specific things a person could recommend to others — books, films, products, tools, dishes, " +
      'anything nameable — for a free-form recommendations list. Given the user\'s theme, "name" is the thing ' +
      'itself and "note" is a short reason it is worth recommending. Include a "url" only when there is an ' +
      "obvious canonical page for it. " +
      EXTRACT_SHAPE_INSTRUCTION,
    fromImages:
      "You extract recommendable things — books, films, products, tools, dishes, places, anything nameable — " +
      "mentioned or shown in images, for a free-form recommendations list. The images may be screenshots of a " +
      'conversation, a list, a shelf, a menu, or a social post. "name" is the thing itself, "note" is any ' +
      "visible context about why it came up. " +
      EXTRACT_SHAPE_INSTRUCTION,
  },
};

/** One extracted candidate, before the client resolves it against Google Places / a link preview. */
export interface ExtractedItem {
  name: string;
  url?: string;
  note?: string;
}

/**
 * Parses Claude's reply into ExtractedItems. Accepts both the object array
 * the prompts ask for and a bare string array, since older clients and the
 * occasional stubborn model response still produce the latter.
 *
 * Both text fields are cleaned and bounded here rather than trusted: the
 * prompt asks for plain text within a length, and a model that ignores
 * either shouldn't be able to put a wall of emoji on a pin — or, worse,
 * fail somebody's whole import by one character of overrun.
 */
export function parseExtractedItems(raw: string): ExtractedItem[] {
  let parsed: unknown;
  try {
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const items: ExtractedItem[] = [];
  for (const entry of parsed) {
    if (typeof entry === "string") {
      const name = cleanName(entry);
      if (name) items.push({ name });
      continue;
    }
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const name = typeof record.name === "string" ? cleanName(record.name) : "";
    if (!name) continue;
    const item: ExtractedItem = { name };
    // Only absolute http(s) URLs survive — a relative or malformed one would
    // just fail the client's preview fetch with a confusing error later.
    if (typeof record.url === "string" && /^https?:\/\/\S+$/i.test(record.url.trim())) {
      item.url = record.url.trim();
    }
    if (typeof record.note === "string") {
      const note = truncateDescription(stripDecoration(record.note), DESCRIPTION_MAX_CHARS);
      if (note) item.note = note;
    }
    items.push(item);
  }
  return items;
}

/** A name is a title, not prose: decoration off, and hard-capped at what the column accepts. */
function cleanName(value: string): string {
  return stripDecoration(value).slice(0, NAME_MAX_CHARS).trim();
}

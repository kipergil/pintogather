/**
 * Text cleaning for content on its way into a collection.
 *
 * Two different jobs live here, and they're deliberately separate:
 * `stripDecoration` is safe to run over prose (it only removes glyphs that
 * carry no meaning as text), while `stripLineDecoration` also takes off
 * list markers and edge punctuation, which is right for a pasted line and
 * wrong for a sentence.
 */

/**
 * Longest description text the app stores on an item.
 *
 * 1000 rather than a round-feeling number of its own: the
 * `pins.editorial_summary` column already caps there, so a description has
 * one limit whichever field it lands in.
 */
export const DESCRIPTION_MAX_CHARS = 1000;

/**
 * Characters with no visible width: zero-width spaces and joiners, bidi
 * embedding marks from text copied out of chat apps, and the variation
 * selectors that ask for an emoji rendering. Removed outright rather than
 * replaced with a space — a zero-width space sits *inside* a word, and
 * turning it into a gap would split "Dishoom" in two.
 */
const INVISIBLE = /[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFE00-\uFE0F]/g;

/**
 * Keycap emoji: the digit, a variation selector and a combining keycap, as
 * one unit. Dropping only the invisible halves would leave a stray "1" at
 * the front of the name.
 */
const KEYCAP = /[0-9#*]\uFE0F?\u20E3/g;

/**
 * Emoji and pictographs, as explicit code-point ranges rather than
 * `\p{Extended_Pictographic}`.
 *
 * The ranges are the unglamorous part: this repo's tsconfig sets no
 * `target`, so everything compiles as ES5, where TypeScript rejects both
 * Unicode property escapes and the `u` flag they require. Hence also the
 * surrogate-pair clause at the end, which stops at U+1FFFF — one plane
 * short of the CJK extensions, so Chinese and Japanese names survive.
 */
const DECORATION = new RegExp(
  "[" +
    "\\u2190-\\u21FF" + // arrows
    "\\u2300-\\u23FF" + // misc technical (⌚ ⏰ ⏳)
    "\\u2460-\\u24FF" + // enclosed alphanumerics (① ②)
    "\\u2500-\\u27BF" + // box drawing, blocks, geometric shapes, misc symbols, dingbats (─ ▶ ★ ✓ ✨)
    "\\u2B00-\\u2BFF" + // more arrows and stars (⭐ ⬆)
    "\\u2022\\u2023\\u2043\\u2219" + // bullets
    "\\u20E3" + // a combining keycap left on its own
    "\\u3030\\u303D" + // wavy dash, part alternation mark
    "]" +
    "|[\\uD83C-\\uD83E][\\uDC00-\\uDFFF]", // U+1F000–1FFFF: every emoji plane
  "g",
);

/** Bullets, dashes and quote markers a pasted list puts in front of each line. */
const LEADING_MARKER = /^[\s\-–—*+>«»‹›·]+/;
/** "1. ", "2) " — numbering from an ordered list. The trailing space is required so a name like "1984" is left alone. */
const LEADING_NUMBER = /^\d+[.)]\s+/;
/** Separators left dangling once a trailing emoji or icon has gone: "Dishoom —" → "Dishoom". */
const TRAILING_SEPARATOR = /[\s\-–—:|,;·]+$/;

/**
 * Removes emoji and invisible formatting, and normalises whitespace.
 *
 * Safe on prose: no punctuation is touched, so a sentence keeps its commas
 * and full stop. Letterlike symbols (™, ®, °) are left alone too — they
 * read as part of a name far more often than as decoration.
 */
export function stripDecoration(text: string): string {
  return text
    .replace(KEYCAP, " ")
    .replace(INVISIBLE, "")
    .replace(DECORATION, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The same, plus the furniture of a pasted list: leading bullets and
 * numbering, and separators left stranded at either end.
 *
 * A line that was nothing but decoration comes back empty, which the
 * parsers treat as "no item here" rather than adding a blank row.
 */
export function stripLineDecoration(line: string): string {
  return stripDecoration(line)
    .replace(LEADING_MARKER, "")
    .replace(LEADING_NUMBER, "")
    .replace(LEADING_MARKER, "")
    .replace(TRAILING_SEPARATOR, "")
    .trim();
}

/**
 * Cuts description text down to `max` characters, at a word boundary where
 * there is one nearby, marking the cut with an ellipsis that counts toward
 * the limit rather than pushing past it.
 *
 * Truncating beats rejecting for machine-written text: a model that
 * ignores the length it was asked for shouldn't fail somebody's import.
 */
export function truncateDescription(text: string, max: number = DESCRIPTION_MAX_CHARS): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;

  const room = max - 1; // the ellipsis has to fit inside the limit too
  const cut = trimmed.slice(0, room);
  const lastSpace = cut.lastIndexOf(" ");
  // Only break at a word when that doesn't throw most of the text away —
  // writing with no spaces at all (a long URL, a Chinese sentence) has to
  // come back at full length, not as a single ellipsis.
  const body = lastSpace > room * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${body.replace(TRAILING_SEPARATOR, "").replace(/[.!?]+$/, "")}…`;
}

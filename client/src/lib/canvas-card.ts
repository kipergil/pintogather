/** Small canvas-drawing helpers shared by the branded card generators (share-image.ts, discover-cover.ts). */

/** Same teardrop path used for pin markers on the map itself (pin-styles.ts), so decorative glyphs read as the same "pin" shape everywhere in the app. */
export const PIN_GLYPH_PATH =
  "M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0";
export const PIN_GLYPH_CIRCLE = { cx: 12, cy: 10, r: 3 };

/** Deterministic PRNG seeded from a string, so a given card's decorative scatter looks the same every time it's regenerated rather than jittering between renders. */
export function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

export function drawPinGlyph(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, color: string, alpha: number) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.translate(-12, -12);
  const path = new Path2D(PIN_GLYPH_PATH);
  ctx.fillStyle = color;
  ctx.fill(path);
  ctx.beginPath();
  ctx.arc(PIN_GLYPH_CIRCLE.cx, PIN_GLYPH_CIRCLE.cy, PIN_GLYPH_CIRCLE.r, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fill();
  ctx.restore();
}

export function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const attempt = current ? `${current} ${word}` : word;
    if (ctx.measureText(attempt).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = attempt;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Shrinks a bold sans-serif title font (starting at maxFontSize) until it wraps to at most maxLines within maxWidth. */
export function fitTitle(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  opts: { maxFontSize?: number; minFontSize?: number; maxLines?: number } = {},
): { fontSize: number; lines: string[] } {
  const maxFontSize = opts.maxFontSize ?? 72;
  const minFontSize = opts.minFontSize ?? 36;
  const maxLines = opts.maxLines ?? 3;
  let fontSize = maxFontSize;
  while (fontSize > minFontSize) {
    ctx.font = `700 ${fontSize}px sans-serif`;
    const lines = wrapLines(ctx, text, maxWidth);
    if (lines.length <= maxLines) return { fontSize, lines };
    fontSize -= 4;
  }
  ctx.font = `700 ${fontSize}px sans-serif`;
  return { fontSize, lines: wrapLines(ctx, text, maxWidth).slice(0, maxLines) };
}

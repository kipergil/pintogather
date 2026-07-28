import type { CuratedCategory } from "@shared/enums";
import { drawPinGlyph, fitTitle, seededRandom } from "@/lib/canvas-card";
import { CURATED_CATEGORY_GRADIENT } from "@/lib/curated-maps";

const WIDTH = 640;
const HEIGHT = 400;
const DEFAULT_GRADIENT: [string, string] = ["#2C3B7A", "#EE6B4D"];

export interface DiscoverCoverOptions {
  mapId: string;
  mapName: string;
  category: CuratedCategory | null;
}

/**
 * A lighter, landscape branded card for the /discover grid — same visual
 * language as share-image.ts's share card (gradient + decorative pin
 * scatter + title) but sized for a browse grid and colored per category so
 * the page reads as a real catalog rather than one repeated background.
 * Returns a data URL directly (sync canvas.toDataURL) since it's only ever
 * used as an <img src>, never downloaded or shared as a file.
 */
export function generateDiscoverCoverUrl(options: DiscoverCoverOptions): string {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  const [c1, c2] = options.category ? CURATED_CATEGORY_GRADIENT[options.category] : DEFAULT_GRADIENT;
  const gradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  gradient.addColorStop(0, c1);
  gradient.addColorStop(1, c2);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const rand = seededRandom(options.mapId || options.mapName);
  for (let i = 0; i < 8; i++) {
    const x = rand() * WIDTH;
    const y = rand() * HEIGHT;
    const scale = 1.1 + rand() * 1.8;
    drawPinGlyph(ctx, x, y, scale, "#ffffff", 0.14 + rand() * 0.12);
  }

  const scrim = ctx.createLinearGradient(0, HEIGHT * 0.4, 0, HEIGHT);
  scrim.addColorStop(0, "rgba(15, 23, 42, 0)");
  scrim.addColorStop(1, "rgba(15, 23, 42, 0.55)");
  ctx.fillStyle = scrim;
  ctx.fillRect(0, HEIGHT * 0.4, WIDTH, HEIGHT * 0.6);

  const maxTextWidth = WIDTH - 64;
  const { fontSize, lines } = fitTitle(ctx, options.mapName, maxTextWidth, { maxFontSize: 40, minFontSize: 22, maxLines: 3 });
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(0,0,0,0.3)";
  ctx.shadowBlur = 8;

  const lineHeight = fontSize * 1.16;
  let textY = HEIGHT - 32 - (lines.length - 1) * lineHeight;
  ctx.font = `700 ${fontSize}px sans-serif`;
  for (const line of lines) {
    ctx.fillText(line, 32, textY);
    textY += lineHeight;
  }
  ctx.shadowBlur = 0;

  return canvas.toDataURL("image/png");
}

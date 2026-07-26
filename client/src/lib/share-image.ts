import { PIN_COLOR, type PinColor } from "@shared/enums";
import { PIN_COLOR_HEX } from "@/lib/pin-styles";
import { drawPinGlyph, fitTitle, seededRandom } from "@/lib/canvas-card";

const SIZE = 1080;

export interface ShareImageOptions {
  mapId: string;
  mapName: string;
  ownerName?: string | null;
  pinCount: number;
}

/**
 * Renders a branded 1080x1080 share card — gradient background, a loose
 * scatter of decorative pin glyphs confined to top/bottom bands, and the
 * map's own title/owner/pin-count centered in the clear space between. No
 * PinTogather wordmark or URL — the card is about the map being shared, not
 * the app, so the color signature does the branding work instead of a logo.
 */
export async function generateShareImage(options: ShareImageOptions): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  const gradient = ctx.createLinearGradient(0, 0, SIZE, SIZE);
  gradient.addColorStop(0, "#2563EB");
  gradient.addColorStop(1, "#7C3AED");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Soft radial vignette for depth, independent of the text layout below.
  const vignette = ctx.createRadialGradient(SIZE / 2, SIZE * 0.46, SIZE * 0.15, SIZE / 2, SIZE * 0.46, SIZE * 0.78);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(15,23,42,0.3)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Decorative pin-glyph texture, deterministic per map — confined to top
  // and bottom bands so the center stays clear for the title instead of
  // competing with it.
  const rand = seededRandom(options.mapId || options.mapName);
  const scatterBand = (yMin: number, yMax: number, count: number) => {
    for (let i = 0; i < count; i++) {
      const x = 60 + rand() * (SIZE - 120);
      const y = yMin + rand() * (yMax - yMin);
      const scale = 1.3 + rand() * 2.4;
      const color = PIN_COLOR_HEX[PIN_COLOR[Math.floor(rand() * PIN_COLOR.length)] as PinColor];
      drawPinGlyph(ctx, x, y, scale, color, 0.16 + rand() * 0.14);
    }
  };
  scatterBand(36, SIZE * 0.2, 6);
  scatterBand(SIZE * 0.84, SIZE - 36, 6);

  // Content block (title, optional owner credit, pin-count pill) is
  // centered as a single group in the clear middle of the card.
  const maxTextWidth = SIZE - 140;
  const { fontSize, lines } = fitTitle(ctx, options.mapName, maxTextWidth, {
    maxFontSize: 78,
    minFontSize: 42,
    maxLines: 3,
  });
  const lineHeight = fontSize * 1.16;
  const titleHeight = lines.length * lineHeight;

  const ownerFontSize = 32;
  const ownerGap = 26;
  const ownerBlockHeight = options.ownerName ? ownerGap + ownerFontSize : 0;

  const pillGap = 40;
  const pillHeight = 58;

  const blockHeight = titleHeight + ownerBlockHeight + pillGap + pillHeight;
  let sectionTop = SIZE / 2 - blockHeight / 2;

  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(0,0,0,0.22)";
  ctx.shadowBlur = 14;
  ctx.font = `700 ${fontSize}px sans-serif`;
  for (let i = 0; i < lines.length; i++) {
    const baseline = sectionTop + fontSize + i * lineHeight;
    ctx.fillText(lines[i], SIZE / 2, baseline);
  }
  ctx.shadowBlur = 0;
  sectionTop += titleHeight;

  if (options.ownerName) {
    sectionTop += ownerGap;
    ctx.font = '500 32px sans-serif';
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillText(`Curated by ${options.ownerName}`, SIZE / 2, sectionTop + ownerFontSize);
    sectionTop += ownerFontSize;
  }

  sectionTop += pillGap;
  const pillText = `${options.pinCount} ${options.pinCount === 1 ? "pin" : "pins"}`;
  ctx.font = '600 28px sans-serif';
  const pillTextWidth = ctx.measureText(pillText).width;
  const pillPaddingX = 26;
  const pillGlyphGap = 34;
  const pillWidth = pillTextWidth + pillPaddingX * 2 + pillGlyphGap;
  const pillX = SIZE / 2 - pillWidth / 2;
  const pillY = sectionTop;
  ctx.fillStyle = "rgba(255,255,255,0.16)";
  ctx.beginPath();
  ctx.moveTo(pillX + pillHeight / 2, pillY);
  ctx.arcTo(pillX + pillWidth, pillY, pillX + pillWidth, pillY + pillHeight, pillHeight / 2);
  ctx.arcTo(pillX + pillWidth, pillY + pillHeight, pillX, pillY + pillHeight, pillHeight / 2);
  ctx.arcTo(pillX, pillY + pillHeight, pillX, pillY, pillHeight / 2);
  ctx.arcTo(pillX, pillY, pillX + pillWidth, pillY, pillHeight / 2);
  ctx.closePath();
  ctx.fill();
  drawPinGlyph(ctx, pillX + pillPaddingX + 12, pillY + pillHeight / 2, 1.15, "#ffffff", 1);
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(pillText, pillX + pillPaddingX + pillGlyphGap, pillY + pillHeight / 2 + 1);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Failed to render share image"));
    }, "image/png");
  });
}

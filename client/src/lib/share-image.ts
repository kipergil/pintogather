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

/** Renders a branded 1080x1080 share card (gradient background, scattered decorative pins, map title/owner/pin-count) entirely client-side. No map imagery — just the app's own visual identity. */
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

  // Decorative, out-of-focus-feeling scatter of pin glyphs — deterministic per map.
  const rand = seededRandom(options.mapId || options.mapName);
  for (let i = 0; i < 14; i++) {
    const x = rand() * SIZE;
    const y = rand() * SIZE;
    const scale = 1.4 + rand() * 2.6;
    const color = PIN_COLOR_HEX[PIN_COLOR[Math.floor(rand() * PIN_COLOR.length)] as PinColor];
    drawPinGlyph(ctx, x, y, scale, color, 0.16 + rand() * 0.14);
  }

  // Scrim so text stays legible over the gradient + scatter regardless of position.
  const scrim = ctx.createLinearGradient(0, SIZE * 0.35, 0, SIZE);
  scrim.addColorStop(0, "rgba(15, 23, 42, 0)");
  scrim.addColorStop(1, "rgba(15, 23, 42, 0.45)");
  ctx.fillStyle = scrim;
  ctx.fillRect(0, SIZE * 0.35, SIZE, SIZE * 0.65);

  // Brand mark, top-left.
  const badgeSize = 56;
  const badgeX = 64;
  const badgeY = 64;
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  const radius = 14;
  ctx.beginPath();
  ctx.moveTo(badgeX + radius, badgeY);
  ctx.arcTo(badgeX + badgeSize, badgeY, badgeX + badgeSize, badgeY + badgeSize, radius);
  ctx.arcTo(badgeX + badgeSize, badgeY + badgeSize, badgeX, badgeY + badgeSize, radius);
  ctx.arcTo(badgeX, badgeY + badgeSize, badgeX, badgeY, radius);
  ctx.arcTo(badgeX, badgeY, badgeX + badgeSize, badgeY, radius);
  ctx.closePath();
  ctx.fill();
  drawPinGlyph(ctx, badgeX + badgeSize / 2, badgeY + badgeSize / 2, 1.6, "#2563EB", 1);

  ctx.font = '600 34px sans-serif';
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "middle";
  ctx.fillText("PinTogather", badgeX + badgeSize + 16, badgeY + badgeSize / 2 + 2);

  // Title, vertically centered in the lower two-thirds.
  const maxTextWidth = SIZE - 128;
  const { fontSize, lines } = fitTitle(ctx, options.mapName, maxTextWidth);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(0,0,0,0.25)";
  ctx.shadowBlur = 12;

  const lineHeight = fontSize * 1.18;
  const blockHeight = lines.length * lineHeight;
  let titleY = SIZE * 0.62 - blockHeight / 2 + fontSize;
  ctx.font = `700 ${fontSize}px sans-serif`;
  for (const line of lines) {
    ctx.fillText(line, SIZE / 2, titleY);
    titleY += lineHeight;
  }
  ctx.shadowBlur = 0;

  let y = titleY + 8;
  if (options.ownerName) {
    ctx.font = '500 32px sans-serif';
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillText(`Curated by ${options.ownerName}`, SIZE / 2, y);
    y += 52;
  }

  // Pin-count pill.
  const pillText = `${options.pinCount} ${options.pinCount === 1 ? "pin" : "pins"}`;
  ctx.font = '600 28px sans-serif';
  const pillTextWidth = ctx.measureText(pillText).width;
  const pillPaddingX = 26;
  const pillGlyphGap = 34;
  const pillWidth = pillTextWidth + pillPaddingX * 2 + pillGlyphGap;
  const pillHeight = 56;
  const pillX = SIZE / 2 - pillWidth / 2;
  const pillY = y + 20;
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

  ctx.textAlign = "center";
  ctx.font = '500 24px sans-serif';
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.fillText("pintogather.app", SIZE / 2, SIZE - 56);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Failed to render share image"));
    }, "image/png");
  });
}

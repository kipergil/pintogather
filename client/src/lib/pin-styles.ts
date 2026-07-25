import { PIN_COLOR, PIN_ICON, type PinColor, type PinIcon } from "@shared/enums";

export const PIN_COLOR_HEX: Record<PinColor, string> = {
  red: "#EF4444",
  orange: "#F97316",
  amber: "#F59E0B",
  yellow: "#EAB308",
  green: "#22C55E",
  teal: "#14B8A6",
  blue: "#3B82F6",
  indigo: "#6366F1",
  purple: "#A855F7",
  pink: "#EC4899",
};

export const PIN_COLOR_LABELS: Record<PinColor, string> = {
  red: "Red",
  orange: "Orange",
  amber: "Amber",
  yellow: "Yellow",
  green: "Green",
  teal: "Teal",
  blue: "Blue",
  indigo: "Indigo",
  purple: "Purple",
  pink: "Pink",
};

export const PIN_ICON_LABELS: Record<PinIcon, string> = {
  pin: "Pin",
  star: "Star",
  heart: "Heart",
  coffee: "Coffee",
  restaurant: "Restaurant",
  home: "Home",
  building: "Building",
  landmark: "Landmark",
  shopping: "Shopping",
  bed: "Lodging",
  trees: "Park",
  music: "Music",
  camera: "Scenic",
  flag: "Flag",
};

/**
 * Inner SVG markup for each icon glyph, lifted directly from lucide-react's
 * own path data (24x24 viewBox, stroke-based) so marker glyphs render with
 * the exact same shapes as the icons used everywhere else in the app.
 */
const PIN_ICON_SVG: Record<PinIcon, string> = {
  pin: `<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>`,
  star: `<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>`,
  heart: `<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>`,
  coffee: `<path d="M10 2v2"/><path d="M14 2v2"/><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/><path d="M6 2v2"/>`,
  restaurant: `<path d="m16 2-2.3 2.3a3 3 0 0 0 0 4.2l1.8 1.8a3 3 0 0 0 4.2 0L22 8"/><path d="M15 15 3.3 3.3a4.2 4.2 0 0 0 0 6l7.3 7.3c.7.7 2 .7 2.8 0L15 15Zm0 0 7 7"/><path d="m2.1 21.8 6.4-6.3"/><path d="m19 5-7 7"/>`,
  home: `<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>`,
  building: `<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>`,
  landmark: `<line x1="3" x2="21" y1="22" y2="22"/><line x1="6" x2="6" y1="18" y2="11"/><line x1="10" x2="10" y1="18" y2="11"/><line x1="14" x2="14" y1="18" y2="11"/><line x1="18" x2="18" y1="18" y2="11"/><polygon points="12 2 20 7 4 7"/>`,
  shopping: `<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>`,
  bed: `<path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/>`,
  trees: `<path d="M10 10v.2A3 3 0 0 1 8.9 16H5a3 3 0 0 1-1-5.8V10a3 3 0 0 1 6 0Z"/><path d="M7 16v6"/><path d="M13 19v3"/><path d="M12 19h8.3a1 1 0 0 0 .7-1.7L18 14h.3a1 1 0 0 0 .7-1.7L16 9h.2a1 1 0 0 0 .8-1.7L13 3l-1.4 1.5"/>`,
  music: `<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>`,
  camera: `<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>`,
  flag: `<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/>`,
};

export function isPinColor(value: unknown): value is PinColor {
  return typeof value === "string" && (PIN_COLOR as readonly string[]).includes(value);
}

export function isPinIcon(value: unknown): value is PinIcon {
  return typeof value === "string" && (PIN_ICON as readonly string[]).includes(value);
}

const MARKER_SIZE = 32;
const MARKER_CENTER = MARKER_SIZE / 2;

/**
 * Builds a Google Maps marker icon (data-URI SVG) for a pin's resolved
 * color/icon. `pending` layers a dashed ring on top regardless of color, so
 * a pin's approval status stays visible no matter what color/icon it uses —
 * approved/pending was the map's only visual signal before this feature, and
 * a freely-colorable fill would otherwise erase it.
 */
export function buildPinMarkerIcon(options: {
  color: PinColor | null;
  icon: PinIcon | null;
  pending: boolean;
}): google.maps.Icon {
  const hex = PIN_COLOR_HEX[options.color ?? "blue"];
  const glyph = options.icon ? PIN_ICON_SVG[options.icon] : null;

  const pendingRing = options.pending
    ? `<circle cx="${MARKER_CENTER}" cy="${MARKER_CENTER}" r="14.5" fill="none" stroke="#78716c" stroke-width="1.5" stroke-dasharray="3,2"/>`
    : "";
  const iconGlyph = glyph
    ? `<g transform="translate(8,8) scale(0.6667)" fill="none" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">${glyph}</g>`
    : "";

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${MARKER_SIZE}" height="${MARKER_SIZE}" viewBox="0 0 ${MARKER_SIZE} ${MARKER_SIZE}">` +
    pendingRing +
    `<circle cx="${MARKER_CENTER}" cy="${MARKER_CENTER}" r="11" fill="${hex}" stroke="#ffffff" stroke-width="2"/>` +
    iconGlyph +
    `</svg>`;

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(MARKER_SIZE, MARKER_SIZE),
    anchor: new google.maps.Point(MARKER_CENTER, MARKER_CENTER),
  };
}

/** Resolution order: a pin's own override, then the map's default, then the app fallback (null = plain blue, no glyph). */
export function resolvePinStyle(
  pin: { pinColor?: PinColor | null; pinIcon?: PinIcon | null },
  map: { defaultPinColor?: PinColor | null; defaultPinIcon?: PinIcon | null },
): { color: PinColor | null; icon: PinIcon | null } {
  return {
    color: pin.pinColor ?? map.defaultPinColor ?? null,
    icon: pin.pinIcon ?? map.defaultPinIcon ?? null,
  };
}

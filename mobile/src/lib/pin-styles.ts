import type { ComponentProps } from "react";
import type { Ionicons } from "@expo/vector-icons";
import type { PinColor, PinIcon } from "../../../shared/enums";

export type IoniconsName = ComponentProps<typeof Ionicons>["name"];

/** Same palette as client/src/lib/pin-styles.ts's PIN_COLOR_HEX, kept as a separate copy here since the web file's buildPinMarkerIcon() references `google.maps` types that don't exist in the mobile bundle. */
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

/** Closest @expo/vector-icons Ionicons glyph for each PinIcon — a visual approximation, not the exact lucide SVGs the web app inlines into its marker icons. */
export const PIN_ICON_IONICON: Record<PinIcon, IoniconsName> = {
  pin: "location",
  star: "star",
  heart: "heart",
  coffee: "cafe",
  restaurant: "restaurant",
  home: "home",
  building: "business",
  landmark: "flag-outline",
  shopping: "cart",
  bed: "bed",
  trees: "leaf",
  music: "musical-notes",
  camera: "camera",
  flag: "flag",
};

/** Resolution order: a pin's own override, then the map's default, then the app fallback (null = plain blue, no glyph). Mirrors client/src/lib/pin-styles.ts's resolvePinStyle. */
export function resolvePinStyle(
  pin: { pinColor?: PinColor | null; pinIcon?: PinIcon | null },
  map: { defaultPinColor?: PinColor | null; defaultPinIcon?: PinIcon | null },
): { color: PinColor | null; icon: PinIcon | null } {
  return {
    color: pin.pinColor ?? map.defaultPinColor ?? null,
    icon: pin.pinIcon ?? map.defaultPinIcon ?? null,
  };
}

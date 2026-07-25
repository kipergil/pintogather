import { PIN_COLOR, PIN_ICON, type PinColor, type PinIcon } from "@shared/enums";
import { PIN_COLOR_HEX, PIN_COLOR_LABELS, PIN_ICON_LABELS } from "@/lib/pin-styles";
import {
  Bed,
  Building2,
  Camera,
  Coffee,
  Flag,
  Heart,
  Home,
  Landmark,
  MapPin,
  Music,
  Slash,
  ShoppingBag,
  Star,
  Trees,
  UtensilsCrossed,
  X,
} from "lucide-react";

export const PIN_ICON_COMPONENTS: Record<PinIcon, typeof MapPin> = {
  pin: MapPin,
  star: Star,
  heart: Heart,
  coffee: Coffee,
  restaurant: UtensilsCrossed,
  home: Home,
  building: Building2,
  landmark: Landmark,
  shopping: ShoppingBag,
  bed: Bed,
  trees: Trees,
  music: Music,
  camera: Camera,
  flag: Flag,
};

/** Small read-only preview of a pin's own color/icon override, e.g. for a table row. Renders nothing when neither is set. */
export function PinStyleSwatch({ color, icon }: { color?: PinColor | null; icon?: PinIcon | null }) {
  if (!color && !icon) return null;
  const Glyph = icon ? PIN_ICON_COMPONENTS[icon] : null;
  return (
    <span
      title={`Custom pin style${color ? `: ${PIN_COLOR_LABELS[color]}` : ""}`}
      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white shadow-sm"
      style={{ backgroundColor: color ? PIN_COLOR_HEX[color] : "#3B82F6" }}
      data-testid="pin-style-swatch"
    >
      {Glyph && <Glyph className="h-3 w-3 text-white" />}
    </span>
  );
}

interface PinStylePickerProps {
  color: PinColor | null;
  icon: PinIcon | null;
  onChange: (next: { color: PinColor | null; icon: PinIcon | null }) => void;
  /** Label for the "clear" swatch/glyph — differs between map-default (fall back to plain blue) and per-pin override (fall back to the map's default). */
  noneLabel?: string;
}

export function PinStylePicker({ color, icon, onChange, noneLabel = "Default" }: PinStylePickerProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">Color</p>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            title={noneLabel}
            onClick={() => onChange({ color: null, icon })}
            className={`h-7 w-7 rounded-full border flex items-center justify-center transition-transform ${
              color === null ? "border-foreground ring-2 ring-offset-1 ring-foreground" : "border-border"
            }`}
            data-testid="button-pin-color-none"
          >
            <Slash className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          {PIN_COLOR.map((c) => (
            <button
              key={c}
              type="button"
              title={PIN_COLOR_LABELS[c]}
              onClick={() => onChange({ color: c, icon })}
              className={`h-7 w-7 rounded-full border-2 transition-transform ${
                color === c ? "border-foreground scale-110" : "border-white/60"
              }`}
              style={{ backgroundColor: PIN_COLOR_HEX[c] }}
              data-testid={`button-pin-color-${c}`}
            />
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground">Icon</p>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            title={noneLabel}
            onClick={() => onChange({ color, icon: null })}
            className={`h-8 w-8 rounded-md border flex items-center justify-center transition-colors ${
              icon === null ? "border-foreground bg-muted" : "border-border"
            }`}
            data-testid="button-pin-icon-none"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
          {PIN_ICON.map((i) => {
            const Glyph = PIN_ICON_COMPONENTS[i];
            return (
              <button
                key={i}
                type="button"
                title={PIN_ICON_LABELS[i]}
                onClick={() => onChange({ color, icon: i })}
                className={`h-8 w-8 rounded-md border flex items-center justify-center transition-colors ${
                  icon === i ? "border-foreground bg-muted" : "border-border"
                }`}
                data-testid={`button-pin-icon-${i}`}
              >
                <Glyph className="h-4 w-4" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

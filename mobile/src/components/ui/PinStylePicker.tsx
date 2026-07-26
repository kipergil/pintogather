import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PIN_COLOR, PIN_ICON } from "../../../../shared/enums";
import type { PinColor, PinIcon } from "../../../../shared/enums";
import { PIN_COLOR_HEX, PIN_ICON_IONICON } from "@/lib/pin-styles";

interface PinStylePickerProps {
  color: PinColor | null;
  icon: PinIcon | null;
  onChange: (value: { color: PinColor | null; icon: PinIcon | null }) => void;
  /** Label for the swatch that clears both color and icon back to the app default. */
  noneLabel?: string;
}

export function PinStylePicker({ color, icon, onChange, noneLabel = "Default" }: PinStylePickerProps) {
  return (
    <View className="gap-3">
      <View className="gap-1.5">
        <Text className="text-sm font-medium text-slate-700">Color</Text>
        <View className="flex-row flex-wrap gap-2">
          <Pressable
            onPress={() => onChange({ color: null, icon })}
            className={`h-9 w-9 items-center justify-center rounded-full border-2 bg-slate-100 ${color === null ? "border-slate-900" : "border-transparent"}`}
            testID="pin-color-none"
          >
            <Ionicons name="close" size={16} color="#64748b" />
          </Pressable>
          {PIN_COLOR.map((c) => (
            <Pressable
              key={c}
              onPress={() => onChange({ color: c, icon })}
              className={`h-9 w-9 rounded-full border-2 ${color === c ? "border-slate-900" : "border-transparent"}`}
              style={{ backgroundColor: PIN_COLOR_HEX[c] }}
              testID={`pin-color-${c}`}
            />
          ))}
        </View>
      </View>

      <View className="gap-1.5">
        <Text className="text-sm font-medium text-slate-700">Icon</Text>
        <View className="flex-row flex-wrap gap-2">
          <Pressable
            onPress={() => onChange({ color, icon: null })}
            className={`h-10 w-10 items-center justify-center rounded-xl border-2 bg-slate-100 ${icon === null ? "border-slate-900" : "border-transparent"}`}
            testID="pin-icon-none"
          >
            <Text className="text-xs text-slate-500">{noneLabel.slice(0, 4)}</Text>
          </Pressable>
          {PIN_ICON.map((i) => (
            <Pressable
              key={i}
              onPress={() => onChange({ color, icon: i })}
              className={`h-10 w-10 items-center justify-center rounded-xl border-2 bg-slate-100 ${icon === i ? "border-slate-900" : "border-transparent"}`}
              testID={`pin-icon-${i}`}
            >
              <Ionicons name={PIN_ICON_IONICON[i]} size={18} color="#334155" />
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

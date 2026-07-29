import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ItemType } from "../../../shared/enums";

interface ItemTypePickerProps {
  onSelect: (itemType: ItemType) => void;
}

const OPTIONS: {
  itemType: ItemType;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  tagline: string;
}[] = [
  {
    itemType: "location",
    icon: "location-outline",
    label: "Locations",
    tagline: "A map — pin places for people to visit.",
  },
  {
    itemType: "link",
    icon: "link-outline",
    label: "Links",
    tagline:
      "A shared reading/watch list — paste a URL and it fills itself in.",
  },
  {
    itemType: "recommendation",
    icon: "sparkles-outline",
    label: "Recommendations",
    tagline: "Anything worth recommending — no location or link required.",
  },
];

/**
 * First step of creating a collection, mirroring client/src/components/
 * item-type-picker.tsx — what kind of thing it holds. Set once here and
 * never editable afterward (see shared/schema.ts's MapCollection.itemType).
 * "Locations" is the only choice that leads into TemplatePicker next.
 */
export function ItemTypePicker({ onSelect }: ItemTypePickerProps) {
  return (
    <View className="gap-4 py-6">
      <View className="gap-1">
        <Text className="text-lg font-semibold text-slate-900">
          What are you collecting?
        </Text>
        <Text className="text-sm text-slate-500">
          This can't be changed later, so pick the one that fits.
        </Text>
      </View>

      <View className="gap-2.5">
        {OPTIONS.map(({ itemType, icon, label, tagline }) => (
          <Pressable
            key={itemType}
            onPress={() => onSelect(itemType)}
            className="flex-row items-start gap-3 rounded-xl border border-slate-200 p-3.5 active:bg-slate-50"
            testID={`card-item-type-${itemType}`}
          >
            <View className="h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Ionicons name={icon} size={18} color="#2563EB" />
            </View>
            <View className="flex-1 gap-0.5">
              <Text className="font-medium text-slate-900">{label}</Text>
              <Text className="text-xs text-slate-500">{tagline}</Text>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

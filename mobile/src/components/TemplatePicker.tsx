import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { MAP_TEMPLATES, type MapTemplate } from "../../../shared/templates";

const TEMPLATE_ICON_NAMES: Record<MapTemplate["icon"], keyof typeof Ionicons.glyphMap> = {
  plane: "airplane-outline",
  compass: "compass-outline",
  heart: "heart-outline",
  briefcase: "briefcase-outline",
  users: "people-outline",
};

interface TemplatePickerProps {
  onSelect: (template: MapTemplate | null) => void;
}

/**
 * Shown before the create-map form so a new map never starts as a blank
 * "name your map" field. Mirrors client/src/components/template-picker.tsx —
 * picking a template just prefills the form's initial values, nothing is
 * persisted until the form itself is submitted.
 */
export function TemplatePicker({ onSelect }: TemplatePickerProps) {
  return (
    <View className="gap-4 py-6">
      <View className="gap-1">
        <Text className="text-lg font-semibold text-slate-900">What are you mapping?</Text>
        <Text className="text-sm text-slate-500">Start from a template, or build your own from scratch.</Text>
      </View>

      <View className="gap-2.5">
        {MAP_TEMPLATES.map((template) => (
          <Pressable
            key={template.id}
            onPress={() => onSelect(template)}
            className="flex-row items-start gap-3 rounded-xl border border-slate-200 p-3.5 active:bg-slate-50"
            testID={`card-template-${template.id}`}
          >
            <View className="h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Ionicons name={TEMPLATE_ICON_NAMES[template.icon]} size={18} color="#2563EB" />
            </View>
            <View className="flex-1 gap-0.5">
              <Text className="font-medium text-slate-900">{template.label}</Text>
              <Text className="text-xs text-slate-500">{template.tagline}</Text>
            </View>
          </Pressable>
        ))}

        <Pressable
          onPress={() => onSelect(null)}
          className="flex-row items-start gap-3 rounded-xl border border-dashed border-slate-300 p-3.5 active:bg-slate-50"
          testID="card-template-scratch"
        >
          <View className="h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
            <Ionicons name="sparkles-outline" size={18} color="#64748b" />
          </View>
          <View className="flex-1 gap-0.5">
            <Text className="font-medium text-slate-900">Start from scratch</Text>
            <Text className="text-xs text-slate-500">A blank map — set it up your own way.</Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

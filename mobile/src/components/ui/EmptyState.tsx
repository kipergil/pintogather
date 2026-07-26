import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  children?: React.ReactNode;
}

export function EmptyState({ icon = "map-outline", title, description, children }: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center gap-2 px-8 py-16">
      <Ionicons name={icon} size={40} color="#94a3b8" />
      <Text className="text-center text-base font-semibold text-slate-900">{title}</Text>
      {description && <Text className="text-center text-sm text-slate-500">{description}</Text>}
      {children}
    </View>
  );
}

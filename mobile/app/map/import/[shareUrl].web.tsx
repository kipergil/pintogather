import { Text, View } from "react-native";
import { Stack } from "expo-router";
import { EmptyState } from "@/components/ui/EmptyState";

/**
 * Same reasoning as app/map/[shareUrl].web.tsx: react-native-maps has no web
 * implementation, and this screen's "tap the map to place each pin" step
 * depends on it, so there's no meaningful web-preview fallback beyond a
 * placeholder notice — unlike the map detail screen, there's no plain-list
 * alternative that preserves this screen's actual purpose.
 */
export default function AddItemsWebFallback() {
  return (
    <View className="flex-1 bg-slate-50 px-4">
      <Stack.Screen options={{ title: "Add items" }} />
      <EmptyState
        icon="phone-portrait-outline"
        title="Import is only available in the iOS/Android app"
        description="Placing pins from a pasted list requires tapping a real map — open this project on a device or simulator."
      />
      <Text className="px-4 text-center text-xs text-slate-400">
        (This is a Metro/Expo Router web-target limitation of react-native-maps, not the real app.)
      </Text>
    </View>
  );
}

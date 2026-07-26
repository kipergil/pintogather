import { ActivityIndicator, FlatList, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { EmptyState } from "@/components/ui/EmptyState";
import { useMap } from "@/hooks/useMaps";
import { useRequireAuth } from "@/hooks/useRequireAuth";

/**
 * react-native-maps has no web implementation (it registers a native Fabric
 * component that doesn't exist in react-native-web, which would otherwise
 * crash Expo Router's route registration for the whole app on web). Metro
 * picks this file over [shareUrl].tsx automatically when bundling for web
 * — iOS/Android still get the real MapView screen, unaffected. This is a
 * plain-list fallback so the web preview target stays useful for
 * development instead of unusable; it isn't meant to be a shipped web
 * experience.
 */
export default function MapDetailWebFallback() {
  const { isSignedIn } = useRequireAuth();
  const { shareUrl } = useLocalSearchParams<{ shareUrl: string }>();
  const { data: map, isLoading, error } = useMap(shareUrl);

  if (!isSignedIn) return null;

  return (
    <View className="flex-1 bg-slate-50 px-4">
      <Stack.Screen options={{ title: map?.name ?? "Map" }} />
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      ) : error || !map ? (
        <EmptyState icon="alert-circle-outline" title="Couldn't load this map" />
      ) : (
        <>
          <View className="gap-1 py-4">
            <Text className="text-xl font-bold text-slate-900">{map.name}</Text>
            <Text className="text-sm text-amber-600">
              The map view is only available in the iOS/Android app — open this project on a device or simulator to see pins on a
              real map. Showing the pin list here instead.
            </Text>
          </View>
          <FlatList
            data={map.pins}
            keyExtractor={(pin) => pin.id}
            renderItem={({ item: pin }) => (
              <View className="mb-2 rounded-xl border border-slate-200 bg-white p-3">
                <Text className="font-semibold text-slate-900">{pin.userName}</Text>
                {pin.note && <Text className="text-sm text-slate-600">{pin.note}</Text>}
              </View>
            )}
            ListEmptyComponent={<EmptyState icon="location-outline" title="No pins yet" />}
          />
        </>
      )}
    </View>
  );
}

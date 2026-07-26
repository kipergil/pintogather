import { useState } from "react";
import { Alert, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/ui/Screen";
import { EmptyState } from "@/components/ui/EmptyState";
import { useMaps, useUnarchiveMaps, type MapListItem } from "@/hooks/useMaps";

function MapCard({
  map,
  onPress,
  archived,
  onRestore,
}: {
  map: MapListItem;
  onPress: () => void;
  archived?: boolean;
  onRestore?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="mb-3 rounded-2xl border border-slate-200 bg-white p-4 active:opacity-70"
      testID={`card-map-${map.id}`}
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 gap-1">
          <Text className="text-base font-semibold text-slate-900" numberOfLines={1}>
            {map.name}
          </Text>
          {map.description ? (
            <Text className="text-sm text-slate-500" numberOfLines={2}>
              {map.description}
            </Text>
          ) : (
            <Text className="text-sm italic text-slate-400">No description</Text>
          )}
        </View>
        {archived ? (
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              onRestore?.();
            }}
            hitSlop={8}
            testID={`button-restore-map-${map.id}`}
          >
            <Ionicons name="refresh" size={20} color="#2563EB" />
          </Pressable>
        ) : (
          <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
        )}
      </View>
      <View className="mt-3 flex-row items-center gap-1.5">
        <Ionicons name="location" size={14} color="#94a3b8" />
        <Text className="text-xs text-slate-500">
          {map.pinCount} {map.pinCount === 1 ? "pin" : "pins"}
        </Text>
      </View>
    </Pressable>
  );
}

export default function MapsListScreen() {
  const router = useRouter();
  const [showArchived, setShowArchived] = useState(false);
  const { data: maps, isLoading, isFetching, refetch } = useMaps(showArchived);
  const unarchiveMaps = useUnarchiveMaps();

  const onRestore = (map: MapListItem) => {
    Alert.alert("Restore map?", `"${map.name}" will reappear in your maps list.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Restore",
        onPress: async () => {
          try {
            await unarchiveMaps.mutateAsync([map.id]);
          } catch (err: any) {
            Alert.alert("Couldn't restore map", err?.message ?? "Please try again.");
          }
        },
      },
    ]);
  };

  return (
    <Screen>
      <View className="flex-row items-center justify-between py-4">
        <Text className="text-2xl font-bold text-slate-900">{showArchived ? "Archived maps" : "My Maps"}</Text>
        <View className="flex-row items-center gap-3">
          <Pressable onPress={() => setShowArchived((v) => !v)} hitSlop={8} testID="button-toggle-archived">
            <Ionicons name={showArchived ? "archive" : "archive-outline"} size={22} color="#2563EB" />
          </Pressable>
          {!showArchived && (
            <Pressable
              onPress={() => router.push("/map/create")}
              className="h-10 w-10 items-center justify-center rounded-full bg-primary active:bg-blue-700"
              testID="button-create-map"
            >
              <Ionicons name="add" size={24} color="white" />
            </Pressable>
          )}
        </View>
      </View>

      <FlatList
        data={maps ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) =>
          showArchived ? (
            <MapCard map={item} onPress={() => router.push(`/map/${item.shareUrl}`)} archived onRestore={() => onRestore(item)} />
          ) : (
            <MapCard map={item} onPress={() => router.push(`/map/${item.shareUrl}`)} />
          )
        }
        refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} />}
        contentContainerStyle={{ flexGrow: 1 }}
        ListEmptyComponent={
          !isLoading ? (
            showArchived ? (
              <EmptyState icon="archive-outline" title="No archived maps" description="Maps you archive will show up here." />
            ) : (
              <EmptyState icon="map-outline" title="No maps yet" description="Create your first map to start pinning places.">
                <Pressable onPress={() => router.push("/map/create")} className="mt-2">
                  <Text className="text-sm font-semibold text-primary">Create a map</Text>
                </Pressable>
              </EmptyState>
            )
          ) : null
        }
      />
    </Screen>
  );
}

import { useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/ui/Screen";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useBulkDeletePins, useMap } from "@/hooks/useMaps";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { PIN_COLOR_HEX, resolvePinStyle } from "@/lib/pin-styles";

export default function ManagePinsScreen() {
  const { isSignedIn } = useRequireAuth();
  const { shareUrl } = useLocalSearchParams<{ shareUrl: string }>();
  const { data: map, isLoading } = useMap(shareUrl);
  const { data: currentUser } = useCurrentUser();
  const bulkDeletePins = useBulkDeletePins(shareUrl);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  if (!isSignedIn) return null;

  const isOwner = !!currentUser && !!map && currentUser.id === map.ownerId;

  const canDeletePin = (pin: { userId: string | null }) => isOwner || (!!currentUser && currentUser.id === pin.userId);

  const pins = map?.pins ?? [];
  const selectableIds = pins.filter(canDeletePin).map((pin) => pin.id);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id));

  const toggleSelected = (pinId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(pinId)) next.delete(pinId);
      else next.add(pinId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(selectableIds));
  };

  const onBulkDelete = () => {
    const count = selectedIds.size;
    if (count === 0) return;
    Alert.alert("Delete pins?", `Delete ${count} selected pin${count === 1 ? "" : "s"}? This can't be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const result = await bulkDeletePins.mutateAsync(Array.from(selectedIds));
            setSelectedIds(new Set());
            if (result.skippedCount > 0) {
              Alert.alert(
                "Some pins weren't deleted",
                `${result.deletedCount} pin${result.deletedCount === 1 ? "" : "s"} deleted. ${result.skippedCount} couldn't be removed — you don't have permission.`,
              );
            }
          } catch (err: any) {
            Alert.alert("Couldn't delete pins", err?.message ?? "Please try again.");
          }
        },
      },
    ]);
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: "Manage pins" }} />
      {isLoading ? (
        <View className="flex-1 items-center justify-center py-16">
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      ) : !map ? (
        <EmptyState icon="alert-circle-outline" title="Map not found" description="This map doesn't exist, or the link is no longer valid." />
      ) : (
        <>
          {selectableIds.length > 0 && (
            <Pressable className="flex-row items-center gap-2 py-3" onPress={toggleSelectAll} testID="button-select-all-pins">
              <Ionicons name={allSelected ? "checkbox" : "square-outline"} size={20} color={allSelected ? "#2563EB" : "#64748b"} />
              <Text className="text-sm font-medium text-slate-700">Select all</Text>
            </Pressable>
          )}
          <FlatList
            data={pins}
            keyExtractor={(pin) => pin.id}
            contentContainerStyle={{ gap: 8, paddingBottom: 96 }}
            renderItem={({ item: pin }) => {
              const style = map ? resolvePinStyle(pin, map) : { color: null, icon: null };
              const hex = style.color ? PIN_COLOR_HEX[style.color] : "#3B82F6";
              const selectable = canDeletePin(pin);
              const selected = selectedIds.has(pin.id);
              return (
                <Pressable
                  disabled={!selectable}
                  onPress={() => toggleSelected(pin.id)}
                  className={`flex-row items-start gap-2.5 rounded-xl border p-3 ${selected ? "border-primary bg-primary/5" : "border-slate-200 bg-white"} ${!selectable ? "opacity-50" : ""}`}
                  testID={`row-pin-${pin.id}`}
                >
                  {selectable && (
                    <Ionicons name={selected ? "checkbox" : "square-outline"} size={20} color={selected ? "#2563EB" : "#64748b"} />
                  )}
                  <View className="mt-1 h-3 w-3 rounded-full" style={{ backgroundColor: hex }} />
                  <View className="flex-1">
                    <Text className="font-semibold text-slate-900">{pin.userName}</Text>
                    {pin.note && <Text className="text-sm text-slate-600">{pin.note}</Text>}
                    {pin.address && <Text className="text-xs text-slate-400">{pin.address}</Text>}
                    {!pin.approved && <Text className="text-xs font-medium text-amber-600">Pending approval</Text>}
                  </View>
                </Pressable>
              );
            }}
            ListEmptyComponent={<EmptyState icon="location-outline" title="No pins yet" />}
          />
        </>
      )}

      {selectedIds.size > 0 && (
        <View className="absolute inset-x-4 bottom-4">
          <Button variant="destructive" onPress={onBulkDelete} loading={bulkDeletePins.isPending} testID="button-bulk-delete-pins">
            {`Delete ${selectedIds.size} pin${selectedIds.size === 1 ? "" : "s"}`}
          </Button>
        </View>
      )}
    </Screen>
  );
}

import { useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, Text, View } from "react-native";
import MapView, { Callout, Marker, type LatLng } from "react-native-maps";
import { Link, Stack, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useUser } from "@clerk/clerk-expo";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAddPin, useMap } from "@/hooks/useMaps";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { PIN_COLOR_HEX, PIN_ICON_IONICON, resolvePinStyle } from "@/lib/pin-styles";

// Central London — same fallback the web app's map component uses when a
// map has no pins yet to derive a center from (client/src/components/simple-google-map.tsx).
const DEFAULT_REGION = { latitude: 51.5074, longitude: -0.1278 };

export default function MapDetailScreen() {
  const { isSignedIn } = useRequireAuth();
  const { shareUrl } = useLocalSearchParams<{ shareUrl: string }>();
  const { user } = useUser();
  const { data: currentUser } = useCurrentUser();
  const { data: map, isLoading, error } = useMap(shareUrl);
  const addPin = useAddPin(shareUrl);
  const isOwner = !!currentUser && !!map && currentUser.id === map.ownerId;

  const [pendingCoordinate, setPendingCoordinate] = useState<LatLng | null>(null);
  const [pinNote, setPinNote] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const initialRegion = useMemo(() => {
    const firstPin = map?.pins[0];
    const center = firstPin
      ? { latitude: Number(firstPin.latitude), longitude: Number(firstPin.longitude) }
      : DEFAULT_REGION;
    return { ...center, latitudeDelta: 0.05, longitudeDelta: 0.05 };
  }, [map?.pins]);

  if (!isSignedIn) return null;

  const closeAddPinModal = () => {
    setPendingCoordinate(null);
    setPinNote("");
    setSubmitError(null);
  };

  const onSubmitPin = async () => {
    if (!pendingCoordinate) return;
    setSubmitError(null);
    try {
      await addPin.mutateAsync({
        userName: user?.fullName || user?.primaryEmailAddress?.emailAddress || "Anonymous",
        latitude: String(pendingCoordinate.latitude),
        longitude: String(pendingCoordinate.longitude),
        note: pinNote.trim() || undefined,
      });
      closeAddPinModal();
    } catch (err: any) {
      setSubmitError(err?.message ?? "Couldn't add that pin.");
    }
  };

  return (
    <View className="flex-1">
      <Stack.Screen
        options={{
          title: map?.name ?? "Map",
          headerRight: isOwner
            ? () => (
                <Link href={`/map/edit/${shareUrl}`} asChild>
                  <Pressable hitSlop={8} testID="button-edit-map">
                    <Ionicons name="settings-outline" size={22} color="#2563EB" />
                  </Pressable>
                </Link>
              )
            : undefined,
        }}
      />

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      ) : error || !map ? (
        <EmptyState icon="alert-circle-outline" title="Couldn't load this map" description="Check your connection and try again." />
      ) : (
        <>
          <MapView
            className="flex-1"
            initialRegion={initialRegion}
            onPress={(e) => setPendingCoordinate(e.nativeEvent.coordinate)}
          >
            {map.pins.map((pin) => {
              const style = resolvePinStyle(pin, map);
              const hex = style.color ? PIN_COLOR_HEX[style.color] : "#3B82F6";
              return (
                <Marker
                  key={pin.id}
                  coordinate={{ latitude: Number(pin.latitude), longitude: Number(pin.longitude) }}
                  title={pin.userName}
                  anchor={{ x: 0.5, y: 0.5 }}
                >
                  <View
                    className="items-center justify-center rounded-full border-2 border-white"
                    style={{ width: 28, height: 28, backgroundColor: hex }}
                  >
                    <Ionicons name={style.icon ? PIN_ICON_IONICON[style.icon] : "location"} size={14} color="#ffffff" />
                  </View>
                  <Callout>
                    <View className="max-w-[220px] gap-1 p-1">
                      <Text className="font-semibold text-slate-900">{pin.userName}</Text>
                      {pin.note && <Text className="text-sm text-slate-600">{pin.note}</Text>}
                      {pin.address && <Text className="text-xs text-slate-400">{pin.address}</Text>}
                    </View>
                  </Callout>
                </Marker>
              );
            })}
          </MapView>

          <View className="absolute bottom-6 left-4 right-4 flex-row items-center justify-between rounded-2xl bg-white/95 px-4 py-3 shadow">
            <View className="flex-row items-center gap-1.5">
              <Ionicons name="location" size={16} color="#2563EB" />
              <Text className="text-sm font-medium text-slate-700">
                {map.pinCount} {map.pinCount === 1 ? "pin" : "pins"}
              </Text>
            </View>
            <Text className="text-xs text-slate-400">Tap the map to add a pin</Text>
          </View>
        </>
      )}

      <Modal visible={!!pendingCoordinate} animationType="slide" transparent onRequestClose={closeAddPinModal}>
        <View className="flex-1 justify-end bg-black/40">
          <View className="gap-4 rounded-t-3xl bg-white p-6">
            <Text className="text-lg font-bold text-slate-900">Add a pin</Text>
            <TextField
              label="Note (optional)"
              value={pinNote}
              onChangeText={setPinNote}
              placeholder="What should people know about this spot?"
              multiline
              numberOfLines={3}
              testID="input-pin-note"
            />
            {submitError && <Text className="text-sm text-red-600">{submitError}</Text>}
            <View className="flex-row gap-3">
              <Button variant="outline" className="flex-1" onPress={closeAddPinModal}>
                Cancel
              </Button>
              <Button className="flex-1" loading={addPin.isPending} onPress={onSubmitPin} testID="button-submit-pin">
                Drop pin
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

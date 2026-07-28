import { useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import MapView, { Marker, type LatLng } from "react-native-maps";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/ui/Screen";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { useBulkImportPins } from "@/hooks/useMaps";
import { useRequireAuth } from "@/hooks/useRequireAuth";

const DEFAULT_REGION = { latitude: 51.5074, longitude: -0.1278, latitudeDelta: 0.05, longitudeDelta: 0.05 };

type Placed = { title: string; latitude: string; longitude: string };

/**
 * Scoped-down mobile equivalent of client/src/pages/import-pins.tsx's
 * paste-list flow. The web version resolves each pasted name to real
 * coordinates via the browser's google.maps.places JS SDK, which has no RN
 * equivalent and no server-side proxy to call instead — so here, after
 * pasting names, the map is tapped once per name to place it (same
 * interaction as the regular add-pin flow, just repeated through the list),
 * then the whole batch submits in one POST /pins/bulk call. AI-suggested
 * names and screenshot-based import are out of scope for this pass.
 */
export default function ImportPinsScreen() {
  const { isSignedIn } = useRequireAuth();
  const { shareUrl } = useLocalSearchParams<{ shareUrl: string }>();
  const router = useRouter();
  const bulkImport = useBulkImportPins(shareUrl);

  const [step, setStep] = useState<"paste" | "place" | "review">("paste");
  const [pastedText, setPastedText] = useState("");
  const [names, setNames] = useState<string[]>([]);
  const [placed, setPlaced] = useState<Placed[]>([]);
  const [error, setError] = useState<string | null>(null);

  if (!isSignedIn) return null;

  const onContinueFromPaste = () => {
    const parsed = Array.from(
      new Set(
        pastedText
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
      ),
    ).slice(0, 200);
    if (parsed.length === 0) {
      setError("Paste at least one venue name, one per line.");
      return;
    }
    setError(null);
    setNames(parsed);
    setPlaced([]);
    setStep("place");
  };

  const currentIndex = placed.length;
  const currentName = names[currentIndex];

  const onMapPress = (coordinate: LatLng) => {
    setPlaced((prev) => [...prev, { title: currentName, latitude: String(coordinate.latitude), longitude: String(coordinate.longitude) }]);
  };

  const onSkip = () => {
    setNames((prev) => prev.filter((_, i) => i !== currentIndex));
  };

  const onUndoLast = () => {
    setPlaced((prev) => prev.slice(0, -1));
  };

  const onSubmit = async () => {
    setError(null);
    try {
      const result = await bulkImport.mutateAsync(placed);
      if (result.skippedDueToLimit > 0) {
        Alert.alert(
          "Some pins skipped",
          `${result.created.length + result.updated.length} pins were imported. ${result.skippedDueToLimit} were skipped because this map is at its pin limit.`,
        );
      }
      router.replace(`/map/${shareUrl}`);
    } catch (err: any) {
      setError(err?.message ?? "Couldn't import pins.");
    }
  };

  return (
    <View className="flex-1">
      <Stack.Screen options={{ title: "Import pins" }} />

      {step === "paste" && (
        <Screen scroll>
          <View className="gap-4 py-6">
            <Text className="text-sm text-slate-600">
              Paste a list of venue names, one per line. You'll tap the map once for each to set its location.
            </Text>
            <TextField
              value={pastedText}
              onChangeText={setPastedText}
              placeholder={"Dishoom Shoreditch\nCeremony Coffee\nBorough Market"}
              multiline
              numberOfLines={10}
              testID="input-paste-list"
            />
            {error && <Text className="text-sm text-red-600">{error}</Text>}
            <Button onPress={onContinueFromPaste} disabled={!pastedText.trim()} testID="button-continue-paste">
              Continue
            </Button>
          </View>
        </Screen>
      )}

      {step === "place" &&
        (currentName ? (
          <>
            <MapView className="flex-1" initialRegion={DEFAULT_REGION} onPress={(e) => onMapPress(e.nativeEvent.coordinate)}>
              {placed.map((pin, i) => (
                <Marker key={i} coordinate={{ latitude: Number(pin.latitude), longitude: Number(pin.longitude) }} title={pin.title} />
              ))}
            </MapView>
            <View className="absolute left-4 right-4 top-4 gap-2 rounded-2xl bg-white/95 px-4 py-3 shadow">
              <Text className="text-xs text-slate-500">
                Placing {currentIndex + 1} of {names.length}
              </Text>
              <Text className="text-base font-semibold text-slate-900" testID="text-current-import-name">
                {currentName}
              </Text>
              <Text className="text-xs text-slate-500">Tap the map to drop this pin</Text>
            </View>
            <View className="absolute bottom-6 left-4 right-4 flex-row gap-3">
              {placed.length > 0 && (
                <Button variant="outline" className="flex-1" onPress={onUndoLast} testID="button-undo-last-placed">
                  Undo last
                </Button>
              )}
              <Button variant="outline" className="flex-1" onPress={onSkip} testID="button-skip-import-name">
                Skip
              </Button>
            </View>
          </>
        ) : (
          <Screen>
            <View className="flex-1 items-center justify-center gap-4">
              <Ionicons name="checkmark-circle" size={40} color="#16a34a" />
              <Text className="text-lg font-semibold text-slate-900">All {placed.length} pins placed</Text>
              <Button onPress={() => setStep("review")} testID="button-go-to-review">
                Review & import
              </Button>
            </View>
          </Screen>
        ))}

      {step === "review" && (
        <Screen>
          <View className="gap-1 py-4">
            <Text className="text-xl font-bold text-slate-900">Review</Text>
            <Text className="text-sm text-slate-500">
              {placed.length} {placed.length === 1 ? "pin" : "pins"} ready to import.
            </Text>
          </View>
          <ScrollView className="flex-1">
            {placed.map((pin, i) => (
              <View key={i} className="mb-2 flex-row items-center justify-between rounded-xl border border-slate-200 bg-white p-3">
                <Text className="flex-1 text-sm font-medium text-slate-900" numberOfLines={1}>
                  {pin.title}
                </Text>
                <Pressable onPress={() => setPlaced((prev) => prev.filter((_, idx) => idx !== i))} hitSlop={8}>
                  <Ionicons name="close-circle" size={20} color="#94a3b8" />
                </Pressable>
              </View>
            ))}
          </ScrollView>
          {error && <Text className="text-sm text-red-600">{error}</Text>}
          <Button onPress={onSubmit} loading={bulkImport.isPending} disabled={placed.length === 0} testID="button-submit-import">
            {`Import ${placed.length} ${placed.length === 1 ? "pin" : "pins"}`}
          </Button>
        </Screen>
      )}
    </View>
  );
}

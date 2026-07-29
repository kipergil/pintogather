import { useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, Text, View } from "react-native";
import MapView, { Marker, type LatLng } from "react-native-maps";
import * as ImagePicker from "expo-image-picker";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/ui/Screen";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { useBulkImportPins, useMap } from "@/hooks/useMaps";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { apiRequest, apiUpload, type UploadFile } from "@/lib/api";
import type { ItemType } from "../../../../shared/enums";

const DEFAULT_REGION = { latitude: 51.5074, longitude: -0.1278, latitudeDelta: 0.05, longitudeDelta: 0.05 };
/** Matches the server's multer maxCount for the extraction endpoint. */
const MAX_IMAGES = 4;

const ITEM_NOUN: Record<ItemType, { one: string; many: string }> = {
  location: { one: "pin", many: "pins" },
  link: { one: "link", many: "links" },
  recommendation: { one: "recommendation", many: "recommendations" },
};

/** A candidate before it's saved. Mirrors the web hub's StagedItem, minus the Places resolution the RN SDK can't do. */
interface Staged {
  title: string;
  url?: string;
  note?: string;
  latitude?: string;
  longitude?: string;
}

/** What the extraction/suggestion endpoints return per item. */
interface ItemSeed {
  name: string;
  url?: string;
  note?: string;
}

const URL_PATTERN = /https?:\/\/[^\s<>"']+/i;

function parseLines(text: string, itemType: ItemType): ItemSeed[] {
  const lines = Array.from(new Set(text.split("\n").map((l) => l.trim()).filter(Boolean))).slice(0, 200);
  if (itemType !== "link") return lines.map((name) => ({ name }));
  return lines.map((line) => {
    const match = line.match(URL_PATTERN);
    if (!match) return { name: line };
    const url = match[0];
    return { name: line.replace(url, "").replace(/^[\s\-–—:|,]+|[\s\-–—:|,]+$/g, ""), url };
  });
}

/**
 * Mobile counterpart to client/src/pages/add-items.tsx. Same three sources
 * (paste, AI prompt, photo/screenshot) feeding one review list, and the
 * same per-type behaviour: only "location" collections need the tap-the-map
 * placement step, because React Native has no equivalent of the browser's
 * google.maps.places SDK and there's no server-side proxy to call instead.
 * Link and recommendation items carry everything they need already, so they
 * skip straight from staging to review.
 */
export default function AddItemsScreen() {
  const { isSignedIn } = useRequireAuth();
  const { shareUrl } = useLocalSearchParams<{ shareUrl: string }>();
  const router = useRouter();
  const bulkImport = useBulkImportPins(shareUrl);
  const { data: map } = useMap(shareUrl);
  const itemType: ItemType = map?.itemType ?? "location";
  const noun = ITEM_NOUN[itemType];
  const isLocation = itemType === "location";

  const [step, setStep] = useState<"source" | "place" | "review">("source");
  const [pastedText, setPastedText] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [images, setImages] = useState<UploadFile[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [pending, setPending] = useState<ItemSeed[]>([]);
  const [placed, setPlaced] = useState<Staged[]>([]);
  const [error, setError] = useState<string | null>(null);

  if (!isSignedIn) return null;

  /** Location items still need a tap per item; everything else is ready to review. */
  const acceptSeeds = (seeds: ItemSeed[]) => {
    if (seeds.length === 0) {
      setError(`Couldn't find any ${noun.many} in that.`);
      return;
    }
    setError(null);
    if (isLocation) {
      setPending(seeds);
      setPlaced([]);
      setStep("place");
      return;
    }
    setPlaced(seeds.map((seed) => ({ title: seed.name, url: seed.url, note: seed.note })));
    setStep("review");
  };

  const onContinueFromPaste = () => {
    const seeds = parseLines(pastedText, itemType);
    if (seeds.length === 0) {
      setError(`Paste at least one ${noun.one}, one per line.`);
      return;
    }
    acceptSeeds(seeds);
  };

  const seedsFrom = (data: { items?: ItemSeed[]; suggestions?: string[] }): ItemSeed[] =>
    data.items?.length ? data.items : (data.suggestions ?? []).map((name) => ({ name }));

  const onGenerate = async () => {
    if (images.length === 0 && !aiPrompt.trim()) return;
    setIsGenerating(true);
    setError(null);
    try {
      const response =
        images.length > 0
          ? await apiUpload(
              `/api/maps/${shareUrl}/extract-items`,
              images,
              aiPrompt.trim() ? { prompt: aiPrompt.trim() } : undefined,
            )
          : await apiRequest("POST", `/api/maps/${shareUrl}/venue-suggestions`, { prompt: aiPrompt.trim() });
      const data = await response.json();
      setImages([]);
      acceptSeeds(seedsFrom(data));
    } catch (err: any) {
      setError(err?.message ?? "Couldn't generate suggestions.");
    } finally {
      setIsGenerating(false);
    }
  };

  const pickImages = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Photo access needed", "Allow photo library access in Settings to read items from an image.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: MAX_IMAGES - images.length,
      quality: 0.8,
    });
    if (result.canceled) return;
    setImages((prev) =>
      [
        ...prev,
        ...result.assets.map((asset, i) => ({
          uri: asset.uri,
          name: asset.fileName || `image-${i}.jpg`,
          mimeType: asset.mimeType || "image/jpeg",
        })),
      ].slice(0, MAX_IMAGES),
    );
  };

  const currentIndex = placed.length;
  const currentSeed = pending[currentIndex];

  const onMapPress = (coordinate: LatLng) => {
    if (!currentSeed) return;
    setPlaced((prev) => [
      ...prev,
      {
        title: currentSeed.name,
        note: currentSeed.note,
        latitude: String(coordinate.latitude),
        longitude: String(coordinate.longitude),
      },
    ]);
  };

  const onSubmit = async () => {
    setError(null);
    try {
      const result = await bulkImport.mutateAsync(placed);
      if (result.skippedDueToLimit > 0) {
        Alert.alert(
          `Some ${noun.many} skipped`,
          `${result.created.length + result.updated.length} were added. ${result.skippedDueToLimit} were skipped because this collection is at its limit.`,
        );
      }
      router.replace(`/map/${shareUrl}`);
    } catch (err: any) {
      setError(err?.message ?? `Couldn't add those ${noun.many}.`);
    }
  };

  return (
    <View className="flex-1">
      <Stack.Screen options={{ title: "Add items" }} />

      {step === "source" && (
        <Screen scroll>
          <View className="gap-6 py-6">
            <View className="gap-3">
              <Text className="text-base font-semibold text-slate-900">Paste a list</Text>
              <Text className="text-sm text-slate-600">
                One {noun.one} per line.
                {isLocation ? " You'll tap the map once for each to set its location." : ""}
              </Text>
              <TextField
                value={pastedText}
                onChangeText={setPastedText}
                placeholder={
                  isLocation
                    ? "Dishoom Shoreditch\nCeremony Coffee\nBorough Market"
                    : itemType === "link"
                      ? "https://example.com/article\nhttps://another.site/post"
                      : "Dune (the novel)\nThe Bear, season 2"
                }
                multiline
                numberOfLines={8}
                testID="input-paste-list"
              />
              <Button onPress={onContinueFromPaste} disabled={!pastedText.trim()} testID="button-continue-paste">
                Continue
              </Button>
            </View>

            <View className="h-px bg-slate-200" />

            <View className="gap-3">
              <Text className="text-base font-semibold text-slate-900">Or let AI find them</Text>
              <Text className="text-sm text-slate-600">
                Describe what you want, or attach a screenshot or photo and we'll read the {noun.many} out of it.
              </Text>
              <TextField
                value={aiPrompt}
                onChangeText={setAiPrompt}
                placeholder={
                  images.length > 0 ? "Optional — add context for the image(s)" : "Best ramen spots in Tokyo"
                }
                multiline
                numberOfLines={3}
                testID="input-ai-prompt"
              />

              {images.length > 0 && (
                <View className="flex-row flex-wrap gap-2" testID="ai-image-thumbs">
                  {images.map((image, index) => (
                    <View key={`${image.uri}-${index}`} className="relative">
                      <Image source={{ uri: image.uri }} className="h-16 w-16 rounded-lg" />
                      <Pressable
                        onPress={() => setImages((prev) => prev.filter((_, i) => i !== index))}
                        className="absolute -right-1.5 -top-1.5 h-6 w-6 items-center justify-center rounded-full bg-slate-800"
                        hitSlop={6}
                        testID={`button-remove-image-${index}`}
                      >
                        <Ionicons name="close" size={13} color="#ffffff" />
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}

              {images.length < MAX_IMAGES && (
                <Button variant="outline" onPress={pickImages} testID="button-attach-image">
                  {images.length === 0 ? "Attach a screenshot or photo" : "Add another image"}
                </Button>
              )}

              <Button
                onPress={onGenerate}
                loading={isGenerating}
                disabled={(!aiPrompt.trim() && images.length === 0) || isGenerating}
                testID="button-generate"
              >
                {images.length > 0 ? `Read ${images.length} image${images.length === 1 ? "" : "s"}` : "Generate"}
              </Button>
            </View>

            {error && <Text className="text-sm text-red-600">{error}</Text>}
          </View>
        </Screen>
      )}

      {step === "place" &&
        (currentSeed ? (
          <>
            <MapView
              className="flex-1"
              initialRegion={DEFAULT_REGION}
              onPress={(e) => onMapPress(e.nativeEvent.coordinate)}
            >
              {placed.map((pin, i) => (
                <Marker
                  key={i}
                  coordinate={{ latitude: Number(pin.latitude), longitude: Number(pin.longitude) }}
                  title={pin.title}
                />
              ))}
            </MapView>
            <View className="absolute left-4 right-4 top-4 gap-2 rounded-2xl bg-white/95 px-4 py-3 shadow">
              <Text className="text-xs text-slate-500">
                Placing {currentIndex + 1} of {pending.length}
              </Text>
              <Text className="text-base font-semibold text-slate-900" testID="text-current-import-name">
                {currentSeed.name}
              </Text>
              <Text className="text-xs text-slate-500">Tap the map to drop this pin</Text>
            </View>
            <View className="absolute bottom-6 left-4 right-4 flex-row gap-3">
              {placed.length > 0 && (
                <Button
                  variant="outline"
                  className="flex-1"
                  onPress={() => setPlaced((prev) => prev.slice(0, -1))}
                  testID="button-undo-last-placed"
                >
                  Undo last
                </Button>
              )}
              <Button
                variant="outline"
                className="flex-1"
                onPress={() => setPending((prev) => prev.filter((_, i) => i !== currentIndex))}
                testID="button-skip-import-name"
              >
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
                Review & add
              </Button>
            </View>
          </Screen>
        ))}

      {step === "review" && (
        <Screen>
          <View className="gap-1 py-4">
            <Text className="text-xl font-bold text-slate-900">Review</Text>
            <Text className="text-sm text-slate-500">
              {placed.length} {placed.length === 1 ? noun.one : noun.many} ready to add.
            </Text>
          </View>
          <ScrollView className="flex-1">
            {placed.map((item, i) => (
              <View
                key={i}
                className="mb-2 flex-row items-center justify-between rounded-xl border border-slate-200 bg-white p-3"
              >
                <View className="flex-1">
                  <Text className="text-sm font-medium text-slate-900" numberOfLines={1}>
                    {item.title}
                  </Text>
                  {item.url && (
                    <Text className="text-xs text-primary" numberOfLines={1}>
                      {item.url}
                    </Text>
                  )}
                  {item.note && (
                    <Text className="text-xs text-slate-500" numberOfLines={2}>
                      {item.note}
                    </Text>
                  )}
                </View>
                <Pressable onPress={() => setPlaced((prev) => prev.filter((_, idx) => idx !== i))} hitSlop={8}>
                  <Ionicons name="close-circle" size={20} color="#94a3b8" />
                </Pressable>
              </View>
            ))}
          </ScrollView>
          {error && <Text className="text-sm text-red-600">{error}</Text>}
          <Button
            onPress={onSubmit}
            loading={bulkImport.isPending}
            disabled={placed.length === 0}
            testID="button-submit-import"
          >
            {`Add ${placed.length} ${placed.length === 1 ? noun.one : noun.many}`}
          </Button>
        </Screen>
      )}
    </View>
  );
}

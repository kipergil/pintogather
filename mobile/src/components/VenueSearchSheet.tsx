import { useState } from "react";
import { ActivityIndicator, FlatList, Modal, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { usePlacesSearch, type PlaceSearchResult } from "@/hooks/usePlacesSearch";

export type VenueResult = PlaceSearchResult;

interface VenueSearchSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (place: VenueResult) => void;
}

/** Search-first way to add a pin, alongside tapping the map directly — mirrors the web app's "Add a venue" search button (client/src/components/places-search.tsx), backed by GET /api/places/search instead of the browser-only google.maps.places SDK. */
export function VenueSearchSheet({ visible, onClose, onSelect }: VenueSearchSheetProps) {
  const [query, setQuery] = useState("");
  const { results, isSearching, error } = usePlacesSearch(query);

  const onPick = (place: VenueResult) => {
    onSelect(place);
    setQuery("");
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <View className="max-h-[85%] gap-3 rounded-t-3xl bg-white p-6">
          <Text className="text-lg font-bold text-slate-900">Search for a venue</Text>
          <TextField
            value={query}
            onChangeText={setQuery}
            placeholder="Restaurants, cafes, landmarks..."
            autoFocus
            testID="input-venue-search"
          />
          {isSearching && (
            <View className="items-center py-4">
              <ActivityIndicator color="#2563EB" />
            </View>
          )}
          {error && <Text className="text-sm text-red-600">{error}</Text>}
          {!isSearching && query.trim().length >= 2 && results.length === 0 && !error && (
            <Text className="py-4 text-center text-sm text-slate-400">No matches. Try a different search.</Text>
          )}
          <FlatList
            data={results}
            keyExtractor={(item, i) => `${item.latitude},${item.longitude},${i}`}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => onPick(item)}
                className="flex-row items-center gap-3 border-b border-slate-100 py-3"
                testID={`venue-result-${item.name}`}
              >
                <Ionicons name="location-outline" size={18} color="#2563EB" />
                <View className="flex-1">
                  <Text className="text-sm font-medium text-slate-900" numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text className="text-xs text-slate-500" numberOfLines={1}>
                    {item.address}
                  </Text>
                </View>
              </Pressable>
            )}
          />
          <Button variant="ghost" onPress={onClose}>
            Close
          </Button>
        </View>
      </View>
    </Modal>
  );
}

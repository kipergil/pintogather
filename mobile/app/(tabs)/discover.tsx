import { useState } from "react";
import { FlatList, Pressable, ScrollView, Text, View } from "react-native";
import { Link } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { EmptyState } from "@/components/ui/EmptyState";
import { Screen } from "@/components/ui/Screen";
import { useDiscover } from "@/hooks/useDiscover";
import { CURATED_CATEGORY_COLOR, CURATED_CATEGORY_LABELS, CURATED_COUNTRY_LABELS } from "@/lib/curated-maps";
import type { CuratedCategory, CuratedCountry } from "../../../shared/enums";

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className={`mr-2 rounded-full border px-3.5 py-1.5 ${active ? "border-primary bg-primary" : "border-slate-300 bg-white"}`}
    >
      <Text className={`text-sm font-medium ${active ? "text-white" : "text-slate-600"}`}>{label}</Text>
    </Pressable>
  );
}

export default function DiscoverScreen() {
  const [category, setCategory] = useState<CuratedCategory | null>(null);
  const [country, setCountry] = useState<CuratedCountry | null>(null);
  const { data, isLoading } = useDiscover(category, country);

  return (
    <Screen>
      <View className="gap-1 pb-3 pt-2">
        <Text className="text-xs font-semibold uppercase tracking-wide text-primary">Discover</Text>
        <Text className="text-xl font-bold text-slate-900">Curated maps, ready to explore</Text>
        <Text className="text-sm text-slate-500">Hand-picked collections from the PinTogather team and the community.</Text>
      </View>

      {data && (
        <View className="gap-2 pb-3">
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Chip label="All categories" active={category === null} onPress={() => setCategory(null)} />
            {data.filters.categories.map((c) => (
              <Chip key={c} label={CURATED_CATEGORY_LABELS[c]} active={category === c} onPress={() => setCategory(c)} />
            ))}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Chip label="All countries" active={country === null} onPress={() => setCountry(null)} />
            {data.filters.countries.map((c) => (
              <Chip key={c} label={CURATED_COUNTRY_LABELS[c]} active={country === c} onPress={() => setCountry(c)} />
            ))}
          </ScrollView>
        </View>
      )}

      <FlatList
        data={data?.maps ?? []}
        keyExtractor={(map) => map.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 12 }}
        contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
        renderItem={({ item: map }) => {
          const card = (
            <View className="flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white">
              <View
                className="aspect-[8/5] items-center justify-center"
                style={{ backgroundColor: map.curatedCategory ? CURATED_CATEGORY_COLOR[map.curatedCategory] : "#3B82F6", opacity: map.locked ? 0.4 : 1 }}
              >
                <Ionicons name="location" size={28} color="#ffffff" />
                {map.locked && (
                  <View className="absolute right-2 top-2 h-7 w-7 items-center justify-center rounded-full bg-white/90">
                    <Ionicons name="lock-closed" size={14} color="#0f172a" />
                  </View>
                )}
              </View>
              <View className={`gap-1 p-3 ${map.locked ? "opacity-50" : ""}`}>
                {map.curatedCategory && (
                  <Text className="text-xs font-medium text-slate-500">{CURATED_CATEGORY_LABELS[map.curatedCategory]}</Text>
                )}
                <Text className="font-semibold text-slate-900" numberOfLines={1}>
                  {map.name}
                </Text>
                {map.curatedTagline && (
                  <Text className="text-xs text-slate-500" numberOfLines={2}>
                    {map.curatedTagline}
                  </Text>
                )}
                <Text className="text-xs text-slate-400">
                  {map.pinCount} {map.pinCount === 1 ? "pin" : "pins"}
                </Text>
              </View>
            </View>
          );

          if (map.locked || !map.shareUrl) {
            return <View className="flex-1" testID={`card-discover-map-${map.id}`}>{card}</View>;
          }
          return (
            <Link href={`/map/${map.shareUrl}`} asChild>
              <Pressable className="flex-1" testID={`card-discover-map-${map.id}`}>
                {card}
              </Pressable>
            </Link>
          );
        }}
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState icon="compass-outline" title="No curated maps match these filters yet" description="Try a different category or country, or check back soon." />
          ) : null
        }
        ListFooterComponent={
          data?.isLimited ? (
            <View className="flex-row items-center gap-2.5 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
              <Ionicons name="lock-closed" size={16} color="#2563EB" />
              <Text className="flex-1 text-sm text-slate-700">
                Showing {data.visibleCount} of {data.totalCount} curated maps.
              </Text>
              <Link href="/pricing" className="text-sm font-medium text-primary">
                Upgrade
              </Link>
            </View>
          ) : null
        }
      />
    </Screen>
  );
}

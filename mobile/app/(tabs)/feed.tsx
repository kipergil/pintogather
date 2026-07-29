import { FlatList, Image, Pressable, Text, View } from "react-native";
import { Link } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { EmptyState } from "@/components/ui/EmptyState";
import { Screen } from "@/components/ui/Screen";
import { LikeButton } from "@/components/LikeButton";
import { FEED_QUERY_KEY, useFeed } from "@/hooks/useFeed";
import { APP_NAME } from "@/lib/config";
import type { FeedMapItem } from "../../../shared/schema";

function FeedCard({ map }: { map: FeedMapItem }) {
  const initials = (map.ownerName || "?")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <View className="mb-3 gap-3 rounded-xl border border-slate-200 bg-white p-4">
      {map.ownerUsername && (
        <Link href={`/u/${map.ownerUsername}`} asChild>
          <Pressable
            className="flex-row items-center gap-2"
            testID={`link-feed-owner-${map.id}`}
          >
            {map.ownerAvatarUrl ? (
              <Image
                source={{ uri: map.ownerAvatarUrl }}
                className="h-6 w-6 rounded-full"
              />
            ) : (
              <View className="h-6 w-6 items-center justify-center rounded-full bg-primary/10">
                <Text className="text-[10px] font-semibold text-primary">
                  {initials}
                </Text>
              </View>
            )}
            <Text className="text-sm font-medium text-slate-600">
              {map.ownerName || `@${map.ownerUsername}`}
            </Text>
          </Pressable>
        </Link>
      )}

      <Link href={`/map/${map.shareUrl}`} asChild>
        <Pressable testID={`link-feed-map-${map.id}`}>
          <View className="flex-row items-start gap-3">
            <View className="h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-primary/10">
              {map.brandingLogoUrl ? (
                <Image
                  source={{ uri: map.brandingLogoUrl }}
                  className="h-full w-full"
                />
              ) : (
                <Ionicons name="location" size={18} color="#2563EB" />
              )}
            </View>
            <View className="flex-1">
              <Text className="font-semibold text-slate-900" numberOfLines={1}>
                {map.name}
              </Text>
              {map.description ? (
                <Text
                  className="mt-0.5 text-sm text-slate-500"
                  numberOfLines={2}
                >
                  {map.description}
                </Text>
              ) : (
                <Text className="mt-0.5 text-sm italic text-slate-400">
                  No description
                </Text>
              )}
            </View>
          </View>
        </Pressable>
      </Link>

      <View className="flex-row items-center justify-between pt-1">
        <Text className="text-xs text-slate-400">
          {map.pinCount}{" "}
          {map.itemType === "location"
            ? map.pinCount === 1
              ? "pin"
              : "pins"
            : map.pinCount === 1
              ? "item"
              : "items"}
        </Text>
        <LikeButton
          mapId={map.id}
          liked={map.likedByViewer}
          likeCount={map.likeCount}
          invalidateKeys={[FEED_QUERY_KEY]}
        />
      </View>
    </View>
  );
}

export default function FeedScreen() {
  const { data, isLoading, refetch, isRefetching } = useFeed();

  return (
    <Screen>
      <FlatList
        data={data?.items ?? []}
        keyExtractor={(map) => map.id}
        renderItem={({ item }) => <FeedCard map={item} />}
        refreshing={isRefetching}
        onRefresh={refetch}
        ListHeaderComponent={
          <View className="gap-1 pb-4 pt-2">
            <Text className="text-xs font-semibold uppercase tracking-wide text-primary">
              Feed
            </Text>
            <Text className="text-xl font-bold text-slate-900">
              Recently added maps
            </Text>
            <Text className="text-sm text-slate-500">
              From people you follow and {APP_NAME}'s curated collections.
            </Text>
          </View>
        }
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              icon="albums-outline"
              title={
                data && data.followingCount === 0
                  ? "You're not following anyone yet"
                  : "No new maps yet"
              }
              description={
                data && data.followingCount === 0
                  ? "Follow other users from their public profile to see their maps here."
                  : "Check back soon, or explore Discover in the meantime."
              }
            />
          ) : null
        }
      />
    </Screen>
  );
}

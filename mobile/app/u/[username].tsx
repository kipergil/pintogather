import { ActivityIndicator, FlatList, Image, Linking, Pressable, Text, View } from "react-native";
import { Link, Stack, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { EmptyState } from "@/components/ui/EmptyState";
import { FollowButton } from "@/components/FollowButton";
import { LikeButton } from "@/components/LikeButton";
import { usePublicProfile } from "@/hooks/useProfile";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { buildSocialUrl } from "@/lib/social-links";

export default function PublicProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const { data: viewer } = useCurrentUser();
  const queryKey = `/api/profile/${username}`;
  const { data: profile, isLoading, error } = usePublicProfile(username);

  // Compare against our own backend user record's username, not Clerk's own
  // `user.username` (a separate, unused Clerk-native field this app never
  // sets — comparing against it would always read as "not the same user").
  const isOwnProfile = !!viewer && profile?.username === viewer.username;
  const displayName = profile?.fullName || (profile ? `@${profile.username}` : "");
  const totalPins = profile?.maps.reduce((sum, map) => sum + map.pinCount, 0) ?? 0;
  const initials = displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const socialLinks = profile
    ? ([
        ["twitter", buildSocialUrl("twitter", profile.twitterHandle), "logo-twitter"],
        ["instagram", buildSocialUrl("instagram", profile.instagramHandle), "logo-instagram"],
        ["linkedin", buildSocialUrl("linkedin", profile.linkedinHandle), "logo-linkedin"],
      ] as const)
    : [];

  return (
    <View className="flex-1 bg-white">
      <Stack.Screen options={{ title: profile ? `@${profile.username}` : "Profile" }} />
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      ) : error || !profile ? (
        <EmptyState icon="compass-outline" title="Profile not found" description="This username isn't taken, or the link is no longer valid." />
      ) : (
        <FlatList
          className="px-4"
          ListHeaderComponent={
            <View className="gap-3 py-5">
              <View className="flex-row items-start gap-4">
                {profile.profileImageUrl ? (
                  <Image source={{ uri: profile.profileImageUrl }} className="h-16 w-16 rounded-full" />
                ) : (
                  <View className="h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                    <Text className="text-lg font-semibold text-primary">{initials}</Text>
                  </View>
                )}
                <View className="flex-1 gap-0.5">
                  <Text className="text-lg font-bold text-slate-900">{displayName}</Text>
                  <Text className="text-sm text-slate-500">@{profile.username}</Text>
                </View>
                {!isOwnProfile && <FollowButton username={profile.username} following={profile.isFollowedByViewer} invalidateKeys={[queryKey]} />}
              </View>

              {profile.bio && <Text className="text-sm text-slate-700">{profile.bio}</Text>}

              <View className="flex-row flex-wrap items-center gap-x-4 gap-y-1">
                <Text className="text-sm text-slate-500">
                  {profile.maps.length} {profile.maps.length === 1 ? "map" : "maps"}
                </Text>
                <Text className="text-sm text-slate-500">
                  {totalPins} {totalPins === 1 ? "pin" : "pins"}
                </Text>
                <Text className="text-sm text-slate-500" testID="text-follower-count">
                  <Text className="font-semibold text-slate-900">{profile.followerCount}</Text> followers
                </Text>
                <Text className="text-sm text-slate-500" testID="text-following-count">
                  <Text className="font-semibold text-slate-900">{profile.followingCount}</Text> following
                </Text>
              </View>

              {socialLinks.some(([, url]) => url) && (
                <View className="flex-row gap-4">
                  {socialLinks.map(([key, url, icon]) =>
                    url ? (
                      <Pressable key={key} onPress={() => Linking.openURL(url)} testID={`link-profile-${key}`}>
                        <Ionicons name={icon} size={22} color="#64748b" />
                      </Pressable>
                    ) : null,
                  )}
                </View>
              )}

              <Text className="mt-2 text-sm font-semibold text-slate-900">Maps</Text>
            </View>
          }
          data={profile.maps}
          keyExtractor={(map) => map.id}
          renderItem={({ item: map }) => (
            <Link href={`/map/${map.shareUrl}`} asChild>
              <Pressable className="mb-3 rounded-xl border border-slate-200 bg-white p-4" testID={`link-profile-map-${map.id}`}>
                <Text className="font-semibold text-slate-900" numberOfLines={1}>
                  {map.name}
                </Text>
                {map.description ? (
                  <Text className="mt-0.5 text-sm text-slate-500" numberOfLines={2}>
                    {map.description}
                  </Text>
                ) : (
                  <Text className="mt-0.5 text-sm italic text-slate-400">No description</Text>
                )}
                <View className="mt-2 flex-row items-center justify-between">
                  <Text className="text-xs text-slate-400">
                    {map.pinCount} {map.pinCount === 1 ? "pin" : "pins"}
                  </Text>
                  <LikeButton mapId={map.id} liked={map.likedByViewer} likeCount={map.likeCount} invalidateKeys={[queryKey]} />
                </View>
              </Pressable>
            </Link>
          )}
          ListEmptyComponent={<EmptyState icon="map-outline" title="No public maps yet" description="Check back later." />}
        />
      )}
    </View>
  );
}

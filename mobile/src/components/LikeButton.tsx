import { GestureResponderEvent, Pressable, Text } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { useLike } from "@/hooks/useSocial";
import { signInHref } from "@/lib/authNav";

interface LikeButtonProps {
  mapId: string;
  liked: boolean;
  likeCount: number;
  invalidateKeys?: string[];
}

export function LikeButton({ mapId, liked, likeCount, invalidateKeys = [] }: LikeButtonProps) {
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { optimistic, toggle, isPending } = useLike(mapId, invalidateKeys);
  const display = optimistic ?? { liked, count: likeCount };

  const onPress = (e: GestureResponderEvent) => {
    // This button is nested inside a map-card Link (navigates to the map) in
    // every place it's used. react-native-web renders both as DOM elements
    // whose click events bubble, so without stopping propagation here a tap
    // both toggles the like AND triggers the parent Link's navigation.
    e.stopPropagation();
    e.preventDefault();
    if (!isSignedIn) {
      router.push(signInHref(pathname));
      return;
    }
    toggle(display.liked, display.count);
  };

  return (
    <Pressable className="flex-row items-center gap-1.5" onPress={onPress} disabled={isPending} testID={`button-like-map-${mapId}`}>
      <Ionicons name={display.liked ? "heart" : "heart-outline"} size={16} color={display.liked ? "#e11d48" : "#64748b"} />
      <Text className={`text-sm ${display.liked ? "text-rose-600" : "text-slate-500"}`}>{display.count}</Text>
    </Pressable>
  );
}

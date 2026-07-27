import { usePathname, useRouter } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { Button } from "@/components/ui/Button";
import { useFollow } from "@/hooks/useSocial";
import { signInHref } from "@/lib/authNav";

interface FollowButtonProps {
  username: string;
  following: boolean;
  invalidateKeys?: string[];
}

export function FollowButton({ username, following, invalidateKeys = [] }: FollowButtonProps) {
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { optimistic, toggle, isPending } = useFollow(username, invalidateKeys);
  const isFollowing = optimistic ?? following;

  const onPress = () => {
    if (!isSignedIn) {
      router.push(signInHref(pathname));
      return;
    }
    toggle(isFollowing);
  };

  return (
    <Button
      variant={isFollowing ? "outline" : "default"}
      size="sm"
      onPress={onPress}
      loading={isPending}
      testID={`button-follow-${username}`}
    >
      {isFollowing ? "Following" : "Follow"}
    </Button>
  );
}

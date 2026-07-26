import { Image, Text, View } from "react-native";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { Screen } from "@/components/ui/Screen";
import { Button } from "@/components/ui/Button";

export default function ProfileScreen() {
  const { signOut } = useAuth();
  const { user } = useUser();

  const displayName = user?.fullName || user?.primaryEmailAddress?.emailAddress || "Account";
  const initials = displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Screen scroll>
      <View className="items-center gap-3 py-10">
        {user?.imageUrl ? (
          <Image source={{ uri: user.imageUrl }} className="h-20 w-20 rounded-full" />
        ) : (
          <View className="h-20 w-20 items-center justify-center rounded-full bg-primary/10">
            <Text className="text-2xl font-semibold text-primary">{initials}</Text>
          </View>
        )}
        <View className="items-center gap-0.5">
          <Text className="text-xl font-bold text-slate-900">{displayName}</Text>
          {user?.primaryEmailAddress && <Text className="text-sm text-slate-500">{user.primaryEmailAddress.emailAddress}</Text>}
        </View>
      </View>

      <View className="gap-3">
        <Button variant="outline" onPress={() => signOut()} testID="button-sign-out">
          Sign out
        </Button>
      </View>
    </Screen>
  );
}

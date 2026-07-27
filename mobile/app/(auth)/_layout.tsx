import { useAuth } from "@clerk/clerk-expo";
import { Redirect, Stack, useLocalSearchParams } from "expo-router";

export default function AuthLayout() {
  const { isSignedIn } = useAuth();
  // Read from whichever child screen (sign-in or sign-up) is currently
  // focused — both forward their own returnTo param through untouched, so
  // this is the single place that actually decides where to land.
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();

  if (isSignedIn) {
    return <Redirect href={returnTo ? decodeURIComponent(returnTo) : "/"} />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

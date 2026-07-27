import { Stack } from "expo-router";

/** Same reasoning as app/pricing/_layout.tsx — a Stack navigator is required for Stack.Screen's title/header to actually render. */
export default function PagesLayout() {
  return <Stack screenOptions={{ headerTintColor: "#2563EB" }} />;
}

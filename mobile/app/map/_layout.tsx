import { Stack } from "expo-router";

/**
 * Everything under map/ (detail, create, edit) relies on its own
 * `<Stack.Screen options={...}>` call to set a title/headerRight — that only
 * has an effect inside an actual Stack navigator. The root layout
 * (app/_layout.tsx) only renders `<Slot />`, so without this file these
 * screens had no header UI at all (no back button, no title, no
 * headerRight icon).
 */
export default function MapLayout() {
  return <Stack screenOptions={{ headerTintColor: "#2563EB" }} />;
}

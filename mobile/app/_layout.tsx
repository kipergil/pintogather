import "../global.css";
import { ClerkProvider, ClerkLoaded } from "@clerk/clerk-expo";
import { QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Slot } from "expo-router";
import { CLERK_PUBLISHABLE_KEY } from "@/lib/config";
import { clerkTokenCache } from "@/lib/clerk-token-cache";
import { queryClient } from "@/lib/api";
import { ClerkTokenBridge } from "@/components/ClerkTokenBridge";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} tokenCache={clerkTokenCache}>
        <ClerkTokenBridge>
          <ClerkLoaded>
            <QueryClientProvider client={queryClient}>
              <SafeAreaProvider>
                <StatusBar style="dark" />
                <Slot />
              </SafeAreaProvider>
            </QueryClientProvider>
          </ClerkLoaded>
        </ClerkTokenBridge>
      </ClerkProvider>
    </GestureHandlerRootView>
  );
}

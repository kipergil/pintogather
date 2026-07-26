import * as SecureStore from "expo-secure-store";
import type { TokenCache } from "@clerk/clerk-expo";

/** Persists Clerk's session JWT in the OS keychain/keystore so signing in survives an app restart. Standard @clerk/clerk-expo recipe. */
export const clerkTokenCache: TokenCache = {
  async getToken(key: string) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.error("Failed to read Clerk token from SecureStore:", error);
      await SecureStore.deleteItemAsync(key).catch(() => {});
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.error("Failed to save Clerk token to SecureStore:", error);
    }
  },
};

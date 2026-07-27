import type { ExpoConfig } from "expo/config";

/**
 * app.config.ts instead of a static app.json so the Google Maps API keys
 * (different per platform, and never committed) can come from the
 * environment instead of being hardcoded — see mobile/.env.example.
 *
 * Name/slug/scheme/bundle identifiers are also env-driven for the same
 * reason, so a project rename doesn't require editing this file. IMPORTANT:
 * unlike the display name, `IOS_BUNDLE_IDENTIFIER`/`ANDROID_PACKAGE` are NOT
 * safe to casually change once an app is published — Apple/Google treat a
 * new bundle ID/package name as an entirely new app (no shared install
 * base, reviews, or update path from the old listing). Only change those
 * two before your first store submission, or deliberately when doing a
 * real relaunch.
 */
const APP_NAME = process.env.EXPO_PUBLIC_APP_NAME ?? "PinTogather";
const APP_SLUG = process.env.APP_SLUG ?? "pintogather";

const config: ExpoConfig = {
  name: APP_NAME,
  slug: APP_SLUG,
  scheme: process.env.APP_SCHEME ?? APP_SLUG,
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "automatic",
  ios: {
    supportsTablet: true,
    bundleIdentifier: process.env.IOS_BUNDLE_IDENTIFIER ?? "app.pintogather.mobile",
    config: {
      googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY_IOS,
    },
    infoPlist: {
      NSLocationWhenInUseUsageDescription: `${APP_NAME} uses your location to center the map and show your position relative to pins.`,
      // No custom/proprietary encryption beyond standard HTTPS/TLS, so this
      // is exempt — set explicitly so App Store Connect doesn't ask at
      // upload time. See https://developer.apple.com/documentation/bundleresources/information_property_list/itsappusesnonexemptencryption
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: process.env.ANDROID_PACKAGE ?? "app.pintogather.mobile",
    adaptiveIcon: {
      backgroundColor: "#E6F4FE",
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
    config: {
      googleMaps: {
        apiKey: process.env.GOOGLE_MAPS_API_KEY_ANDROID,
      },
    },
    permissions: ["ACCESS_COARSE_LOCATION", "ACCESS_FINE_LOCATION"],
  },
  web: {
    favicon: "./assets/favicon.png",
    bundler: "metro",
  },
  plugins: ["expo-router", "expo-status-bar", "expo-secure-store", "expo-web-browser", "expo-asset", "expo-sharing", "react-native-maps"],
  // Runtime config (API base URL, Clerk publishable key) is NOT read here —
  // Expo inlines any EXPO_PUBLIC_* variable from mobile/.env directly into
  // process.env at build time, so app code (see src/lib/config.ts) reads
  // those straight from process.env without needing expo-constants.
  extra: {
    eas: {
      // Links this project to the EAS project Expo Go already reserved
      // (`eas init --id ...`), so non-interactive/CI builds (EAS's GitHub
      // integration, `--non-interactive`) don't need to run `eas init` themselves.
      projectId: "bff12e33-c89e-4fef-86bd-2f29f29562cc",
    },
  },
};

export default config;

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

const alias = {
  "@": path.resolve(import.meta.dirname, "client", "src"),
  "@shared": path.resolve(import.meta.dirname, "shared"),
  "@assets": path.resolve(import.meta.dirname, "attached_assets"),
};

/**
 * Two projects rather than one, because the two halves genuinely need
 * different environments: server/shared code runs on node (real `dns`,
 * `net`, express), while client components need a DOM. Splitting them also
 * keeps the node suite fast — it doesn't pay for jsdom setup.
 */
export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "server",
          environment: "node",
          // directus/ is a separate package, but its flow definitions decide
          // when customers and admins get emailed — logic worth the same
          // guard as the rest. Only dependency-free modules there are
          // testable from here; anything touching directus/.env isn't.
          include: ["server/**/*.test.ts", "shared/**/*.test.ts", "directus/src/**/*.test.ts"],
          setupFiles: ["./test/setup.server.ts"],
        },
      },
      {
        plugins: [react()],
        resolve: { alias },
        // tsconfig sets jsx: "preserve" for the app build, and the Vite that
        // Vitest bundles transforms with oxc — which ignores the deprecated
        // esbuild.jsx option plugin-react still sets. Without this, .tsx test
        // files reach import analysis with JSX intact and fail to parse.
        oxc: { jsx: { runtime: "automatic" } },
        test: {
          name: "client",
          environment: "jsdom",
          include: ["client/**/*.test.{ts,tsx}"],
          setupFiles: ["./test/setup.client.ts"],
          // jsdom leaks state between files far more readily than node does.
          restoreMocks: true,
        },
      },
    ],
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "lcov"],
      reportsDirectory: "./coverage",
      include: ["server/**/*.ts", "shared/**/*.ts", "client/src/**/*.{ts,tsx}"],
      exclude: [
        "**/*.test.{ts,tsx}",
        // Thin wiring with no logic worth asserting on, or third-party
        // scaffolding — counting these would only dilute the signal.
        "client/src/components/ui/**",
        "client/src/main.tsx",
        "server/index.ts",
        "server/vite.ts",
        "**/*.d.ts",
      ],
    },
  },
});

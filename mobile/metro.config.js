// Metro config for the mobile app, extended two ways beyond Expo's default:
//
// 1. Monorepo wiring — this app lives in a `mobile/` subfolder next to the
//    web app's `client/`, `server/`, and `shared/`, sharing code with them
//    (see ../shared/*.ts) without this being an npm/yarn/pnpm workspace.
//    `watchFolders` lets Metro see/bundle files outside `mobile/`, and
//    `nodeModulesPaths` + `disableHierarchicalLookup` pin every bare-import
//    resolution (zod, @tanstack/react-query, ...) to this app's own
//    node_modules — so a shared file like ../shared/api-client.ts resolves
//    "@tanstack/react-query" to the SAME copy the mobile screens import,
//    rather than picking up the root project's separate copy and creating
//    two incompatible QueryClient instances at runtime. (mobile/tsconfig.json
//    has matching "paths" overrides so `tsc` agrees with this at the type
//    level too.)
//
// 2. NativeWind — Tailwind classes on React Native components.
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, "node_modules")];
config.resolver.disableHierarchicalLookup = true;

module.exports = withNativeWind(config, { input: "./global.css" });

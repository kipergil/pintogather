/**
 * Every server-side tier gate (maps, pins, AI suggestions, branding, seats)
 * mentions "/pricing" in its message — the same heuristic client/src/lib/
 * upgradeToast.tsx uses to decide whether an error is a paywall moment worth
 * a one-click way to upgrade, rather than parsing status codes (some limits
 * 403, others 429).
 */
export function isUpgradeableError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("/pricing");
}

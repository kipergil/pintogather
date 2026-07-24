import { ToastAction } from "@/components/ui/toast";

/**
 * Every server-side tier gate (maps, pins, AI suggestions, branding, seats)
 * mentions "/pricing" in its message — used here to decide whether an error
 * toast is a paywall moment worth a one-click way to upgrade, rather than
 * parsing status codes (some limits 403, others 429).
 */
export function isUpgradeableError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("/pricing");
}

export function upgradeToastAction() {
  return (
    <ToastAction altText="View plans" onClick={() => (window.location.href = "/pricing")}>
      View plans
    </ToastAction>
  );
}

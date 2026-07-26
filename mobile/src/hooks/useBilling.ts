import { useMutation, useQuery } from "@tanstack/react-query";
import * as WebBrowser from "expo-web-browser";
import { apiRequest, getQueryFn } from "@/lib/api";
import type { UserGroup } from "../../../shared/enums";

interface UsageSummary {
  userGroup: UserGroup;
  maps: { used: number; limit: number };
  aiSuggestions: { used: number; limit: number };
}

export function useUsage() {
  return useQuery<UsageSummary>({
    queryKey: ["/api/usage"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });
}

/** Opens Stripe Checkout/Billing Portal in an in-app browser — both are hosted, web-only flows with no native SDK equivalent needed here. */
function useHostedBillingFlow<TArgs>(request: (args: TArgs) => Promise<{ url: string }>) {
  return useMutation({
    mutationFn: async (args: TArgs) => {
      const { url } = await request(args);
      await WebBrowser.openBrowserAsync(url);
    },
  });
}

export function useCheckout() {
  return useHostedBillingFlow(async (tier: "basic" | "premium") => {
    const res = await apiRequest("POST", "/api/billing/checkout", { tier });
    return (await res.json()) as { url: string };
  });
}

export function useBillingPortal() {
  return useHostedBillingFlow(async () => {
    const res = await apiRequest("POST", "/api/billing/portal");
    return (await res.json()) as { url: string };
  });
}

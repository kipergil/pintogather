import { useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";
import { getPricingTiers } from "@shared/pricing";
import { APP_NAME } from "@/lib/branding";
import { Check, Loader2 } from "lucide-react";

const PRICING_TIERS = getPricingTiers(APP_NAME);

export default function Pricing() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const search = useSearch();

  useEffect(() => {
    const params = new URLSearchParams(search);
    const checkout = params.get("checkout");
    if (checkout === "success") {
      toast({ title: "You're subscribed!", description: "Your plan will update shortly.", variant: "success" });
    } else if (checkout === "cancelled") {
      toast({ title: "Checkout cancelled", description: "No charge was made." });
    }
  }, [search, toast]);

  const checkoutMutation = useMutation({
    mutationFn: async (tier: "basic" | "premium") => {
      const response = await apiRequest("POST", "/api/billing/checkout", { tier });
      return response.json() as Promise<{ url: string }>;
    },
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (error: any) => {
      toast({
        title: "Couldn't start checkout",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  const portalMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/billing/portal", {});
      return response.json() as Promise<{ url: string }>;
    },
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (error: any) => {
      toast({
        title: "Couldn't open billing portal",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  if (authLoading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
      </main>
    );
  }

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 animate-fade-in">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Plans &amp; pricing</h1>
        <p className="text-muted-foreground">Upgrade for more collections, more items, and more AI-generated suggestions.</p>
        {user && user.userGroup !== "freemium" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => portalMutation.mutate()}
            disabled={portalMutation.isPending}
            data-testid="button-manage-billing"
          >
            {portalMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : null}
            Manage billing
          </Button>
        )}
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        {PRICING_TIERS.map((tier) => {
          const isCurrent = user?.userGroup === tier.id;
          // A user already on a paid plan switching tiers must go through the
          // billing portal (which updates/prorates their existing
          // subscription) rather than a fresh Checkout session — Checkout
          // always creates a brand-new subscription, which would double-bill
          // someone who already has one active.
          const hasActiveSubscription = !!user && user.userGroup !== "freemium";
          return (
            <Card key={tier.id} className={isCurrent ? "border-primary" : "border-border"}>
              <CardContent className="p-6 flex flex-col h-full">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-lg font-semibold text-foreground">{tier.name}</h2>
                  {isCurrent && <Badge variant="secondary" data-testid={`badge-current-plan-${tier.id}`}>Current plan</Badge>}
                </div>
                <p className="text-2xl font-bold text-foreground mb-4">{tier.priceLabel}</p>
                <ul className="space-y-2 mb-6 flex-1">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                {tier.checkoutTier && !isCurrent && hasActiveSubscription && (
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => portalMutation.mutate()}
                    disabled={portalMutation.isPending}
                    data-testid={`button-switch-${tier.id}`}
                  >
                    {portalMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Redirecting...
                      </>
                    ) : (
                      "Switch via billing portal"
                    )}
                  </Button>
                )}
                {tier.checkoutTier && !isCurrent && !hasActiveSubscription && (
                  <Button
                    className="w-full"
                    onClick={() => checkoutMutation.mutate(tier.checkoutTier!)}
                    disabled={!user || checkoutMutation.isPending}
                    data-testid={`button-upgrade-${tier.id}`}
                  >
                    {checkoutMutation.isPending && checkoutMutation.variables === tier.checkoutTier ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Redirecting...
                      </>
                    ) : (
                      `Upgrade to ${tier.name}`
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </main>
  );
}

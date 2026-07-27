import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/ui/Button";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useBillingPortal, useCheckout } from "@/hooks/useBilling";
import { getPricingTiers } from "../../../shared/pricing";
import { APP_NAME } from "@/lib/config";

const PRICING_TIERS = getPricingTiers(APP_NAME);

export default function PricingScreen() {
  const { data: user, isLoading } = useCurrentUser();
  const checkout = useCheckout();
  const portal = useBillingPortal();

  const hasActiveSubscription = !!user && user.userGroup !== "freemium";

  return (
    <ScrollView className="flex-1 bg-slate-50 px-4">
      <Stack.Screen options={{ title: "Plans & pricing" }} />
      <View className="items-center gap-2 py-6">
        <Text className="text-2xl font-bold text-slate-900">Plans & pricing</Text>
        <Text className="text-center text-sm text-slate-500">
          Upgrade for more maps, more pins, and more AI-generated suggestions.
        </Text>
        {hasActiveSubscription && (
          <Button variant="outline" size="sm" onPress={() => portal.mutate(undefined)} loading={portal.isPending} testID="button-manage-billing">
            Manage billing
          </Button>
        )}
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color="#2563EB" />
      ) : (
        <View className="gap-4 pb-8">
          {PRICING_TIERS.map((tier) => {
            const isCurrent = user?.userGroup === tier.id;
            return (
              <View key={tier.id} className={`rounded-2xl border bg-white p-5 ${isCurrent ? "border-primary" : "border-slate-200"}`}>
                <View className="mb-1 flex-row items-center justify-between">
                  <Text className="text-lg font-semibold text-slate-900">{tier.name}</Text>
                  {isCurrent && (
                    <View className="rounded-full bg-slate-100 px-2.5 py-1" testID={`badge-current-plan-${tier.id}`}>
                      <Text className="text-xs font-medium text-slate-600">Current plan</Text>
                    </View>
                  )}
                </View>
                <Text className="mb-3 text-xl font-bold text-slate-900">{tier.priceLabel}</Text>
                <View className="mb-4 gap-1.5">
                  {tier.features.map((feature) => (
                    <View key={feature} className="flex-row items-start gap-2">
                      <Ionicons name="checkmark" size={16} color="#16a34a" style={{ marginTop: 2 }} />
                      <Text className="flex-1 text-sm text-slate-600">{feature}</Text>
                    </View>
                  ))}
                </View>
                {tier.checkoutTier && !isCurrent && hasActiveSubscription && (
                  <Button variant="outline" onPress={() => portal.mutate(undefined)} loading={portal.isPending} testID={`button-switch-${tier.id}`}>
                    Switch via billing portal
                  </Button>
                )}
                {tier.checkoutTier && !isCurrent && !hasActiveSubscription && (
                  <Button
                    onPress={() => checkout.mutate(tier.checkoutTier!)}
                    loading={checkout.isPending && checkout.variables === tier.checkoutTier}
                    disabled={!user}
                    testID={`button-upgrade-${tier.id}`}
                  >
                    {`Upgrade to ${tier.name}`}
                  </Button>
                )}
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

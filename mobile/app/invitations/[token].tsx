import { ActivityIndicator, Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/ui/Screen";
import { Button } from "@/components/ui/Button";
import { useAcceptInvitation, useInvitationPreview } from "@/hooks/useInvitations";
import { signInHref } from "@/lib/authNav";

export default function AcceptInvitationScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const { data: invitation, isLoading, error } = useInvitationPreview(token);
  const acceptInvitation = useAcceptInvitation(token);

  const onAccept = async () => {
    try {
      const result = await acceptInvitation.mutateAsync();
      router.replace(result.mapShareUrl ? `/map/${result.mapShareUrl}` : "/");
    } catch {
      // Error surfaces via acceptInvitation.error below.
    }
  };

  let body: React.ReactNode;
  if (isLoading) {
    body = (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  } else if (error || !invitation) {
    body = <InvitationCard icon="alert-circle" title="Invitation not found" description="This invitation link is invalid or has been removed." />;
  } else if (invitation.expired) {
    body = <InvitationCard icon="alert-circle" title="Invitation expired" description="This invitation has expired. Ask the map owner to send you a new one." />;
  } else if (invitation.status !== "pending") {
    body = (
      <InvitationCard icon="alert-circle" title="Invitation already used" description="This invitation has already been accepted or declined.">
        {invitation.mapShareUrl && (
          <Button onPress={() => router.replace(`/map/${invitation.mapShareUrl}`)} testID="button-go-to-map">
            Go to map
          </Button>
        )}
      </InvitationCard>
    );
  } else {
    body = (
      <InvitationCard icon="location" title={`Join "${invitation.mapName}"`} description={`${invitation.inviterName} invited you to collaborate on this map.`}>
        <View className="w-full gap-3">
          <View className="flex-row items-center justify-center gap-1.5">
            <Ionicons name={invitation.permission === "editable" ? "shield-outline" : "lock-closed-outline"} size={14} color="#64748b" />
            <Text className="text-sm text-slate-500">
              You'll be able to {invitation.permission === "editable" ? "add and edit pins" : "view pins"}
            </Text>
          </View>
          {isSignedIn ? (
            <Button onPress={onAccept} loading={acceptInvitation.isPending} testID="button-accept-invitation">
              Accept invitation
            </Button>
          ) : (
            <Button onPress={() => router.push(signInHref(`/invitations/${token}`))} testID="button-signin-to-accept">
              Sign in to accept
            </Button>
          )}
          {acceptInvitation.isError && <Text className="text-center text-sm text-red-600">Couldn't accept invitation. Please try again.</Text>}
        </View>
      </InvitationCard>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: "Invitation" }} />
      {body}
    </Screen>
  );
}

function InvitationCard({
  icon,
  title,
  description,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <View className="flex-1 items-center justify-center gap-3 px-4">
      <Ionicons name={icon} size={36} color="#2563EB" />
      <Text className="text-center text-xl font-bold text-slate-900">{title}</Text>
      <Text className="text-center text-sm text-slate-500">{description}</Text>
      {children && <View className="mt-2 w-full">{children}</View>}
    </View>
  );
}

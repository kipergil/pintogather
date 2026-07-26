import { useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { Link } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { useDeleteInvitation, useInvitations, useSendInvitation } from "@/hooks/useInvitations";
import { WEB_APP_URL } from "@/lib/config";

interface InviteSheetProps {
  visible: boolean;
  onClose: () => void;
  mapId: string;
}

const STATUS_COLOR: Record<string, string> = {
  pending: "text-amber-700 bg-amber-100",
  accepted: "text-green-700 bg-green-100",
  declined: "text-red-700 bg-red-100",
};

export function InviteSheet({ visible, onClose, mapId }: InviteSheetProps) {
  const { data, isLoading } = useInvitations(mapId);
  const sendInvitation = useSendInvitation(mapId);
  const deleteInvitation = useDeleteInvitation(mapId);

  const [email, setEmail] = useState("");
  const [permission, setPermission] = useState<"readonly" | "editable">("readonly");
  const [error, setError] = useState<string | null>(null);

  const seatsUsed = data?.seatsUsed ?? 0;
  const seatLimit = data?.seatLimit ?? Infinity;
  const seatLimitReached = seatsUsed >= seatLimit;

  const onSend = async () => {
    if (!email.trim()) return;
    setError(null);
    try {
      await sendInvitation.mutateAsync({ email: email.trim(), permission });
      setEmail("");
    } catch (err: any) {
      setError(err?.message ?? "Couldn't send that invitation.");
    }
  };

  const copyInviteLink = async (token: string) => {
    await Clipboard.setStringAsync(`${WEB_APP_URL}/invitations/${token}`);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <View className="max-h-[85%] gap-4 rounded-t-3xl bg-white p-6">
          <View className="flex-row items-center justify-between">
            <Text className="text-lg font-bold text-slate-900">Invite collaborators</Text>
            {Number.isFinite(seatLimit) && (
              <Text className="text-sm text-slate-500" testID="seat-usage">
                {seatsUsed} / {seatLimit} seats
              </Text>
            )}
          </View>

          {seatLimitReached ? (
            <View className="flex-row items-center gap-2.5 rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5" testID="seat-limit-locked-notice">
              <Ionicons name="lock-closed" size={14} color="#64748b" />
              <Text className="flex-1 text-xs text-slate-500">This map has reached its {seatLimit}-collaborator limit for this plan.</Text>
              <Link href="/pricing" className="text-xs font-medium text-primary">
                Upgrade
              </Link>
            </View>
          ) : (
            <View className="gap-2.5">
              <TextField
                value={email}
                onChangeText={setEmail}
                placeholder="Enter email address"
                keyboardType="email-address"
                autoCapitalize="none"
                testID="input-invite-email"
              />
              <View className="flex-row gap-2">
                <Pressable
                  onPress={() => setPermission("readonly")}
                  className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 ${permission === "readonly" ? "border-primary bg-primary/10" : "border-slate-300"}`}
                  testID="button-permission-readonly"
                >
                  <Ionicons name="lock-closed-outline" size={14} color={permission === "readonly" ? "#2563EB" : "#64748b"} />
                  <Text className={`text-sm ${permission === "readonly" ? "font-medium text-primary" : "text-slate-600"}`}>Read-only</Text>
                </Pressable>
                <Pressable
                  onPress={() => setPermission("editable")}
                  className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 ${permission === "editable" ? "border-primary bg-primary/10" : "border-slate-300"}`}
                  testID="button-permission-editable"
                >
                  <Ionicons name="shield-outline" size={14} color={permission === "editable" ? "#2563EB" : "#64748b"} />
                  <Text className={`text-sm ${permission === "editable" ? "font-medium text-primary" : "text-slate-600"}`}>Editable</Text>
                </Pressable>
              </View>
              {error && <Text className="text-sm text-red-600">{error}</Text>}
              <Button onPress={onSend} loading={sendInvitation.isPending} disabled={!email.trim()} testID="button-send-invitation">
                Send invitation
              </Button>
            </View>
          )}

          {!isLoading && (data?.invitations.length ?? 0) > 0 && (
            <ScrollView className="max-h-64">
              <View className="gap-2">
                {data!.invitations.map((invitation) => (
                  <View key={invitation.id} className="flex-row items-center justify-between rounded-xl border border-slate-200 p-2.5">
                    <View className="min-w-0 flex-1 gap-1">
                      <View className="flex-row items-center gap-2">
                        <Text className="flex-shrink truncate text-sm font-medium text-slate-900" numberOfLines={1}>
                          {invitation.email}
                        </Text>
                        <Text className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLOR[invitation.status] ?? "bg-slate-100 text-slate-600"}`}>
                          {invitation.status}
                        </Text>
                      </View>
                      <Text className="text-xs text-slate-500">{invitation.permission}</Text>
                    </View>
                    <View className="flex-row items-center gap-3">
                      {invitation.status === "pending" && (
                        <Pressable onPress={() => copyInviteLink(invitation.token)} hitSlop={8} testID={`button-copy-invite-link-${invitation.id}`}>
                          <Ionicons name="copy-outline" size={18} color="#64748b" />
                        </Pressable>
                      )}
                      <Pressable
                        onPress={() => deleteInvitation.mutate(invitation.id)}
                        hitSlop={8}
                        testID={`button-delete-invitation-${invitation.id}`}
                      >
                        <Ionicons name="trash-outline" size={18} color="#64748b" />
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>
          )}

          <Button variant="ghost" onPress={onClose}>
            Close
          </Button>
        </View>
      </View>
    </Modal>
  );
}

import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Screen } from "@/components/ui/Screen";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PinForm, type PinFormValue } from "@/components/PinForm";
import { useDeletePin, useMap, usePin, useUpdatePin } from "@/hooks/useMaps";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useCurrentUser } from "@/hooks/useCurrentUser";

const EMPTY_PIN_FORM: PinFormValue = {
  userName: "",
  twitterHandle: "",
  instagramHandle: "",
  linkedinHandle: "",
  note: "",
  photoUrl: null,
  pinColor: null,
  pinIcon: null,
};

export default function EditPinScreen() {
  const { isSignedIn } = useRequireAuth();
  const router = useRouter();
  const { shareUrl, pinId } = useLocalSearchParams<{ shareUrl: string; pinId: string }>();
  const { data: pin, isLoading: pinLoading } = usePin(pinId);
  const { data: map, isLoading: mapLoading } = useMap(shareUrl);
  const { data: currentUser } = useCurrentUser();
  const updatePin = useUpdatePin(pinId, shareUrl);
  const deletePin = useDeletePin(shareUrl);

  const [form, setForm] = useState<PinFormValue>(EMPTY_PIN_FORM);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!pin) return;
    setForm({
      userName: pin.userName ?? "",
      twitterHandle: pin.twitterHandle ?? "",
      instagramHandle: pin.instagramHandle ?? "",
      linkedinHandle: pin.linkedinHandle ?? "",
      note: pin.note ?? "",
      photoUrl: pin.photoUrl ?? null,
      pinColor: pin.pinColor ?? null,
      pinIcon: pin.pinIcon ?? null,
    });
  }, [pin]);

  if (!isSignedIn) return null;

  const canModify = !!pin && !!currentUser && (currentUser.id === pin.userId || currentUser.id === map?.ownerId);

  const onSave = async () => {
    if (!form.userName.trim()) {
      setError("Please enter your name.");
      return;
    }
    setError(null);
    try {
      await updatePin.mutateAsync({
        userName: form.userName.trim(),
        twitterHandle: form.twitterHandle.trim() || null,
        instagramHandle: form.instagramHandle.trim() || null,
        linkedinHandle: form.linkedinHandle.trim() || null,
        note: form.note.trim() || null,
        photoUrl: form.photoUrl,
        pinColor: map?.hasPinCustomization ? form.pinColor : pin?.pinColor ?? null,
        pinIcon: map?.hasPinCustomization ? form.pinIcon : pin?.pinIcon ?? null,
      });
      router.back();
    } catch (err: any) {
      setError(err?.message ?? "Couldn't save changes.");
    }
  };

  const onDelete = () => {
    if (!pin) return;
    Alert.alert("Delete pin?", `Remove "${pin.userName}"'s pin from this map.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deletePin.mutateAsync(pin.id);
            router.replace(`/map/${shareUrl}`);
          } catch (err: any) {
            Alert.alert("Couldn't delete pin", err?.message ?? "Please try again.");
          }
        },
      },
    ]);
  };

  return (
    <Screen scroll>
      <Stack.Screen options={{ title: "Edit pin" }} />
      {pinLoading || mapLoading ? (
        <View className="flex-1 items-center justify-center py-16">
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      ) : !pin || !map ? (
        <EmptyState icon="alert-circle-outline" title="Pin not found" description="This pin doesn't exist, or the link is no longer valid." />
      ) : !canModify ? (
        <EmptyState icon="lock-closed-outline" title="You can't edit this pin" description="Only the pin's creator or the map owner can edit it." />
      ) : (
        <View className="gap-4 py-6">
          {pin.address && <Text className="-mt-2 text-sm text-slate-500">{pin.address}</Text>}
          <PinForm
            value={form}
            onChange={setForm}
            noteLabel={map.noteLabel || "Note"}
            notePrompt={map.notePrompt ?? null}
            hasPinCustomization={map.hasPinCustomization}
            profileSocials={
              currentUser
                ? {
                    twitterHandle: currentUser.twitterHandle ?? "",
                    instagramHandle: currentUser.instagramHandle ?? "",
                    linkedinHandle: currentUser.linkedinHandle ?? "",
                  }
                : undefined
            }
          />
          {error && <Text className="text-sm text-red-600">{error}</Text>}
          <Button onPress={onSave} loading={updatePin.isPending} disabled={!form.userName.trim()} testID="button-save-pin">
            Save changes
          </Button>
          <Button variant="destructive" onPress={onDelete} loading={deletePin.isPending} testID="button-delete-pin">
            Delete pin
          </Button>
        </View>
      )}
    </Screen>
  );
}

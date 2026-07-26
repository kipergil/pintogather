import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Switch, Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/ui/Screen";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PinStylePicker } from "@/components/ui/PinStylePicker";
import { useDeleteMap, useMap, useUpdateMap } from "@/hooks/useMaps";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { TIER_LIMITS } from "../../../../shared/limits";
import type { PinColor, PinIcon } from "../../../../shared/enums";

export default function EditMapScreen() {
  const { isSignedIn } = useRequireAuth();
  const router = useRouter();
  const { shareUrl } = useLocalSearchParams<{ shareUrl: string }>();
  const { data: map, isLoading } = useMap(shareUrl);
  const { data: currentUser } = useCurrentUser();
  const updateMap = useUpdateMap(map?.id);
  const deleteMap = useDeleteMap();
  const hasPinCustomization = TIER_LIMITS[currentUser?.userGroup ?? "freemium"].pinCustomization;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [noteLabel, setNoteLabel] = useState("");
  const [notePrompt, setNotePrompt] = useState("");
  const [showOnProfile, setShowOnProfile] = useState(false);
  const [defaultPinColor, setDefaultPinColor] = useState<PinColor | null>(null);
  const [defaultPinIcon, setDefaultPinIcon] = useState<PinIcon | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!map) return;
    setName(map.name);
    setDescription(map.description ?? "");
    setNoteLabel(map.noteLabel ?? "");
    setNotePrompt(map.notePrompt ?? "");
    setShowOnProfile(map.showOnProfile);
    setDefaultPinColor(map.defaultPinColor);
    setDefaultPinIcon(map.defaultPinIcon);
  }, [map]);

  if (!isSignedIn) return null;

  const isOwner = !!currentUser && !!map && currentUser.id === map.ownerId;

  const onSave = async () => {
    if (!map) return;
    setError(null);
    try {
      await updateMap.mutateAsync({
        name: name.trim(),
        description: description.trim() || null,
        noteLabel: noteLabel.trim() || null,
        notePrompt: notePrompt.trim() || null,
        showOnProfile,
        defaultPinColor: hasPinCustomization ? defaultPinColor : map.defaultPinColor,
        defaultPinIcon: hasPinCustomization ? defaultPinIcon : map.defaultPinIcon,
      });
      router.back();
    } catch (err: any) {
      setError(err?.message ?? "Couldn't save changes.");
    }
  };

  const onDelete = () => {
    if (!map) return;
    Alert.alert("Delete map?", `"${map.name}" and all of its pins will be permanently deleted.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteMap.mutateAsync(map.id);
            router.replace("/");
          } catch (err: any) {
            Alert.alert("Couldn't delete map", err?.message ?? "Please try again.");
          }
        },
      },
    ]);
  };

  return (
    <Screen scroll>
      <Stack.Screen options={{ title: "Edit map" }} />
      {isLoading ? (
        <View className="flex-1 items-center justify-center py-16">
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      ) : !map ? (
        <EmptyState icon="alert-circle-outline" title="Map not found" description="This map doesn't exist, or the link is no longer valid." />
      ) : !isOwner ? (
        <EmptyState icon="lock-closed-outline" title="Only the owner can edit this map" description="You don't have permission to change this map's settings." />
      ) : (
        <View className="gap-4 py-6">
          <TextField label="Name" value={name} onChangeText={setName} testID="input-map-name" />
          <TextField
            label="Description (optional)"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            testID="input-map-description"
          />

          <View className="flex-row items-center justify-between gap-3 rounded-xl border border-slate-200 p-3.5">
            <View className="flex-1 gap-0.5">
              <Text className="text-sm font-medium text-slate-700">Show on public profile</Text>
              <Text className="text-xs text-slate-500">List this map on your public profile page.</Text>
            </View>
            <Switch value={showOnProfile} onValueChange={setShowOnProfile} testID="switch-show-on-profile" />
          </View>

          <TextField
            label="Note field label"
            value={noteLabel}
            onChangeText={setNoteLabel}
            placeholder="Note"
            maxLength={60}
            testID="input-note-label"
          />
          <TextField
            label="Note prompt"
            value={notePrompt}
            onChangeText={setNotePrompt}
            placeholder="What makes this place worth pinning?"
            multiline
            numberOfLines={2}
            testID="input-note-prompt"
          />

          <View className="gap-1.5">
            <Text className="text-sm font-medium text-slate-700">Default pin color & icon</Text>
            {hasPinCustomization ? (
              <PinStylePicker
                color={defaultPinColor}
                icon={defaultPinIcon}
                onChange={({ color, icon }) => {
                  setDefaultPinColor(color);
                  setDefaultPinIcon(icon);
                }}
                noneLabel="Default"
              />
            ) : (
              <View className="flex-row items-center gap-2.5 rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5">
                <Ionicons name="lock-closed" size={14} color="#64748b" />
                <Text className="flex-1 text-xs text-slate-500">
                  Custom pin colors & icons are a Basic/Premium feature. Upgrade on the web app.
                </Text>
              </View>
            )}
          </View>

          {error && <Text className="text-sm text-red-600">{error}</Text>}
          <Button onPress={onSave} loading={updateMap.isPending} disabled={!name.trim()} testID="button-save-map">
            Save changes
          </Button>
          <Button variant="destructive" onPress={onDelete} loading={deleteMap.isPending} testID="button-delete-map">
            Delete map
          </Button>
        </View>
      )}
    </Screen>
  );
}

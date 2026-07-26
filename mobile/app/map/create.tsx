import { useState } from "react";
import { Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/ui/Screen";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { PinStylePicker } from "@/components/ui/PinStylePicker";
import { useCreateMap } from "@/hooks/useMaps";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { TIER_LIMITS } from "../../../shared/limits";
import type { PinColor, PinIcon } from "../../../shared/enums";

export default function CreateMapScreen() {
  const { isSignedIn } = useRequireAuth();
  const router = useRouter();
  const createMap = useCreateMap();
  const { data: currentUser } = useCurrentUser();
  const hasPinCustomization = TIER_LIMITS[currentUser?.userGroup ?? "freemium"].pinCustomization;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [showNoteCustomization, setShowNoteCustomization] = useState(false);
  const [noteLabel, setNoteLabel] = useState("");
  const [notePrompt, setNotePrompt] = useState("");
  const [showPinStyle, setShowPinStyle] = useState(false);
  const [defaultPinColor, setDefaultPinColor] = useState<PinColor | null>(null);
  const [defaultPinIcon, setDefaultPinIcon] = useState<PinIcon | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isSignedIn) return null;

  const onSubmit = async () => {
    setError(null);
    try {
      const map = await createMap.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        noteLabel: noteLabel.trim() || null,
        notePrompt: notePrompt.trim() || null,
        defaultPinColor: hasPinCustomization ? defaultPinColor : null,
        defaultPinIcon: hasPinCustomization ? defaultPinIcon : null,
      });
      router.replace(`/map/${map.shareUrl}`);
    } catch (err: any) {
      setError(err?.message ?? "Couldn't create the map.");
    }
  };

  return (
    <Screen scroll>
      <Stack.Screen options={{ title: "New map", presentation: "modal" }} />
      <View className="gap-4 py-6">
        <TextField label="Name" value={name} onChangeText={setName} placeholder="Best coffee in town" testID="input-map-name" />
        <TextField
          label="Description (optional)"
          value={description}
          onChangeText={setDescription}
          placeholder="What's this map for?"
          multiline
          numberOfLines={3}
          testID="input-map-description"
        />

        <View className="gap-3">
          <Button
            variant="ghost"
            className="justify-start px-0"
            onPress={() => setShowNoteCustomization((v) => !v)}
            testID="button-toggle-note-customization"
          >
            {`${showNoteCustomization ? "▾" : "▸"}  Customize the pin note question`}
          </Button>
          {showNoteCustomization && (
            <View className="gap-3">
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
            </View>
          )}
        </View>

        <View className="gap-3">
          <Button
            variant="ghost"
            className="justify-start px-0"
            onPress={() => setShowPinStyle((v) => !v)}
            testID="button-toggle-pin-style"
          >
            {`${showPinStyle ? "▾" : "▸"}  Default pin color & icon`}
          </Button>
          {showPinStyle &&
            (hasPinCustomization ? (
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
              <View
                className="flex-row items-center gap-2.5 rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5"
                testID="pin-style-locked-notice"
              >
                <Ionicons name="lock-closed" size={14} color="#64748b" />
                <Text className="flex-1 text-xs text-slate-500">
                  Custom pin colors & icons are a Basic/Premium feature. Upgrade on the web app.
                </Text>
              </View>
            ))}
        </View>

        {error && <Text className="text-sm text-red-600">{error}</Text>}
        <Button onPress={onSubmit} loading={createMap.isPending} disabled={!name.trim()} testID="button-submit-create-map">
          Create map
        </Button>
      </View>
    </Screen>
  );
}

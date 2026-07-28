import { useState } from "react";
import { Switch, Text, View } from "react-native";
import { Link, Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/ui/Screen";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { PinStylePicker } from "@/components/ui/PinStylePicker";
import { TemplatePicker } from "@/components/TemplatePicker";
import { useCreateMap } from "@/hooks/useMaps";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { isUpgradeableError } from "@/lib/upgradeError";
import { TIER_LIMITS } from "../../../shared/limits";
import type { PinColor, PinIcon } from "../../../shared/enums";
import type { MapTemplate } from "../../../shared/schema";

export default function CreateMapScreen() {
  const { isSignedIn } = useRequireAuth();
  const router = useRouter();
  const createMap = useCreateMap();
  const { data: currentUser } = useCurrentUser();
  const hasPinCustomization = TIER_LIMITS[currentUser?.userGroup ?? "freemium"].pinCustomization;

  // undefined = not chosen yet (show the picker), null = "start from scratch", otherwise the picked template.
  const [template, setTemplate] = useState<MapTemplate | null | undefined>(undefined);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [showNoteCustomization, setShowNoteCustomization] = useState(false);
  const [requirePinApproval, setRequirePinApproval] = useState(true);
  const [noteLabel, setNoteLabel] = useState("");
  const [notePrompt, setNotePrompt] = useState("");
  const [showPinStyle, setShowPinStyle] = useState(false);
  const [defaultPinColor, setDefaultPinColor] = useState<PinColor | null>(null);
  const [defaultPinIcon, setDefaultPinIcon] = useState<PinIcon | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [upgradeable, setUpgradeable] = useState(false);

  if (!isSignedIn) return null;

  const onSelectTemplate = (chosen: MapTemplate | null) => {
    setTemplate(chosen);
    if (chosen) {
      setName(chosen.suggestedName);
      setDescription(chosen.suggestedDescription ?? "");
      setNoteLabel(chosen.noteLabel ?? "");
      setNotePrompt(chosen.notePrompt ?? "");
      setShowNoteCustomization(true);
      // A template can only suggest pin styling if this user's plan actually supports it —
      // otherwise the picker isn't shown but the value would still be submitted and rejected.
      if (hasPinCustomization) {
        setDefaultPinColor(chosen.defaultPinColor);
        setDefaultPinIcon(chosen.defaultPinIcon);
        setShowPinStyle(true);
      }
    }
  };

  if (template === undefined) {
    return (
      <Screen scroll>
        <Stack.Screen options={{ title: "New map", presentation: "modal" }} />
        <TemplatePicker onSelect={onSelectTemplate} />
      </Screen>
    );
  }

  const onSubmit = async () => {
    setError(null);
    setUpgradeable(false);
    try {
      const map = await createMap.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        noteLabel: noteLabel.trim() || null,
        notePrompt: notePrompt.trim() || null,
        requirePinApproval,
        defaultPinColor: hasPinCustomization ? defaultPinColor : null,
        defaultPinIcon: hasPinCustomization ? defaultPinIcon : null,
      });
      router.replace(`/map/${map.shareUrl}`);
    } catch (err: any) {
      setError(err?.message ?? "Couldn't create the map.");
      setUpgradeable(isUpgradeableError(err));
    }
  };

  return (
    <Screen scroll>
      <Stack.Screen options={{ title: "New map", presentation: "modal" }} />
      <View className="gap-4 py-6">
        <Button
          variant="ghost"
          size="sm"
          className="self-start px-0"
          onPress={() => setTemplate(undefined)}
          testID="button-change-template"
        >
          ← Choose a different template
        </Button>
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

        <View className="flex-row items-center justify-between gap-3 rounded-xl border border-slate-200 p-3.5">
          <View className="flex-1 gap-0.5">
            <Text className="text-sm font-medium text-slate-700">Require approval for new pins</Text>
            <Text className="text-xs text-slate-500">
              Pins from anyone but you stay hidden until you approve them. Turn this off to have them go live right away.
            </Text>
          </View>
          <Switch value={requirePinApproval} onValueChange={setRequirePinApproval} testID="switch-require-pin-approval" />
        </View>

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
                <Text className="flex-1 text-xs text-slate-500">Custom pin colors & icons are a Basic/Premium feature.</Text>
                <Link href="/pricing" className="text-xs font-medium text-primary">
                  Upgrade
                </Link>
              </View>
            ))}
        </View>

        {error && (
          <View className="gap-1">
            <Text className="text-sm text-red-600">{error}</Text>
            {upgradeable && (
              <Link href="/pricing" className="text-sm font-medium text-primary">
                View plans
              </Link>
            )}
          </View>
        )}
        <Button onPress={onSubmit} loading={createMap.isPending} disabled={!name.trim()} testID="button-submit-create-map">
          Create map
        </Button>
      </View>
    </Screen>
  );
}

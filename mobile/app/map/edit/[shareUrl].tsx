import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Switch, Text, View } from "react-native";
import { Link, Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/ui/Screen";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PinStylePicker } from "@/components/ui/PinStylePicker";
import { InviteSheet } from "@/components/InviteSheet";
import { useArchiveMaps, useDeleteMap, useMap, useUpdateMap, useUpdateMapPermissions } from "@/hooks/useMaps";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { sharePinsCsv } from "@/lib/csv-export";
import { TIER_LIMITS } from "../../../../shared/limits";
import type { PinColor, PinIcon } from "../../../../shared/enums";

export default function EditMapScreen() {
  const { isSignedIn } = useRequireAuth();
  const router = useRouter();
  const { shareUrl } = useLocalSearchParams<{ shareUrl: string }>();
  const { data: map, isLoading } = useMap(shareUrl);
  const { data: currentUser } = useCurrentUser();
  const updateMap = useUpdateMap(map?.id);
  const updatePermissions = useUpdateMapPermissions(map?.id);
  const deleteMap = useDeleteMap();
  const archiveMaps = useArchiveMaps();
  const hasPinCustomization = TIER_LIMITS[currentUser?.userGroup ?? "freemium"].pinCustomization;
  const hasMapArchiving = TIER_LIMITS[currentUser?.userGroup ?? "freemium"].mapArchiving;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [noteLabel, setNoteLabel] = useState("");
  const [notePrompt, setNotePrompt] = useState("");
  const [showOnProfile, setShowOnProfile] = useState(false);
  const [defaultPinColor, setDefaultPinColor] = useState<PinColor | null>(null);
  const [defaultPinIcon, setDefaultPinIcon] = useState<PinIcon | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [defaultPermission, setDefaultPermission] = useState<"readonly" | "editable">("readonly");
  const [error, setError] = useState<string | null>(null);
  const [permissionsError, setPermissionsError] = useState<string | null>(null);
  const [inviteSheetVisible, setInviteSheetVisible] = useState(false);

  useEffect(() => {
    if (!map) return;
    setName(map.name);
    setDescription(map.description ?? "");
    setNoteLabel(map.noteLabel ?? "");
    setNotePrompt(map.notePrompt ?? "");
    setShowOnProfile(map.showOnProfile);
    setDefaultPinColor(map.defaultPinColor);
    setDefaultPinIcon(map.defaultPinIcon);
    setIsPublic(map.isPublic);
    setDefaultPermission(map.defaultPermission);
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

  const onSavePermissions = async () => {
    if (!map) return;
    setPermissionsError(null);
    try {
      await updatePermissions.mutateAsync({ isPublic, defaultPermission });
    } catch (err: any) {
      setPermissionsError(err?.message ?? "Couldn't save access settings.");
    }
  };

  const onExportCsv = async () => {
    if (!map) return;
    try {
      await sharePinsCsv(map.pins, map.noteLabel || "Note");
    } catch (err: any) {
      Alert.alert("Couldn't export pins", err?.message ?? "Please try again.");
    }
  };

  const onArchive = () => {
    if (!map) return;
    Alert.alert("Archive map?", `"${map.name}" will be hidden from your maps list and public profile, but stays reachable via its share link.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Archive",
        onPress: async () => {
          try {
            await archiveMaps.mutateAsync([map.id]);
            router.replace("/");
          } catch (err: any) {
            Alert.alert("Couldn't archive map", err?.message ?? "Please try again.");
          }
        },
      },
    ]);
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
                <Text className="flex-1 text-xs text-slate-500">Custom pin colors & icons are a Basic/Premium feature.</Text>
                <Link href="/pricing" className="text-xs font-medium text-primary">
                  Upgrade
                </Link>
              </View>
            )}
          </View>

          {error && <Text className="text-sm text-red-600">{error}</Text>}
          <Button onPress={onSave} loading={updateMap.isPending} disabled={!name.trim()} testID="button-save-map">
            Save changes
          </Button>

          <View className="gap-3 rounded-xl border border-slate-200 p-3.5">
            <Text className="text-sm font-medium text-slate-700">Sharing & access</Text>

            <View className="flex-row items-center justify-between gap-3">
              <View className="flex-1 gap-0.5">
                <Text className="text-sm text-slate-700">Public map</Text>
                <Text className="text-xs text-slate-500">Marks this map as open to the public via its share link.</Text>
              </View>
              <Switch value={isPublic} onValueChange={setIsPublic} testID="switch-map-public" />
            </View>

            <View className="gap-1.5">
              <Text className="text-sm text-slate-700">Access for people without an account</Text>
              <Text className="text-xs text-slate-500">
                Controls whether pins added anonymously through the share link can later be edited by other visitors, not just their
                creator.
              </Text>
              <View className="flex-row gap-2">
                <Pressable
                  onPress={() => setDefaultPermission("readonly")}
                  className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 ${defaultPermission === "readonly" ? "border-primary bg-primary/10" : "border-slate-300"}`}
                  testID="button-default-permission-readonly"
                >
                  <Ionicons name="lock-closed-outline" size={14} color={defaultPermission === "readonly" ? "#2563EB" : "#64748b"} />
                  <Text className={`text-sm ${defaultPermission === "readonly" ? "font-medium text-primary" : "text-slate-600"}`}>
                    View only
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setDefaultPermission("editable")}
                  className={`flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 ${defaultPermission === "editable" ? "border-primary bg-primary/10" : "border-slate-300"}`}
                  testID="button-default-permission-editable"
                >
                  <Ionicons name="shield-outline" size={14} color={defaultPermission === "editable" ? "#2563EB" : "#64748b"} />
                  <Text className={`text-sm ${defaultPermission === "editable" ? "font-medium text-primary" : "text-slate-600"}`}>
                    Anyone can edit
                  </Text>
                </Pressable>
              </View>
            </View>

            {permissionsError && <Text className="text-sm text-red-600">{permissionsError}</Text>}
            <Button
              variant="outline"
              size="sm"
              onPress={onSavePermissions}
              loading={updatePermissions.isPending}
              testID="button-save-permissions"
            >
              Save access settings
            </Button>
          </View>

          <Button variant="outline" onPress={() => setInviteSheetVisible(true)} testID="button-open-invite-sheet">
            Invite collaborators
          </Button>
          <Link href={`/map/import/${shareUrl}`} asChild>
            <Button variant="outline" testID="button-open-import">
              Import pins from a list
            </Button>
          </Link>
          <Link href={`/map/pins/${shareUrl}`} asChild>
            <Button variant="outline" testID="button-manage-pins">
              Manage pins
            </Button>
          </Link>
          <Button variant="outline" onPress={onExportCsv} testID="button-export-csv">
            Export pins as CSV
          </Button>
          {hasMapArchiving ? (
            <Button variant="outline" onPress={onArchive} loading={archiveMaps.isPending} testID="button-archive-map">
              Archive map
            </Button>
          ) : (
            <View className="flex-row items-center gap-2.5 rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5">
              <Ionicons name="lock-closed" size={14} color="#64748b" />
              <Text className="flex-1 text-xs text-slate-500">Archiving maps is a Basic/Premium feature.</Text>
              <Link href="/pricing" className="text-xs font-medium text-primary">
                Upgrade
              </Link>
            </View>
          )}
          <Button variant="destructive" onPress={onDelete} loading={deleteMap.isPending} testID="button-delete-map">
            Delete map
          </Button>
        </View>
      )}

      {map && <InviteSheet visible={inviteSheetVisible} onClose={() => setInviteSheetVisible(false)} mapId={map.id} />}
    </Screen>
  );
}

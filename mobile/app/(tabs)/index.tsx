import { useState } from "react";
import { Alert, FlatList, Modal, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/ui/Screen";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { useMaps, useUnarchiveMaps, type MapListItem } from "@/hooks/useMaps";
import { useCreateFolder, useDeleteFolder, useFolders, useMoveMapToFolder, useUpdateFolder } from "@/hooks/useFolders";
import { buildFolderTree, flattenFolderTree } from "@/lib/folder-tree";
import type { Folder } from "../../../shared/schema";

function MapCard({
  map,
  onPress,
  archived,
  onRestore,
  onMove,
}: {
  map: MapListItem;
  onPress: () => void;
  archived?: boolean;
  onRestore?: () => void;
  onMove?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="mb-3 rounded-2xl border border-slate-200 bg-white p-4 active:opacity-70"
      testID={`card-map-${map.id}`}
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 gap-1">
          <Text className="text-base font-semibold text-slate-900" numberOfLines={1}>
            {map.name}
          </Text>
          {map.description ? (
            <Text className="text-sm text-slate-500" numberOfLines={2}>
              {map.description}
            </Text>
          ) : (
            <Text className="text-sm italic text-slate-400">No description</Text>
          )}
        </View>
        {archived ? (
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              onRestore?.();
            }}
            hitSlop={8}
            testID={`button-restore-map-${map.id}`}
          >
            <Ionicons name="refresh" size={20} color="#2563EB" />
          </Pressable>
        ) : (
          <View className="flex-row items-center gap-3">
            {onMove && (
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  onMove();
                }}
                hitSlop={8}
                testID={`button-move-map-${map.id}`}
              >
                <Ionicons name="folder-outline" size={20} color="#64748b" />
              </Pressable>
            )}
            <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
          </View>
        )}
      </View>
      <View className="mt-3 flex-row items-center gap-1.5">
        <Ionicons name="location" size={14} color="#94a3b8" />
        <Text className="text-xs text-slate-500">
          {map.pinCount} {map.pinCount === 1 ? "pin" : "pins"}
        </Text>
      </View>
    </Pressable>
  );
}

/** Bottom sheet: create/rename/delete folders. Always fully expanded (no collapse) — folder counts for personal organization are small. */
function FolderManagerSheet({ visible, onClose, folders }: { visible: boolean; onClose: () => void; folders: Folder[] }) {
  const createFolder = useCreateFolder();
  const updateFolder = useUpdateFolder();
  const deleteFolder = useDeleteFolder();
  const [dialog, setDialog] = useState<{ mode: "create" | "rename"; parentFolderId: string | null; folderId?: string } | null>(null);
  const [nameInput, setNameInput] = useState("");

  const tree = buildFolderTree(folders);

  const submitDialog = () => {
    const name = nameInput.trim();
    if (!name || !dialog) return;
    if (dialog.mode === "create") {
      createFolder.mutate({ name, parentFolderId: dialog.parentFolderId });
    } else if (dialog.folderId) {
      updateFolder.mutate({ folderId: dialog.folderId, data: { name } });
    }
    setDialog(null);
  };

  const onDelete = (folder: Folder) => {
    Alert.alert(
      "Delete folder?",
      `Maps and subfolders inside "${folder.name}" move back to the root level — nothing is deleted.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => deleteFolder.mutate(folder.id) },
      ],
    );
  };

  return (
    <>
      <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
        <View className="flex-1 justify-end bg-black/40">
          <View className="max-h-[75%] rounded-t-3xl bg-white p-6">
            <View className="mb-4 flex-row items-center justify-between">
              <Text className="text-lg font-bold text-slate-900">Folders</Text>
              <Pressable onPress={onClose} hitSlop={8} testID="button-close-folder-manager">
                <Ionicons name="close" size={22} color="#64748b" />
              </Pressable>
            </View>
            <Button
              variant="outline"
              size="sm"
              className="mb-3 self-start"
              onPress={() => {
                setNameInput("");
                setDialog({ mode: "create", parentFolderId: null });
              }}
              testID="button-new-folder"
            >
              + New folder
            </Button>
            <ScrollView>
              {tree.length === 0 && <Text className="text-sm italic text-slate-400">No folders yet.</Text>}
              {flattenFolderTree(tree).map((folder) => (
                <View
                  key={folder.id}
                  className="mb-2 flex-row items-center gap-2 rounded-xl border border-slate-200 p-3"
                  style={{ marginLeft: folder.depth * 16 }}
                  testID={`row-folder-${folder.id}`}
                >
                  <Ionicons name="folder-outline" size={16} color="#64748b" />
                  <Text className="flex-1 font-medium text-slate-900" numberOfLines={1}>
                    {folder.name}
                  </Text>
                  <Pressable
                    onPress={() => {
                      setNameInput("");
                      setDialog({ mode: "create", parentFolderId: folder.id });
                    }}
                    hitSlop={8}
                    testID={`button-new-subfolder-${folder.id}`}
                  >
                    <Ionicons name="add-circle-outline" size={18} color="#2563EB" />
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setNameInput(folder.name);
                      setDialog({ mode: "rename", parentFolderId: folder.parentFolderId, folderId: folder.id });
                    }}
                    hitSlop={8}
                    testID={`button-rename-folder-${folder.id}`}
                  >
                    <Ionicons name="pencil-outline" size={16} color="#64748b" />
                  </Pressable>
                  <Pressable onPress={() => onDelete(folder)} hitSlop={8} testID={`button-delete-folder-${folder.id}`}>
                    <Ionicons name="trash-outline" size={16} color="#dc2626" />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={!!dialog} animationType="fade" transparent onRequestClose={() => setDialog(null)}>
        <View className="flex-1 items-center justify-center bg-black/40 px-8">
          <View className="w-full gap-3 rounded-2xl bg-white p-5">
            <Text className="text-base font-bold text-slate-900">{dialog?.mode === "rename" ? "Rename folder" : "New folder"}</Text>
            <TextField value={nameInput} onChangeText={setNameInput} placeholder="Folder name" autoFocus testID="input-folder-name" />
            <View className="mt-1 flex-row gap-3">
              <Button variant="outline" className="flex-1" onPress={() => setDialog(null)}>
                Cancel
              </Button>
              <Button className="flex-1" onPress={submitDialog} disabled={!nameInput.trim()} testID="button-save-folder">
                Save
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

/** Bottom sheet: pick a folder (or Unfiled) to move one map into. */
function MoveToFolderSheet({
  visible,
  onClose,
  folders,
  map,
}: {
  visible: boolean;
  onClose: () => void;
  folders: Folder[];
  map: MapListItem | null;
}) {
  const moveToFolder = useMoveMapToFolder();
  const flatFolders = flattenFolderTree(buildFolderTree(folders));

  const onSelect = async (folderId: string | null) => {
    if (!map) return;
    try {
      await moveToFolder.mutateAsync({ mapId: map.id, folderId });
    } catch (err: any) {
      Alert.alert("Couldn't move map", err?.message ?? "Please try again.");
    }
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <View className="max-h-[75%] rounded-t-3xl bg-white p-6">
          <View className="mb-4 flex-row items-center justify-between">
            <Text className="text-lg font-bold text-slate-900" numberOfLines={1}>
              Move "{map?.name}"
            </Text>
            <Pressable onPress={onClose} hitSlop={8} testID="button-close-move-to-folder">
              <Ionicons name="close" size={22} color="#64748b" />
            </Pressable>
          </View>
          <ScrollView>
            <Pressable
              onPress={() => onSelect(null)}
              className="mb-2 flex-row items-center gap-2 rounded-xl border border-slate-200 p-3"
              testID="option-move-unfiled"
            >
              {(map?.folderId ?? null) === null && <Ionicons name="checkmark" size={16} color="#2563EB" />}
              <Text className="text-slate-900">Unfiled</Text>
            </Pressable>
            {flatFolders.map((folder) => (
              <Pressable
                key={folder.id}
                onPress={() => onSelect(folder.id)}
                className="mb-2 flex-row items-center gap-2 rounded-xl border border-slate-200 p-3"
                style={{ marginLeft: folder.depth * 16 }}
                testID={`option-move-folder-${folder.id}`}
              >
                {map?.folderId === folder.id && <Ionicons name="checkmark" size={16} color="#2563EB" />}
                <Text className="text-slate-900">{folder.name}</Text>
              </Pressable>
            ))}
            {flatFolders.length === 0 && (
              <Text className="text-sm italic text-slate-400">No folders yet — create one from the folder icon above.</Text>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function MapsListScreen() {
  const router = useRouter();
  const [showArchived, setShowArchived] = useState(false);
  const { data: maps, isLoading, isFetching, refetch } = useMaps(showArchived);
  const unarchiveMaps = useUnarchiveMaps();
  const { data: folders = [] } = useFolders();
  const [folderManagerVisible, setFolderManagerVisible] = useState(false);
  const [moveMapTarget, setMoveMapTarget] = useState<MapListItem | null>(null);
  // undefined = "All maps" (no filter), null = "Unfiled", a string = that folder.
  const [selectedFolderId, setSelectedFolderId] = useState<string | null | undefined>(undefined);

  const flatFolders = flattenFolderTree(buildFolderTree(folders));
  const visibleMaps =
    showArchived || selectedFolderId === undefined
      ? maps ?? []
      : (maps ?? []).filter((map) => (map.folderId ?? null) === selectedFolderId);

  const onRestore = (map: MapListItem) => {
    Alert.alert("Restore map?", `"${map.name}" will reappear in your maps list.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Restore",
        onPress: async () => {
          try {
            await unarchiveMaps.mutateAsync([map.id]);
          } catch (err: any) {
            Alert.alert("Couldn't restore map", err?.message ?? "Please try again.");
          }
        },
      },
    ]);
  };

  return (
    <Screen>
      <View className="flex-row items-center justify-between py-4">
        <Text className="text-2xl font-bold text-slate-900">{showArchived ? "Archived maps" : "My Maps"}</Text>
        <View className="flex-row items-center gap-3">
          {!showArchived && (
            <Pressable onPress={() => setFolderManagerVisible(true)} hitSlop={8} testID="button-manage-folders">
              <Ionicons name="folder-outline" size={22} color="#2563EB" />
            </Pressable>
          )}
          <Pressable onPress={() => setShowArchived((v) => !v)} hitSlop={8} testID="button-toggle-archived">
            <Ionicons name={showArchived ? "archive" : "archive-outline"} size={22} color="#2563EB" />
          </Pressable>
          {!showArchived && (
            <Pressable
              onPress={() => router.push("/map/create")}
              className="h-10 w-10 items-center justify-center rounded-full bg-primary active:bg-blue-700"
              testID="button-create-map"
            >
              <Ionicons name="add" size={24} color="white" />
            </Pressable>
          )}
        </View>
      </View>

      {!showArchived && (maps ?? []).length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3 -mx-1" contentContainerStyle={{ paddingHorizontal: 4, gap: 8 }}>
          {[
            { id: undefined, label: "All", testId: "all" },
            { id: null, label: "Unfiled", testId: "unfiled" },
            ...flatFolders.map((f) => ({ id: f.id as string | null | undefined, label: f.name, testId: f.id })),
          ].map((chip, i) => (
            <Pressable
              key={i}
              onPress={() => setSelectedFolderId(chip.id)}
              className={`rounded-full border px-3.5 py-1.5 ${
                selectedFolderId === chip.id ? "border-primary bg-primary/10" : "border-slate-200 bg-white"
              }`}
              testID={`chip-folder-${chip.testId}`}
            >
              <Text className={`text-sm font-medium ${selectedFolderId === chip.id ? "text-primary" : "text-slate-600"}`}>
                {chip.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <FlatList
        data={visibleMaps}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) =>
          showArchived ? (
            <MapCard map={item} onPress={() => router.push(`/map/${item.shareUrl}`)} archived onRestore={() => onRestore(item)} />
          ) : (
            <MapCard map={item} onPress={() => router.push(`/map/${item.shareUrl}`)} onMove={() => setMoveMapTarget(item)} />
          )
        }
        refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} />}
        contentContainerStyle={{ flexGrow: 1 }}
        ListEmptyComponent={
          !isLoading ? (
            showArchived ? (
              <EmptyState icon="archive-outline" title="No archived maps" description="Maps you archive will show up here." />
            ) : (maps ?? []).length > 0 ? (
              <EmptyState icon="folder-outline" title="No maps in this folder" description="Move a map here, or pick a different folder above." />
            ) : (
              <EmptyState icon="map-outline" title="No maps yet" description="Create your first map to start pinning places.">
                <Pressable onPress={() => router.push("/map/create")} className="mt-2">
                  <Text className="text-sm font-semibold text-primary">Create a map</Text>
                </Pressable>
              </EmptyState>
            )
          ) : null
        }
      />

      <FolderManagerSheet visible={folderManagerVisible} onClose={() => setFolderManagerVisible(false)} folders={folders} />
      <MoveToFolderSheet visible={!!moveMapTarget} onClose={() => setMoveMapTarget(null)} folders={folders} map={moveMapTarget} />
    </Screen>
  );
}

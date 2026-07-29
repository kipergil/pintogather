import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  Text,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { apiRequest, apiUpload } from "@/lib/api";
import type { ItemType } from "../../../shared/enums";

export interface ItemFormValue {
  title: string;
  contributorName: string;
  url: string;
  note: string;
  photoUrl: string | null;
}

interface AddItemFormProps {
  value: ItemFormValue;
  onChange: (value: ItemFormValue) => void;
  noteLabel: string;
  notePrompt: string | null;
  /** Only "link"/"recommendation" ever reach this form — "location" items still use PinForm. */
  itemType: Extract<ItemType, "link" | "recommendation">;
  /** Shows the "Your name" field — only relevant for anonymous (not signed-in) contributors. */
  showContributorName?: boolean;
}

function looksLikeUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Add-item field set for "link"/"recommendation" collections — the mobile
 * counterpart to PinForm, mirroring client/src/components/add-item-modal.tsx.
 * A "link" item's URL auto-fetches a title/description/image via POST
 * /api/link-preview (still editable after); a "recommendation" item's URL
 * is optional but triggers the same fetch when present.
 */
export function AddItemForm({
  value,
  onChange,
  noteLabel,
  notePrompt,
  itemType,
  showContributorName,
}: AddItemFormProps) {
  const isLink = itemType === "link";
  const [isFetchingPreview, setIsFetchingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const lastFetchedUrlRef = useRef<string | null>(null);

  const fetchPreview = async (url: string) => {
    if (!looksLikeUrl(url) || lastFetchedUrlRef.current === url) return;
    lastFetchedUrlRef.current = url;
    setIsFetchingPreview(true);
    setPreviewError(null);
    try {
      const response = await apiRequest("POST", "/api/link-preview", { url });
      const preview = (await response.json()) as {
        title: string | null;
        description: string | null;
        imageUrl: string | null;
      };
      onChange({
        ...value,
        title: value.title || preview.title || value.title,
        note: value.note || preview.description || value.note,
        photoUrl: value.photoUrl || preview.imageUrl,
      });
    } catch (err: any) {
      setPreviewError(err?.message ?? "Couldn't fetch a preview for that URL.");
    } finally {
      setIsFetchingPreview(false);
    }
  };

  return (
    <View className="gap-4">
      <View className="gap-1.5">
        <TextField
          label={isLink ? "URL" : "Link (optional)"}
          value={value.url}
          onChangeText={(url) => onChange({ ...value, url })}
          onBlur={() => fetchPreview(value.url.trim())}
          placeholder="https://..."
          autoCapitalize="none"
          keyboardType="url"
          testID="input-item-url"
        />
        {isFetchingPreview && (
          <View className="flex-row items-center gap-1.5">
            <ActivityIndicator size="small" color="#2563EB" />
            <Text className="text-xs text-slate-500">Fetching preview...</Text>
          </View>
        )}
        {previewError && (
          <Text className="text-xs text-red-600">{previewError}</Text>
        )}
      </View>

      <TextField
        label="Title"
        value={value.title}
        onChangeText={(title) => onChange({ ...value, title })}
        placeholder={
          isLink ? "Title of the page" : "What are you recommending?"
        }
        testID="input-item-title"
      />

      {showContributorName && (
        <TextField
          label="Your name"
          value={value.contributorName}
          onChangeText={(contributorName) =>
            onChange({ ...value, contributorName })
          }
          placeholder="So the map owner knows who added this"
          testID="input-item-contributor-name"
        />
      )}

      <TextField
        label={noteLabel}
        value={value.note}
        onChangeText={(note) =>
          onChange({ ...value, note: note.slice(0, 280) })
        }
        placeholder={
          notePrompt ||
          (isLink
            ? "Why is this worth reading?"
            : "Why are you recommending this?")
        }
        multiline
        numberOfLines={3}
        testID="input-item-note"
      />
      {notePrompt && (
        <Text className="-mt-2.5 text-xs text-slate-500">{notePrompt}</Text>
      )}

      <View className="gap-2">
        <Text className="text-sm font-medium text-slate-700">
          Photo (optional)
        </Text>
        {value.photoUrl ? (
          <View className="flex-row items-start gap-2">
            <Image
              source={{ uri: value.photoUrl }}
              className="h-20 w-20 rounded-lg"
              testID="img-item-photo-preview"
            />
            <Pressable
              onPress={() => onChange({ ...value, photoUrl: null })}
              className="h-7 w-7 items-center justify-center rounded-full bg-slate-800"
              testID="button-remove-item-photo"
            >
              <Ionicons name="close" size={14} color="#ffffff" />
            </Pressable>
          </View>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            loading={isUploadingPhoto}
            testID="button-upload-item-photo"
            onPress={async () => {
              const permission =
                await ImagePicker.requestMediaLibraryPermissionsAsync();
              if (!permission.granted) {
                Alert.alert(
                  "Photo access needed",
                  "Allow photo library access in Settings to attach a photo.",
                );
                return;
              }
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ["images"],
                quality: 0.8,
              });
              if (result.canceled) return;
              const asset = result.assets[0];
              setIsUploadingPhoto(true);
              try {
                const response = await apiUpload("/api/uploads/pin-photo", {
                  uri: asset.uri,
                  name: asset.fileName || "photo.jpg",
                  mimeType: asset.mimeType || "image/jpeg",
                });
                const { url } = await response.json();
                onChange({ ...value, photoUrl: url });
              } catch (err: any) {
                Alert.alert(
                  "Couldn't upload photo",
                  err?.message ?? "Please try again.",
                );
              } finally {
                setIsUploadingPhoto(false);
              }
            }}
          >
            {isUploadingPhoto ? "Uploading..." : "Add a photo"}
          </Button>
        )}
      </View>
    </View>
  );
}

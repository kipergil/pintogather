import { useState } from "react";
import { Modal, Pressable, Share, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/components/ui/Button";
import { WEB_APP_URL } from "@/lib/config";

interface ShareSheetProps {
  visible: boolean;
  onClose: () => void;
  mapName: string;
  shareUrl: string;
}

/**
 * Mobile equivalent of client/src/components/share-popover.tsx. The web
 * version generates a canvas image card per platform because most browsers
 * have no OS-level share sheet; native platforms already have one (listing
 * every installed app — Instagram, WhatsApp, Messages, etc.), so RN's
 * built-in Share API is the idiomatic mobile path instead of reimplementing
 * per-platform buttons and image generation.
 */
export function ShareSheet({ visible, onClose, mapName, shareUrl }: ShareSheetProps) {
  const [copied, setCopied] = useState(false);
  const webUrl = `${WEB_APP_URL}/map/${shareUrl}`;
  const caption = `Check out "${mapName}" on PinTogather — ${webUrl}`;

  const copyLink = async () => {
    await Clipboard.setStringAsync(webUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openShareSheet = async () => {
    try {
      await Share.share({ message: caption, title: mapName, url: webUrl });
    } catch {
      // User dismissed the share sheet — not an error.
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <View className="gap-3 rounded-t-3xl bg-white p-6">
          <Text className="text-lg font-bold text-slate-900">Share this map</Text>
          <Text className="text-sm text-slate-500" numberOfLines={2}>
            {webUrl}
          </Text>

          <Pressable
            className="flex-row items-center gap-2.5 rounded-xl border border-slate-300 px-4 py-3"
            onPress={copyLink}
            testID="button-share-copy-link"
          >
            <Ionicons name={copied ? "checkmark" : "copy-outline"} size={18} color={copied ? "#16a34a" : "#334155"} />
            <Text className={`text-sm font-medium ${copied ? "text-green-600" : "text-slate-700"}`}>
              {copied ? "Link copied" : "Copy link"}
            </Text>
          </Pressable>

          <Button onPress={openShareSheet} testID="button-share-open-sheet">
            Share...
          </Button>

          <Button variant="ghost" onPress={onClose}>
            Close
          </Button>
        </View>
      </View>
    </Modal>
  );
}

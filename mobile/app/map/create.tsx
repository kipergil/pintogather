import { useState } from "react";
import { Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { Screen } from "@/components/ui/Screen";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { useCreateMap } from "@/hooks/useMaps";
import { useRequireAuth } from "@/hooks/useRequireAuth";

export default function CreateMapScreen() {
  const { isSignedIn } = useRequireAuth();
  const router = useRouter();
  const createMap = useCreateMap();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!isSignedIn) return null;

  const onSubmit = async () => {
    setError(null);
    try {
      const map = await createMap.mutateAsync({ name: name.trim(), description: description.trim() || undefined });
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
        {error && <Text className="text-sm text-red-600">{error}</Text>}
        <Button onPress={onSubmit} loading={createMap.isPending} disabled={!name.trim()} testID="button-submit-create-map">
          Create map
        </Button>
      </View>
    </Screen>
  );
}

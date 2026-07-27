import { useEffect, useState } from "react";
import { Image, Text, View } from "react-native";
import { Link } from "expo-router";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/ui/Screen";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useUpdateProfile, useUsernameAvailability } from "@/hooks/useProfile";
import { useUsage } from "@/hooks/useBilling";
import { usePages } from "@/hooks/usePages";

const TIER_LABELS: Record<string, string> = { freemium: "Free", basic: "Basic", premium: "Premium" };

const BIO_MAX_LENGTH = 160;

const STATUS_ICON: Record<string, { name: keyof typeof Ionicons.glyphMap; color: string } | null> = {
  idle: null,
  checking: { name: "time-outline", color: "#94a3b8" },
  available: { name: "checkmark-circle", color: "#16a34a" },
  taken: { name: "close-circle", color: "#dc2626" },
  invalid: { name: "close-circle", color: "#dc2626" },
};

export default function ProfileScreen() {
  const { signOut } = useAuth();
  const { user } = useUser();
  const { data: currentUser } = useCurrentUser();
  const updateProfile = useUpdateProfile();
  const { data: usage } = useUsage();
  const { data: pages } = usePages();

  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [twitterHandle, setTwitterHandle] = useState("");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [linkedinHandle, setLinkedinHandle] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) return;
    setUsername(currentUser.username ?? "");
    setBio(currentUser.bio ?? "");
    setTwitterHandle(currentUser.twitterHandle ?? "");
    setInstagramHandle(currentUser.instagramHandle ?? "");
    setLinkedinHandle(currentUser.linkedinHandle ?? "");
  }, [currentUser]);

  const usernameStatus = useUsernameAvailability(username, currentUser?.username);
  const statusIcon = STATUS_ICON[usernameStatus];
  const canSave = usernameStatus !== "taken" && usernameStatus !== "invalid" && usernameStatus !== "checking";

  const displayName = user?.fullName || user?.primaryEmailAddress?.emailAddress || "Account";
  const initials = displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const onSave = async () => {
    setError(null);
    setSaved(false);
    try {
      await updateProfile.mutateAsync({
        fullName: user?.fullName || displayName,
        username: username.trim().toLowerCase() || null,
        bio: bio.trim() || null,
        twitterHandle: twitterHandle.trim() || null,
        instagramHandle: instagramHandle.trim() || null,
        linkedinHandle: linkedinHandle.trim() || null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      setError(err?.message ?? "Couldn't save your profile.");
    }
  };

  return (
    <Screen scroll>
      <View className="items-center gap-3 py-10">
        {user?.imageUrl ? (
          <Image source={{ uri: user.imageUrl }} className="h-20 w-20 rounded-full" />
        ) : (
          <View className="h-20 w-20 items-center justify-center rounded-full bg-primary/10">
            <Text className="text-2xl font-semibold text-primary">{initials}</Text>
          </View>
        )}
        <View className="items-center gap-0.5">
          <Text className="text-xl font-bold text-slate-900">{displayName}</Text>
          {user?.primaryEmailAddress && <Text className="text-sm text-slate-500">{user.primaryEmailAddress.emailAddress}</Text>}
        </View>
      </View>

      <View className="gap-4 pb-6">
        <Text className="text-sm font-semibold text-slate-900">Public profile</Text>

        <View className="gap-1.5">
          <Text className="text-sm font-medium text-slate-700">Username</Text>
          <View className="flex-row items-center gap-2">
            <TextField
              value={username}
              onChangeText={setUsername}
              placeholder="your-username"
              autoCapitalize="none"
              className="flex-1"
              testID="input-username"
            />
            {statusIcon && <Ionicons name={statusIcon.name} size={20} color={statusIcon.color} />}
          </View>
          {usernameStatus === "taken" && <Text className="text-xs text-red-600">That username is already taken.</Text>}
          {usernameStatus === "invalid" && (
            <Text className="text-xs text-red-600">Use 3-30 lowercase letters, numbers, or underscores.</Text>
          )}
          {currentUser?.username && (
            <Link href={`/u/${currentUser.username}`} className="text-xs font-medium text-primary">
              View your public profile
            </Link>
          )}
        </View>

        <View className="gap-1.5">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm font-medium text-slate-700">Bio</Text>
            <Text className="text-xs text-slate-400">
              {bio.length}/{BIO_MAX_LENGTH}
            </Text>
          </View>
          <TextField
            value={bio}
            onChangeText={(v) => setBio(v.slice(0, BIO_MAX_LENGTH))}
            placeholder="A short bio shown on your public profile"
            multiline
            numberOfLines={3}
            testID="input-bio"
          />
        </View>

        <TextField
          label="X (Twitter) handle"
          value={twitterHandle}
          onChangeText={setTwitterHandle}
          placeholder="@yourhandle"
          autoCapitalize="none"
          testID="input-twitter"
        />
        <TextField
          label="Instagram handle"
          value={instagramHandle}
          onChangeText={setInstagramHandle}
          placeholder="@yourhandle"
          autoCapitalize="none"
          testID="input-instagram"
        />
        <TextField
          label="LinkedIn handle"
          value={linkedinHandle}
          onChangeText={setLinkedinHandle}
          placeholder="your-linkedin"
          autoCapitalize="none"
          testID="input-linkedin"
        />

        {error && <Text className="text-sm text-red-600">{error}</Text>}
        <Button onPress={onSave} loading={updateProfile.isPending} disabled={!canSave} testID="button-save-profile">
          {saved ? "Saved" : "Save profile"}
        </Button>
      </View>

      <View className="gap-3 pb-6">
        <Text className="text-sm font-semibold text-slate-900">Plan & billing</Text>
        <View className="gap-2 rounded-xl border border-slate-200 p-3.5">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm text-slate-700">Current plan</Text>
            <Text className="text-sm font-semibold text-slate-900">{TIER_LABELS[usage?.userGroup ?? "freemium"]}</Text>
          </View>
          {usage && (
            <>
              <Text className="text-xs text-slate-500">
                {usage.maps.used} of {Number.isFinite(usage.maps.limit) ? usage.maps.limit : "unlimited"} maps used
              </Text>
              <Text className="text-xs text-slate-500">
                {usage.aiSuggestions.used} of {Number.isFinite(usage.aiSuggestions.limit) ? usage.aiSuggestions.limit : "unlimited"} AI
                suggestions used today
              </Text>
            </>
          )}
        </View>
        <Link href="/pricing" asChild>
          <Button variant="outline" testID="button-view-plans">
            View plans
          </Button>
        </Link>
      </View>

      {pages && pages.length > 0 && (
        <View className="gap-3 pb-6">
          <Text className="text-sm font-semibold text-slate-900">About</Text>
          <View className="gap-2 rounded-xl border border-slate-200 p-1">
            {pages.map((page) => (
              <Link key={page.slug} href={`/pages/${page.slug}`} asChild>
                <Button variant="ghost" className="justify-start" testID={`button-page-${page.slug}`}>
                  {page.title}
                </Button>
              </Link>
            ))}
          </View>
        </View>
      )}

      <View className="gap-3">
        <Button variant="outline" onPress={() => signOut()} testID="button-sign-out">
          Sign out
        </Button>
      </View>
    </Screen>
  );
}

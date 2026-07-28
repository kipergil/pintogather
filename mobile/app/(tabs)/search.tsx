import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, Text, View } from "react-native";
import { Link } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/ui/Screen";
import { TextField } from "@/components/ui/TextField";
import { apiRequest } from "@/lib/api";

interface SearchMapResult {
  id: string;
  name: string;
  description: string | null;
  shareUrl: string;
  isPublic: boolean;
  ownerName: string | null;
}

interface SearchPinResult {
  id: string;
  title: string;
  note: string | null;
  address: string | null;
  city: string | null;
  mapShareUrl: string;
  mapName: string;
}

interface SearchUserResult {
  id: string;
  username: string;
  fullName: string | null;
  bio: string | null;
  profileImageUrl: string | null;
}

interface SearchResponse {
  maps: SearchMapResult[];
  pins: SearchPinResult[];
  users: SearchUserResult[];
}

type Row =
  | { type: "header"; key: string; label: string; icon: keyof typeof Ionicons.glyphMap }
  | { type: "user"; key: string; data: SearchUserResult }
  | { type: "map"; key: string; data: SearchMapResult }
  | { type: "pin"; key: string; data: SearchPinResult };

export default function SearchScreen() {
  const [query, setQuery] = useState("");
  const [data, setData] = useState<SearchResponse | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setData(null);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    const timeout = setTimeout(async () => {
      try {
        const res = await apiRequest("GET", `/api/search?q=${encodeURIComponent(trimmed)}`);
        setData(await res.json());
      } catch {
        setData({ maps: [], pins: [], users: [] });
      } finally {
        setIsSearching(false);
      }
    }, 400);
    return () => clearTimeout(timeout);
  }, [query]);

  const rows: Row[] = [];
  if (data) {
    if (data.users.length > 0) {
      rows.push({ type: "header", key: "h-users", label: "People", icon: "people" });
      for (const u of data.users) rows.push({ type: "user", key: `u-${u.id}`, data: u });
    }
    if (data.maps.length > 0) {
      rows.push({ type: "header", key: "h-maps", label: "Maps", icon: "map" });
      for (const m of data.maps) rows.push({ type: "map", key: `m-${m.id}`, data: m });
    }
    if (data.pins.length > 0) {
      rows.push({ type: "header", key: "h-pins", label: "Pins", icon: "location" });
      for (const p of data.pins) rows.push({ type: "pin", key: `p-${p.id}`, data: p });
    }
  }

  return (
    <Screen>
      <View className="gap-1 pb-3 pt-2">
        <Text className="text-xs font-semibold uppercase tracking-wide text-primary">Search</Text>
        <Text className="text-xl font-bold text-slate-900">Find maps, pins, and people</Text>
      </View>

      <TextField
        value={query}
        onChangeText={setQuery}
        placeholder="Search maps, pins, or people..."
        autoCapitalize="none"
        autoCorrect={false}
        testID="input-search-query"
      />

      {query.trim().length < 2 && (
        <Text className="pt-6 text-center text-sm text-slate-400">Type at least 2 characters to search.</Text>
      )}
      {isSearching && !data && <ActivityIndicator size="small" color="#2563EB" style={{ marginTop: 24 }} />}
      {data && rows.length === 0 && !isSearching && (
        <Text className="pt-6 text-center text-sm text-slate-400" testID="text-no-results">
          No results for "{query.trim()}".
        </Text>
      )}

      <FlatList
        className="pt-3"
        data={rows}
        keyExtractor={(row) => row.key}
        contentContainerStyle={{ gap: 8, paddingBottom: 24 }}
        renderItem={({ item }) => {
          if (item.type === "header") {
            return (
              <View className="mb-1 mt-3 flex-row items-center gap-1.5">
                <Ionicons name={item.icon} size={14} color="#64748b" />
                <Text className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</Text>
              </View>
            );
          }
          if (item.type === "user") {
            const u = item.data;
            const initials = (u.fullName || u.username).split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
            return (
              <Link href={`/u/${u.username}`} asChild>
                <Pressable className="flex-row items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5" testID={`link-search-user-${u.id}`}>
                  {u.profileImageUrl ? (
                    <Image source={{ uri: u.profileImageUrl }} className="h-10 w-10 rounded-full" />
                  ) : (
                    <View className="h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <Text className="text-sm font-semibold text-primary">{initials}</Text>
                    </View>
                  )}
                  <View className="min-w-0 flex-1">
                    <Text className="font-medium text-slate-900" numberOfLines={1}>{u.fullName || `@${u.username}`}</Text>
                    <Text className="text-xs text-slate-500" numberOfLines={1}>
                      @{u.username}
                      {u.bio ? ` · ${u.bio}` : ""}
                    </Text>
                  </View>
                </Pressable>
              </Link>
            );
          }
          if (item.type === "map") {
            const map = item.data;
            return (
              <Link href={`/map/${map.shareUrl}`} asChild>
                <Pressable className="rounded-xl border border-slate-200 bg-white p-3.5" testID={`link-search-map-${map.id}`}>
                  <View className="flex-row items-center gap-2">
                    <Text className="flex-1 font-medium text-slate-900" numberOfLines={1}>{map.name}</Text>
                    {!map.isPublic && <Ionicons name="lock-closed" size={14} color="#94a3b8" />}
                  </View>
                  {map.description && (
                    <Text className="mt-0.5 text-sm text-slate-500" numberOfLines={1}>{map.description}</Text>
                  )}
                  {map.ownerName && <Text className="mt-1 text-xs text-slate-400">by {map.ownerName}</Text>}
                </Pressable>
              </Link>
            );
          }
          const pin = item.data;
          return (
            <Link href={{ pathname: "/map/[shareUrl]", params: { shareUrl: pin.mapShareUrl, pin: pin.id } }} asChild>
              <Pressable className="rounded-xl border border-slate-200 bg-white p-3.5" testID={`link-search-pin-${pin.id}`}>
                <Text className="font-medium text-slate-900" numberOfLines={1}>{pin.title}</Text>
                {(pin.note || pin.address || pin.city) && (
                  <Text className="mt-0.5 text-sm text-slate-500" numberOfLines={1}>
                    {pin.note || [pin.address, pin.city].filter(Boolean).join(", ")}
                  </Text>
                )}
                <Text className="mt-1 text-xs text-slate-400">in {pin.mapName}</Text>
              </Pressable>
            </Link>
          );
        }}
      />
    </Screen>
  );
}

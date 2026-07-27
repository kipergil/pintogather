import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import Markdown from "react-native-markdown-display";
import { EmptyState } from "@/components/ui/EmptyState";
import { usePage } from "@/hooks/usePages";

/**
 * Renders any published CMS page by slug — mirrors
 * client/src/pages/cms-page.tsx. A new page in Directus's
 * pintogather_pages collection is reachable here at /pages/:slug with no
 * app changes; it only needs a link added somewhere (see the About list in
 * the Profile tab) to be discoverable.
 */
export default function CmsPageScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { data: page, isLoading, error } = usePage(slug);

  return (
    <ScrollView className="flex-1 bg-white" contentContainerClassName="px-5 py-4">
      <Stack.Screen options={{ title: page?.title ?? "" }} />
      {isLoading ? (
        <ActivityIndicator size="large" color="#2563EB" className="mt-10" />
      ) : error || !page ? (
        <EmptyState icon="document-text-outline" title="Page not found" description="This page doesn't exist, or isn't published yet." />
      ) : (
        <View className="gap-2 pb-8">
          <Text className="text-2xl font-bold text-slate-900">{page.title}</Text>
          {page.content && <Markdown>{page.content}</Markdown>}
        </View>
      )}
    </ScrollView>
  );
}

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { APP_NAME } from "@/lib/branding";

interface CmsPageData {
  slug: string;
  title: string;
  metaDescription: string | null;
  content: string | null;
}

interface CmsPageProps {
  /** Set directly by the friendly named routes (e.g. /how-it-works); falls back to the :slug route param for the generic /pages/:slug route. */
  slug?: string;
  params?: { slug?: string };
}

/** Sets (and restores) the page's meta description tag — falls back to a no-op if the tag doesn't exist. */
function setMetaDescription(content: string | null) {
  const tag = document.querySelector('meta[name="description"]');
  const previous = tag?.getAttribute("content") ?? null;
  if (tag && content) tag.setAttribute("content", content);
  return () => {
    if (tag && previous !== null) tag.setAttribute("content", previous);
  };
}

/**
 * Renders any published CMS page by slug — how-it-works, features, etc. are
 * just rows in Directus's pintogather_pages collection (see
 * directus/src/content/seed-pages.ts), so a new page only ever needs a new
 * Directus row plus, for a friendly URL, one route line in App.tsx. No new
 * component or deploy required to edit copy or add a page at /pages/:slug.
 */
export default function CmsPage({ slug: slugProp, params }: CmsPageProps) {
  const slug = slugProp ?? params?.slug ?? "";

  const { data: page, isLoading, error } = useQuery<CmsPageData>({
    queryKey: [`/api/pages/${slug}`],
    enabled: !!slug,
  });

  useEffect(() => {
    if (!page) return;
    document.title = `${page.title} — ${APP_NAME}`;
    const restore = setMetaDescription(page.metaDescription);
    return restore;
  }, [page]);

  if (isLoading) {
    return (
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/2" />
          <div className="h-4 bg-muted rounded w-full" />
          <div className="h-4 bg-muted rounded w-5/6" />
          <div className="h-4 bg-muted rounded w-2/3" />
        </div>
      </main>
    );
  }

  if (error || !page) {
    return (
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Card className="border-border">
          <CardContent className="pt-8 pb-8 text-center">
            <AlertCircle className="h-8 w-8 text-destructive mx-auto mb-3" />
            <h1 className="text-xl font-semibold text-foreground mb-2">Page not found</h1>
            <p className="text-muted-foreground">This page doesn't exist, or isn't published yet.</p>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-fade-in">
      <article className="prose prose-slate max-w-none prose-headings:font-bold prose-headings:tracking-tight prose-a:text-primary">
        <h1>{page.title}</h1>
        {page.content && <ReactMarkdown>{page.content}</ReactMarkdown>}
      </article>
    </main>
  );
}

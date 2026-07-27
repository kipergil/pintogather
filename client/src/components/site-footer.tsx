import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { APP_NAME } from "@/lib/branding";

interface CmsPageSummary {
  slug: string;
  title: string;
}

/**
 * Nav links here come straight from the pintogather_pages CMS collection
 * (nav_order set, published) — adding a new page in Directus with a
 * nav_order is enough to add it here too, no code change required.
 */
export function SiteFooter() {
  const { data: pages } = useQuery<CmsPageSummary[]>({ queryKey: ["/api/pages"] });

  return (
    <footer className="border-t border-border/80 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} {APP_NAME}
        </p>
        {pages && pages.length > 0 && (
          <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {pages.map((page) => (
              <Link
                key={page.slug}
                href={`/pages/${page.slug}`}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                data-testid={`link-footer-page-${page.slug}`}
              >
                {page.title}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </footer>
  );
}

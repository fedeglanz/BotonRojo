import Link from "next/link";

import { pagePath, resolvePages } from "@/lib/launch-pages";
import type { Launch, LaunchType } from "@/db/schema/launches";
import type { PageConfig } from "@/lib/launch-pages";

/**
 * Shared footer for every public page. Its job is the legal links: a page that
 * collects an email or takes a payment has to reach its privacy policy and
 * terms from anywhere, and before this each page's footer was just a year.
 *
 * The links come from `resolvePages`, the same source the admin and the public
 * routes use, so a launch can never advertise a legal page it doesn't have.
 */
export function PublicFooter({
  launch,
  /** Extra bottom padding when the sticky action bar covers the footer. */
  stickyBar = false,
}: {
  launch: Launch;
  stickyBar?: boolean;
}) {
  const legalPages = resolvePages(
    launch.type as LaunchType,
    launch.pageConfig as PageConfig | null,
  ).filter((p) => p.kind === "legal");

  return (
    <footer
      className={`border-t border-[--color-border] py-10 ${stickyBar ? "pb-28" : ""}`}
    >
      {legalPages.length > 0 && (
        <nav
          aria-label="Información legal"
          className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-6 gap-y-2 px-6"
        >
          {legalPages.map((page) => (
            <Link
              key={page.pageKey}
              href={pagePath(launch.slug, page)}
              className="text-xs text-[--color-muted-2] underline-offset-4 transition hover:text-[--color-accent] hover:underline"
            >
              {page.label}
            </Link>
          ))}
        </nav>
      )}
    </footer>
  );
}

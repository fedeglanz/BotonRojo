import Link from "next/link";
import { cn } from "@/lib/utils";

export type LaunchTab = {
  id: string;
  label: string;
  /** Steps in this group that are finished, over the total. */
  done: number;
  total: number;
  /** True when nothing in the group can be worked on yet. */
  blocked?: boolean;
};

/**
 * Groups the launch's eight steps into a handful of sections. Before this the
 * hub was one long scroll of eight panels — everything visible at once meant
 * nothing had an order.
 *
 * Navigation goes through the URL (`?seccion=`) rather than client state, so a
 * section is linkable, the back button works, and each server action's
 * revalidate returns you to the section you were in. Only the active group is
 * rendered, which also cuts the queries and AI panels the page mounts.
 */
export function LaunchTabs({
  tabs,
  active,
  basePath,
}: {
  tabs: LaunchTab[];
  active: string;
  basePath: string;
}) {
  return (
    <nav
      aria-label="Secciones del lanzamiento"
      /* Scrolls sideways on a phone instead of wrapping into three ragged rows. */
      className="-mx-1 flex gap-1 overflow-x-auto pb-1"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        const complete = tab.total > 0 && tab.done === tab.total;

        return (
          <Link
            key={tab.id}
            href={`${basePath}?seccion=${tab.id}`}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-lg border px-4 py-2.5 text-sm transition",
              isActive
                ? "border-[var(--color-red)]/50 bg-[var(--color-red)]/10 text-white"
                : "border-white/10 bg-white/[0.02] text-zinc-400 hover:border-white/20 hover:text-zinc-200",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "h-1.5 w-1.5 shrink-0 rounded-full",
                complete
                  ? "bg-emerald-400"
                  : tab.blocked
                    ? "bg-zinc-600"
                    : tab.done > 0
                      ? "bg-amber-400"
                      : "bg-zinc-600",
              )}
            />
            <span className="font-medium">{tab.label}</span>
            <span className="font-[family-name:var(--font-mono)] text-[10px] text-zinc-500">
              {tab.done}/{tab.total}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

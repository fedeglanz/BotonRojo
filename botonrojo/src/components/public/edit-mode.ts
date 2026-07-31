import "server-only";

import { auth } from "@/lib/auth";
import type { Launch } from "@/db/schema/launches";

/**
 * Whether the visitor may edit this launch's pages in place.
 *
 * Decided on the SERVER from the session, never from the URL. `?editar=1` only
 * expresses intent; the answer comes from who you are and whether this launch
 * belongs to your organization. A visitor who guesses the parameter gets the
 * ordinary page, because the flag they can influence isn't the one that decides.
 *
 * Scoped to the launch's own organization on purpose: an admin of one client must
 * not be able to edit another client's pages by opening them with the parameter.
 */
export async function canEditLaunch(launch: Launch, searchParams?: { editar?: string }): Promise<boolean> {
  if (searchParams?.editar !== "1") return false;

  const session = await auth();
  const user = session?.user;
  if (!user) return false;
  if (user.role !== "admin" && user.role !== "superadmin") return false;

  // A superadmin works across organizations; an org admin only inside their own.
  if (user.isSuperAdmin || user.role === "superadmin") return true;
  return user.organizationId === launch.organizationId;
}

/**
 * What an editable part points at. `section` is a landing section key,
 * `block` is an index into a simple page's `blocks`, and `hero` is the band a
 * capture/content page opens with.
 */
export type EditTarget =
  | { kind: "section"; key: string }
  | { kind: "block"; index: number }
  | { kind: "hero" };

export type EditContext = {
  enabled: boolean;
  launchId: string;
  launchSlug: string;
  pageKey: string;
};

/** Off, for every render that isn't an admin asking to edit. */
export const EDIT_DISABLED: EditContext = {
  enabled: false,
  launchId: "",
  launchSlug: "",
  pageKey: "",
};

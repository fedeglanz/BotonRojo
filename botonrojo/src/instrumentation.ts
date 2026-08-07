/**
 * Runs once when the server starts.
 *
 * Its only job today is to close generation runs that the previous process was in
 * the middle of. A run lives in memory: it writes a progress record, generates each
 * page, and stamps `finishedAt` at the end. If the process dies before that — a
 * deploy, a crash, an OOM — the record stays open forever and the panel keeps
 * reporting "Generando páginas… 2 de 5" for a run that stopped days ago.
 *
 * The process that owned those runs is, by definition, gone: nothing that is
 * unfinished at startup can still be running. So they can be closed with certainty
 * rather than with a timeout, and closed as INTERRUPTED rather than as failed, which
 * is the honest word for it and tells the admin the fix is to generate again.
 */
export async function register() {
  // Only in the Node runtime: the edge one has no database.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { closeOrphanGenerations } = await import("@/server/generation-sweep");
  await closeOrphanGenerations().catch((err) => {
    // Never let this stop the server from starting: a stale progress record is a
    // cosmetic problem, an app that won't boot is not.
    console.error(
      "[startup] no se pudieron cerrar las generaciones huérfanas",
      err,
    );
  });
}

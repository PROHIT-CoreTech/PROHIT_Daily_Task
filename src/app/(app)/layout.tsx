import { redirect } from "next/navigation";
import { getActiveHydration } from "@/lib/queries/activeWorkspace";
import { toClientHydration } from "@/lib/queries/hydrate";
import { AppShell } from "@/components/app/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const hydration = await getActiveHydration();
  if (!hydration) redirect("/login");

  if (!hydration.activeWorkspaceId) {
    // Only reachable for accounts created before signup auto-provisioning
    // (src/lib/auth.ts `createUser` event) shipped. Workspace creation UI
    // is a later slice, so this is a message, not a dead-end redirect.
    return (
      <main className="flex min-h-screen items-center justify-center px-4 text-center text-sm text-muted-foreground">
        Your account has no workspace yet. Contact support to have one created.
      </main>
    );
  }

  return <AppShell hydration={toClientHydration(hydration)}>{children}</AppShell>;
}

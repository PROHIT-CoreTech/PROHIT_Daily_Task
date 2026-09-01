"use client";

import { SessionProvider } from "next-auth/react";
import { WorkspaceProvider, useWorkspace } from "@/context/WorkspaceContext";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";

function AppShellInner({ children }: { children: React.ReactNode }) {
  const { isLoading, me } = useWorkspace();

  if (isLoading || !me) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 pb-14 md:pb-0">{children}</div>
      <MobileNav />
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <WorkspaceProvider>
        <AppShellInner>{children}</AppShellInner>
      </WorkspaceProvider>
    </SessionProvider>
  );
}

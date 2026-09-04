"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Nav } from "@/components/app/nav";
import { WorkspaceSwitcher } from "@/components/app/workspace-switcher";
import type { ClientHydration } from "@/lib/queries/hydrate";

function initials(name: string) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function AppShell({
  hydration,
  children,
}: {
  hydration: ClientHydration;
  children: React.ReactNode;
}) {
  const { user, workspaces, activeWorkspaceId } = hydration;

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 shrink-0 flex-col gap-6 border-r border-border bg-card p-4">
        <div className="px-1 text-sm font-semibold text-primary">PROHIT Daily Task</div>
        <WorkspaceSwitcher workspaces={workspaces} activeWorkspaceId={activeWorkspaceId ?? ""} />
        <Nav />
        <div className="mt-auto">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex w-full items-center gap-2 rounded-md p-2 text-left hover:bg-muted">
              <Avatar>
                <AvatarFallback>{initials(user?.name ?? "?")}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{user?.name}</p>
                <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onSelect={() => signOut({ callbackUrl: "/login" })}>
                <LogOut className="size-3.5" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  );
}

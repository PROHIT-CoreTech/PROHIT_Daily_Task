"use client";

import { useSession, signOut } from "next-auth/react";
import { useState } from "react";
import { Search, LogOut } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Input } from "@/components/ui/Input";

export function TopNav({ title }: { title: string }) {
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="flex items-center justify-between gap-4 border-b border-border bg-surface px-6 py-3">
      <h1 className="text-lg font-semibold text-primary">{title}</h1>

      <div className="flex flex-1 items-center justify-end gap-4">
        <div className="relative hidden sm:block w-64">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <Input placeholder="Search" className="pl-9" />
        </div>

        {session?.user && (
          <div className="relative">
            <button onClick={() => setMenuOpen((o) => !o)} className="flex items-center gap-2">
              <Avatar name={session.user.name ?? "User"} src={session.user.image ?? undefined} size={32} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-lg border border-border bg-surface p-1 shadow-xl z-20">
                <div className="px-3 py-2 text-sm">
                  <p className="font-medium text-foreground truncate">{session.user.name}</p>
                  <p className="text-muted truncate text-xs">{session.user.email}</p>
                </div>
                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-danger hover:bg-danger/10"
                >
                  <LogOut size={14} />
                  Sign out
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

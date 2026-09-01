"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Plus, User, Users, Building2 } from "lucide-react";
import { useWorkspace } from "@/context/WorkspaceContext";
import type { WorkspaceType } from "@/types/api";

const TYPE_ICON: Record<WorkspaceType, typeof User> = {
  personal: User,
  team: Users,
  business: Building2,
};

export function WorkspaceSwitcher() {
  const { me, activeWorkspace, setActiveWorkspaceId } = useWorkspace();
  const [open, setOpen] = useState(false);

  if (!me || !activeWorkspace) return null;

  const Icon = TYPE_ICON[activeWorkspace.type];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-white/90 hover:bg-white/5"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10">
          <Icon size={14} />
        </div>
        <span className="flex-1 truncate text-left">{activeWorkspace.name}</span>
        <ChevronDown size={14} />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-64 rounded-lg border border-border bg-surface p-1 shadow-xl text-foreground z-20">
          {me.workspaces.map((ws) => {
            const WsIcon = TYPE_ICON[ws.type];
            return (
              <button
                key={ws.id}
                onClick={() => {
                  setActiveWorkspaceId(ws.id);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-black/5 ${
                  ws.id === activeWorkspace.id ? "bg-accent/10 text-accent" : ""
                }`}
              >
                <WsIcon size={14} />
                <span className="flex-1 truncate text-left">{ws.name}</span>
                <span className="text-xs text-muted capitalize">{ws.type}</span>
              </button>
            );
          })}
          <Link
            href="/workspace/new"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-accent hover:bg-accent/10"
          >
            <Plus size={14} />
            New workspace
          </Link>
        </div>
      )}
    </div>
  );
}

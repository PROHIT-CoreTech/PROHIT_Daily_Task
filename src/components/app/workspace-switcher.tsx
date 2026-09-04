"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronsUpDown, Check, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setActiveWorkspace } from "@/app/(app)/actions";
import type { ClientWorkspace } from "@/lib/queries/hydrate";
import type { WorkspaceType } from "@/lib/types";

export function WorkspaceSwitcher({
  workspaces,
  activeWorkspaceId,
}: {
  workspaces: ClientWorkspace[];
  activeWorkspaceId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const active = workspaces.find((w) => w._id === activeWorkspaceId);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={pending}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-60"
          >
            <span className="truncate">{active?.name ?? "Workspace"}</span>
            <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {workspaces.map((w) => {
              const isActive = w._id === activeWorkspaceId;
              return (
                <DropdownMenuItem
                  key={w._id}
                  onSelect={() => !isActive && startTransition(() => setActiveWorkspace(w._id))}
                >
                  <span className="flex-1">{w.name}</span>
                  {isActive && <Check className="size-3.5 text-accent" />}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
        <button
          onClick={() => setCreating((c) => !c)}
          aria-label="New workspace"
          className="flex size-8 shrink-0 items-center justify-center rounded-md hover:bg-muted"
        >
          <Plus className="size-4" />
        </button>
      </div>
      {creating && <CreateWorkspaceForm onDone={() => setCreating(false)} />}
    </div>
  );
}

function CreateWorkspaceForm({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [type, setType] = useState<WorkspaceType>("team");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);

    const res = await fetch("/api/v1/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), type }),
    });
    const body = await res.json();
    setSaving(false);

    if (!res.ok) {
      setError("Couldn't create the workspace.");
      return;
    }

    await setActiveWorkspace(body.workspace._id);
    onDone();
    router.refresh();
  }

  return (
    <form onSubmit={create} className="flex flex-col gap-2 rounded-md border border-border p-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Workspace name"
        className="h-8 rounded-md border border-border bg-transparent px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <select
        value={type}
        onChange={(e) => setType(e.target.value as WorkspaceType)}
        className="h-8 rounded-md border border-border bg-transparent px-2 text-sm"
      >
        <option value="team">Team</option>
        <option value="business">Business</option>
        <option value="personal">Personal</option>
      </select>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="h-8 flex-1 rounded-md bg-primary text-xs font-medium text-primary-foreground disabled:opacity-50"
        >
          {saving ? "Creating…" : "Create"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="h-8 rounded-md border border-border px-3 text-xs font-medium hover:bg-muted"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </form>
  );
}

"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ListSummary } from "@/lib/queries/lists";

export function ListSidebar({
  lists,
  workspaceId,
}: {
  lists: ListSummary[];
  workspaceId: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function createList(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);

    const res = await fetch(`/api/v1/workspaces/${workspaceId}/lists`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    const body = await res.json();

    if (!res.ok) {
      setError(
        body.error === "limit_exceeded"
          ? "List limit reached on your current plan."
          : "Couldn't create the list."
      );
      return;
    }

    setName("");
    startTransition(() => {
      router.refresh();
      router.push(`/lists/${body.list._id}`);
    });
  }

  async function deleteList(id: string) {
    if (!confirm("Delete this list? Its tasks stay archived, not lost.")) return;

    const res = await fetch(`/api/v1/lists/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Couldn't delete the list.");
      return;
    }

    const wasActive = pathname === `/lists/${id}`;
    startTransition(() => {
      router.refresh();
      if (wasActive) router.push("/lists");
    });
  }

  return (
    <aside className="flex w-56 shrink-0 flex-col gap-3">
      <h2 className="px-1 text-sm font-semibold">Lists</h2>
      <nav className="flex flex-col gap-0.5">
        {lists.map((list) => {
          const href = `/lists/${list._id}`;
          const active = pathname === href;
          return (
            <div
              key={list._id}
              className={cn(
                "group flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-muted",
                active && "bg-primary text-primary-foreground hover:bg-primary"
              )}
            >
              <Link href={href} className="flex min-w-0 flex-1 items-center gap-2">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: list.color }}
                />
                <span className="truncate">{list.name}</span>
              </Link>
              {list.readOnly && <span className="text-xs opacity-70">Locked</span>}
              <button
                onClick={() => deleteList(list._id)}
                aria-label={`Delete ${list.name}`}
                className={cn(
                  "shrink-0 rounded p-0.5 opacity-0 hover:bg-black/10 group-hover:opacity-100",
                  active ? "hover:bg-white/20" : "hover:text-destructive"
                )}
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          );
        })}
      </nav>
      <form onSubmit={createList} className="flex items-center gap-1">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New list"
          className="h-8 min-w-0 flex-1 rounded-md border border-border bg-transparent px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button
          type="submit"
          disabled={pending || !name.trim()}
          className="flex size-8 shrink-0 items-center justify-center rounded-md hover:bg-muted disabled:opacity-50"
        >
          <Plus className="size-4" />
        </button>
      </form>
      {error && <p className="px-1 text-xs text-destructive">{error}</p>}
    </aside>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Input";
import type { ListItem } from "@/types/api";

export function QuickAddTask({
  lists,
  defaultListId,
  onAdd,
}: {
  lists: ListItem[];
  defaultListId?: string;
  onAdd: (title: string, listId: string) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [listId, setListId] = useState(defaultListId ?? lists[0]?.id ?? "");
  const [submitting, setSubmitting] = useState(false);

  // `lists` loads asynchronously (SWR) and is empty on first render, so the
  // useState initializer above can't pick a default — sync it once the
  // list actually arrives, but don't clobber a user's manual selection.
  useEffect(() => {
    if (!listId && lists.length > 0) {
      setListId(defaultListId ?? lists[0].id);
    }
  }, [lists, listId, defaultListId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !listId) return;
    setSubmitting(true);
    try {
      await onAdd(title.trim(), listId);
      setTitle("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex items-center gap-2 border-b border-border px-4 py-3">
      <Plus size={16} className="text-accent shrink-0" />
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Add a task…"
        className="border-none px-0 focus:ring-0"
        disabled={submitting}
      />
      {lists.length > 1 && (
        <Select value={listId} onChange={(e) => setListId(e.target.value)} className="w-36 shrink-0 text-xs" disabled={submitting}>
          {lists.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </Select>
      )}
    </form>
  );
}

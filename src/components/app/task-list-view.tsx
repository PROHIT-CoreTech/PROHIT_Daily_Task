"use client";

import { useState } from "react";
import { Trash2, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ListDetail } from "@/lib/queries/lists";
import type { TaskSummary } from "@/lib/queries/tasks";
import type { TeamMember } from "@/lib/queries/team";

const PRIORITIES = [
  { value: 0, label: "None" },
  { value: 1, label: "Low" },
  { value: 2, label: "Medium" },
  { value: 3, label: "High" },
] as const;

function toDatetimeLocal(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function api(url: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "request_failed");
  return res.json();
}

export function TaskListView({
  list,
  initialTasks,
  members,
}: {
  list: ListDetail;
  initialTasks: TaskSummary[];
  members: TeamMember[];
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  function patchTask(id: string, patch: Partial<TaskSummary>) {
    setTasks((prev) => prev.map((t) => (t._id === id ? { ...t, ...patch } : t)));
  }

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setError(null);
    try {
      const { task } = await api(`/api/v1/workspaces/${list.workspaceId}/tasks`, {
        method: "POST",
        body: JSON.stringify({ listId: list._id, title: newTitle.trim() }),
      });
      setTasks((prev) => [
        { ...task, _id: task._id, subtasks: [], reminders: [], tags: task.tags ?? [] },
        ...prev,
      ]);
      setNewTitle("");
    } catch {
      setError("List limit reached on your current plan, or the request failed.");
    }
  }

  async function completeTask(id: string) {
    patchTask(id, { completedAt: new Date().toISOString() });
    try {
      await api(`/api/v1/tasks/${id}/complete`, { method: "POST" });
    } catch {
      patchTask(id, { completedAt: undefined });
    }
  }

  async function deleteTask(id: string) {
    const prev = tasks;
    setTasks((cur) => cur.filter((t) => t._id !== id));
    try {
      await api(`/api/v1/tasks/${id}`, { method: "DELETE" });
    } catch {
      setTasks(prev);
    }
  }

  async function saveTask(id: string, patch: Record<string, unknown>) {
    const { task } = await api(`/api/v1/tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    patchTask(id, task);
  }

  async function addSubtask(taskId: string, title: string) {
    const { subtask } = await api(`/api/v1/tasks/${taskId}/subtasks`, {
      method: "POST",
      body: JSON.stringify({ title }),
    });
    setTasks((prev) =>
      prev.map((t) => (t._id === taskId ? { ...t, subtasks: [...t.subtasks, subtask] } : t))
    );
  }

  async function toggleSubtask(taskId: string, subtaskId: string, done: boolean) {
    setTasks((prev) =>
      prev.map((t) =>
        t._id === taskId
          ? { ...t, subtasks: t.subtasks.map((s) => (s._id === subtaskId ? { ...s, done } : s)) }
          : t
      )
    );
    await api(`/api/v1/tasks/${taskId}/subtasks/${subtaskId}`, {
      method: "PATCH",
      body: JSON.stringify({ done }),
    });
  }

  async function deleteSubtask(taskId: string, subtaskId: string) {
    setTasks((prev) =>
      prev.map((t) =>
        t._id === taskId
          ? { ...t, subtasks: t.subtasks.filter((s) => s._id !== subtaskId) }
          : t
      )
    );
    await api(`/api/v1/tasks/${taskId}/subtasks/${subtaskId}`, { method: "DELETE" });
  }

  async function addReminder(taskId: string, remindAt: string): Promise<string | null> {
    try {
      const { reminder } = await api(`/api/v1/tasks/${taskId}/reminders`, {
        method: "POST",
        body: JSON.stringify({ remindAt }),
      });
      setTasks((prev) =>
        prev.map((t) => (t._id === taskId ? { ...t, reminders: [...t.reminders, reminder] } : t))
      );
      return null;
    } catch (err) {
      return err instanceof Error && err.message === "limit_exceeded"
        ? "Reminder limit reached on your current plan."
        : "Couldn't add the reminder.";
    }
  }

  async function deleteReminder(taskId: string, reminderId: string) {
    setTasks((prev) =>
      prev.map((t) =>
        t._id === taskId
          ? { ...t, reminders: t.reminders.filter((r) => r._id !== reminderId) }
          : t
      )
    );
    await api(`/api/v1/tasks/${taskId}/reminders/${reminderId}`, { method: "DELETE" });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="size-2.5 rounded-full" style={{ backgroundColor: list.color }} />
        <h1 className="text-xl font-semibold">{list.name}</h1>
      </div>

      {list.readOnly && (
        <p className="rounded-md bg-module/20 px-3 py-2 text-sm text-module-foreground">
          This list is read-only on your current plan — existing tasks stay editable, but new
          tasks can&apos;t be added.
        </p>
      )}

      {!list.readOnly && (
        <form onSubmit={addTask} className="flex items-center gap-2">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Add a task…"
            className="h-9 flex-1 rounded-md border border-border bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button
            type="submit"
            disabled={!newTitle.trim()}
            className="flex h-9 items-center gap-1 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            <Plus className="size-4" />
            Add
          </button>
        </form>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}

      <ul className="flex flex-col gap-2">
        {tasks.length === 0 && (
          <li className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No tasks yet.
          </li>
        )}
        {tasks.map((task) => (
          <TaskItem
            key={task._id}
            task={task}
            members={members}
            expanded={expandedId === task._id}
            onToggleExpand={() => setExpandedId((cur) => (cur === task._id ? null : task._id))}
            onComplete={() => completeTask(task._id)}
            onDelete={() => deleteTask(task._id)}
            onSave={(patch) => saveTask(task._id, patch)}
            onAddSubtask={(title) => addSubtask(task._id, title)}
            onToggleSubtask={(sid, done) => toggleSubtask(task._id, sid, done)}
            onDeleteSubtask={(sid) => deleteSubtask(task._id, sid)}
            onAddReminder={(remindAt) => addReminder(task._id, remindAt)}
            onDeleteReminder={(rid) => deleteReminder(task._id, rid)}
          />
        ))}
      </ul>
    </div>
  );
}

function TaskItem({
  task,
  members,
  expanded,
  onToggleExpand,
  onComplete,
  onDelete,
  onSave,
  onAddSubtask,
  onToggleSubtask,
  onDeleteSubtask,
  onAddReminder,
  onDeleteReminder,
}: {
  task: TaskSummary;
  members: TeamMember[];
  expanded: boolean;
  onToggleExpand: () => void;
  onComplete: () => void;
  onDelete: () => void;
  onSave: (patch: Record<string, unknown>) => Promise<void>;
  onAddSubtask: (title: string) => Promise<void>;
  onToggleSubtask: (subtaskId: string, done: boolean) => Promise<void>;
  onDeleteSubtask: (subtaskId: string) => Promise<void>;
  onAddReminder: (remindAt: string) => Promise<string | null>;
  onDeleteReminder: (reminderId: string) => Promise<void>;
}) {
  const done = Boolean(task.completedAt);
  const [draft, setDraft] = useState({
    description: task.description ?? "",
    priority: task.priority,
    dueDate: toDatetimeLocal(task.dueDate),
    tags: task.tags.join(", "),
    assigneeId: task.assigneeId ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [reminderAt, setReminderAt] = useState("");
  const [reminderError, setReminderError] = useState<string | null>(null);

  const assignee = members.find((m) => m.userId === task.assigneeId);
  const canAssign = members.length > 1;

  async function handleSave() {
    setSaving(true);
    try {
      await onSave({
        description: draft.description || null,
        priority: draft.priority,
        dueDate: draft.dueDate ? new Date(draft.dueDate).toISOString() : null,
        tags: draft.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        assigneeId: draft.assigneeId || null,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <li className="rounded-md border border-border bg-card">
      <div className="flex items-center gap-3 px-4 py-3">
        <input
          type="checkbox"
          checked={done}
          disabled={done}
          onChange={onComplete}
          className="size-4 accent-accent"
        />
        <button
          onClick={onToggleExpand}
          className={cn(
            "min-w-0 flex-1 truncate text-left text-sm font-medium",
            done && "text-muted-foreground line-through"
          )}
        >
          {task.title}
        </button>
        {task.priority > 0 && (
          <span className="rounded-full bg-module px-2 py-0.5 text-xs font-medium text-module-foreground">
            {PRIORITIES[task.priority].label}
          </span>
        )}
        {assignee && (
          <span
            className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground"
            title={`Assigned to ${assignee.name}`}
          >
            {assignee.name}
          </span>
        )}
        <button
          onClick={onDelete}
          className="text-muted-foreground hover:text-destructive"
          aria-label="Delete task"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      {expanded && (
        <div className="flex flex-col gap-3 border-t border-border px-4 py-3">
          <textarea
            value={draft.description}
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            placeholder="Description"
            rows={2}
            className="w-full resize-none rounded-md border border-border bg-transparent px-2 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={draft.priority}
              onChange={(e) => setDraft((d) => ({ ...d, priority: Number(e.target.value) }))}
              className="h-8 rounded-md border border-border bg-transparent px-2 text-sm"
            >
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label} priority
                </option>
              ))}
            </select>
            <input
              type="datetime-local"
              value={draft.dueDate}
              onChange={(e) => setDraft((d) => ({ ...d, dueDate: e.target.value }))}
              className="h-8 rounded-md border border-border bg-transparent px-2 text-sm"
            />
            <input
              value={draft.tags}
              onChange={(e) => setDraft((d) => ({ ...d, tags: e.target.value }))}
              placeholder="tags, comma, separated"
              className="h-8 min-w-0 flex-1 rounded-md border border-border bg-transparent px-2 text-sm"
            />
            {canAssign && (
              <select
                value={draft.assigneeId}
                onChange={(e) => setDraft((d) => ({ ...d, assigneeId: e.target.value }))}
                className="h-8 rounded-md border border-border bg-transparent px-2 text-sm"
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.name}
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="h-8 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>

          <div className="flex flex-col gap-1.5 pt-1">
            <p className="text-xs font-medium text-muted-foreground">Subtasks</p>
            {task.subtasks.map((s) => (
              <div key={s._id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={s.done}
                  onChange={(e) => onToggleSubtask(s._id, e.target.checked)}
                  className="size-3.5 accent-accent"
                />
                <span className={cn("flex-1 text-sm", s.done && "text-muted-foreground line-through")}>
                  {s.title}
                </span>
                <button
                  onClick={() => onDeleteSubtask(s._id)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Remove subtask"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!subtaskTitle.trim()) return;
                onAddSubtask(subtaskTitle.trim());
                setSubtaskTitle("");
              }}
              className="flex items-center gap-2 pt-1"
            >
              <input
                value={subtaskTitle}
                onChange={(e) => setSubtaskTitle(e.target.value)}
                placeholder="Add subtask…"
                className="h-7 flex-1 rounded-md border border-border bg-transparent px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <button
                type="submit"
                disabled={!subtaskTitle.trim()}
                className="text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                <Plus className="size-3.5" />
              </button>
            </form>
          </div>

          <div className="flex flex-col gap-1.5 pt-1">
            <p className="text-xs font-medium text-muted-foreground">Reminders</p>
            {task.reminders.map((r) => (
              <div key={r._id} className="flex items-center gap-2">
                <span className="flex-1 text-sm">
                  {new Date(r.remindAt).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                {r.sentAt && <span className="text-xs text-muted-foreground">Sent</span>}
                <button
                  onClick={() => onDeleteReminder(r._id)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Remove reminder"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!reminderAt) return;
                setReminderError(null);
                const err = await onAddReminder(new Date(reminderAt).toISOString());
                if (err) setReminderError(err);
                else setReminderAt("");
              }}
              className="flex items-center gap-2 pt-1"
            >
              <input
                type="datetime-local"
                value={reminderAt}
                onChange={(e) => setReminderAt(e.target.value)}
                className="h-7 rounded-md border border-border bg-transparent px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <button
                type="submit"
                disabled={!reminderAt}
                className="text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                <Plus className="size-3.5" />
              </button>
            </form>
            {reminderError && <p className="text-xs text-destructive">{reminderError}</p>}
          </div>
        </div>
      )}
    </li>
  );
}

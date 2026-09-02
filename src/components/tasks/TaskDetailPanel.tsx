"use client";

import { useState } from "react";
import { X, Plus, Paperclip, Lock, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useTaskDetail } from "@/hooks/useTaskDetail";
import { useWorkspace } from "@/context/WorkspaceContext";
import { PRIORITY } from "@/lib/constants";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { api } from "@/lib/api-client";
import Link from "next/link";

export function TaskDetailPanel({
  taskId,
  onClose,
  onChanged,
}: {
  taskId: string;
  onClose: () => void;
  onChanged: () => void | Promise<unknown>;
}) {
  const { activeWorkspace } = useWorkspace();
  const { task, comments, addSubtask, toggleSubtask, addComment, requestAttachmentUpload, mutate } = useTaskDetail(taskId);
  const [newSubtask, setNewSubtask] = useState("");
  const [newComment, setNewComment] = useState("");
  const [reminderTime, setReminderTime] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  if (!task) {
    return (
      <div className="w-full sm:w-96 shrink-0 border-l border-border bg-surface p-5">
        <div className="h-6 w-32 animate-pulse rounded bg-black/5" />
      </div>
    );
  }

  const entitlements = activeWorkspace?.entitlements;
  const canAttach = entitlements?.features.unlimited_attachments ?? false;
  const canMultiRemind = entitlements?.features.multiple_reminders ?? false;
  const remindersMaxed = !canMultiRemind && task.reminders.length >= 1;

  async function patchTask(patch: Record<string, unknown>) {
    await api.patch(`/api/v1/tasks/${taskId}`, patch);
    await mutate();
    await onChanged();
  }

  async function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const result = await requestAttachmentUpload(file.name, file.type || "application/octet-stream", file.size);
      if (result?.uploadUrl) {
        const res = await fetch(result.uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
        if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      }
    } catch {
      setUploadError("Couldn't upload the file — storage isn't configured yet or the connection failed.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function addReminder() {
    if (!reminderTime) return;
    await api.post(`/api/v1/tasks/${taskId}/reminders`, { remindAt: new Date(reminderTime).toISOString() });
    setReminderTime("");
    await mutate();
  }

  return (
    <div className="w-full sm:w-96 shrink-0 border-l border-border bg-surface flex flex-col h-full">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">Task</span>
        <button onClick={onClose} className="text-muted hover:text-foreground">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <Input
          value={task.title}
          onChange={(e) => patchTask({ title: e.target.value })}
          className="text-lg font-semibold border-none px-0 focus:ring-0"
        />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted mb-1 block">Priority</label>
            <Select value={task.priority} onChange={(e) => patchTask({ priority: Number(e.target.value) })}>
              {Object.entries(PRIORITY).map(([val, p]) => (
                <option key={val} value={val}>
                  {p.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">Due date</label>
            <Input
              type="date"
              value={task.dueDate ? task.dueDate.slice(0, 10) : ""}
              onChange={(e) => patchTask({ dueDate: e.target.value ? new Date(e.target.value).toISOString() : null })}
            />
          </div>
        </div>

        {/* Subtasks */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">
            Subtasks {task.subtasks.length > 0 && `(${task.subtasks.filter((s) => s.done).length}/${task.subtasks.length})`}
          </h3>
          <div className="space-y-1">
            {task.subtasks.map((s) => (
              <label key={s._id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={s.done} onChange={(e) => toggleSubtask(s._id, e.target.checked)} className="accent-accent" />
                <span className={s.done ? "line-through text-muted" : ""}>{s.title}</span>
              </label>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!newSubtask.trim()) return;
              addSubtask(newSubtask.trim());
              setNewSubtask("");
            }}
            className="flex items-center gap-1 mt-2"
          >
            <Plus size={14} className="text-accent" />
            <Input value={newSubtask} onChange={(e) => setNewSubtask(e.target.value)} placeholder="Add a subtask" className="border-none px-0 text-sm focus:ring-0" />
          </form>
        </div>

        {/* Sticky Alerts (reminders) */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">Sticky Alerts</h3>
          <div className="space-y-1 mb-2">
            {task.reminders.map((r) => (
              <div key={r._id} className="text-sm flex items-center justify-between">
                <span>{format(new Date(r.remindAt), "d MMM, h:mm a")}</span>
                {r.sentAt && <Badge tone="muted">Sent</Badge>}
              </div>
            ))}
          </div>
          {remindersMaxed ? (
            <Link href="/settings/billing" className="flex items-center gap-1 text-xs text-module">
              <Lock size={12} /> Upgrade for multiple Sticky Alerts per task
            </Link>
          ) : (
            <div className="flex items-center gap-2">
              <Input type="datetime-local" value={reminderTime} onChange={(e) => setReminderTime(e.target.value)} className="text-xs" />
              <button onClick={addReminder} className="text-accent text-xs font-medium shrink-0">
                Add
              </button>
            </div>
          )}
        </div>

        {/* Attachments */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">Attachments</h3>
          <div className="space-y-1 mb-2">
            {task.attachments.map((a) => (
              <a key={a._id} href={a.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-accent truncate">
                <Paperclip size={13} /> {a.filename}
              </a>
            ))}
          </div>
          {canAttach ? (
            <>
              <label className="text-xs text-accent font-medium cursor-pointer">
                {uploading ? "Uploading…" : "+ Add attachment"}
                <input type="file" className="hidden" onChange={onFileSelected} disabled={uploading} />
              </label>
              {uploadError && <p className="text-xs text-danger mt-1">{uploadError}</p>}
            </>
          ) : (
            <Link href="/settings/billing" className="flex items-center gap-1 text-xs text-module">
              <Lock size={12} /> Upgrade to add attachments
            </Link>
          )}
        </div>

        {/* Comments */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">Comments ({comments.length})</h3>
          <div className="space-y-3 mb-2">
            {comments.map((c) => (
              <div key={c.id} className="text-sm">
                <p>{c.body}</p>
                <p className="text-[11px] text-muted">{format(new Date(c.createdAt), "d MMM, h:mm a")}</p>
              </div>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!newComment.trim()) return;
              addComment(newComment.trim());
              setNewComment("");
            }}
          >
            <Input value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Write a comment…" />
          </form>
        </div>

        <button
          onClick={async () => {
            await api.delete(`/api/v1/tasks/${taskId}`);
            await onChanged();
            onClose();
          }}
          className="flex items-center gap-1 text-xs text-danger"
        >
          <Trash2 size={13} /> Delete task
        </button>
      </div>
    </div>
  );
}

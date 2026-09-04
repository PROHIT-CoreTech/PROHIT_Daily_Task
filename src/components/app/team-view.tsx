"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserMinus, X } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { UNLIMITED } from "@/lib/types";
import type { MemberRole, WorkspaceType } from "@/lib/types";
import type { TeamMember, PendingInvite } from "@/lib/queries/team";

function initials(name: string) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function TeamView({
  workspaceId,
  workspaceType,
  myRole,
  myUserId,
  members,
  invites,
  maxMembers,
}: {
  workspaceId: string;
  workspaceType: WorkspaceType;
  myRole: MemberRole;
  myUserId: string;
  members: TeamMember[];
  invites: PendingInvite[];
  maxMembers: number;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const canManage = myRole === "owner" || myRole === "admin";
  const isPersonal = workspaceType === "personal";

  const seatCount = members.length + invites.length;
  const seatLimit = maxMembers === UNLIMITED ? "Unlimited" : String(maxMembers);
  const atLimit = maxMembers !== UNLIMITED && seatCount >= maxMembers;

  async function removeMember(userId: string) {
    const isSelf = userId === myUserId;
    if (!confirm(isSelf ? "Leave this workspace?" : "Remove this member?")) return;
    const res = await fetch(`/api/v1/workspaces/${workspaceId}/members/${userId}`, {
      method: "DELETE",
    });
    if (res.ok) startTransition(() => router.refresh());
  }

  async function revokeInvite(inviteId: string) {
    const res = await fetch(`/api/v1/workspaces/${workspaceId}/invites/${inviteId}`, {
      method: "DELETE",
    });
    if (res.ok) startTransition(() => router.refresh());
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Team</h1>
        <span className="text-sm text-muted-foreground">
          {seatCount} / {seatLimit} seats
        </span>
      </div>

      {isPersonal && (
        <p className="rounded-md bg-module/20 px-3 py-2 text-sm text-module-foreground">
          Personal workspaces are single-user. Create a Team or Business workspace (via the
          workspace switcher) to invite others.
        </p>
      )}

      <div className="flex flex-col gap-2">
        {members.map((m) => {
          const isSelf = m.userId === myUserId;
          const canRemove = m.role !== "owner" && (isSelf || canManage);
          return (
            <div
              key={m.userId}
              className="flex items-center gap-3 rounded-md border border-border bg-card px-4 py-3"
            >
              <Avatar>
                <AvatarFallback>{initials(m.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{m.name}</p>
                <p className="truncate text-xs text-muted-foreground">{m.email}</p>
              </div>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium capitalize">
                {m.role}
              </span>
              {canRemove && (
                <button
                  onClick={() => removeMember(m.userId)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label={isSelf ? "Leave workspace" : `Remove ${m.name}`}
                >
                  <UserMinus className="size-4" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {canManage && !isPersonal && (
        <>
          {invites.length > 0 && (
            <div className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold text-muted-foreground">Pending invites</h2>
              {invites.map((inv) => (
                <div
                  key={inv._id}
                  className="flex items-center gap-3 rounded-md border border-dashed border-border px-4 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{inv.email}</p>
                  </div>
                  {inv.expired && (
                    <span className="text-xs text-destructive">Expired</span>
                  )}
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium capitalize">
                    {inv.role}
                  </span>
                  <button
                    onClick={() => revokeInvite(inv._id)}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label={`Revoke invite to ${inv.email}`}
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <InviteForm workspaceId={workspaceId} disabled={atLimit} />
        </>
      )}
    </div>
  );
}

function InviteForm({ workspaceId, disabled }: { workspaceId: string; disabled: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    setError(null);

    const res = await fetch(`/api/v1/workspaces/${workspaceId}/invites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), role }),
    });
    setSending(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(
        body.error === "limit_exceeded"
          ? "Member limit reached on your current plan."
          : body.error === "already_member"
            ? "That person is already a member."
            : "Couldn't send the invite."
      );
      return;
    }

    setEmail("");
    router.refresh();
  }

  return (
    <form onSubmit={sendInvite} className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-muted-foreground">Invite someone</h2>
      <div className="flex items-center gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@example.com"
          disabled={disabled}
          className="h-9 min-w-0 flex-1 rounded-md border border-border bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as "admin" | "member")}
          disabled={disabled}
          className="h-9 rounded-md border border-border bg-transparent px-2 text-sm disabled:opacity-50"
        >
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
        <button
          type="submit"
          disabled={disabled || sending || !email.trim()}
          className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {sending ? "Sending…" : "Invite"}
        </button>
      </div>
      {disabled && (
        <p className="text-xs text-muted-foreground">
          Member limit reached on your current plan.
        </p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </form>
  );
}

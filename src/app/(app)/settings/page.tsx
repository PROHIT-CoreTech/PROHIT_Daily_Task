"use client";

import { useState } from "react";
import Link from "next/link";
import { useWorkspace } from "@/context/WorkspaceContext";
import { TopNav } from "@/components/layout/TopNav";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Avatar } from "@/components/ui/Avatar";
import { api } from "@/lib/api-client";

export default function SettingsPage() {
  const { activeWorkspace, refresh } = useWorkspace();
  const [name, setName] = useState(activeWorkspace?.name ?? "");
  const [saving, setSaving] = useState(false);

  if (!activeWorkspace) return null;

  async function onSave() {
    setSaving(true);
    try {
      await api.patch(`/api/v1/workspaces/${activeWorkspace!.id}`, { name });
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <TopNav title="Settings" />
      <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-2xl">
        <Card className="p-5 space-y-4">
          <h3 className="text-sm font-semibold text-primary">Workspace</h3>
          <div>
            <Label>Name</Label>
            <div className="flex gap-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
              <Button onClick={onSave} disabled={saving}>
                Save
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted capitalize">
            {activeWorkspace.type} workspace · Your role: {activeWorkspace.role}
          </p>
        </Card>

        <Card className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-primary">Plan</h3>
            <Link href="/settings/billing" className="text-xs text-accent font-medium">
              Manage plan →
            </Link>
          </div>
          <p className="text-sm text-muted capitalize">Current plan: {activeWorkspace.entitlements.plan.replace("_", " ")}</p>
        </Card>

        {activeWorkspace.type !== "personal" && <MembersCard workspaceId={activeWorkspace.id} />}
      </div>
    </div>
  );
}

function MembersCard({ workspaceId }: { workspaceId: string }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const { me, refresh } = useWorkspace();
  const members = me?.workspaces.find((w) => w.id === workspaceId);

  async function onInvite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAdding(true);
    try {
      await api.post(`/api/v1/workspaces/${workspaceId}/members`, { email });
      setEmail("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add member.");
    } finally {
      setAdding(false);
    }
  }

  return (
    <Card className="p-5 space-y-4">
      <h3 className="text-sm font-semibold text-primary">Members</h3>
      <form onSubmit={onInvite} className="flex gap-2">
        <Input type="email" placeholder="teammate@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Button type="submit" disabled={adding}>
          Invite
        </Button>
      </form>
      {error && <p className="text-xs text-danger">{error}</p>}
      <p className="text-xs text-muted">Invited users must already have a PROHIT Daily Task account. {members?.entitlements.limits.maxMembers === -1 ? "" : `Up to ${members?.entitlements.limits.maxMembers} members on this plan.`}</p>
      <div className="flex items-center gap-2">
        <Avatar name="You" size={28} />
        <span className="text-sm">You</span>
      </div>
    </Card>
  );
}

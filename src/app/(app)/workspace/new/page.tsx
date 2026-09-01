"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Building2 } from "lucide-react";
import { TopNav } from "@/components/layout/TopNav";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { api, ApiClientError } from "@/lib/api-client";
import { useWorkspace } from "@/context/WorkspaceContext";

export default function NewWorkspacePage() {
  const router = useRouter();
  const { refresh, setActiveWorkspaceId } = useWorkspace();
  const [name, setName] = useState("");
  const [type, setType] = useState<"team" | "business">("team");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.post<{ id: string }>("/api/v1/workspaces", { name, type });
      await refresh();
      setActiveWorkspaceId(res.id);
      router.push("/my-day");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not create workspace.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <TopNav title="New Workspace" />
      <div className="flex-1 overflow-y-auto p-6">
        <Card className="max-w-md p-6">
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label>Workspace name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Acme Inc." />
            </div>
            <div>
              <Label>Type</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setType("team")}
                  className={`flex flex-col items-center gap-2 rounded-lg border p-4 text-sm ${
                    type === "team" ? "border-accent bg-accent/5 text-accent" : "border-border text-muted"
                  }`}
                >
                  <Users size={20} />
                  Team
                  <span className="text-[11px]">Up to 10 members</span>
                </button>
                <button
                  type="button"
                  onClick={() => setType("business")}
                  className={`flex flex-col items-center gap-2 rounded-lg border p-4 text-sm ${
                    type === "business" ? "border-accent bg-accent/5 text-accent" : "border-border text-muted"
                  }`}
                >
                  <Building2 size={20} />
                  Business
                  <span className="text-[11px]">Up to 50 · vertical modules</span>
                </button>
              </div>
            </div>
            <p className="text-xs text-muted">Team/Business workspaces start on the Team plan (₹149/user/month).</p>
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Creating…" : "Create workspace"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}

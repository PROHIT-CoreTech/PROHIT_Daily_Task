"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles, Lock } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useWorkspace } from "@/context/WorkspaceContext";
import { api, ApiClientError } from "@/lib/api-client";
import { NOMENCLATURE } from "@/lib/constants";

export function QuickRecapCard({ workspaceId }: { workspaceId: string | undefined }) {
  const { activeWorkspace } = useWorkspace();
  const [recap, setRecap] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enabled = activeWorkspace?.entitlements.features.ai_assistant ?? false;

  async function generate() {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.post<{ recap: string }>(`/api/v1/workspaces/${workspaceId}/ai/quick-recap`);
      setRecap(res.recap);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Couldn't generate a recap right now.");
    } finally {
      setLoading(false);
    }
  }

  if (!enabled) {
    return (
      <Card className="p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted">
          <Sparkles size={16} className="text-module" />
          {NOMENCLATURE.aiSummary} — an AI-written plan for your day
        </div>
        <Link href="/settings/billing" className="flex items-center gap-1 text-xs text-module font-medium shrink-0">
          <Lock size={12} /> Add for ₹99/mo
        </Link>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium text-primary">
          <Sparkles size={16} className="text-accent" />
          {NOMENCLATURE.aiSummary}
        </div>
        <Button size="sm" variant="ghost" onClick={generate} disabled={loading}>
          {loading ? "Thinking…" : recap ? "Regenerate" : "Generate"}
        </Button>
      </div>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
      {recap && <p className="mt-2 text-sm text-foreground">{recap}</p>}
    </Card>
  );
}

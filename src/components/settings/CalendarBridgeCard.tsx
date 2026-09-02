"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { CalendarDays } from "lucide-react";
import { fetcher, api, ApiClientError } from "@/lib/api-client";
import { useWorkspace } from "@/context/WorkspaceContext";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type ConnectionStatus = {
  connected: boolean;
  connectedAt: string | null;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
};

export function CalendarBridgeCard({ workspaceId }: { workspaceId: string }) {
  const { activeWorkspace } = useWorkspace();
  const entitled = activeWorkspace?.entitlements.features.calendar_bridge ?? false;
  const { data, mutate } = useSWR<ConnectionStatus>(
    entitled ? `/api/v1/workspaces/${workspaceId}/integrations/google-calendar` : null,
    fetcher
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ url: string }>(`/api/v1/workspaces/${workspaceId}/integrations/google-calendar`);
      window.location.href = res.url;
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not start Google Calendar connection.");
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!confirm("Disconnect Google Calendar? Tasks will stop syncing.")) return;
    setBusy(true);
    setError(null);
    try {
      await api.delete(`/api/v1/workspaces/${workspaceId}/integrations/google-calendar`);
      await mutate();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not disconnect.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5 space-y-3">
      <div className="flex items-center gap-2">
        <CalendarDays size={15} className="text-module" />
        <h3 className="text-sm font-semibold text-primary">Calendar Bridge</h3>
      </div>

      {!entitled ? (
        <>
          <p className="text-xs text-muted">Sync task due dates to Google Calendar automatically. Available on Pro and Team.</p>
          <Link href="/settings/billing">
            <Button variant="ghost" className="w-full">
              Upgrade to unlock
            </Button>
          </Link>
        </>
      ) : data?.connected ? (
        <>
          <p className="text-xs text-muted">
            Connected{data.lastSyncedAt ? ` · last synced ${new Date(data.lastSyncedAt).toLocaleString()}` : ""}
          </p>
          {data.lastSyncError && <p className="text-xs text-danger">Last sync failed: {data.lastSyncError}</p>}
          <Button variant="ghost" className="w-full" onClick={disconnect} disabled={busy}>
            Disconnect
          </Button>
        </>
      ) : (
        <>
          <p className="text-xs text-muted">Sync task due dates to Google Calendar automatically.</p>
          <Button className="w-full" onClick={connect} disabled={busy}>
            {busy ? "Connecting…" : "Connect Google Calendar"}
          </Button>
        </>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
    </Card>
  );
}

"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { useWorkspace } from "@/context/WorkspaceContext";
import { Button } from "@/components/ui/Button";
import { TopNav } from "@/components/layout/TopNav";
import type { FeatureFlags } from "@/lib/entitlements/matrix";

const FEATURE_COPY: Record<keyof FeatureFlags, { headline: string; body: string }> = {
  flow_board: {
    headline: "Flow Board is a Pro feature",
    body: "Visualize your tasks as a drag-and-drop board with To Do, In Progress, and Done columns.",
  },
  calendar_week_view: {
    headline: "Week view is a Pro feature",
    body: "See your week at a glance instead of the whole month.",
  },
  calendar_bridge: { headline: "Calendar Bridge is coming soon", body: "External calendar sync arrives in a future release." },
  unlimited_attachments: { headline: "Attachments are a Pro feature", body: "Attach files to any task on Pro or Team." },
  multiple_reminders: { headline: "Multiple Sticky Alerts are a Pro feature", body: "Set more than one reminder per task on Pro or Team." },
  deep_work: { headline: "Deep Work Sprint is a Pro feature", body: "Run focused, distraction-free timer sessions on Pro or Team." },
  ai_assistant: { headline: "Quick Recap is coming soon", body: "AI-powered summaries are launching in a future release." },
  team_dashboard: { headline: "The team dashboard is a Team feature", body: "See completion breakdowns across your whole team." },
};

export function UpgradeGate({
  feature,
  title,
  children,
}: {
  feature: keyof FeatureFlags;
  title: string;
  children: React.ReactNode;
}) {
  const { activeWorkspace, isLoading } = useWorkspace();

  if (isLoading || !activeWorkspace) return null;
  if (activeWorkspace.entitlements.features[feature]) return <>{children}</>;

  const copy = FEATURE_COPY[feature];

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <TopNav title={title} />
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-module/20 text-module">
            <Lock size={20} />
          </div>
          <h2 className="text-lg font-semibold text-primary mb-1">{copy.headline}</h2>
          <p className="text-sm text-muted mb-5">{copy.body}</p>
          <Link href="/settings/billing">
            <Button>Upgrade Now</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

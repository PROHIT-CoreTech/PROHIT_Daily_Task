import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { UpgradeGate } from "./UpgradeGate";
import { buildUseWorkspaceReturn, buildWorkspace } from "@/test/mocks/workspace";
import type { FeatureFlags } from "@/lib/entitlements/matrix";

const { useWorkspace } = vi.hoisted(() => ({ useWorkspace: vi.fn() }));
vi.mock("@/context/WorkspaceContext", () => ({ useWorkspace }));
// The gated (locked) branch renders <TopNav>, which calls next-auth's useSession —
// needs a SessionProvider ancestor unless stubbed.
vi.mock("next-auth/react", () => ({ useSession: () => ({ data: null }), signOut: vi.fn() }));

const ALL_FEATURE_KEYS: (keyof FeatureFlags)[] = [
  "flow_board",
  "calendar_week_view",
  "calendar_bridge",
  "unlimited_attachments",
  "multiple_reminders",
  "deep_work",
  "ai_assistant",
  "team_dashboard",
];

describe("UpgradeGate", () => {
  it("renders nothing while the workspace is loading", () => {
    useWorkspace.mockReturnValue({ ...buildUseWorkspaceReturn(), isLoading: true });
    const { container } = render(
      <UpgradeGate feature="flow_board" title="Flow Board">
        <p>protected content</p>
      </UpgradeGate>
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when there is no active workspace", () => {
    useWorkspace.mockReturnValue({ ...buildUseWorkspaceReturn(), me: undefined, activeWorkspace: undefined });
    const { container } = render(
      <UpgradeGate feature="flow_board" title="Flow Board">
        <p>protected content</p>
      </UpgradeGate>
    );
    expect(container).toBeEmptyDOMElement();
  });

  it.each(ALL_FEATURE_KEYS)("gates %s when the flag is off, unlocks when it's on", (feature) => {
    useWorkspace.mockReturnValue(
      buildUseWorkspaceReturn(buildWorkspace({ features: { [feature]: false } }))
    );
    const { rerender } = render(
      <UpgradeGate feature={feature} title="Feature">
        <p>protected content</p>
      </UpgradeGate>
    );
    expect(screen.queryByText("protected content")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /upgrade now/i })).toHaveAttribute("href", "/settings/billing");

    useWorkspace.mockReturnValue(
      buildUseWorkspaceReturn(buildWorkspace({ plan: "pro", features: { [feature]: true } }))
    );
    rerender(
      <UpgradeGate feature={feature} title="Feature">
        <p>protected content</p>
      </UpgradeGate>
    );
    expect(screen.getByText("protected content")).toBeInTheDocument();
  });
});

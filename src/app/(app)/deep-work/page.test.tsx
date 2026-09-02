import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import DeepWorkPage from "./page";
import { buildUseWorkspaceReturn, buildWorkspace } from "@/test/mocks/workspace";

const { useWorkspace } = vi.hoisted(() => ({ useWorkspace: vi.fn() }));
vi.mock("@/context/WorkspaceContext", () => ({ useWorkspace }));
vi.mock("next-auth/react", () => ({ useSession: () => ({ data: null }), signOut: vi.fn() }));

vi.mock("swr", () => ({ default: () => ({ data: { tasks: [] }, mutate: vi.fn() }) }));

const { startSession, endSession } = vi.hoisted(() => ({
  startSession: vi.fn(),
  endSession: vi.fn(),
}));
vi.mock("@/hooks/useFocusSessions", () => ({
  useFocusSessions: () => ({ sessionsToday: 2, recent: [], startSession, endSession }),
}));

describe("DeepWorkPage timer state machine", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    startSession.mockReset();
    endSession.mockReset();
    startSession.mockResolvedValue("session-1");
    useWorkspace.mockReturnValue(
      buildUseWorkspaceReturn(buildWorkspace({ plan: "pro", features: { deep_work: true } }))
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // onStart/onStop await the (already-resolved) mocked session promise, so the resulting
  // setState only lands on the next microtask; waiting for the button label flip lets that
  // continuation flush before we assert on the countdown.
  async function clickStart() {
    fireEvent.click(screen.getByRole("button", { name: /start|resume/i }));
    await vi.waitFor(() => expect(screen.getByRole("button", { name: /pause/i })).toBeInTheDocument());
  }

  async function clickStop() {
    fireEvent.click(screen.getByRole("button", { name: /stop/i }));
    await vi.waitFor(() => expect(screen.getByRole("button", { name: /^start$/i })).toBeInTheDocument());
  }

  it("starts a session, counts down every second, and calls startSession once", async () => {
    render(<DeepWorkPage />);

    expect(screen.queryByText("00:00")).not.toBeInTheDocument(); // sanity: not started/zeroed yet
    expect(screen.getByText("25:00")).toBeInTheDocument();

    await clickStart();
    expect(startSession).toHaveBeenCalledWith(25, undefined);
    expect(startSession).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(3000);
    expect(screen.getByText("24:57")).toBeInTheDocument();

    // resuming an already-started session must not create a second one
    fireEvent.click(screen.getByRole("button", { name: /pause/i }));
    await clickStart();
    expect(startSession).toHaveBeenCalledTimes(1);
  });

  it("pause stops the countdown; resume continues it", async () => {
    render(<DeepWorkPage />);

    await clickStart();
    await vi.advanceTimersByTimeAsync(2000);
    expect(screen.getByText("24:58")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /pause/i }));
    await vi.advanceTimersByTimeAsync(5000);
    expect(screen.getByText("24:58")).toBeInTheDocument(); // unchanged while paused

    await clickStart();
    await vi.advanceTimersByTimeAsync(2000);
    expect(screen.getByText("24:56")).toBeInTheDocument();
  });

  it(
    "auto-ends the session as completed when the countdown reaches zero",
    async () => {
      endSession.mockResolvedValue(undefined);
      render(<DeepWorkPage />);

      // shortest preset available is 25 min; select it explicitly for clarity, then drain it
      await clickStart();
      // 1500 real interval ticks under fake timers — each re-renders the component, so this
      // is inherently heavier than the other cases; give it more room than the 5s default
      // to avoid flaking under parallel test-file load.
      await vi.advanceTimersByTimeAsync(25 * 60 * 1000);

      await vi.waitFor(() => expect(endSession).toHaveBeenCalledWith("session-1", true));
      // once ended, the Start/Resume button should read "Start" again (sessionId cleared)
      expect(screen.getByRole("button", { name: /^start$/i })).toBeInTheDocument();
    },
    20000
  );

  it("stop ends the session as incomplete and resets the ring to the planned duration", async () => {
    endSession.mockResolvedValue(undefined);
    render(<DeepWorkPage />);

    await clickStart();
    await vi.advanceTimersByTimeAsync(4000);
    await clickStop();

    expect(endSession).toHaveBeenCalledWith("session-1", false);
    expect(screen.getByText("25:00")).toBeInTheDocument();
  });

  it("changing the duration preset before starting resets the displayed time", async () => {
    render(<DeepWorkPage />);
    fireEvent.click(screen.getByRole("button", { name: "45 min" }));
    expect(screen.getByText("45:00")).toBeInTheDocument();
  });
});

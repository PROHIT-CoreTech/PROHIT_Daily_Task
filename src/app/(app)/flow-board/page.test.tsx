import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import FlowBoardPage from "./page";
import { buildUseWorkspaceReturn, buildWorkspace } from "@/test/mocks/workspace";
import type { BoardColumn } from "@/types/api";

const { useWorkspace } = vi.hoisted(() => ({ useWorkspace: vi.fn() }));
vi.mock("@/context/WorkspaceContext", () => ({ useWorkspace }));
vi.mock("next-auth/react", () => ({ useSession: () => ({ data: null }), signOut: vi.fn() }));

const columns: BoardColumn[] = [
  { id: "todo", label: "To Do", tasks: [] },
  { id: "in_progress", label: "In Progress", tasks: [] },
  { id: "done", label: "Done", tasks: [] },
];

vi.mock("swr", () => ({
  default: (key: string | null) => {
    if (typeof key === "string" && key.includes("/board")) {
      return { data: { columns }, mutate: vi.fn() };
    }
    if (typeof key === "string" && key.includes("/lists")) {
      return { data: { lists: [] }, mutate: vi.fn() };
    }
    return { data: undefined, mutate: vi.fn() };
  },
}));

describe("FlowBoardPage", () => {
  it("gates behind the flow_board entitlement", () => {
    useWorkspace.mockReturnValue(buildUseWorkspaceReturn(buildWorkspace({ features: { flow_board: false } })));
    render(<FlowBoardPage />);
    expect(screen.getByText(/pro feature/i)).toBeInTheDocument();
    expect(screen.queryByText("To Do")).not.toBeInTheDocument();
  });

  it("renders board columns when entitled", () => {
    useWorkspace.mockReturnValue(
      buildUseWorkspaceReturn(buildWorkspace({ plan: "pro", features: { flow_board: true } }))
    );
    render(<FlowBoardPage />);
    expect(screen.getByText("To Do")).toBeInTheDocument();
    expect(screen.getByText("In Progress")).toBeInTheDocument();
    expect(screen.getByText("Done")).toBeInTheDocument();
  });
});

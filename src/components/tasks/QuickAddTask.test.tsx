import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuickAddTask } from "./QuickAddTask";
import type { ListItem } from "@/types/api";

function buildList(overrides: Partial<ListItem> = {}): ListItem {
  return { id: "list-1", workspaceId: "workspace-1", name: "Inbox", color: "#000000", order: 0, ...overrides };
}

describe("QuickAddTask", () => {
  it("does not show the list selector when there's only one list", () => {
    render(<QuickAddTask lists={[buildList()]} onAdd={vi.fn()} />);
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("shows a list selector defaulting to the first list when there are multiple", () => {
    render(<QuickAddTask lists={[buildList({ id: "a", name: "A" }), buildList({ id: "b", name: "B" })]} onAdd={vi.fn()} />);
    expect(screen.getByRole("combobox")).toHaveValue("a");
  });

  it("submits the trimmed title and selected list, then clears the input", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(<QuickAddTask lists={[buildList()]} onAdd={onAdd} />);

    const input = screen.getByPlaceholderText("Add a task…");
    await user.type(input, "  Buy milk  ");
    await user.keyboard("{Enter}");

    expect(onAdd).toHaveBeenCalledWith("Buy milk", "list-1");
    expect(input).toHaveValue("");
  });

  it("does not submit an empty/whitespace-only title", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<QuickAddTask lists={[buildList()]} onAdd={onAdd} />);

    await user.type(screen.getByPlaceholderText("Add a task…"), "   ");
    await user.keyboard("{Enter}");

    expect(onAdd).not.toHaveBeenCalled();
  });

  it("syncs to the first-loaded list once lists arrive asynchronously, without clobbering a manual selection", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(<QuickAddTask lists={[]} onAdd={onAdd} />);

    // lists arrive later (SWR) — the effect should adopt the first one
    rerender(<QuickAddTask lists={[buildList({ id: "a", name: "A" }), buildList({ id: "b", name: "B" })]} onAdd={onAdd} />);
    expect(screen.getByRole("combobox")).toHaveValue("a");

    // user manually picks "b" — a subsequent lists update must not reset it
    await user.selectOptions(screen.getByRole("combobox"), "b");
    rerender(<QuickAddTask lists={[buildList({ id: "a", name: "A" }), buildList({ id: "b", name: "B" }), buildList({ id: "c", name: "C" })]} onAdd={onAdd} />);
    expect(screen.getByRole("combobox")).toHaveValue("b");
  });
});

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TaskRow } from "./TaskRow";
import { buildTask } from "@/test/mocks/task";

describe("TaskRow", () => {
  it("renders title, priority dot, tags, subtask count, and due date", () => {
    const task = buildTask({
      title: "Ship the release",
      priority: 3,
      tags: ["urgent", "backend"],
      subtasks: [
        { _id: "s1", title: "step 1", done: true, order: 0 },
        { _id: "s2", title: "step 2", done: false, order: 1 },
      ],
      dueDate: new Date(Date.now() + 86_400_000).toISOString(),
    });

    render(<TaskRow task={task} onToggleComplete={vi.fn()} onOpen={vi.fn()} />);

    expect(screen.getByText("Ship the release")).toBeInTheDocument();
    expect(screen.getByText("urgent")).toBeInTheDocument();
    expect(screen.getByText("backend")).toBeInTheDocument();
    expect(screen.getByText("1/2")).toBeInTheDocument();
    expect(screen.getByLabelText("Mark complete")).toBeInTheDocument();
  });

  it("shows the overdue due date in red and marks completed tasks struck through", () => {
    const task = buildTask({
      title: "Overdue thing",
      dueDate: new Date(Date.now() - 86_400_000).toISOString(),
      completedAt: undefined,
    });
    render(<TaskRow task={task} onToggleComplete={vi.fn()} onOpen={vi.fn()} />);
    const dueDateEl = screen.getByText((content, el) => el?.tagName === "SPAN" && /\d/.test(content));
    expect(dueDateEl.className).toContain("text-danger");
  });

  it("calls onOpen when the row is clicked, and onToggleComplete (without opening) when the check button is clicked", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    const onToggleComplete = vi.fn();
    const task = buildTask({ title: "Click me" });

    render(<TaskRow task={task} onToggleComplete={onToggleComplete} onOpen={onOpen} />);

    await user.click(screen.getByLabelText("Mark complete"));
    expect(onToggleComplete).toHaveBeenCalledWith(task);
    expect(onOpen).not.toHaveBeenCalled();

    await user.click(screen.getByText("Click me"));
    expect(onOpen).toHaveBeenCalledWith(task);
  });
});

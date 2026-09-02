import { describe, expect, it } from "vitest";
import { computeDragTarget } from "./computeDragTarget";
import type { BoardColumn, TaskItem } from "@/types/api";

function task(id: string): TaskItem {
  return {
    id,
    workspaceId: "w1",
    listId: "l1",
    title: id,
    status: "todo",
    boardOrder: 0,
    priority: 0,
    tags: [],
    subtasks: [],
    reminders: [],
    attachments: [],
    createdBy: "u1",
  };
}

function columns(): BoardColumn[] {
  return [
    { id: "todo", label: "To Do", tasks: [task("t1"), task("t2"), task("t3")] },
    { id: "in_progress", label: "In Progress", tasks: [task("t4")] },
    { id: "done", label: "Done", tasks: [] },
  ];
}

describe("computeDragTarget", () => {
  it("returns null when the destination column doesn't exist", () => {
    expect(computeDragTarget(columns(), "t1", { droppableId: "missing", index: 0 })).toBeNull();
  });

  it("dropping at the very top of a column has no beforeTaskId, afterTaskId is the current first task", () => {
    expect(computeDragTarget(columns(), "t4", { droppableId: "todo", index: 0 })).toEqual({
      boardColumnId: "todo",
      beforeTaskId: null,
      afterTaskId: "t1",
    });
  });

  it("dropping at the very bottom of a column has beforeTaskId as the current last task, no afterTaskId", () => {
    expect(computeDragTarget(columns(), "t4", { droppableId: "todo", index: 3 })).toEqual({
      boardColumnId: "todo",
      beforeTaskId: "t3",
      afterTaskId: null,
    });
  });

  it("dropping into an empty column has neither before nor after", () => {
    expect(computeDragTarget(columns(), "t4", { droppableId: "done", index: 0 })).toEqual({
      boardColumnId: "done",
      beforeTaskId: null,
      afterTaskId: null,
    });
  });

  it("dropping between two existing cards resolves both neighbours, excluding the dragged task itself from its origin column", () => {
    // t2 is being dragged within "todo" to index 1 (between t1 and t3) — it must
    // be excluded from destTasks first, or the neighbour math shifts by one.
    expect(computeDragTarget(columns(), "t2", { droppableId: "todo", index: 1 })).toEqual({
      boardColumnId: "todo",
      beforeTaskId: "t1",
      afterTaskId: "t3",
    });
  });
});

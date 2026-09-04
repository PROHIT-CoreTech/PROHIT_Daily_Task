"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import type { BoardColumn, BoardTask } from "@/lib/queries/board";

const PRIORITY_LABEL = ["", "Low", "Medium", "High"] as const;

function findColumnIndex(columns: BoardColumn[], taskId: string): number {
  return columns.findIndex((c) => c.tasks.some((t) => t._id === taskId));
}

/**
 * Computes the new column layout and the {afterTaskId, beforeTaskId} pair
 * the server needs (src/app/api/v1/tasks/[id]/board-position). Server
 * computes the actual fractional order from those two IDs — this only
 * decides where the card visually lands.
 */
function moveTask(columns: BoardColumn[], activeId: string, overId: string) {
  const fromColIdx = findColumnIndex(columns, activeId);
  if (fromColIdx === -1) return null;

  const activeTask = columns[fromColIdx].tasks.find((t) => t._id === activeId)!;
  const originalIdx = columns[fromColIdx].tasks.findIndex((t) => t._id === activeId);

  let toColIdx = columns.findIndex((c) => c.id === overId);
  let toTaskIdx: number;
  if (toColIdx !== -1) {
    toTaskIdx = columns[toColIdx].tasks.length; // dropped on the column itself: append
  } else {
    toColIdx = findColumnIndex(columns, overId);
    if (toColIdx === -1) return null;
    toTaskIdx = columns[toColIdx].tasks.findIndex((t) => t._id === overId);
  }

  let insertIdx = toTaskIdx;
  if (fromColIdx === toColIdx && originalIdx < toTaskIdx) insertIdx -= 1;

  const next = columns.map((c) => ({ ...c, tasks: [...c.tasks] }));
  next[fromColIdx].tasks = next[fromColIdx].tasks.filter((t) => t._id !== activeId);
  next[toColIdx].tasks.splice(insertIdx, 0, activeTask);

  return {
    columns: next,
    boardColumnId: next[toColIdx].id,
    // "goes after" the task now sitting just above it, "goes before" the one just below.
    afterTaskId: next[toColIdx].tasks[insertIdx - 1]?._id,
    beforeTaskId: next[toColIdx].tasks[insertIdx + 1]?._id,
  };
}

export function BoardView({ initialColumns }: { initialColumns: BoardColumn[] }) {
  const router = useRouter();
  const [columns, setColumns] = useState(initialColumns);
  const [activeTask, setActiveTask] = useState<BoardTask | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function handleDragStart(event: DragStartEvent) {
    const id = event.active.id.toString();
    const col = columns.find((c) => c.tasks.some((t) => t._id === id));
    setActiveTask(col?.tasks.find((t) => t._id === id) ?? null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const result = moveTask(columns, active.id.toString(), over.id.toString());
    if (!result) return;

    setColumns(result.columns);

    const res = await fetch(`/api/v1/tasks/${active.id}/board-position`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        boardColumnId: result.boardColumnId,
        afterTaskId: result.afterTaskId,
        beforeTaskId: result.beforeTaskId,
      }),
    });
    // Optimistic order can drift from the server's fractional math (or a
    // stale drop target); resync from the source of truth on any mismatch.
    if (!res.ok) router.refresh();
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <h1 className="text-xl font-semibold">Flow Board</h1>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid flex-1 grid-cols-3 gap-4 overflow-x-auto">
          {columns.map((col) => (
            <BoardColumnView key={col.id} column={col} />
          ))}
        </div>
        <DragOverlay>{activeTask && <BoardCard task={activeTask} overlay />}</DragOverlay>
      </DndContext>
    </div>
  );
}

function BoardColumnView({ column }: { column: BoardColumn }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-0 flex-col gap-2 rounded-lg border border-border bg-muted/40 p-3",
        isOver && "ring-2 ring-ring"
      )}
    >
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold">{column.title}</h2>
        <span className="text-xs text-muted-foreground">{column.tasks.length}</span>
      </div>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
        <SortableContext items={column.tasks.map((t) => t._id)} strategy={verticalListSortingStrategy}>
          {column.tasks.map((task) => (
            <SortableBoardCard key={task._id} task={task} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}

function SortableBoardCard({ task }: { task: BoardTask }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task._id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className={isDragging ? "opacity-40" : undefined}
    >
      <BoardCard task={task} />
    </div>
  );
}

function BoardCard({ task, overlay }: { task: BoardTask; overlay?: boolean }) {
  return (
    <div
      className={cn(
        "cursor-grab rounded-md border border-border bg-card p-3 text-sm shadow-sm active:cursor-grabbing",
        overlay && "shadow-lg"
      )}
    >
      <p className="font-medium">{task.title}</p>
      <div className="mt-1.5 flex items-center gap-2">
        {task.priority > 0 && (
          <span className="rounded-full bg-module px-2 py-0.5 text-xs font-medium text-module-foreground">
            {PRIORITY_LABEL[task.priority]}
          </span>
        )}
        {task.dueDate && (
          <span className="text-xs text-muted-foreground">
            {new Date(task.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </span>
        )}
        {task.assigneeName && (
          <span
            className="ml-auto rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground"
            title={`Assigned to ${task.assigneeName}`}
          >
            {task.assigneeName}
          </span>
        )}
      </div>
    </div>
  );
}

import type { BoardColumn } from "@/types/api";

export type DragTarget = { boardColumnId: string; beforeTaskId: string | null; afterTaskId: string | null };

/**
 * Turns an `@hello-pangea/dnd` drop destination into the `{beforeTaskId,
 * afterTaskId}` pair the board-position API expects. Pulled out of onDragEnd
 * so it's testable without simulating real drag pointer events.
 */
export function computeDragTarget(
  columns: BoardColumn[],
  draggableId: string,
  destination: { droppableId: string; index: number }
): DragTarget | null {
  const destColumn = columns.find((c) => c.id === destination.droppableId);
  if (!destColumn) return null;

  const destTasks = destColumn.tasks.filter((t) => t.id !== draggableId);
  const beforeTaskId = destTasks[destination.index - 1]?.id ?? null;
  const afterTaskId = destTasks[destination.index]?.id ?? null;

  return { boardColumnId: destination.droppableId, beforeTaskId, afterTaskId };
}

"use client";

import { useState } from "react";
import useSWR from "swr";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { fetcher, api } from "@/lib/api-client";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useLists } from "@/hooks/useLists";
import { useTaskMutations } from "@/hooks/useTaskMutations";
import { TopNav } from "@/components/layout/TopNav";
import { QuickAddTask } from "@/components/tasks/QuickAddTask";
import { TaskDetailPanel } from "@/components/tasks/TaskDetailPanel";
import { UpgradeGate } from "@/components/billing/UpgradeGate";
import { PRIORITY } from "@/lib/constants";
import type { BoardColumn, TaskItem } from "@/types/api";

function BoardCard({ task, onOpen }: { task: TaskItem; onOpen: () => void }) {
  const priority = PRIORITY[task.priority];
  return (
    <div onClick={onOpen} className="rounded-lg border border-border bg-surface p-3 shadow-sm cursor-pointer hover:shadow-md transition-shadow">
      <p className="text-sm font-medium text-foreground">{task.title}</p>
      <div className="mt-2 flex items-center justify-between">
        <span className="rounded px-1.5 py-0.5 text-[10px] font-medium" style={{ backgroundColor: `${priority.color}20`, color: priority.color }}>
          {priority.label}
        </span>
        {task.dueDate && <span className="text-[11px] text-muted">{new Date(task.dueDate).toLocaleDateString()}</span>}
      </div>
    </div>
  );
}

function FlowBoardContent() {
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id;
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  const { data, mutate } = useSWR<{ columns: BoardColumn[] }>(
    workspaceId ? `/api/v1/workspaces/${workspaceId}/board` : null,
    fetcher
  );
  const { lists } = useLists(workspaceId);
  const { createTask } = useTaskMutations(workspaceId, mutate);

  async function onDragEnd(result: DropResult) {
    const { destination, draggableId } = result;
    if (!destination || !data) return;

    const destColumn = data.columns.find((c) => c.id === destination.droppableId);
    if (!destColumn) return;

    const destTasks = destColumn.tasks.filter((t) => t.id !== draggableId);
    const beforeTaskId = destTasks[destination.index - 1]?.id ?? null;
    const afterTaskId = destTasks[destination.index]?.id ?? null;

    await api.patch(`/api/v1/tasks/${draggableId}/board-position`, {
      boardColumnId: destination.droppableId,
      beforeTaskId,
      afterTaskId,
    });
    await mutate();
  }

  return (
    <div className="flex flex-1 min-h-0">
      <div className="flex-1 flex flex-col min-w-0">
        <TopNav title="Flow Board" />
        <div className="border-b border-border">
          <QuickAddTask lists={lists} onAdd={(title, listId) => createTask({ listId, title })} />
        </div>
        <div className="flex-1 overflow-x-auto p-6">
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex gap-4 h-full">
              {data?.columns.map((col) => (
                <div key={col.id} className="w-72 shrink-0 flex flex-col">
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="text-sm font-semibold text-primary">{col.label}</h3>
                    <span className="text-xs text-muted bg-black/5 rounded-full px-2 py-0.5">{col.tasks.length}</span>
                  </div>
                  <Droppable droppableId={col.id}>
                    {(provided) => (
                      <div ref={provided.innerRef} {...provided.droppableProps} className="flex-1 space-y-2 min-h-[200px]">
                        {col.tasks.map((task, index) => (
                          <Draggable key={task.id} draggableId={task.id} index={index}>
                            {(dragProvided) => (
                              <div ref={dragProvided.innerRef} {...dragProvided.draggableProps} {...dragProvided.dragHandleProps}>
                                <BoardCard task={task} onOpen={() => setOpenTaskId(task.id)} />
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              ))}
            </div>
          </DragDropContext>
        </div>
      </div>

      {openTaskId && <TaskDetailPanel taskId={openTaskId} onClose={() => setOpenTaskId(null)} onChanged={mutate} />}
    </div>
  );
}

export default function FlowBoardPage() {
  return (
    <UpgradeGate feature="flow_board" title="Flow Board">
      <FlowBoardContent />
    </UpgradeGate>
  );
}

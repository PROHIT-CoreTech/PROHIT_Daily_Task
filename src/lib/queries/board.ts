import { connectDb } from "@/lib/db";
import { Task } from "@/lib/models/Task";
import { User } from "@/lib/models/User";

export interface BoardTask {
  _id: string;
  title: string;
  priority: number;
  dueDate?: string;
  assigneeName?: string;
}

export interface BoardColumn {
  id: string;
  title: string;
  tasks: BoardTask[];
}

const DEFAULT_COLUMNS = [
  { id: "todo", title: "To Do" },
  { id: "in_progress", title: "In Progress" },
  { id: "done", title: "Done" },
];

/** Mirrors GET /api/v1/workspaces/:id/board — kept separate since the page
 * renders server-side and the API route stays for any future client fetch.
 * Assignee is denormalised to a name here (display-only, no editing on the
 * board) rather than shipping the full member list just for this badge. */
export async function getBoard(workspaceId: string, listId?: string): Promise<BoardColumn[]> {
  await connectDb();

  const tasks = await Task.find({ workspaceId, ...(listId ? { listId } : {}) })
    .sort({ boardOrder: 1 })
    .select("title priority dueDate boardColumnId status assigneeId")
    .populate({ path: "assigneeId", model: User, select: "name" })
    .lean<
      {
        _id: { toString(): string };
        title: string;
        priority: number;
        dueDate?: Date;
        boardColumnId?: string;
        status: string;
        assigneeId?: { name?: string } | null;
      }[]
    >();

  return DEFAULT_COLUMNS.map((col) => ({
    ...col,
    tasks: tasks
      .filter((t) => (t.boardColumnId ?? t.status) === col.id)
      .map((t) => ({
        _id: t._id.toString(),
        title: t.title,
        priority: t.priority,
        dueDate: t.dueDate ? new Date(t.dueDate).toISOString() : undefined,
        assigneeName: t.assigneeId?.name,
      })),
  }));
}

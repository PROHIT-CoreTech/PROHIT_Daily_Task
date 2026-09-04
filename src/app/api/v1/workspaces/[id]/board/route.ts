import { NextRequest, NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { Task } from "@/lib/models/Task";
import { handle, requireFeature, requireWorkspaceCtx } from "@/lib/api/guard";

type Params = { params: Promise<{ id: string }> };

const DEFAULT_COLUMNS = [
  { id: "todo", title: "To Do" },
  { id: "in_progress", title: "In Progress" },
  { id: "done", title: "Done" },
];

export async function GET(req: NextRequest, { params }: Params) {
  return handle(async () => {
    const { id } = await params;
    const ctx = await requireWorkspaceCtx(id);

    // Flow Board is Pro and above (spec decision D2). The wireframe showed it
    // on Free; the BRD does not.
    requireFeature(ctx, "flow_board");

    const listId = req.nextUrl.searchParams.get("listId");

    await connectDb();
    const tasks = await Task.find({
      workspaceId: ctx.workspaceId,
      ...(listId ? { listId } : {}),
    })
      .sort({ boardOrder: 1 })
      .lean<{ boardColumnId?: string; status: string }[]>();

    const columns = DEFAULT_COLUMNS.map((col) => ({
      ...col,
      tasks: tasks.filter((t) => (t.boardColumnId ?? t.status) === col.id),
    }));

    return NextResponse.json({ columns });
  });
}

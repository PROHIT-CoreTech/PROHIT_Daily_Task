import { NextRequest, NextResponse } from "next/server";
import { withEntitlements, withErrorHandling, requireFeature } from "@/lib/api/middleware";
import { connectToDatabase } from "@/lib/db";
import { Task } from "@/models/Task";
import { BOARD_COLUMNS_DEFAULT } from "@/lib/constants";
import { subDays } from "date-fns";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandling(async () => {
    const { id } = await params;
    const { entitlements } = await withEntitlements(id);
    requireFeature(entitlements, "flow_board");

    const url = new URL(req.url);
    const listId = url.searchParams.get("listId");

    await connectToDatabase();
    // Cards dropped in "done" must stay visible on the board — only drop
    // tasks completed more than 7 days ago, so the column doesn't grow
    // unbounded but a just-completed card doesn't vanish from the drop.
    const filter: Record<string, unknown> = {
      workspaceId: id,
      $or: [{ completedAt: { $exists: false } }, { completedAt: { $gte: subDays(new Date(), 7) } }],
    };
    if (listId) filter.listId = listId;

    const tasks = await Task.find(filter).sort({ boardOrder: 1 }).lean();

    const columns = BOARD_COLUMNS_DEFAULT.map((col) => ({
      id: col.id,
      label: col.label,
      tasks: tasks
        .filter((t) => (t.boardColumnId ?? t.status) === col.id)
        .map((t) => ({ ...t, id: t._id.toString(), _id: undefined })),
    }));

    return NextResponse.json({ columns });
  });
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withErrorHandling } from "@/lib/api/middleware";
import { loadAuthorizedTask } from "@/lib/tasks/load";
import { getEntitlements } from "@/lib/entitlements/service";
import { requireFeature } from "@/lib/api/middleware";
import { connectToDatabase } from "@/lib/db";
import { Task } from "@/models/Task";
import { computeBoardOrder } from "@/lib/tasks/board-order";
import { completeTask } from "@/lib/tasks/complete";

const MoveSchema = z.object({
  boardColumnId: z.string(),
  afterTaskId: z.string().nullable().optional(),
  beforeTaskId: z.string().nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandling(async () => {
    const { id } = await params;
    const { task } = await loadAuthorizedTask(id);
    const entitlements = await getEntitlements(task.workspaceId.toString());
    requireFeature(entitlements, "flow_board");

    const body = MoveSchema.parse(await req.json());
    await connectToDatabase();

    const [afterTask, beforeTask] = await Promise.all([
      body.afterTaskId ? Task.findById(body.afterTaskId).select("boardOrder").lean() : null,
      body.beforeTaskId ? Task.findById(body.beforeTaskId).select("boardOrder").lean() : null,
    ]);

    const boardOrder = await computeBoardOrder(
      task.workspaceId.toString(),
      task.listId.toString(),
      body.boardColumnId,
      beforeTask?.boardOrder ?? null,
      afterTask?.boardOrder ?? null
    );

    task.boardColumnId = body.boardColumnId;
    task.boardOrder = boardOrder;

    // Moving to "done" triggers the same completion + recurrence path as
    // POST /tasks/:id/complete (spec §3) — one code path, two entry points.
    if (body.boardColumnId === "done") {
      await task.save();
      await completeTask(task._id.toString());
    } else {
      task.status = body.boardColumnId === "in_progress" ? "in_progress" : "todo";
      await task.save();
    }

    return NextResponse.json({ ok: true });
  });
}

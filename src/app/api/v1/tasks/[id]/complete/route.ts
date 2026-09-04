import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { Task } from "@/lib/models/Task";
import { ApiError, handle, requireWorkspaceCtx } from "@/lib/api/guard";
import { completeTask, type CompletableTask } from "@/lib/tasks/completion";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  return handle(async () => {
    const { id } = await params;
    if (!Types.ObjectId.isValid(id)) {
      throw new ApiError(400, { error: "invalid_task_id" });
    }

    await connectDb();

    const task = await Task.findById(id).lean<CompletableTask | null>();
    if (!task) throw new ApiError(404, { error: "task_not_found" });

    // Membership check — the task ID alone must not grant access.
    await requireWorkspaceCtx(task.workspaceId.toString());

    const result = await completeTask(task);
    if (result.alreadyComplete) {
      return NextResponse.json({ task, alreadyComplete: true });
    }

    return NextResponse.json({
      ok: true,
      completedAt: result.completedAt,
      nextTask: result.nextTask,
    });
  });
}

import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { z } from "zod";
import { connectDb } from "@/lib/db";
import { Task } from "@/lib/models/Task";
import { ApiError, handle, requireWorkspaceCtx } from "@/lib/api/guard";

type Params = { params: Promise<{ id: string }> };

const CreateSubtask = z.object({
  title: z.string().min(1).max(300),
});

export async function POST(req: NextRequest, { params }: Params) {
  return handle(async () => {
    const { id } = await params;
    if (!Types.ObjectId.isValid(id)) throw new ApiError(400, { error: "invalid_task_id" });

    await connectDb();
    const task = await Task.findById(id).lean<{
      workspaceId: Types.ObjectId;
      subtasks: { order: number }[];
    } | null>();
    if (!task) throw new ApiError(404, { error: "task_not_found" });

    await requireWorkspaceCtx(task.workspaceId.toString());

    const parsed = CreateSubtask.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation_failed", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const subtask = {
      _id: new Types.ObjectId(),
      title: parsed.data.title,
      done: false,
      order: task.subtasks.length,
    };

    await Task.updateOne({ _id: id }, { $push: { subtasks: subtask } });

    return NextResponse.json({ subtask }, { status: 201 });
  });
}

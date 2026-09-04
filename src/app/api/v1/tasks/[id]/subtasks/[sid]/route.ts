import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { z } from "zod";
import { connectDb } from "@/lib/db";
import { Task } from "@/lib/models/Task";
import { ApiError, handle, requireWorkspaceCtx } from "@/lib/api/guard";

type Params = { params: Promise<{ id: string; sid: string }> };

async function authorize(id: string, sid: string) {
  if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(sid)) {
    throw new ApiError(400, { error: "invalid_id" });
  }
  await connectDb();
  const task = await Task.findOne({ _id: id, "subtasks._id": sid }).lean<{
    workspaceId: Types.ObjectId;
  } | null>();
  if (!task) throw new ApiError(404, { error: "subtask_not_found" });

  await requireWorkspaceCtx(task.workspaceId.toString());
}

const UpdateSubtask = z.object({
  title: z.string().min(1).max(300).optional(),
  done: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  return handle(async () => {
    const { id, sid } = await params;
    await authorize(id, sid);

    const parsed = UpdateSubtask.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation_failed", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const set: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(parsed.data)) {
      set[`subtasks.$.${key}`] = value;
    }

    if (Object.keys(set).length) {
      await Task.updateOne({ _id: id, "subtasks._id": sid }, { $set: set });
    }

    const task = await Task.findOne({ _id: id }, { subtasks: 1 }).lean<{
      subtasks: { _id: Types.ObjectId }[];
    } | null>();
    const subtask = task?.subtasks.find((s) => s._id.toString() === sid);

    return NextResponse.json({ subtask });
  });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  return handle(async () => {
    const { id, sid } = await params;
    await authorize(id, sid);

    await Task.updateOne({ _id: id }, { $pull: { subtasks: { _id: sid } } });

    return NextResponse.json({ ok: true });
  });
}

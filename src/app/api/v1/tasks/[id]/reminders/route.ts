import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { z } from "zod";
import { connectDb } from "@/lib/db";
import { Task } from "@/lib/models/Task";
import { ApiError, handle, requireLimit, requireWorkspaceCtx } from "@/lib/api/guard";

type Params = { params: Promise<{ id: string }> };

const CreateReminder = z.object({
  remindAt: z.string().datetime(),
});

export async function POST(req: NextRequest, { params }: Params) {
  return handle(async () => {
    const { id } = await params;
    if (!Types.ObjectId.isValid(id)) throw new ApiError(400, { error: "invalid_task_id" });

    await connectDb();
    const task = await Task.findById(id).lean<{
      workspaceId: Types.ObjectId;
      reminders: unknown[];
    } | null>();
    if (!task) throw new ApiError(404, { error: "task_not_found" });

    const ctx = await requireWorkspaceCtx(task.workspaceId.toString());

    const parsed = CreateReminder.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation_failed", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    requireLimit(ctx, "maxRemindersPerTask", task.reminders.length);

    const reminder = {
      _id: new Types.ObjectId(),
      remindAt: new Date(parsed.data.remindAt),
      channel: "email" as const,
    };

    await Task.updateOne({ _id: id }, { $push: { reminders: reminder } });

    return NextResponse.json({ reminder }, { status: 201 });
  });
}

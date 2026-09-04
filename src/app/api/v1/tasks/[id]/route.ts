import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { z } from "zod";
import { connectDb } from "@/lib/db";
import { Task } from "@/lib/models/Task";
import { Workspace } from "@/lib/models/Workspace";
import { ApiError, handle, requireWorkspaceCtx, type Ctx } from "@/lib/api/guard";

type Params = { params: Promise<{ id: string }> };

async function loadTaskAndAuthorize(id: string) {
  if (!Types.ObjectId.isValid(id)) throw new ApiError(400, { error: "invalid_task_id" });

  await connectDb();
  const task = await Task.findById(id).lean<{ workspaceId: Types.ObjectId } | null>();
  if (!task) throw new ApiError(404, { error: "task_not_found" });

  // Membership check — the task ID alone must not grant access.
  const ctx = await requireWorkspaceCtx(task.workspaceId.toString());
  return { task, ctx };
}

export async function GET(_req: NextRequest, { params }: Params) {
  return handle(async () => {
    const { id } = await params;
    await loadTaskAndAuthorize(id);

    const task = await Task.findById(id).lean();
    return NextResponse.json({ task });
  });
}

const UpdateTask = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(10000).nullable().optional(),
  priority: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]).optional(),
  dueDate: z.string().datetime().nullable().optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  assigneeId: z
    .string()
    .refine(Types.ObjectId.isValid, "invalid assigneeId")
    .nullable()
    .optional(),
});

/** A task can only be assigned to a current member of its own workspace. */
async function assertValidAssignee(ctx: Ctx, assigneeId: string): Promise<void> {
  const isMember = await Workspace.exists({
    _id: ctx.workspaceId,
    "members.userId": assigneeId,
  });
  if (!isMember) throw new ApiError(400, { error: "assignee_not_a_member" });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  return handle(async () => {
    const { id } = await params;
    const { ctx } = await loadTaskAndAuthorize(id);

    const parsed = UpdateTask.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation_failed", issues: parsed.error.issues },
        { status: 400 }
      );
    }
    const { dueDate, assigneeId, ...rest } = parsed.data;

    if (assigneeId) await assertValidAssignee(ctx, assigneeId);

    // Status/completedAt deliberately excluded — those transitions only
    // happen through POST /complete and PATCH /board-position, which also
    // touch boardColumnId and recurrence. A generic PATCH bypassing that
    // would let a client set status: "done" without those side effects.
    const update: Record<string, unknown> = { ...rest };
    if (dueDate !== undefined) update.dueDate = dueDate ? new Date(dueDate) : null;
    if (assigneeId !== undefined) update.assigneeId = assigneeId;

    await Task.updateOne({ _id: id }, { $set: update });
    const task = await Task.findById(id).lean();

    return NextResponse.json({ task });
  });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  return handle(async () => {
    const { id } = await params;
    await loadTaskAndAuthorize(id);

    await Task.deleteOne({ _id: id });
    return NextResponse.json({ ok: true });
  });
}

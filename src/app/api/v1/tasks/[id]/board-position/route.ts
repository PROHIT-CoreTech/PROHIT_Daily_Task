import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { z } from "zod";
import { connectDb } from "@/lib/db";
import { Task } from "@/lib/models/Task";
import { ApiError, handle, requireFeature, requireWorkspaceCtx } from "@/lib/api/guard";
import { midpoint, needsRenormalise, renormalise } from "@/lib/utils/boardOrder";
import { completeTask, uncompleteTask, type CompletableTask } from "@/lib/tasks/completion";

type Params = { params: Promise<{ id: string }> };

const Move = z.object({
  boardColumnId: z.enum(["todo", "in_progress", "done"]),
  afterTaskId: z.string().optional(),
  beforeTaskId: z.string().optional(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  return handle(async () => {
    const { id } = await params;
    if (!Types.ObjectId.isValid(id)) {
      throw new ApiError(400, { error: "invalid_task_id" });
    }

    const parsed = Move.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation_failed", issues: parsed.error.issues },
        { status: 400 }
      );
    }
    const { boardColumnId, afterTaskId, beforeTaskId } = parsed.data;

    await connectDb();
    const task = await Task.findById(id).lean<{
      _id: Types.ObjectId;
      workspaceId: Types.ObjectId;
      listId: Types.ObjectId;
    } | null>();
    if (!task) throw new ApiError(404, { error: "task_not_found" });

    const ctx = await requireWorkspaceCtx(task.workspaceId.toString());
    requireFeature(ctx, "flow_board");

    // The server computes the midpoint rather than trusting a client float.
    const [after, before] = await Promise.all([
      afterTaskId ? Task.findById(afterTaskId).select("boardOrder").lean<{ boardOrder: number } | null>() : null,
      beforeTaskId ? Task.findById(beforeTaskId).select("boardOrder").lean<{ boardOrder: number } | null>() : null,
    ]);

    const newOrder = midpoint(after?.boardOrder, before?.boardOrder);

    if (boardColumnId === "done") {
      // Same completion path as the checkbox (POST /complete) — one
      // implementation of "what happens when a task completes", reachable
      // from both entry points, recurrence included.
      const full = await Task.findById(id).lean<CompletableTask | null>();
      if (full) await completeTask(full);
      await Task.updateOne({ _id: task._id }, { $set: { boardOrder: newOrder } });
    } else {
      await uncompleteTask(task._id);
      await Task.updateOne(
        { _id: task._id },
        { $set: { boardColumnId, boardOrder: newOrder, status: boardColumnId } }
      );
    }

    // Floats lose precision after ~50 subdivisions. Respace the column when
    // the gap gets too small. Cheap here; move to a background job at scale.
    let renormalised = false;
    if (needsRenormalise(after?.boardOrder, before?.boardOrder)) {
      const siblings = await Task.find({
        workspaceId: ctx.workspaceId,
        listId: task.listId,
        boardColumnId,
      })
        .sort({ boardOrder: 1 })
        .select("_id")
        .lean<{ _id: Types.ObjectId }[]>();

      const spaced = renormalise(siblings.length);
      await Promise.all(
        siblings.map((s, i) =>
          Task.updateOne({ _id: s._id }, { $set: { boardOrder: spaced[i] } })
        )
      );
      renormalised = true;
    }

    return NextResponse.json({ ok: true, boardOrder: newOrder, renormalised });
  });
}

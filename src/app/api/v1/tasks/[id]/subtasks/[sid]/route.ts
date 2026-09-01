import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withErrorHandling, ApiError } from "@/lib/api/middleware";
import { loadAuthorizedTask } from "@/lib/tasks/load";

const PatchSubtaskSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  done: z.boolean().optional(),
  order: z.number().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; sid: string }> }) {
  return withErrorHandling(async () => {
    const { id, sid } = await params;
    const { task } = await loadAuthorizedTask(id);
    const body = PatchSubtaskSchema.parse(await req.json());

    const subtask = task.subtasks.id(sid);
    if (!subtask) throw new ApiError(404, { error: "not_found", message: "Subtask not found." });

    if (body.title !== undefined) subtask.title = body.title;
    if (body.done !== undefined) subtask.done = body.done;
    if (body.order !== undefined) subtask.order = body.order;
    await task.save();

    return NextResponse.json({ ok: true });
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; sid: string }> }) {
  return withErrorHandling(async () => {
    const { id, sid } = await params;
    const { task } = await loadAuthorizedTask(id);

    const subtask = task.subtasks.id(sid);
    if (!subtask) throw new ApiError(404, { error: "not_found", message: "Subtask not found." });
    subtask.deleteOne();
    await task.save();

    return NextResponse.json({ ok: true });
  });
}

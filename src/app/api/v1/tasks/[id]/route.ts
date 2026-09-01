import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withErrorHandling } from "@/lib/api/middleware";
import { loadAuthorizedTask } from "@/lib/tasks/load";

const PatchTaskSchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  description: z.string().trim().max(5000).optional(),
  listId: z.string().optional(),
  status: z.enum(["todo", "in_progress", "done"]).optional(),
  priority: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]).optional(),
  dueDate: z.string().datetime().nullable().optional(),
  tags: z.array(z.string().trim().max(40)).optional(),
  assigneeId: z.string().nullable().optional(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandling(async () => {
    const { id } = await params;
    const { task } = await loadAuthorizedTask(id);
    return NextResponse.json({ task: { ...task.toObject(), id: task._id.toString() } });
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandling(async () => {
    const { id } = await params;
    const { task } = await loadAuthorizedTask(id);
    const body = PatchTaskSchema.parse(await req.json());

    if (body.title !== undefined) task.title = body.title;
    if (body.description !== undefined) task.description = body.description;
    if (body.listId !== undefined) task.listId = body.listId as unknown as typeof task.listId;
    if (body.status !== undefined) task.status = body.status;
    if (body.priority !== undefined) task.priority = body.priority;
    if (body.dueDate !== undefined) task.dueDate = body.dueDate ? new Date(body.dueDate) : undefined;
    if (body.tags !== undefined) task.tags = body.tags;
    if (body.assigneeId !== undefined)
      task.assigneeId = body.assigneeId ? (body.assigneeId as unknown as typeof task.assigneeId) : undefined;

    await task.save();
    return NextResponse.json({ ok: true });
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandling(async () => {
    const { id } = await params;
    const { task } = await loadAuthorizedTask(id);
    await task.deleteOne();
    return NextResponse.json({ ok: true });
  });
}

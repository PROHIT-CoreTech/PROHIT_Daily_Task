import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withErrorHandling } from "@/lib/api/middleware";
import { loadAuthorizedTask } from "@/lib/tasks/load";

const CreateSubtaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandling(async () => {
    const { id } = await params;
    const { task } = await loadAuthorizedTask(id);
    const body = CreateSubtaskSchema.parse(await req.json());

    task.subtasks.push({ title: body.title, done: false, order: task.subtasks.length });
    await task.save();

    return NextResponse.json({ ok: true }, { status: 201 });
  });
}

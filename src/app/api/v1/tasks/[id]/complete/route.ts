import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api/middleware";
import { loadAuthorizedTask } from "@/lib/tasks/load";
import { completeTask } from "@/lib/tasks/complete";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandling(async () => {
    const { id } = await params;
    await loadAuthorizedTask(id); // authorization check
    const task = await completeTask(id);
    return NextResponse.json({ ok: true, taskId: task?._id.toString() });
  });
}

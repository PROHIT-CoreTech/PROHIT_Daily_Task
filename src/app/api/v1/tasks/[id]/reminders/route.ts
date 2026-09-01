import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withErrorHandling, requireLimit } from "@/lib/api/middleware";
import { loadAuthorizedTask } from "@/lib/tasks/load";
import { getEntitlements } from "@/lib/entitlements/service";

const CreateReminderSchema = z.object({
  remindAt: z.string().datetime(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withErrorHandling(async () => {
    const { id } = await params;
    const { task } = await loadAuthorizedTask(id);
    const body = CreateReminderSchema.parse(await req.json());

    const entitlements = await getEntitlements(task.workspaceId.toString());
    requireLimit(entitlements, "maxRemindersPerTask", task.reminders.length);

    task.reminders.push({ remindAt: new Date(body.remindAt), channel: "email" });
    await task.save();

    return NextResponse.json({ ok: true }, { status: 201 });
  });
}

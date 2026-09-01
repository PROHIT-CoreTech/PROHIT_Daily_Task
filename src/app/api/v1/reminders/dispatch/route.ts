import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db";
import { Task } from "@/models/Task";
import { User } from "@/models/User";
import { sendMail, reminderEmail } from "@/lib/mailer";

/**
 * Meant to be invoked every 5 minutes by an external cron (Vercel Cron,
 * GitHub Actions, cron-job.org, ...) with `Authorization: Bearer
 * REMINDER_DISPATCH_SECRET`. Sets `sentAt` before dispatching — a reminder
 * that silently fails to send is a smaller failure than one that sends six
 * times because the cron overlapped (spec §5).
 */
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.REMINDER_DISPATCH_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  await connectToDatabase();

  const now = new Date();
  const tasks = await Task.find({
    "reminders.remindAt": { $lte: now },
    "reminders.sentAt": { $exists: false },
    completedAt: { $exists: false },
  }).limit(200);

  let sent = 0;

  for (const task of tasks) {
    const due = task.reminders.filter((r) => r.remindAt <= now && !r.sentAt);
    if (!due.length) continue;

    // Mark sent before dispatching (spec §5's "send once, not six times" rule).
    due.forEach((r) => {
      r.sentAt = new Date();
    });
    await task.save();

    const assignee = await User.findById(task.assigneeId ?? task.createdBy).lean();
    if (!assignee) continue;

    const { subject, html } = reminderEmail(task.title, task.dueDate);
    try {
      await sendMail(assignee.email, subject, html);
      sent += due.length;
    } catch (err) {
      console.error(`[reminders] failed to send for task ${task._id}`, err);
    }
  }

  return NextResponse.json({ ok: true, checked: tasks.length, sent });
}

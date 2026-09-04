import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDb } from "@/lib/db";
import { Task } from "@/lib/models/Task";
import { User } from "@/lib/models/User";
import { sendReminderEmail } from "@/lib/mail";

/**
 * Meant to be hit every 5 minutes by an external scheduler — Vercel Cron
 * (vercel.json `crons`), Railway's scheduled jobs, or a plain cron-job.org
 * ping. This app has no long-running process of its own to host a cron
 * inside, so the trigger has to come from outside; this route is what it
 * calls. Auth is a shared secret, not a session — nothing here is a user.
 */
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // fail closed if it isn't configured at all

  const authHeader = req.headers.get("authorization");
  if (authHeader === `Bearer ${secret}`) return true;

  return req.nextUrl.searchParams.get("secret") === secret;
}

interface ReminderSubdoc {
  _id: Types.ObjectId;
  remindAt: Date;
  sentAt?: Date;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  await connectDb();
  const now = new Date();

  const tasks = await Task.find({
    "reminders.remindAt": { $lte: now },
    "reminders.sentAt": { $exists: false },
    completedAt: { $exists: false },
  })
    .select("title assigneeId createdBy reminders")
    .populate([
      { path: "assigneeId", model: User, select: "email" },
      { path: "createdBy", model: User, select: "email" },
    ])
    .lean<
      {
        _id: Types.ObjectId;
        title: string;
        assigneeId?: { email: string } | null;
        createdBy: { email: string };
        reminders: ReminderSubdoc[];
      }[]
    >();

  let remindersSent = 0;

  for (const task of tasks) {
    const dueIds = task.reminders
      .filter((r) => !r.sentAt && r.remindAt.getTime() <= now.getTime())
      .map((r) => r._id);
    if (!dueIds.length) continue;

    // Marked sent before dispatching: a reminder that fails to send is a
    // smaller failure than one that fires repeatedly because this cron
    // overlapped with the next run.
    await Task.updateOne(
      { _id: task._id },
      { $set: { "reminders.$[r].sentAt": now } },
      { arrayFilters: [{ "r._id": { $in: dueIds } }] }
    );

    const recipient = task.assigneeId ?? task.createdBy;
    if (recipient?.email) {
      await sendReminderEmail({ to: recipient.email, taskTitle: task.title }).catch((err) =>
        console.error("[cron/reminders] failed to send", err)
      );
      remindersSent += dueIds.length;
    }
  }

  return NextResponse.json({ ok: true, tasksProcessed: tasks.length, remindersSent });
}

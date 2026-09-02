import { connectToDatabase } from "@/lib/db";
import { Task } from "@/models/Task";
import { CalendarConnection } from "@/models/CalendarConnection";
import { getEntitlements } from "@/lib/entitlements/service";
import { upsertTaskEvent, deleteTaskEvent } from "./google";

/**
 * Syncs one task to its creator's connected Google Calendar, if any.
 * Fire-and-forget from the caller's perspective — swallows all errors
 * (logged, and recorded on the connection) so a calendar hiccup never
 * fails the task mutation that triggered it.
 *
 * Scope decision: syncs to the task *creator's* calendar only, not every
 * assignee's — a team task with 5 assignees would otherwise need 5
 * separate connections managed correctly. Documented, not silently cut.
 */
export async function syncTaskToCalendar(taskId: string): Promise<void> {
  try {
    await connectToDatabase();
    const task = await Task.findById(taskId);
    if (!task) return;

    const entitlements = await getEntitlements(task.workspaceId.toString());
    if (!entitlements.features.calendar_bridge) return;

    const connection = await CalendarConnection.findOne({
      workspaceId: task.workspaceId,
      userId: task.createdBy,
    }).select("+accessToken +refreshToken");
    if (!connection) return;

    const shouldHaveEvent = Boolean(task.dueDate) && !task.completedAt;

    if (!shouldHaveEvent) {
      await removeTaskFromCalendar(taskId);
      return;
    }

    const eventId = await upsertTaskEvent(
      connection,
      { title: task.title, description: task.description ?? undefined, dueDate: task.dueDate! },
      task.googleCalendarEventId ?? undefined
    );

    task.googleCalendarEventId = eventId;
    await task.save();

    connection.lastSyncedAt = new Date();
    connection.lastSyncError = undefined;
    await connection.save();
  } catch (err) {
    console.error(`[calendar-bridge] sync failed for task ${taskId}`, err);
    await recordSyncError(taskId, err);
  }
}

/** Removes the calendar event for a task (due date cleared, task completed, or task deleted). */
export async function removeTaskFromCalendar(taskId: string): Promise<void> {
  try {
    await connectToDatabase();
    const task = await Task.findById(taskId);
    if (!task?.googleCalendarEventId) return;

    const connection = await CalendarConnection.findOne({
      workspaceId: task.workspaceId,
      userId: task.createdBy,
    }).select("+accessToken +refreshToken");
    if (!connection) return;

    await deleteTaskEvent(connection, task.googleCalendarEventId);
    task.googleCalendarEventId = undefined;
    await task.save();
  } catch (err) {
    console.error(`[calendar-bridge] remove failed for task ${taskId}`, err);
    await recordSyncError(taskId, err);
  }
}

async function recordSyncError(taskId: string, err: unknown) {
  try {
    const task = await Task.findById(taskId).lean();
    if (!task) return;
    await CalendarConnection.updateOne(
      { workspaceId: task.workspaceId, userId: task.createdBy },
      { lastSyncError: err instanceof Error ? err.message : "Unknown sync error" }
    );
  } catch {
    // Best-effort diagnostics only — never let this throw into the caller.
  }
}

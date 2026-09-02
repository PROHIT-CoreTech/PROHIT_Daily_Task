import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/mailer", () => ({
  sendMail: vi.fn().mockResolvedValue(undefined),
  reminderEmail: vi.fn((title: string) => ({ subject: `Sticky Alert: ${title}`, html: "" })),
}));

import { sendMail } from "@/lib/mailer";
import { setupTestDb, clearTestDb, teardownTestDb } from "@/test/db";
import { createUser, createWorkspace, createList } from "@/test/factories";
import { Task } from "@/models/Task";
import { POST } from "./route";

const SECRET = "test-reminder-secret"; // matches vitest.config.ts

function dispatchRequest(bearer?: string) {
  const headers = new Headers();
  if (bearer !== undefined) headers.set("authorization", bearer);
  return new NextRequest("http://localhost:3000/api/v1/reminders/dispatch", { method: "POST", headers });
}

beforeAll(async () => {
  await setupTestDb();
});
afterAll(async () => {
  await teardownTestDb();
});
beforeEach(async () => {
  await clearTestDb();
  vi.clearAllMocks();
});

describe("POST /api/v1/reminders/dispatch", () => {
  it("rejects a missing or wrong bearer token with 401, sending no mail", async () => {
    const missing = await POST(dispatchRequest());
    expect(missing.status).toBe(401);

    const wrong = await POST(dispatchRequest("Bearer not-the-secret"));
    expect(wrong.status).toBe(401);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("dispatches due, unsent reminders on incomplete tasks and marks sentAt", async () => {
    const owner = await createUser();
    const workspace = await createWorkspace(owner, { plan: "pro" });
    const list = await createList(workspace._id, owner);
    const past = new Date(Date.now() - 60_000);
    const future = new Date(Date.now() + 3_600_000);

    const due = await Task.create({
      workspaceId: workspace._id,
      listId: list._id,
      title: "Due task",
      createdBy: owner._id,
      reminders: [{ remindAt: past, channel: "email" }, { remindAt: future, channel: "email" }],
    });

    const res = await POST(dispatchRequest(`Bearer ${SECRET}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sent).toBe(1); // only the past reminder was due

    expect(sendMail).toHaveBeenCalledTimes(1); // one email per task, not per reminder

    const updated = await Task.findById(due._id).lean();
    const [dueReminder, futureReminder] = updated!.reminders;
    expect(dueReminder.sentAt).toBeDefined();
    expect(futureReminder.sentAt).toBeUndefined();
  });

  it("is idempotent: a second dispatch call doesn't resend the same reminder", async () => {
    const owner = await createUser();
    const workspace = await createWorkspace(owner, { plan: "pro" });
    const list = await createList(workspace._id, owner);
    await Task.create({
      workspaceId: workspace._id,
      listId: list._id,
      title: "Due task",
      createdBy: owner._id,
      reminders: [{ remindAt: new Date(Date.now() - 60_000), channel: "email" }],
    });

    await POST(dispatchRequest(`Bearer ${SECRET}`));
    expect(sendMail).toHaveBeenCalledTimes(1);

    const second = await POST(dispatchRequest(`Bearer ${SECRET}`));
    const body = await second.json();
    expect(body.sent).toBe(0);
    expect(sendMail).toHaveBeenCalledTimes(1); // still 1, not resent
  });

  it("skips reminders on already-completed tasks", async () => {
    const owner = await createUser();
    const workspace = await createWorkspace(owner, { plan: "pro" });
    const list = await createList(workspace._id, owner);
    await Task.create({
      workspaceId: workspace._id,
      listId: list._id,
      title: "Completed task",
      createdBy: owner._id,
      completedAt: new Date(),
      reminders: [{ remindAt: new Date(Date.now() - 60_000), channel: "email" }],
    });

    const res = await POST(dispatchRequest(`Bearer ${SECRET}`));
    const body = await res.json();
    expect(body.sent).toBe(0);
    expect(sendMail).not.toHaveBeenCalled();
  });
});

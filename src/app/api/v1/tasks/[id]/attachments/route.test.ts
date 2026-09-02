import { describe, it, expect, beforeAll, afterAll, beforeEach, vi, type Mock } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/lib/auth";
import { setupTestDb, clearTestDb, teardownTestDb } from "@/test/db";
import { createUser, createWorkspace, createList, createTask } from "@/test/factories";
import { Task } from "@/models/Task";
import { POST } from "./route";

function loginAs(userId: string) {
  (auth as unknown as Mock).mockResolvedValue({ user: { id: userId } });
}

function postRequest(taskId: string, body: unknown) {
  return new NextRequest(`http://localhost:3000/api/v1/tasks/${taskId}/attachments`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
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

describe("POST /api/v1/tasks/[id]/attachments", () => {
  it("returns a presigned upload URL and registers the attachment on the task", async () => {
    const owner = await createUser();
    const workspace = await createWorkspace(owner, { plan: "pro" });
    const list = await createList(workspace._id, owner);
    const task = await createTask(workspace._id, list._id, owner);
    loginAs(owner._id.toString());

    const res = await POST(postRequest(task._id.toString(), { filename: "notes.pdf", contentType: "application/pdf", sizeBytes: 1024 }), {
      params: Promise.resolve({ id: task._id.toString() }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.uploadUrl).toContain("https://");
    expect(body.publicUrl).toContain("notes.pdf");

    const updated = await Task.findById(task._id).lean();
    expect(updated!.attachments).toHaveLength(1);
    expect(updated!.attachments[0].filename).toBe("notes.pdf");
  });

  it("rejects on the Free plan (unlimited_attachments off) with 402 entitlement_required", async () => {
    const owner = await createUser();
    const workspace = await createWorkspace(owner, { plan: "free" });
    const list = await createList(workspace._id, owner);
    const task = await createTask(workspace._id, list._id, owner);
    loginAs(owner._id.toString());

    const res = await POST(postRequest(task._id.toString(), { filename: "notes.pdf", contentType: "application/pdf", sizeBytes: 1024 }), {
      params: Promise.resolve({ id: task._id.toString() }),
    });
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error).toBe("entitlement_required");
    expect(body.feature).toBe("unlimited_attachments");
  });

  it("rejects a file exceeding maxAttachmentMb (Pro = 100MB) with 402 limit_exceeded", async () => {
    const owner = await createUser();
    const workspace = await createWorkspace(owner, { plan: "pro" });
    const list = await createList(workspace._id, owner);
    const task = await createTask(workspace._id, list._id, owner);
    loginAs(owner._id.toString());

    const tooLarge = 101 * 1024 * 1024;
    const res = await POST(postRequest(task._id.toString(), { filename: "huge.zip", contentType: "application/zip", sizeBytes: tooLarge }), {
      params: Promise.resolve({ id: task._id.toString() }),
    });
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error).toBe("limit_exceeded");
    expect(body.limit).toBe("maxAttachmentMb");

    const updated = await Task.findById(task._id).lean();
    expect(updated!.attachments).toHaveLength(0);
  });
});

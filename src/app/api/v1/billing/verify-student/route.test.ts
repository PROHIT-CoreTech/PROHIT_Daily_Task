import { describe, it, expect, beforeAll, afterAll, beforeEach, vi, type Mock } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/mailer", () => ({
  sendMail: vi.fn().mockResolvedValue(undefined),
  reminderEmail: vi.fn((title: string) => ({ subject: title, html: "" })),
}));

import { auth } from "@/lib/auth";
import { sendMail } from "@/lib/mailer";
import { setupTestDb, clearTestDb, teardownTestDb } from "@/test/db";
import { createUser } from "@/test/factories";
import { POST } from "./route";

function loginAs(userId: string) {
  (auth as unknown as Mock).mockResolvedValue({ user: { id: userId } });
}

function postRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/v1/billing/verify-student", {
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

describe("POST /api/v1/billing/verify-student", () => {
  it("rejects a non-academic email with 400", async () => {
    const user = await createUser();
    loginAs(user._id.toString());

    const res = await POST(postRequest({ collegeEmail: "me@gmail.com" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("not_academic_email");
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("sends a verification email with a confirm link for an academic email", async () => {
    const user = await createUser();
    loginAs(user._id.toString());

    const res = await POST(postRequest({ collegeEmail: "me@college.edu" }));
    expect(res.status).toBe(200);

    expect(sendMail).toHaveBeenCalledTimes(1);
    const [to, , html] = (sendMail as Mock).mock.calls[0];
    expect(to).toBe("me@college.edu");
    expect(html).toContain("/api/v1/billing/verify-student/confirm?token=");
  });
});

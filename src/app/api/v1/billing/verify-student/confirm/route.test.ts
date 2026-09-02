import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { setupTestDb, clearTestDb, teardownTestDb } from "@/test/db";
import { createUser } from "@/test/factories";
import { createVerificationToken } from "@/lib/student-verification";
import { User } from "@/models/User";
import { GET } from "./route";

function getRequest(token?: string) {
  const url = token
    ? `http://localhost:3000/api/v1/billing/verify-student/confirm?token=${token}`
    : "http://localhost:3000/api/v1/billing/verify-student/confirm";
  return new NextRequest(url);
}

beforeAll(async () => {
  await setupTestDb();
});
afterAll(async () => {
  await teardownTestDb();
});
beforeEach(async () => {
  await clearTestDb();
});

describe("GET /api/v1/billing/verify-student/confirm", () => {
  it("sets studentVerification on a valid token and redirects with success", async () => {
    const user = await createUser();
    const token = createVerificationToken(user._id.toString(), "me@college.edu");

    const res = await GET(getRequest(token));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("studentVerification=success");

    const updated = await User.findById(user._id).lean();
    expect(updated!.studentVerification!.collegeEmail).toBe("me@college.edu");
  });

  it("redirects with invalid and writes nothing for a missing token", async () => {
    const user = await createUser();

    const res = await GET(getRequest());
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("studentVerification=invalid");

    const untouched = await User.findById(user._id).lean();
    expect(untouched!.studentVerification).toBeUndefined();
  });

  it("redirects with invalid for a tampered token", async () => {
    const user = await createUser();
    const token = createVerificationToken(user._id.toString(), "me@college.edu");

    const res = await GET(getRequest(token + "tampered"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("studentVerification=invalid");
  });
});

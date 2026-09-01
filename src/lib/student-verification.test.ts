import { describe, it, expect, vi, afterEach } from "vitest";
import { isAcademicEmail, createVerificationToken, verifyVerificationToken } from "./student-verification";

describe("isAcademicEmail", () => {
  it.each(["student@college.edu", "student@iit.ac.in", "student@university.edu.in"])(
    "accepts %s",
    (email) => {
      expect(isAcademicEmail(email)).toBe(true);
    }
  );

  it.each(["person@gmail.com", "person@company.com", "no-at-sign"])("rejects %s", (email) => {
    expect(isAcademicEmail(email)).toBe(false);
  });
});

describe("verification token round-trip", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("a freshly created token verifies back to the same userId/email", () => {
    const token = createVerificationToken("user-123", "student@college.ac.in");
    const result = verifyVerificationToken(token);
    expect(result).toEqual({ userId: "user-123", collegeEmail: "student@college.ac.in" });
  });

  it("rejects a tampered token", () => {
    const token = createVerificationToken("user-123", "student@college.ac.in");
    const tampered = token.slice(0, -4) + "abcd";
    expect(verifyVerificationToken(tampered)).toBeNull();
  });

  it("rejects garbage input without throwing", () => {
    expect(verifyVerificationToken("not-a-real-token")).toBeNull();
    expect(verifyVerificationToken("")).toBeNull();
  });

  it("rejects a token after its 30-minute TTL expires", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const token = createVerificationToken("user-123", "student@college.ac.in");

    vi.setSystemTime(new Date("2026-01-01T00:29:00.000Z")); // 29 min later — still valid
    expect(verifyVerificationToken(token)).not.toBeNull();

    vi.setSystemTime(new Date("2026-01-01T00:31:00.000Z")); // 31 min later — expired
    expect(verifyVerificationToken(token)).toBeNull();
  });
});

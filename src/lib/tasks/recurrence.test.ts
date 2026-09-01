import { describe, it, expect } from "vitest";
import { computeNextDueDate, shouldMaterializeNextInstance } from "./recurrence";

// Monday 2026-03-02
const MONDAY = new Date("2026-03-02T09:00:00.000Z");

function recurrence(overrides: Record<string, unknown> = {}) {
  return {
    freq: "daily",
    interval: 1,
    completionAnchored: false,
    ...overrides,
  } as Parameters<typeof computeNextDueDate>[0];
}

describe("computeNextDueDate", () => {
  it("daily: adds `interval` days from the scheduled date when not completion-anchored", () => {
    const next = computeNextDueDate(recurrence({ freq: "daily", interval: 3 }), MONDAY, new Date("2026-03-10T00:00:00.000Z"));
    expect(next.toISOString()).toBe(new Date("2026-03-05T09:00:00.000Z").toISOString());
  });

  it("daily: anchors on completion date when completionAnchored — 'water plants every 7 days from when I actually did it'", () => {
    const completedLate = new Date("2026-03-06T12:00:00.000Z"); // completed 4 days late
    const next = computeNextDueDate(recurrence({ freq: "daily", interval: 7, completionAnchored: true }), MONDAY, completedLate);
    expect(next.toISOString()).toBe(new Date("2026-03-13T12:00:00.000Z").toISOString());
  });

  it("weekly with no byWeekday: adds `interval` weeks, same weekday", () => {
    const next = computeNextDueDate(recurrence({ freq: "weekly", interval: 2 }), MONDAY, MONDAY);
    expect(next.getDay()).toBe(1); // still Monday
    expect(next.toISOString()).toBe(new Date("2026-03-16T09:00:00.000Z").toISOString());
  });

  it("weekly with byWeekday: 'a Monday standup stays on Mondays even if completed on Wednesday' (spec §1.6)", () => {
    const completedWednesday = new Date("2026-03-04T15:00:00.000Z");
    const next = computeNextDueDate(
      recurrence({ freq: "weekly", interval: 1, byWeekday: [1] }), // Monday = 1
      MONDAY, // scheduled anchor (not completion-anchored)
      completedWednesday
    );
    expect(next.getDay()).toBe(1);
    expect(next.toISOString()).toBe(new Date("2026-03-09T09:00:00.000Z").toISOString());
  });

  it("monthly with byMonthDay: lands on the specified day of the next month", () => {
    const next = computeNextDueDate(recurrence({ freq: "monthly", interval: 1, byMonthDay: 15 }), MONDAY, MONDAY);
    expect(next.getUTCMonth()).toBe(3); // April (0-indexed)
    expect(next.getUTCDate()).toBe(15);
  });

  it("monthly without byMonthDay: same day, `interval` months later", () => {
    const next = computeNextDueDate(recurrence({ freq: "monthly", interval: 1 }), MONDAY, MONDAY);
    expect(next.getUTCDate()).toBe(2);
    expect(next.getUTCMonth()).toBe(3);
  });
});

describe("shouldMaterializeNextInstance", () => {
  it("stops once the next due date passes `until`", async () => {
    const result = await shouldMaterializeNextInstance(
      recurrence({ until: new Date("2026-03-01T00:00:00.000Z") }),
      new Date("2026-03-05T00:00:00.000Z"),
      1
    );
    expect(result).toBe(false);
  });

  it("stops once `count` instances already exist", async () => {
    const result = await shouldMaterializeNextInstance(recurrence({ count: 3 }), new Date("2026-03-05T00:00:00.000Z"), 3);
    expect(result).toBe(false);
  });

  it("continues when neither bound is reached", async () => {
    const result = await shouldMaterializeNextInstance(recurrence({ count: 5 }), new Date("2026-03-05T00:00:00.000Z"), 2);
    expect(result).toBe(true);
  });

  it("continues indefinitely when neither `until` nor `count` is set", async () => {
    const result = await shouldMaterializeNextInstance(recurrence(), new Date("2099-01-01T00:00:00.000Z"), 9999);
    expect(result).toBe(true);
  });
});

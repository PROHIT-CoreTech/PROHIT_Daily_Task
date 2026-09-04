import assert from "node:assert/strict";
import { nextDueDate, type Recurrence } from "../src/lib/utils/recurrence";
import { midpoint, needsRenormalise } from "../src/lib/utils/boardOrder";
import { dateKey, monthGridDays, parseDateKey, weekDays } from "../src/lib/utils/calendarGrid";
import { resolveEntitlements, requiredPlanFor } from "../src/lib/entitlements/matrix";

let passed = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (e) {
    console.log(`  FAIL  ${name}\n        ${(e as Error).message}`);
    process.exitCode = 1;
  }
}

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "null");

console.log("\nRecurrence");

check("daily interval 3 from scheduled date", () => {
  const rec: Recurrence = { freq: "daily", interval: 3, completionAnchored: false };
  const next = nextDueDate(rec, new Date("2026-03-02"), new Date("2026-03-05"));
  assert.equal(iso(next), "2026-03-05");
});

check("completion-anchored uses completion date, not schedule", () => {
  const rec: Recurrence = { freq: "daily", interval: 7, completionAnchored: true };
  const next = nextDueDate(rec, new Date("2026-03-02"), new Date("2026-03-05"));
  assert.equal(iso(next), "2026-03-12");
});

check("weekly standup stays on Monday when ticked late", () => {
  // Scheduled Mon 2 Mar, actually completed Wed 4 Mar. Should land next Monday.
  const rec: Recurrence = {
    freq: "weekly",
    interval: 1,
    byWeekday: [1],
    completionAnchored: false,
  };
  const next = nextDueDate(rec, new Date("2026-03-02"), new Date("2026-03-04"));
  assert.equal(next!.getDay(), 1, "should be a Monday");
  assert.equal(iso(next), "2026-03-09");
});

check("monthly on the 31st clamps to February, not 3 March", () => {
  const rec: Recurrence = {
    freq: "monthly",
    interval: 1,
    byMonthDay: 31,
    completionAnchored: false,
  };
  const next = nextDueDate(rec, new Date("2026-01-31"), new Date("2026-01-31"));
  assert.equal(iso(next), "2026-02-28");
});

check("series ends at count", () => {
  const rec: Recurrence = { freq: "daily", interval: 1, count: 3, completionAnchored: false };
  assert.equal(nextDueDate(rec, new Date("2026-03-01"), new Date("2026-03-01"), 3), null);
  assert.notEqual(nextDueDate(rec, new Date("2026-03-01"), new Date("2026-03-01"), 2), null);
});

check("series ends at until date", () => {
  const rec: Recurrence = {
    freq: "daily",
    interval: 1,
    until: new Date("2026-03-02"),
    completionAnchored: false,
  };
  assert.equal(nextDueDate(rec, new Date("2026-03-02"), new Date("2026-03-02")), null);
});

console.log("\nBoard ordering");

check("midpoint lands between neighbours", () => {
  assert.equal(midpoint(1000, 2000), 1500);
});

check("append and prepend to empty column", () => {
  assert.equal(midpoint(undefined, undefined), 1000);
  assert.equal(midpoint(3000, undefined), 4000);
  assert.equal(midpoint(undefined, 1000), 0);
});

check("repeated subdivision eventually triggers renormalise", () => {
  let lo = 1000;
  const hi = 1001;
  let triggered = false;
  for (let i = 0; i < 60; i++) {
    if (needsRenormalise(lo, hi)) {
      triggered = true;
      break;
    }
    lo = midpoint(lo, hi);
  }
  assert.ok(triggered, "renormalise flag never fired");
});

console.log("\nCalendar grid");

check("dateKey formats using local date components", () => {
  assert.equal(dateKey(new Date(2026, 0, 5)), "2026-01-05");
});

check("parseDateKey round-trips through dateKey", () => {
  assert.equal(dateKey(parseDateKey("2026-03-01")), "2026-03-01");
  // The regression this guards: new Date("2026-03-01") parses as UTC
  // midnight, which reads as Feb 28 locally in any negative-UTC-offset
  // timezone. parseDateKey must not do that.
  assert.equal(parseDateKey("2026-03-01").getMonth(), 2, "March is month index 2");
  assert.equal(parseDateKey("2026-03-01").getDate(), 1);
});

check("month grid for March 2026 (Mon start) pads to full weeks", () => {
  const days = monthGridDays(new Date(2026, 2, 15), 1);
  assert.equal(days.length, 42, "should be 6 full weeks");
  assert.equal(dateKey(days[0]), "2026-02-23", "should lead in from the prior month");
  assert.equal(dateKey(days[days.length - 1]), "2026-04-05", "should trail into the next month");
});

check("month grid respects Sunday-start workspaces", () => {
  const days = monthGridDays(new Date(2026, 2, 15), 0);
  assert.equal(dateKey(days[0]), "2026-03-01", "March 2026 already starts on a Sunday");
});

check("week containing a Wednesday starts on Monday when weekStartsOn=1", () => {
  const days = weekDays(new Date(2026, 2, 4), 1);
  assert.equal(days.length, 7);
  assert.equal(dateKey(days[0]), "2026-03-02", "Monday");
  assert.equal(dateKey(days[6]), "2026-03-08", "Sunday");
});

console.log("\nEntitlements");

check("Free does NOT get Flow Board (spec decision D2)", () => {
  const e = resolveEntitlements("free", "personal");
  assert.equal(e.features.flow_board, false);
  assert.equal(e.limits.maxLists, 5);
  assert.equal(e.limits.maxAttachmentMb, 0);
});

check("Pro unlocks Flow Board and unlimited lists", () => {
  const e = resolveEntitlements("pro", "personal");
  assert.equal(e.features.flow_board, true);
  assert.equal(e.limits.maxLists, -1);
});

check("Student has identical capability to Pro", () => {
  const pro = resolveEntitlements("pro", "personal");
  const stu = resolveEntitlements("pro_student", "personal");
  assert.deepEqual(pro.features, stu.features);
  assert.deepEqual(pro.limits, stu.limits);
});

check("business workspace raises member cap above team", () => {
  assert.equal(resolveEntitlements("team", "team").limits.maxMembers, 10);
  assert.equal(resolveEntitlements("team", "business").limits.maxMembers, 50);
});

check("personal stays single-seat regardless of plan", () => {
  assert.equal(resolveEntitlements("team", "personal").limits.maxMembers, 1);
});

check("deep_work is off on every plan in Phase 1 (D3)", () => {
  for (const p of ["free", "pro", "pro_student", "team"] as const) {
    assert.equal(resolveEntitlements(p, "personal").features.deep_work, false, p);
  }
});

check("AI add-on is never bundled into a base tier", () => {
  assert.equal(resolveEntitlements("team", "business").features.ai_assistant, false);
  assert.equal(
    resolveEntitlements("team", "business", { aiAddon: true }).features.ai_assistant,
    true
  );
});

check("upgrade prompt names the cheapest qualifying plan", () => {
  assert.equal(requiredPlanFor("flow_board"), "pro");
  assert.equal(requiredPlanFor("team_dashboard"), "team");
  assert.equal(requiredPlanFor("deep_work"), null);
});

console.log(`\n${passed} passed\n`);

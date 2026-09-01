import { describe, it, expect } from "vitest";
import { entitlementsFor, PLAN_ALLOWED_TYPES, PLAN_PRICING } from "./matrix";

describe("entitlementsFor", () => {
  it("Free plan matches BRD §9.1 exactly", () => {
    const free = entitlementsFor("free", "personal");
    expect(free.limits).toEqual({
      maxLists: 5,
      maxTasksPerList: 50,
      maxRemindersPerTask: 1,
      maxMembers: 1,
      maxAttachmentMb: 0,
    });
    // Spec §D2: Free does NOT get Flow Board, despite the wireframe's Frame 6 contradiction.
    expect(free.features.flow_board).toBe(false);
    expect(free.features.calendar_week_view).toBe(false);
  });

  it("Pro plan unlocks Flow Board, week view, attachments, multiple reminders, Deep Work Sprint, and Calendar Bridge", () => {
    const pro = entitlementsFor("pro", "personal");
    expect(pro.features.flow_board).toBe(true);
    expect(pro.features.calendar_week_view).toBe(true);
    expect(pro.features.unlimited_attachments).toBe(true);
    expect(pro.features.multiple_reminders).toBe(true);
    expect(pro.features.deep_work).toBe(true);
    expect(pro.features.calendar_bridge).toBe(true);
    expect(pro.limits.maxLists).toBe(-1);
    expect(pro.limits.maxTasksPerList).toBe(-1);
  });

  it("Pro-Student mirrors Pro's entitlements (only pricing differs, handled elsewhere)", () => {
    const pro = entitlementsFor("pro", "personal");
    const proStudent = entitlementsFor("pro_student", "personal");
    expect(proStudent.features).toEqual(pro.features);
    expect(proStudent.limits).toEqual(pro.limits);
  });

  it("Team plan member cap depends on workspace type, not just plan (spec §D1)", () => {
    const team = entitlementsFor("team", "team");
    const business = entitlementsFor("team", "business");
    expect(team.limits.maxMembers).toBe(10);
    expect(business.limits.maxMembers).toBe(50);
  });

  it("Team plan unlocks the team dashboard; Pro does not", () => {
    expect(entitlementsFor("team", "team").features.team_dashboard).toBe(true);
    expect(entitlementsFor("pro", "personal").features.team_dashboard).toBe(false);
  });

  it("Free never unlocks calendar_bridge; ai_assistant is off by default for every plan (it's the separate AI Add-on)", () => {
    expect(entitlementsFor("free", "personal").features.calendar_bridge).toBe(false);
    for (const plan of ["free", "pro", "pro_student", "team"] as const) {
      const type = plan === "team" ? "team" : "personal";
      expect(entitlementsFor(plan, type).features.ai_assistant).toBe(false);
    }
  });
});

describe("PLAN_ALLOWED_TYPES", () => {
  it("only personal workspaces can hold individual plans", () => {
    expect(PLAN_ALLOWED_TYPES.free).toEqual(["personal"]);
    expect(PLAN_ALLOWED_TYPES.pro).toEqual(["personal"]);
    expect(PLAN_ALLOWED_TYPES.pro_student).toEqual(["personal"]);
  });

  it("only team/business workspaces can hold the team plan", () => {
    expect(PLAN_ALLOWED_TYPES.team).toEqual(["team", "business"]);
  });
});

describe("PLAN_PRICING", () => {
  it("matches BRD §9.1 exactly", () => {
    expect(PLAN_PRICING.free).toEqual({ amountInr: 0, interval: "year" });
    expect(PLAN_PRICING.pro).toEqual({ amountInr: 999, interval: "year" });
    expect(PLAN_PRICING.pro_student).toEqual({ amountInr: 499, interval: "year" });
    expect(PLAN_PRICING.team).toEqual({ amountInr: 149, interval: "month" });
  });
});

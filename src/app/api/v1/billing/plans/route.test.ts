import { describe, it, expect, vi } from "vitest";

// billing/plans doesn't call auth() itself, but it imports withErrorHandling
// from @/lib/api/middleware, which imports auth from @/lib/auth
// unconditionally at module scope — that alone is enough to pull in
// next-auth and break under Vitest (see round 1's plan notes), so the mock
// is needed even here.
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { GET } from "./route";

describe("GET /api/v1/billing/plans", () => {
  it("returns all 4 plans with pricing, features, and limits", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.plans.map((p: { plan: string }) => p.plan)).toEqual(["free", "pro", "pro_student", "team"]);

    const pro = body.plans.find((p: { plan: string }) => p.plan === "pro");
    expect(pro.amountInr).toBe(999);
    expect(pro.interval).toBe("year");
    expect(pro.features.flow_board).toBe(true);

    const team = body.plans.find((p: { plan: string }) => p.plan === "team");
    expect(team.amountInr).toBe(149);
    expect(team.interval).toBe("month");
    expect(team.features.team_dashboard).toBe(true);

    const free = body.plans.find((p: { plan: string }) => p.plan === "free");
    expect(free.limits.maxLists).toBe(5);
  });
});

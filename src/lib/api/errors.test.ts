import { describe, it, expect } from "vitest";
import { requireFeature, requireLimit, ApiError } from "./errors";
import { entitlementsFor } from "@/lib/entitlements/matrix";

const free = entitlementsFor("free", "personal");
const pro = entitlementsFor("pro", "personal");

describe("requireFeature", () => {
  it("throws a 402 (not 403) when the feature is off — spec §2.2", () => {
    try {
      requireFeature(free, "flow_board");
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(402);
      expect(apiErr.body.error).toBe("entitlement_required");
      expect(apiErr.body.feature).toBe("flow_board");
      expect(apiErr.body.currentPlan).toBe("free");
    }
  });

  it("does not throw when the feature is on", () => {
    expect(() => requireFeature(pro, "flow_board")).not.toThrow();
  });
});

describe("requireLimit", () => {
  it("throws 402 with limit_exceeded when at the cap", () => {
    try {
      requireLimit(free, "maxLists", 5); // Free cap is 5, current count 5 -> at limit
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(402);
      expect(apiErr.body.error).toBe("limit_exceeded");
      expect(apiErr.body.limit).toBe("maxLists");
      expect(apiErr.body.current).toBe(5);
      expect(apiErr.body.max).toBe(5);
    }
  });

  it("does not throw when under the cap", () => {
    expect(() => requireLimit(free, "maxLists", 4)).not.toThrow();
  });

  it("never throws when the limit is unlimited (-1)", () => {
    expect(() => requireLimit(pro, "maxLists", 100_000)).not.toThrow();
  });
});

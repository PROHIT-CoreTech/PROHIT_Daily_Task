import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { verifyWebhookSignature } from "./razorpay";

// Matches vitest.config.ts's RAZORPAY_WEBHOOK_SECRET
const SECRET = "test-webhook-secret";

function sign(body: string) {
  return crypto.createHmac("sha256", SECRET).update(body).digest("hex");
}

describe("verifyWebhookSignature", () => {
  it("accepts a correctly signed body", () => {
    const body = JSON.stringify({ event: "subscription.charged" });
    expect(verifyWebhookSignature(body, sign(body))).toBe(true);
  });

  it("rejects a body that doesn't match its signature (tampered payload)", () => {
    const original = JSON.stringify({ event: "subscription.charged" });
    const tampered = JSON.stringify({ event: "subscription.cancelled" });
    expect(verifyWebhookSignature(tampered, sign(original))).toBe(false);
  });

  it("rejects a signature signed with the wrong secret", () => {
    const body = JSON.stringify({ event: "subscription.charged" });
    const wrongSignature = crypto.createHmac("sha256", "wrong-secret").update(body).digest("hex");
    expect(verifyWebhookSignature(body, wrongSignature)).toBe(false);
  });

  it("rejects a missing signature", () => {
    expect(verifyWebhookSignature("{}", null)).toBe(false);
  });

  it("rejects a malformed signature without throwing (length mismatch)", () => {
    expect(() => verifyWebhookSignature("{}", "not-a-real-signature")).not.toThrow();
    expect(verifyWebhookSignature("{}", "not-a-real-signature")).toBe(false);
  });
});

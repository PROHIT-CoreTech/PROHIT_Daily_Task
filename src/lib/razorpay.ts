import Razorpay from "razorpay";
import crypto from "crypto";
import type { Plan } from "@/lib/entitlements/matrix";

export const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID ?? "",
  key_secret: process.env.RAZORPAY_KEY_SECRET ?? "",
});

export const RAZORPAY_PLAN_IDS: Partial<Record<Plan, string>> = {
  pro: process.env.RAZORPAY_PLAN_PRO,
  pro_student: process.env.RAZORPAY_PLAN_PRO_STUDENT,
  team: process.env.RAZORPAY_PLAN_TEAM,
};

export const RAZORPAY_PLAN_AI_ADDON = process.env.RAZORPAY_PLAN_AI_ADDON;

/** Verifies the `X-Razorpay-Signature` header against the raw request body. */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET ?? "";
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(signature);
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

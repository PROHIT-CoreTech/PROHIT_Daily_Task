import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const SubscriptionSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, unique: true },
    plan: { type: String, enum: ["free", "pro", "pro_student", "team"], required: true, default: "free" },
    status: { type: String, enum: ["active", "past_due", "cancelled", "expired"], required: true, default: "active" },
    seats: { type: Number, required: true, default: 1 },
    addons: {
      ai: { type: Boolean, default: false }, // Phase 2
      modules: { type: [String], default: [] }, // Phase 3
    },
    razorpay: {
      customerId: { type: String },
      subscriptionId: { type: String },
      planId: { type: String },
      currentPeriodEnd: { type: Date },
      // The AI Add-on is billed as its own Razorpay subscription (a
      // subscription is one plan each in Razorpay) — tracked separately
      // from the base plan subscription above.
      aiSubscriptionId: { type: String },
      aiCurrentPeriodEnd: { type: Date },
    },
    // Idempotency guard against duplicate webhook delivery (spec §4.2)
    processedEvents: { type: [String], default: [] },
  },
  { timestamps: true }
);

SubscriptionSchema.index({ "razorpay.subscriptionId": 1 });
SubscriptionSchema.index({ "razorpay.aiSubscriptionId": 1 });
SubscriptionSchema.index({ processedEvents: 1 });

export type SubscriptionDoc = InferSchemaType<typeof SubscriptionSchema>;

export const Subscription: Model<SubscriptionDoc> =
  models.Subscription ?? model<SubscriptionDoc>("Subscription", SubscriptionSchema);

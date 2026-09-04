import mongoose, { Schema, model, models } from "mongoose";

const SubscriptionSchema = new Schema(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      unique: true,
    },
    plan: {
      type: String,
      enum: ["free", "pro", "pro_student", "team"],
      default: "free",
    },
    status: {
      type: String,
      enum: ["active", "past_due", "cancelled", "expired"],
      default: "active",
    },
    seats: { type: Number, default: 1 },
    addons: {
      ai: { type: Boolean, default: false },
      modules: { type: [String], default: [] },
    },
    razorpay: {
      customerId: String,
      subscriptionId: String,
      planId: String,
      currentPeriodEnd: Date,
    },
    // Razorpay event IDs already applied. Capped at 100 by a $slice on write.
    processedEvents: { type: [String], default: [] },
    // When a past_due subscription loses its grace period and downgrades.
    graceEndsAt: Date,
  },
  { timestamps: true }
);

SubscriptionSchema.index({ "razorpay.subscriptionId": 1 });
SubscriptionSchema.index({ processedEvents: 1 });

export type SubscriptionDoc = mongoose.InferSchemaType<typeof SubscriptionSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Subscription =
  models.Subscription || model("Subscription", SubscriptionSchema);

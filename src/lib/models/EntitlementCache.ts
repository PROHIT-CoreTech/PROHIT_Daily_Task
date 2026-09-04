import mongoose, { Schema, model, models } from "mongoose";

/**
 * The only collection the request path reads to make a gating decision.
 * Written exclusively by recomputeEntitlements(). No API route should ever
 * query Subscription to decide whether a feature is unlocked.
 */
const EntitlementCacheSchema = new Schema(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      unique: true,
    },
    features: {
      flow_board: { type: Boolean, default: false },
      calendar_week_view: { type: Boolean, default: false },
      calendar_bridge: { type: Boolean, default: false },
      unlimited_attachments: { type: Boolean, default: false },
      multiple_reminders: { type: Boolean, default: false },
      deep_work: { type: Boolean, default: false },
      ai_assistant: { type: Boolean, default: false },
      team_dashboard: { type: Boolean, default: false },
    },
    limits: {
      maxLists: { type: Number, default: 5 },
      maxTasksPerList: { type: Number, default: 50 },
      maxRemindersPerTask: { type: Number, default: 1 },
      maxMembers: { type: Number, default: 1 },
      maxAttachmentMb: { type: Number, default: 0 },
    },
    modules: { type: [String], default: [] },
    // Denormalised for UI display and the past_due banner.
    plan: { type: String, default: "free" },
    status: { type: String, default: "active" },
    computedAt: { type: Date, default: Date.now },
    sourceEventId: String,
  },
  { versionKey: false }
);

export const EntitlementCache =
  models.EntitlementCache || model("EntitlementCache", EntitlementCacheSchema);

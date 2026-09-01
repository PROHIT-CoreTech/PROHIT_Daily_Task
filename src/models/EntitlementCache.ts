import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const EntitlementCacheSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, unique: true },
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
      maxLists: { type: Number, required: true },
      maxTasksPerList: { type: Number, required: true },
      maxRemindersPerTask: { type: Number, required: true },
      maxMembers: { type: Number, required: true },
      maxAttachmentMb: { type: Number, required: true },
    },
    modules: { type: [String], default: [] },
    plan: { type: String, required: true },
    status: { type: String, required: true },
    computedAt: { type: Date, required: true, default: Date.now },
    sourceEventId: { type: String },
  },
  { timestamps: true }
);

export type EntitlementCacheDoc = InferSchemaType<typeof EntitlementCacheSchema>;

export const EntitlementCache: Model<EntitlementCacheDoc> =
  models.EntitlementCache ?? model<EntitlementCacheDoc>("EntitlementCache", EntitlementCacheSchema, "entitlements_cache");

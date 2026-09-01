import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

// Deep Work Sprint (BRD nomenclature §10.2 for a Pomodoro-style focus
// timer) — V1.1 fast-follow per BRD §5.2. One document per timer run.
const FocusSessionSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    taskId: { type: Schema.Types.ObjectId, ref: "Task" },
    plannedMinutes: { type: Number, required: true },
    startedAt: { type: Date, required: true, default: Date.now },
    endedAt: { type: Date },
    completed: { type: Boolean, default: false }, // true once it runs the full planned duration
  },
  { timestamps: true }
);

FocusSessionSchema.index({ workspaceId: 1, userId: 1, startedAt: -1 });

export type FocusSessionDoc = InferSchemaType<typeof FocusSessionSchema>;

export const FocusSession: Model<FocusSessionDoc> =
  models.FocusSession ?? model<FocusSessionDoc>("FocusSession", FocusSessionSchema, "focus_sessions");

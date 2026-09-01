import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

// Calendar Bridge (BRD §10.2 nomenclature for "Calendar Subscription") —
// one connection per user per workspace. `accessToken`/`refreshToken` are
// `select: false` so a routine `.lean()` query never accidentally returns
// them to a caller that only needed connection status.
//
// KNOWN SIMPLIFICATION: tokens are stored as plaintext strings, matching
// how this project stores no other credential at rest (Razorpay/Anthropic
// keys live in env vars, never the DB). A production deployment should
// encrypt these at rest (e.g. via a KMS-backed field-level cipher) before
// going live with real users — flagged here rather than silently shipped.
const CalendarConnectionSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    provider: { type: String, enum: ["google"], required: true, default: "google" },
    googleCalendarId: { type: String, required: true, default: "primary" },
    accessToken: { type: String, required: true, select: false },
    refreshToken: { type: String, required: true, select: false },
    tokenExpiresAt: { type: Date, required: true },
    connectedAt: { type: Date, required: true, default: Date.now },
    lastSyncedAt: { type: Date },
    lastSyncError: { type: String },
  },
  { timestamps: true }
);

CalendarConnectionSchema.index({ workspaceId: 1, userId: 1, provider: 1 }, { unique: true });

export type CalendarConnectionDoc = InferSchemaType<typeof CalendarConnectionSchema>;

export const CalendarConnection: Model<CalendarConnectionDoc> =
  models.CalendarConnection ?? model<CalendarConnectionDoc>("CalendarConnection", CalendarConnectionSchema, "calendar_connections");

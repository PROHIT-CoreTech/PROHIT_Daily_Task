import mongoose, { Schema, model, models } from "mongoose";

const InvitationSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    // Owner is assigned only at workspace creation, never via invite.
    role: { type: String, enum: ["admin", "member"], required: true },
    token: { type: String, required: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["pending", "accepted", "revoked"], default: "pending" },
    expiresAt: { type: Date, required: true },
    acceptedAt: Date,
    acceptedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

InvitationSchema.index({ token: 1 }, { unique: true });
// One live invite per email per workspace. Re-inviting refreshes this row
// (new token, new expiry) instead of stacking duplicates that all resolve to
// the same seat.
InvitationSchema.index(
  { workspaceId: 1, email: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } }
);

export type InvitationDoc = mongoose.InferSchemaType<typeof InvitationSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Invitation = models.Invitation || model("Invitation", InvitationSchema);

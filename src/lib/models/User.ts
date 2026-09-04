import mongoose, { Schema, model, models } from "mongoose";

const StudentVerificationSchema = new Schema(
  {
    collegeEmail: { type: String, required: true },
    verifiedAt: { type: Date, required: true },
    // Students graduate. Without an expiry the half-price tier is permanent.
    expiresAt: { type: Date, required: true },
  },
  { _id: false }
);

const UserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true },
    avatarUrl: String,
    emailVerified: Date,
    studentVerification: StudentVerificationSchema,
    defaultWorkspaceId: { type: Schema.Types.ObjectId, ref: "Workspace" },
    // Reminders render in local time; every user is IST today, but hardcoding
    // that breaks on the first user abroad.
    timezone: { type: String, default: "Asia/Kolkata" },
  },
  { timestamps: true }
);

export type UserDoc = mongoose.InferSchemaType<typeof UserSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const User = models.User || model("User", UserSchema);

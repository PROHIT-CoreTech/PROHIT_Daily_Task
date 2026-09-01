import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const StudentVerificationSchema = new Schema(
  {
    collegeEmail: { type: String, required: true },
    verifiedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
  },
  { _id: false }
);

const UserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true },
    passwordHash: { type: String, required: true, select: false },
    avatarUrl: { type: String },
    emailVerified: { type: Date },
    studentVerification: { type: StudentVerificationSchema },
    defaultWorkspaceId: { type: Schema.Types.ObjectId, ref: "Workspace" },
    timezone: { type: String, default: "Asia/Kolkata" },
  },
  { timestamps: true }
);

export type UserDoc = InferSchemaType<typeof UserSchema>;

export const User: Model<UserDoc> = models.User ?? model<UserDoc>("User", UserSchema);

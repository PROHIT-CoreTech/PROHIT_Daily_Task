import mongoose, { Schema, model, models } from "mongoose";

const MemberSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    role: { type: String, enum: ["owner", "admin", "member"], default: "member" },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const WorkspaceSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    // Structure, not billing. Plan lives on the subscription (spec decision D1).
    type: { type: String, enum: ["personal", "team", "business"], required: true },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    members: { type: [MemberSchema], default: [] },
    // Phase 3. Always empty in Phase 1.
    activeModules: { type: [String], default: [] },
    settings: {
      weekStartsOn: { type: Number, enum: [0, 1], default: 1 },
      defaultView: {
        type: String,
        enum: ["my_day", "calendar", "flow_board"],
        default: "my_day",
      },
    },
  },
  { timestamps: true }
);

WorkspaceSchema.index({ ownerId: 1 });
WorkspaceSchema.index({ "members.userId": 1 });

export type WorkspaceDoc = mongoose.InferSchemaType<typeof WorkspaceSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Workspace = models.Workspace || model("Workspace", WorkspaceSchema);

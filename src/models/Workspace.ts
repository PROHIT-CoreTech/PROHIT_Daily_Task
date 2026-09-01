import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const MemberSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    role: { type: String, enum: ["owner", "admin", "member"], required: true },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const WorkspaceSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ["personal", "team", "business"], required: true },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    members: { type: [MemberSchema], default: [] },
    activeModules: { type: [String], default: [] }, // Phase 3, always [] in Phase 1
    settings: {
      weekStartsOn: { type: Number, enum: [0, 1], default: 1 },
      defaultView: { type: String, enum: ["my_day", "calendar", "flow_board"], default: "my_day" },
    },
  },
  { timestamps: true }
);

WorkspaceSchema.index({ ownerId: 1 });
WorkspaceSchema.index({ "members.userId": 1 });

export type WorkspaceDoc = InferSchemaType<typeof WorkspaceSchema>;

export const Workspace: Model<WorkspaceDoc> = models.Workspace ?? model<WorkspaceDoc>("Workspace", WorkspaceSchema);

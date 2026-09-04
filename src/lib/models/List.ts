import mongoose, { Schema, model, models } from "mongoose";

const ListSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
    name: { type: String, required: true, trim: true },
    color: { type: String, default: "#2A9D8F" }, // Emerald Teal (BRD 10.1)
    icon: String,
    order: { type: Number, default: 0 },
    archivedAt: Date,
    // Set when a downgrade pushes this list past the plan's maxLists.
    // Data is never deleted on downgrade, only frozen.
    readOnly: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

ListSchema.index({ workspaceId: 1, archivedAt: 1, order: 1 });

export type ListDoc = mongoose.InferSchemaType<typeof ListSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const List = models.List || model("List", ListSchema);

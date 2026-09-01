import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const ListSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
    name: { type: String, required: true, trim: true },
    color: { type: String, required: true },
    icon: { type: String },
    order: { type: Number, required: true, default: 0 },
    archivedAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

ListSchema.index({ workspaceId: 1, archivedAt: 1, order: 1 });

export type ListDoc = InferSchemaType<typeof ListSchema>;

export const List: Model<ListDoc> = models.List ?? model<ListDoc>("List", ListSchema);

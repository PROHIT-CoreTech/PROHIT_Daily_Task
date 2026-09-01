import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const CommentSchema = new Schema(
  {
    taskId: { type: Schema.Types.ObjectId, ref: "Task", required: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    body: { type: String, required: true, trim: true },
    editedAt: { type: Date },
  },
  { timestamps: true }
);

CommentSchema.index({ taskId: 1, createdAt: 1 });

export type CommentDoc = InferSchemaType<typeof CommentSchema>;

export const Comment: Model<CommentDoc> = models.Comment ?? model<CommentDoc>("Comment", CommentSchema);

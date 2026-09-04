import mongoose, { Schema, model, models } from "mongoose";

const SubtaskSchema = new Schema({
  title: { type: String, required: true, trim: true },
  done: { type: Boolean, default: false },
  order: { type: Number, default: 0 },
});

const ReminderSchema = new Schema({
  remindAt: { type: Date, required: true },
  // Phase 1 is email-only (BRD 5.1). Enum leaves room for push in Phase 4.
  channel: { type: String, enum: ["email"], default: "email" },
  sentAt: Date,
});

const RecurrenceSchema = new Schema(
  {
    freq: { type: String, enum: ["daily", "weekly", "monthly"], required: true },
    interval: { type: Number, default: 1, min: 1 },
    byWeekday: { type: [Number], default: undefined }, // 0=Sun, for weekly
    byMonthDay: Number,
    until: Date,
    count: Number,
    /**
     * false - next instance is derived from the scheduled date. A Monday
     *         standup stays on Mondays even if ticked off on Wednesday.
     * true  - derived from the completion date. "Water plants every 7 days"
     *         means 7 days from when you actually did it.
     */
    completionAnchored: { type: Boolean, default: false },
  },
  { _id: false }
);

const AttachmentSchema = new Schema({
  filename: { type: String, required: true },
  url: { type: String, required: true },
  sizeBytes: { type: Number, required: true },
  uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  uploadedAt: { type: Date, default: Date.now },
});

const TaskSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
    listId: { type: Schema.Types.ObjectId, ref: "List", required: true },
    title: { type: String, required: true, trim: true },
    description: String,
    status: {
      type: String,
      enum: ["todo", "in_progress", "done"],
      default: "todo",
    },
    // Defaults to status; diverges once a workspace defines custom columns.
    boardColumnId: String,
    // Fractional ordering so a drag only rewrites the moved card (see boardOrder util).
    boardOrder: { type: Number, default: 0 },
    priority: { type: Number, enum: [0, 1, 2, 3], default: 0 },
    dueDate: Date,
    completedAt: Date,
    tags: { type: [String], default: [] },
    subtasks: { type: [SubtaskSchema], default: [] },
    reminders: { type: [ReminderSchema], default: [] },
    recurrence: RecurrenceSchema,
    recurrenceParentId: { type: Schema.Types.ObjectId, ref: "Task" },
    attachments: { type: [AttachmentSchema], default: [] },
    assigneeId: { type: Schema.Types.ObjectId, ref: "User" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

TaskSchema.index({ workspaceId: 1, listId: 1, status: 1 });
TaskSchema.index({ workspaceId: 1, dueDate: 1, completedAt: 1 });
TaskSchema.index({ workspaceId: 1, "reminders.remindAt": 1, "reminders.sentAt": 1 });
TaskSchema.index({ workspaceId: 1, listId: 1, boardColumnId: 1, boardOrder: 1 });

export type TaskDoc = mongoose.InferSchemaType<typeof TaskSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Task = models.Task || model("Task", TaskSchema);

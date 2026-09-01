import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const SubtaskSchema = new Schema(
  {
    title: { type: String, required: true },
    done: { type: Boolean, default: false },
    order: { type: Number, required: true, default: 0 },
  },
  { timestamps: false }
);

const ReminderSchema = new Schema(
  {
    remindAt: { type: Date, required: true },
    channel: { type: String, enum: ["email"], default: "email" },
    sentAt: { type: Date },
  },
  { timestamps: false }
);

const RecurrenceSchema = new Schema(
  {
    freq: { type: String, enum: ["daily", "weekly", "monthly"], required: true },
    interval: { type: Number, required: true, default: 1 },
    byWeekday: { type: [Number] },
    byMonthDay: { type: Number },
    until: { type: Date },
    count: { type: Number },
    completionAnchored: { type: Boolean, required: true, default: false },
  },
  { _id: false }
);

const AttachmentSchema = new Schema(
  {
    filename: { type: String, required: true },
    url: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

const TaskSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
    listId: { type: Schema.Types.ObjectId, ref: "List", required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String },
    status: { type: String, enum: ["todo", "in_progress", "done"], required: true, default: "todo" },
    boardColumnId: { type: String },
    boardOrder: { type: Number, required: true, default: 1000 },
    priority: { type: Number, enum: [0, 1, 2, 3], required: true, default: 0 },
    dueDate: { type: Date },
    completedAt: { type: Date },
    tags: { type: [String], default: [] },
    subtasks: { type: [SubtaskSchema], default: [] },
    reminders: { type: [ReminderSchema], default: [] },
    recurrence: { type: RecurrenceSchema },
    recurrenceParentId: { type: Schema.Types.ObjectId, ref: "Task" },
    attachments: { type: [AttachmentSchema], default: [] },
    assigneeId: { type: Schema.Types.ObjectId, ref: "User" },
    customFieldValues: { type: Schema.Types.Mixed }, // Phase 3 vertical modules
    // Calendar Bridge — the corresponding Google Calendar event, if this
    // task's owner has an active connection and the task has a due date.
    googleCalendarEventId: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

TaskSchema.index({ workspaceId: 1, listId: 1, status: 1 });
TaskSchema.index({ workspaceId: 1, dueDate: 1, completedAt: 1 });
TaskSchema.index({ workspaceId: 1, "reminders.remindAt": 1, "reminders.sentAt": 1 });
TaskSchema.index({ workspaceId: 1, listId: 1, boardColumnId: 1, boardOrder: 1 });

export type TaskDoc = InferSchemaType<typeof TaskSchema>;

export const Task: Model<TaskDoc> = models.Task ?? model<TaskDoc>("Task", TaskSchema);

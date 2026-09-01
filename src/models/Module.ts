import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

// Phase 3 vertical modules — defined now, seeded, unused until a workspace
// activates one (BRD §3 / §6.4, spec §1.7). Adding a vertical means
// inserting one document here, no deploy.
const CustomFieldSchema = new Schema(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    type: { type: String, enum: ["text", "number", "date", "select", "boolean"], required: true },
    options: { type: [String] },
    required: { type: Boolean, default: false },
    appliesTo: { type: String, enum: ["task", "list"], required: true },
  },
  { _id: false }
);

const ModuleSchema = new Schema(
  {
    _id: { type: String, required: true }, // "ca_practice", "coaching", "clinic", ...
    displayName: { type: String, required: true },
    labelOverrides: {
      task: { type: String, required: true },
      list: { type: String, required: true },
      assignee: { type: String, required: true },
    },
    customFields: { type: [CustomFieldSchema], default: [] },
    pricePerSeatMonthly: { type: Number, required: true },
    isActive: { type: Boolean, default: false },
  },
  { timestamps: true, _id: false }
);

export type ModuleDoc = InferSchemaType<typeof ModuleSchema>;

export const VerticalModule: Model<ModuleDoc> =
  models.VerticalModule ?? model<ModuleDoc>("VerticalModule", ModuleSchema, "modules");

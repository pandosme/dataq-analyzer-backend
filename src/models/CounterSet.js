import mongoose from "mongoose";

const zoneRectSchema = new mongoose.Schema(
  { x1: Number, y1: Number, x2: Number, y2: Number },
  { _id: false }
);

const zoneSchema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    name: { type: String, default: "" },
    rect: { type: zoneRectSchema, required: true },
  },
  { _id: false }
);

const counterValueSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    from: { type: String, required: true },
    to: { type: String, required: true },
    name: { type: String, default: "" },
    enabled: { type: Boolean, default: true },
    total: { type: Number, default: 0 },
    byClass: { type: Map, of: Number, default: new Map() },
  },
  { _id: false }
);

const counterSetSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    serial: { type: String, required: true, uppercase: true },
    objectClasses: { type: [String], required: true },
    zones: { type: [zoneSchema], required: true },
    counters: { type: [counterValueSchema], default: [] },
    mqttTopic: { type: String, default: "" },
    mqttInterval: { type: Number, default: 60 },
    days: { type: Number, default: 0 },
    lastDayProcessed: { type: String, default: null },
    resetAt: { type: Date, default: null },
    backfill: {
      status: {
        type: String,
        enum: ["idle", "running", "complete", "failed"],
        default: "idle",
      },
      totalPaths: { type: Number, default: 0 },
      processedPaths: { type: Number, default: 0 },
      startedAt: { type: Date, default: null },
      completedAt: { type: Date, default: null },
      error: { type: String, default: null },
    },
  },
  { timestamps: true }
);

counterSetSchema.index({ serial: 1 });

const CounterSet = mongoose.model("CounterSet", counterSetSchema);
export default CounterSet;

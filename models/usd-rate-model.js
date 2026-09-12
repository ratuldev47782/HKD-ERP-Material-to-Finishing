import mongoose from "mongoose";

const usdRateSchema = new mongoose.Schema(
  {
    yearMonth: { type: String, required: true, trim: true }, // removed index: true
    rate: { type: Number, required: true, min: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, required: false },
    createdByName: { type: String, default: "" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, required: false },
    updatedByName: { type: String, default: "" },
  },
  { timestamps: true }
);

usdRateSchema.index({ yearMonth: 1 }, { unique: true });

export const usdRateModel =
  mongoose.models.usd_rates || mongoose.model("usd_rates", usdRateSchema);

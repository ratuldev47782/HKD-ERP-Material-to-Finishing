// models/salary-entry-model.js
import mongoose from "mongoose";

const floors = ["A-2", "B-2", "A-3", "B-3", "A-4", "B-4", "A-5", "B-5"];
const factories = ["K-1", "K-2", "K-3"];

const salaryEntrySchema = new mongoose.Schema(
  {
    factory: {
      type: String,
      required: [true, "Factory is required"],
      enum: factories,
      trim: true,
    },
    yearMonth: {
      type: String,
      required: [true, "Year-Month is required (YYYY-MM)"],
      match: [/^\d{4}-(0[1-9]|1[0-2])$/, "Year-Month must be YYYY-MM"],
    },
    floor: {
      type: String,
      required: [true, "Floor is required"],
      enum: floors,
    },
    line: {
      type: Number,
      required: [true, "Line is required"],
      min: [1, "Line must be between 1 and 15"],
      max: [20, "Line must be between 1 and 20"],
    },
    salaryDirect: {
      type: Number,
      required: [true, "Salary (Direct) is required"],
      min: [0, "Salary cannot be negative"],
    },
    salaryIndirect: {
      type: Number,
      required: [true, "Salary (Indirect) is required"],
      min: [0, "Salary cannot be negative"],
    },
    salaryTotal: {
      type: Number,
      required: true,
      min: [0, "Total cannot be negative"],
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    createdByName: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true }
);

// ✅ auto-calc total (SYNC middleware: NO next())
salaryEntrySchema.pre("validate", function () {
  const d = Number(this.salaryDirect ?? 0);
  const i = Number(this.salaryIndirect ?? 0);
  this.salaryTotal = d + i;
});

// One entry per month per (factory+floor+line)
salaryEntrySchema.index(
  { factory: 1, yearMonth: 1, floor: 1, line: 1 },
  { unique: true }
);

export const salaryEntryModel =
  mongoose.models.salary_entries ||
  mongoose.model("salary_entries", salaryEntrySchema);

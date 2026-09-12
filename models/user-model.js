// models/user-model.js
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    user_name: {
      type: String,
      required: [true, "Username is required"],
      unique: true, // ✅ এটিই যথেষ্ট
      trim: true,
      minlength: [3, "Username must be at least 3 characters long"],
      maxlength: [50, "Username cannot exceed 50 characters"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters long"],
    },
    role: { type: String, required: [true, "Role is required"], trim: true },
    assigned_building: {
      type: String,
      required: [true, "Assigned building is required"],
      enum: ["A-2", "B-2", "A-3", "B-3", "A-4", "B-4", "A-5", "B-5"],
     
    },
    factory: {
      type: String,
      required: [true, "Factory is required"],
      enum: ["K-1", "K-2", "K-3"],
    },
  },
  { timestamps: true }
);

// ✅ যদি তুমি “একই Factory+Building এ একাধিক user” allow করতে চাও,
// তাহলে এই unique index টা REMOVE করো (না হলে 2nd user ব্লক হবে)
// userSchema.index({ factory: 1, assigned_building: 1 }, { unique: true });

export const userModel =
  mongoose.models.users || mongoose.model("users", userSchema);

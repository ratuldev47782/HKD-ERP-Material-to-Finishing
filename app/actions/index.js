// app/actions.js
"use server";

import { createUser, findUserByCredentials } from "@/db/queries";
import { redirect } from "next/navigation";

export async function registerUser(prevState, formData) {
  const user = {
    user_name: (formData.get("user_name") || "").toString().trim(),
    password: (formData.get("password") || "").toString(),
    role: (formData.get("role") || "").toString().trim(),
    assigned_building: (formData.get("assigned_building") || "").toString(),
    factory: (formData.get("factory") || "").toString(),
  };

  // basic validation (optional but helpful)
  if (!user.user_name || !user.password || !user.role || !user.assigned_building || !user.factory) {
    return {
      success: false,
      message: "সবগুলো required field পূরণ করুন।",
      fieldErrors: {},
    };
  }

  const res = await createUser(user);

  if (!res.success) {
    return {
      success: false,
      message: res.message || "Registration failed",
      fieldErrors: res.fieldErrors || {},
    };
  }

  redirect("/login");
}

export async function PerformLogin(formData) {
  const credential = {
    user_name: formData.get("user_name"),
    password: formData.get("password"),
  };
  const found = await findUserByCredentials(credential);
  return found;
}

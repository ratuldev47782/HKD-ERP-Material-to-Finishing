// db/queries.js
import { dbConnect } from "@/services/mongo";
import { userModel } from "@/models/user-model";
import { replaceMongoIdInObject } from "@/utils/data-util";

function parseMongoDuplicate(err) {
  const kp = err?.keyPattern || {};
  if (kp.user_name) {
    return {
      message: "এই User Name আগে থেকেই আছে. অন্য User Name দিন।",
      fieldErrors: { user_name: "Already exists" },
    };
  }
  if (kp.factory && kp.assigned_building) {
    return {
      message:
        "এই Factory + Building already registered. অন্য Building বা Factory দিন।",
      fieldErrors: {
        factory: "Duplicate factory+building",
        assigned_building: "Duplicate factory+building",
      },
    };
  }
  return { message: "Duplicate data found.", fieldErrors: {} };
}

async function createUser(user) {
  try {
    await dbConnect(); // ✅ must
    const created = await userModel.create(user);
    return { success: true, data: replaceMongoIdInObject(created.toObject()) };
  } catch (err) {
    if (err?.code === 11000) {
      const dup = parseMongoDuplicate(err);
      return { success: false, message: dup.message, fieldErrors: dup.fieldErrors };
    }
    return {
      success: false,
      message: err?.message || "Failed to create user",
      fieldErrors: {},
    };
  }
}

async function findUserByCredentials(credentials) {
  await dbConnect(); // ✅ must
  const user = await userModel.findOne(credentials).lean();
  if (user) return replaceMongoIdInObject(user);
  return null;
}

export { createUser, findUserByCredentials };

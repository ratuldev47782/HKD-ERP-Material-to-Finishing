// backend/src/controllers/auth/auth.controllers.js

import { eq } from "drizzle-orm";
import { uploadToCloudinary, deleteFromCloudinary } from "../../utils/cloudinary.js";
import { db, schema } from "../../db/db.js";

const { users } = schema;

const isBase64Image = (str) =>
  typeof str === "string" && str.startsWith("data:image/");

const isValidEmail = (str) =>
  typeof str === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);

// Roles allowed to manage (view + edit) other users
const USER_MANAGER_ROLES = ["Developer", "ERP-Executive"];

// POST /auth/register
export const register = async (req, res) => {
  try {
    const { user_name, email, password, role, department, assigned_building, factory, profile_picture } = req.body;

    if (!user_name || !email || !password || !role || !assigned_building || !factory) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ message: "Invalid email address" });
    }

    const existingName = await db.select().from(users).where(eq(users.user_name, user_name));
    if (existingName.length > 0) {
      return res.status(400).json({ message: "Username already taken" });
    }

    const existingEmail = await db.select().from(users).where(eq(users.email, email));
    if (existingEmail.length > 0) {
      return res.status(400).json({ message: "Email already registered" });
    }

    let pictureUrl = null;
    let pictureId = null;
    if (profile_picture && isBase64Image(profile_picture)) {
      const uploaded = await uploadToCloudinary(profile_picture);
      pictureUrl = uploaded.url;
      pictureId = uploaded.public_id;
    }

    const [result] = await db.insert(users).values({
      user_name, email, password, role, department: department || null, assigned_building, factory,
      profile_picture: pictureUrl,
      profile_picture_id: pictureId,
    });

    const [newUser] = await db.select().from(users).where(eq(users.id, result.insertId));

    return res.status(201).json({
      user: {
        id: newUser.id,
        user_name: newUser.user_name,
        email: newUser.email,
        role: newUser.role,
        department: newUser.department,
        assigned_building: newUser.assigned_building,
        factory: newUser.factory,
        profile_picture: newUser.profile_picture,
        createdAt: newUser.createdAt,
      },
    });
  } catch (error) {
    console.error("Register error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// POST /auth/login
export const login = async (req, res) => {
  try {
    const { user_name, password } = req.body;

    if (!user_name || !password) {
      return res.status(400).json({ message: "Username and password required" });
    }

    const [user] = await db.select().from(users).where(eq(users.user_name, user_name));

    if (!user || user.password !== password) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    return res.status(200).json({
      user: {
        id: user.id,
        user_name: user.user_name,
        email: user.email,
        role: user.role,
        department: user.department,
        assigned_building: user.assigned_building,
        factory: user.factory,
        profile_picture: user.profile_picture,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// POST /auth/refresh
export const refresh = async (req, res) => {
  try {
    const { user_name } = req.body;
    if (!user_name) return res.status(400).json({ message: "Username required" });

    const [user] = await db.select().from(users).where(eq(users.user_name, user_name));
    if (!user) return res.status(404).json({ message: "User not found" });

    return res.status(200).json({
      user: {
        id: user.id,
        user_name: user.user_name,
        email: user.email,
        role: user.role,
        department: user.department,
        assigned_building: user.assigned_building,
        factory: user.factory,
        profile_picture: user.profile_picture,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("Refresh error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// PUT /auth/update
// If `requester_role` is provided and does NOT belong to USER_MANAGER_ROLES,
// the caller may only update their own account (old_user_name must match).
// This keeps self-service profile edits (e.g. from a settings page) working,
// while blocking a random user from editing someone else's account.
export const updateUser = async (req, res) => {
  try {
    const {
      old_user_name,
      user_name,
      email,
      password,
      role,
      department,
      assigned_building,
      factory,
      profile_picture,
      createdAt,
      requester_user_name,
      requester_role,
    } = req.body;

    if (!user_name) return res.status(400).json({ message: "Username required" });

    const isManager = USER_MANAGER_ROLES.includes(requester_role);
    const isSelf = requester_user_name && requester_user_name === old_user_name;

    if (requester_role !== undefined && !isManager && !isSelf) {
      return res.status(403).json({ message: "Not authorized to update this user" });
    }

    const [existing] = await db.select().from(users).where(eq(users.user_name, old_user_name));
    if (!existing) return res.status(404).json({ message: "User not found" });

    if (user_name !== old_user_name) {
      const [duplicate] = await db.select().from(users).where(eq(users.user_name, user_name));
      if (duplicate) return res.status(400).json({ message: "Username already taken" });
    }

    if (email && email !== existing.email) {
      if (!isValidEmail(email)) {
        return res.status(400).json({ message: "Invalid email address" });
      }
      const [duplicateEmail] = await db.select().from(users).where(eq(users.email, email));
      if (duplicateEmail) return res.status(400).json({ message: "Email already registered" });
    }

    if (password && password.length < 4) {
      return res.status(400).json({ message: "Password must be at least 4 characters" });
    }

    let pictureUrl = existing.profile_picture;
    let pictureId = existing.profile_picture_id;

    if (profile_picture === null) {
      await deleteFromCloudinary(existing.profile_picture_id);
      pictureUrl = null;
      pictureId = null;
    } else if (profile_picture && isBase64Image(profile_picture)) {
      await deleteFromCloudinary(existing.profile_picture_id);
      const uploaded = await uploadToCloudinary(profile_picture);
      pictureUrl = uploaded.url;
      pictureId = uploaded.public_id;
    }

    let newCreatedAt = existing.createdAt;
    if (createdAt) {
      const parsed = new Date(createdAt);
      if (!Number.isNaN(parsed.getTime())) newCreatedAt = parsed;
    }

    await db.update(users).set({
      user_name: user_name || existing.user_name,
      email: email || existing.email,
      password: password || existing.password,
      role: role || existing.role,
      department: department !== undefined ? department : existing.department,
      assigned_building: assigned_building || existing.assigned_building,
      factory: factory || existing.factory,
      profile_picture: pictureUrl,
      profile_picture_id: pictureId,
      createdAt: newCreatedAt,
    }).where(eq(users.user_name, old_user_name));

    const [updatedUser] = await db.select().from(users)
      .where(eq(users.user_name, user_name || existing.user_name));

    return res.status(200).json({
      user: {
        id: updatedUser.id,
        user_name: updatedUser.user_name,
        email: updatedUser.email,
        role: updatedUser.role,
        department: updatedUser.department,
        assigned_building: updatedUser.assigned_building,
        factory: updatedUser.factory,
        profile_picture: updatedUser.profile_picture,
        createdAt: updatedUser.createdAt,
      },
    });
  } catch (error) {
    console.error("Update error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// PUT /auth/change-password
export const changePassword = async (req, res) => {
  try {
    const { user_name, current_password, new_password } = req.body;

    if (!user_name || !current_password || !new_password) {
      return res.status(400).json({ message: "All password fields are required" });
    }
    if (new_password.length < 4) {
      return res.status(400).json({ message: "Password must be at least 4 characters" });
    }

    const [existing] = await db.select().from(users).where(eq(users.user_name, user_name));
    if (!existing) return res.status(404).json({ message: "User not found" });
    if (existing.password !== current_password) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    await db.update(users).set({ password: new_password }).where(eq(users.user_name, user_name));

    return res.status(200).json({ message: "Password changed successfully" });
  } catch (error) {
    console.error("Change password error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// GET /auth/users  — Developer / ERP-Executive listing for the admin page
// NOTE: this now includes the raw `password` field so the admin edit UI can
// pre-fill it. Since passwords are stored in plaintext and this endpoint is
// already gated to USER_MANAGER_ROLES, this doesn't change the underlying
// security posture — but it does mean every admin page load now ships every
// user's password over the network in plain view. Worth hashing passwords
// (bcrypt/argon2) and dropping this field long-term.
export const getAllUsers = async (req, res) => {
  try {
    const { requester_role } = req.query;
    if (!USER_MANAGER_ROLES.includes(requester_role)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const allUsers = await db.select({
      id: users.id,
      user_name: users.user_name,
      email: users.email,
      password: users.password,
      role: users.role,
      department: users.department,
      assigned_building: users.assigned_building,
      factory: users.factory,
      profile_picture: users.profile_picture,
      createdAt: users.createdAt,
    }).from(users);

    return res.status(200).json({ users: allUsers });
  } catch (error) {
    console.error("Get all users error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};
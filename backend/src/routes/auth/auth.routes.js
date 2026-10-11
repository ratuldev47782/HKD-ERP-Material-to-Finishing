// backend/src/routes/auth/auth.routes.js

import { Router } from "express";
import {
  register,
  login,
  refresh,
  updateUser,
  changePassword,
  getAllUsers,
} from "../../controllers/auth/auth.controllers.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refresh);
router.put("/update", updateUser);
router.put("/change-password", changePassword);
router.get("/users", getAllUsers);

export default router;
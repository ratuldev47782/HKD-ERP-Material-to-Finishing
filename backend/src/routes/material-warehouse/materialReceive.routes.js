// backend/src/routes/material-warehouse/materialReceive.routes.js

import { Router } from "express";
import {
  getAllMaterialReceives,
  getMaterialReceiveById,
  createMaterialReceive,
  updateMaterialReceive,
  deleteMaterialReceive,
} from "../../controllers/material-warehouse/materialReceive.controllers.js";

const router = Router();

router.get("/", getAllMaterialReceives);
router.get("/:id", getMaterialReceiveById);
router.post("/", createMaterialReceive);
router.patch("/:id", updateMaterialReceive);
router.delete("/:id", deleteMaterialReceive);

export default router;

// If you want these behind login like your other routes, import your
// authMiddleware and add it before each handler, e.g.:
//   router.post("/", authMiddleware, createMaterialReceive);
// backend/src/routes/cutting/cuttingRequisition.routes.js

import { Router } from "express";
import {
  getAllRequisitions,
  getRequisitionById,
  createRequisition,
  updateRequisition,
  deleteRequisition,
} from "../../controllers/cutting/cuttingRequisition.controllers.js";

const router = Router();

router.get("/", getAllRequisitions);
router.get("/:id", getRequisitionById);
router.post("/", createRequisition);
router.patch("/:id", updateRequisition);
router.delete("/:id", deleteRequisition);

export default router;

// Behind login:
// router.post("/", authMiddleware, createRequisition);
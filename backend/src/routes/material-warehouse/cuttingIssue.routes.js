// backend/src/routes/material-warehouse/cuttingIssue.routes.js

import { Router } from "express";
import {
  getNotifications,
  markRequisitionRead,
  getWorklist,
  getIssueHistory,
  issueStock,
  issueStockBatch,
} from "../../controllers/material-warehouse/cuttingIssue.controllers.js";

const router = Router();

// NOTE: specific/static paths are declared before the more general
// "/:requisitionItemId" POST route so Express doesn't try to match
// "notifications" or "history" as an id param.
router.get("/notifications", getNotifications);
router.patch("/:requisitionId/read", markRequisitionRead);
router.get("/history", getIssueHistory);
router.get("/", getWorklist);

// Multi-rack issue in one action (preferred by the current frontend).
router.post("/:requisitionItemId/batch", issueStockBatch);
// Single-rack issue -- kept for backwards compatibility / API flexibility.
router.post("/:requisitionItemId", issueStock);

export default router;

// Behind login:
// router.post("/:requisitionItemId/batch", authMiddleware, issueStockBatch);
// router.post("/:requisitionItemId", authMiddleware, issueStock);
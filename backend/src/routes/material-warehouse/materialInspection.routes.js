// backend/src/routes/material-warehouse/materialInspection.routes.js

import { Router } from "express";
import {
  getNotifications,
  markItemRead,
  getWorklist,
  getHistory,
  getItemById,
  inspectItem,
} from "../../controllers/material-warehouse/materialInspection.controllers.js";

const router = Router();

// NOTE: specific/static paths are declared before the more general
// "/:itemId" routes so Express doesn't try to match "notifications" or
// "history" as an id param.
router.get("/notifications", getNotifications);
router.patch("/:itemId/read", markItemRead);
router.get("/history", getHistory);
router.get("/:itemId", getItemById);
router.get("/", getWorklist);
router.post("/:itemId", inspectItem);

export default router;

// If you want these behind login like your other routes, import your
// authMiddleware and add it before each handler, e.g.:
//   router.post("/:itemId", authMiddleware, inspectItem);
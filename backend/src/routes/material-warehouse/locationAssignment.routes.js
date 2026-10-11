// backend/src/routes/material-warehouse/locationAssignment.routes.js

import { Router } from "express";
import {
  getPendingAssignments,
  assignLocation,
  updateAllocation,
  deleteAllocation,
} from "../../controllers/material-warehouse/locationAssignment.controllers.js";

const router = Router();

router.get("/", getPendingAssignments);

// Assigns PART (or all) of a batch's still-unassigned qty to one rack.
// Changed from PATCH -> POST because it now CREATES a new allocation row
// each time (a batch can be assigned to many racks via repeated calls),
// rather than mutating a single location field in place.
router.post("/:itemId", assignLocation);

// Edit or remove a specific existing rack allocation (only while nothing
// has been issued from it yet).
router.patch("/allocation/:allocationId", updateAllocation);
router.delete("/allocation/:allocationId", deleteAllocation);

export default router;

// Behind login:
// router.post("/:itemId", authMiddleware, assignLocation);
// router.patch("/allocation/:allocationId", authMiddleware, updateAllocation);
// router.delete("/allocation/:allocationId", authMiddleware, deleteAllocation);
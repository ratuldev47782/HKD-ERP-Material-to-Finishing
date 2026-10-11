// backend/src/routes/material-warehouse/materialRackView.routes.js

import { Router } from "express";
import { materialRackView } from "../../controllers/material-warehouse/materialRackView.controllers.js";

const router = Router();

// GET /material-rack-view
router.get("/", materialRackView);

export default router;
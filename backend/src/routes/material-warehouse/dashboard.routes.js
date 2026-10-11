// backend/src/routes/material-warehouse/dashboard.routes.js
//
// Dashboard route for the main buyer overview screen.
//
// This file is mounted from backend/src/app.js as:
//
//     import dashboardRoutes from "./routes/material-warehouse/dashboard.routes.js";
//     app.use("/dashboard", dashboardRoutes);

import { Router } from "express";
import { dashboardOverview } from "../../controllers/material-warehouse/dashboard.controllers.js";

const router = Router();

router.get("/buyer-overview", dashboardOverview);

export default router;
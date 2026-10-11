// backend/src/app.js

import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import authRoutes from "./routes/auth/auth.routes.js";
import cuttingIssueRoutes from "./routes/material-warehouse/cuttingIssue.routes.js"; // ← new
import cuttingRequisitionRoutes from "./routes/cutting/cuttingRequisition.routes.js"; // ← new
import dashboardRoutes from "./routes/material-warehouse/dashboard.routes.js";
import locationAssignmentRoutes from "./routes/material-warehouse/locationAssignment.routes.js";
import materialInspectionRoutes from "./routes/material-warehouse/materialInspection.routes.js"; // ← new
import materialRackView from "./routes/material-warehouse/materialRackView.routes.js";
import materialReceiveRoutes from "./routes/material-warehouse/materialReceive.routes.js";
import materialStockRoutes from "./routes/material-warehouse/materialStock.routes.js";
import materialImportRoutes from "./routes/material-warehouse/materialImport.routes.js";

dotenv.config();

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.use("/auth", authRoutes);
app.use("/dashboard", dashboardRoutes);
app.use("/material-rack-view", materialRackView);
app.use("/material-inspection", materialInspectionRoutes); // ← new
app.use("/material-receive", materialReceiveRoutes);
app.use("/location-assignment", locationAssignmentRoutes);
app.use("/material-stock", materialStockRoutes);
app.use("/cutting-requisition", cuttingRequisitionRoutes); // ← new
app.use("/cutting-issue", cuttingIssueRoutes); // ← new
app.use("/", materialImportRoutes);
app.get("/", (req, res) => {
  res.json({ message: "API is running" });
});

export default app;
// backend/src/routes/material-warehouse/materialStock.routes.js

import { Router } from "express";
import { searchMaterialStock } from "../../controllers/material-warehouse/materialStock.controllers.js";

const router = Router();

router.get("/", searchMaterialStock);

export default router;
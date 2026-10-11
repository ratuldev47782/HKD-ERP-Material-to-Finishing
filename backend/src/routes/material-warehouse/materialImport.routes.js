// backend/src/routes/material-warehouse/materialImport.routes.js


import { Router } from "express";
import express from "express";
import multer from "multer";
import { importMaterialStock, commitMaterialStock } from "../../controllers/material-warehouse/materialImport.controllers.js";

// Memory storage -- the file never touches disk, it's parsed straight
// out of the buffer in the controller. 25MB should comfortably cover
// even a very large legacy workbook with many sheets.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

const router = Router();

// POST /material-import
// multipart "file" -> preview only. Returns { records, warnings, ... }.
// Nothing is written to the DB by this route.
router.post("/material-import", upload.single("file"), importMaterialStock);

// POST /material-import/commit
// application/json { records: [...] } -> inserts every record.
// This is the only route that writes to the DB. Body can get large for
// workbooks with 1000+ rows, hence the higher JSON limit.
router.post(
  "/material-import/commit",
  express.json({ limit: "20mb" }),
  commitMaterialStock
);

export default router;
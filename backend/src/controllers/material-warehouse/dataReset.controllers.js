import { db, schema } from "../../db/db.js";

const {
  materialReceives, materialReceiveStyles, materialReceiveItems,
  materialReceiveItemLocations, stockHistory,
  cuttingRequisitions, cuttingRequisitionItems, cuttingIssues,
} = schema;

const CONFIRM_TEXT = "DELETE ALL DATA";

/**
 * POST /data-reset
 * body: { confirmText: "DELETE ALL DATA", includeCutting: boolean }
 *
 * No user/role check. The typed confirmation text is the only guard.
 * The users table is never touched. Runs in one transaction.
 */
export const resetWarehouseData = async (req, res) => {
  try {
    const { confirmText, includeCutting } = req.body || {};
    if (confirmText !== CONFIRM_TEXT) {
      return res.status(400).json({ message: `Type "${CONFIRM_TEXT}" exactly to confirm` });
    }

    await db.transaction(async (tx) => {
      await tx.delete(cuttingIssues);
      await tx.delete(stockHistory);
      await tx.delete(materialReceiveItemLocations);
      await tx.delete(materialReceiveItems);
      await tx.delete(materialReceiveStyles);
      await tx.delete(materialReceives);

      if (includeCutting) {
        await tx.delete(cuttingRequisitionItems);
        await tx.delete(cuttingRequisitions);
      }
    });

    res.json({
      deleted: true,
      includeCutting: !!includeCutting,
      message: "All warehouse data deleted. Users were not touched.",
    });
  } catch (error) {
    console.error("resetWarehouseData error:", error);
    res.status(500).json({ message: "Failed to delete data", detail: error.message });
  }
};
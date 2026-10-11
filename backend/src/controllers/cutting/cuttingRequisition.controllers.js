// backend/src/controllers/cutting/cuttingRequisition.controllers.js

//
// Used by the CUTTING side page (Cutting -> Cutting Requisition).
// Cutting creates a Requisition here; the Material Warehouse side
// (cuttingIssue.controllers.js) reads/fulfills it.
//
// Cutting never enters a Roll or a PO on a Requisition. Each item row is
// Item Code/PDM + Color + Pcs + Wastage % + Consumption, and the Yds
// actually requested is ALWAYS computed server-side from those three
// numbers (never trusted from the client) as:
//     requestedYds = Pcs x Consumption x (1 + WastagePercentage / 100)
// Roll is a Material Warehouse-only concept, decided at issue time.

import { db, schema } from "../../db/db.js";
import { eq, like, and, inArray, desc, ne } from "drizzle-orm";

const { cuttingRequisitions, cuttingRequisitionItems, cuttingIssues } = schema;

async function getFullRequisition(id) {
  const [req_] = await db.select().from(cuttingRequisitions).where(eq(cuttingRequisitions.id, id));
  if (!req_) return null;
  const items = await db.select().from(cuttingRequisitionItems).where(eq(cuttingRequisitionItems.cuttingRequisitionId, id));
  return { ...req_, items, totalItems: items.length };
}

/**
 * Validates and normalizes the raw item rows coming from the request body
 * into rows ready for insertion, computing requestedYds server-side so it
 * can never be spoofed/mismatched from the client.
 * Throws a { status, message } style error object on invalid input.
 */
function buildItemRows(items) {
  if (!Array.isArray(items) || items.length === 0) {
    const err = new Error("At least one Item Code/PDM + Color row is required");
    err.status = 400;
    throw err;
  }

  return items.map((row) => {
    const pcs = Number(row.pcs);
    const consumption = Number(row.consumption);
    const percentage =
      row.percentage === "" || row.percentage === undefined || row.percentage === null ? 0 : Number(row.percentage);

    if (!row.itemCodePdm || !row.color || !(pcs > 0) || !(consumption > 0) || Number.isNaN(percentage) || percentage < 0) {
      const err = new Error(
        "Every item row needs an Item Code/PDM, Color, Pcs (>0), Consumption (>0), and a valid Wastage % (0 or more)"
      );
      err.status = 400;
      throw err;
    }

    const requestedYds = Math.round(pcs * consumption * (1 + percentage / 100) * 100) / 100;

    return {
      itemCodePdm: row.itemCodePdm,
      color: row.color,
      pcs,
      percentage,
      consumption,
      requestedYds,
    };
  });
}

/**
 * GET /cutting-requisition
 * GET /cutting-requisition?buyer=...&style=...&model=...&itemCodePdm=...&color=...&floor=...&status=...
 *
 * Each field matched only against its own column, same AND-across-groups
 * pattern as GET /material-receive.
 */
export const getAllRequisitions = async (req, res) => {
  try {
    const { buyer, style, model, floor, status, itemCodePdm, color } = req.query;
    const has = (v) => typeof v === "string" && v.trim().length > 0;
    const term = (v) => `%${v.trim()}%`;

    const conditions = [];
    if (has(buyer)) conditions.push(like(cuttingRequisitions.buyer, term(buyer)));
    if (has(style)) conditions.push(like(cuttingRequisitions.style, term(style)));
    if (has(model)) conditions.push(like(cuttingRequisitions.model, term(model)));
    if (has(floor)) conditions.push(like(cuttingRequisitions.floor, term(floor)));
    if (has(status)) conditions.push(eq(cuttingRequisitions.status, status.trim()));

    let requisitions = conditions.length
      ? await db.select().from(cuttingRequisitions).where(and(...conditions)).orderBy(desc(cuttingRequisitions.createdAt))
      : await db.select().from(cuttingRequisitions).orderBy(desc(cuttingRequisitions.createdAt));

    // Item Code/PDM + Color filter -- must match on the SAME item row,
    // intersected with the parent-level filtering above.
    if (has(itemCodePdm) || has(color)) {
      const itemConditions = [];
      if (has(itemCodePdm)) itemConditions.push(like(cuttingRequisitionItems.itemCodePdm, term(itemCodePdm)));
      if (has(color)) itemConditions.push(like(cuttingRequisitionItems.color, term(color)));
      const matchingItemRows = await db
        .select({ cuttingRequisitionId: cuttingRequisitionItems.cuttingRequisitionId })
        .from(cuttingRequisitionItems)
        .where(and(...itemConditions));
      const okIds = new Set(matchingItemRows.map((r) => r.cuttingRequisitionId));
      requisitions = requisitions.filter((r) => okIds.has(r.id));
    }

    const ids = requisitions.map((r) => r.id);
    const allItems = ids.length
      ? await db.select().from(cuttingRequisitionItems).where(inArray(cuttingRequisitionItems.cuttingRequisitionId, ids))
      : [];

    res.json(
      requisitions.map((r) => {
        const items = allItems.filter((i) => i.cuttingRequisitionId === r.id);
        return { ...r, items, totalItems: items.length };
      })
    );
  } catch (error) {
    console.error("getAllRequisitions error:", error);
    res.status(500).json({ message: "Failed to fetch cutting requisitions" });
  }
};

/** GET /cutting-requisition/:id */
export const getRequisitionById = async (req, res) => {
  try {
    const full = await getFullRequisition(req.params.id);
    if (!full) return res.status(404).json({ message: "Requisition not found" });
    res.json(full);
  } catch (error) {
    console.error("getRequisitionById error:", error);
    res.status(500).json({ message: "Failed to fetch requisition" });
  }
};

/**
 * POST /cutting-requisition
 * Body: { date, buyer, floor, season, style, model,
 *         items: [{ itemCodePdm, color, pcs, percentage, consumption }] }
 *
 * requestedYds is always (re)computed here from pcs/percentage/consumption
 * -- never taken as-is from the client. Always created fresh with
 * isRead=false so it immediately shows up as an unread notification on
 * the Material Warehouse's Cutting Issue page.
 */
export const createRequisition = async (req, res) => {
  try {
    const { date, buyer, floor, season, style, model, items } = req.body;

    if (!date || !buyer || !floor || !season || !style) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    let rows;
    try {
      rows = buildItemRows(items);
    } catch (err) {
      return res.status(err.status || 400).json({ message: err.message });
    }

    const newId = await db.transaction(async (tx) => {
      const [inserted] = await tx.insert(cuttingRequisitions).values({
        date, buyer, floor, season, style, model: model || null,
        status: "pending", isRead: false,
      });
      const cuttingRequisitionId = inserted.insertId;

      const itemRows = rows.map((row) => ({
        cuttingRequisitionId,
        itemCodePdm: row.itemCodePdm,
        color: row.color,
        pcs: row.pcs,
        percentage: row.percentage,
        consumption: row.consumption,
        requestedYds: row.requestedYds,
        issuedRoll: 0,
        issuedYds: 0,
        status: "pending",
      }));
      await tx.insert(cuttingRequisitionItems).values(itemRows);

      return cuttingRequisitionId;
    });

    res.status(201).json(await getFullRequisition(newId));
  } catch (error) {
    console.error("createRequisition error:", error);
    res.status(500).json({ message: "Failed to create cutting requisition" });
  }
};

/**
 * PATCH /cutting-requisition/:id
 * Replaces items (delete pending, reinsert), same guard pattern as
 * Material Receive: blocked once ANY item already has something issued
 * against it, since editing here deletes+recreates rows and would
 * orphan/duplicate issue history otherwise.
 */
export const updateRequisition = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, buyer, floor, season, style, model, items } = req.body;

    const [existing] = await db.select().from(cuttingRequisitions).where(eq(cuttingRequisitions.id, id));
    if (!existing) return res.status(404).json({ message: "Requisition not found" });

    const issuedItems = await db
      .select()
      .from(cuttingRequisitionItems)
      .where(and(eq(cuttingRequisitionItems.cuttingRequisitionId, id), ne(cuttingRequisitionItems.status, "pending")));
    if (issuedItems.length > 0) {
      return res.status(400).json({
        message: "Some items on this requisition already have material issued against them; it can no longer be edited here.",
      });
    }

    let rows = [];
    if (Array.isArray(items) && items.length > 0) {
      try {
        rows = buildItemRows(items);
      } catch (err) {
        return res.status(err.status || 400).json({ message: err.message });
      }
    }

    await db.transaction(async (tx) => {
      await tx
        .update(cuttingRequisitions)
        .set({ date, buyer, floor, season, style, model: model || null })
        .where(eq(cuttingRequisitions.id, id));

      await tx
        .delete(cuttingRequisitionItems)
        .where(and(eq(cuttingRequisitionItems.cuttingRequisitionId, id), eq(cuttingRequisitionItems.status, "pending")));

      if (rows.length > 0) {
        const itemRows = rows.map((row) => ({
          cuttingRequisitionId: Number(id),
          itemCodePdm: row.itemCodePdm,
          color: row.color,
          pcs: row.pcs,
          percentage: row.percentage,
          consumption: row.consumption,
          requestedYds: row.requestedYds,
          issuedRoll: 0,
          issuedYds: 0,
          status: "pending",
        }));
        await tx.insert(cuttingRequisitionItems).values(itemRows);
      }
    });

    res.json(await getFullRequisition(id));
  } catch (error) {
    console.error("updateRequisition error:", error);
    res.status(500).json({ message: "Failed to update cutting requisition" });
  }
};

/**
 * DELETE /cutting-requisition/:id
 * Blocked once any item already has material issued against it.
 */
export const deleteRequisition = async (req, res) => {
  try {
    const { id } = req.params;
    const [existing] = await db.select().from(cuttingRequisitions).where(eq(cuttingRequisitions.id, id));
    if (!existing) return res.status(404).json({ message: "Requisition not found" });

    const issuedItems = await db
      .select()
      .from(cuttingRequisitionItems)
      .where(and(eq(cuttingRequisitionItems.cuttingRequisitionId, id), ne(cuttingRequisitionItems.status, "pending")));
    if (issuedItems.length > 0) {
      return res.status(400).json({ message: "Cannot delete: material has already been issued against this requisition." });
    }

    await db.delete(cuttingRequisitions).where(eq(cuttingRequisitions.id, id));
    res.json({ message: "Cutting requisition deleted successfully" });
  } catch (error) {
    console.error("deleteRequisition error:", error);
    res.status(500).json({ message: "Failed to delete cutting requisition" });
  }
};
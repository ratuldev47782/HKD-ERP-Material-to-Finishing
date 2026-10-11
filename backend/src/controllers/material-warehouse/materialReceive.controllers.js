// backend/src/controllers/material-warehouse/materialReceive.controllers.js

import { and, desc, eq, inArray, like } from "drizzle-orm";
import { db, schema } from "../../db/db.js";

const { materialReceives, materialReceiveStyles, materialReceiveItems, materialReceiveItemLocations, stockHistory } = schema;

// Statuses that mean "this batch already has real rack stock riding on
// it" -- editing/deleting the parent Receive must be blocked once any
// item batch reaches one of these, since Material Receive's edit/delete
// deletes+recreates item rows and would otherwise orphan/duplicate racked
// stock. "pending_inspection", "pending", and "rejected" are all still
// safe to edit -- nothing has been racked against them yet.
const RACKED_STATUSES = ["partial", "approved"];

// Pagination defaults/limits for GET /material-receive.
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/** Loads one Material Receive with its Style/Model rows, Item/Color batches,
 * and each batch's rack allocations (locations[]). */
async function getFullReceive(id) {
  const [receive] = await db.select().from(materialReceives).where(eq(materialReceives.id, id));
  if (!receive) return null;
  const styles = await db.select().from(materialReceiveStyles).where(eq(materialReceiveStyles.materialReceiveId, id));
  const items = await db.select().from(materialReceiveItems).where(eq(materialReceiveItems.materialReceiveId, id));

  const locations = items.length
    ? await db
      .select()
      .from(materialReceiveItemLocations)
      .where(inArray(materialReceiveItemLocations.itemId, items.map((i) => i.id)))
    : [];
  const itemsWithLocations = items.map((it) => ({
    ...it,
    locations: locations.filter((l) => l.itemId === it.id),
  }));

  return { ...receive, styles, items: itemsWithLocations, totalItems: items.length };
}

/**
 * GET /material-receive
 * GET /material-receive?invoiceNo=...&buyer=...&supplier=...&po=...&style=...&model=...&itemCodePdm=...&color=...&fabricDetails=...&page=1&limit=20
 *
 * Returns a PAGE of Material Receives with their styles[] (Style + Model)
 * and items[] (Item Code/PDM, Color, Fabric Details, Roll, Yds,
 * unassignedRoll/Yds, status, locations[]).
 *
 * Response shape:
 *   { data: [...], total, page, limit, totalPages }
 *
 * Each query field is matched ONLY against its own column (no more single
 * fuzzy string matching every column at once):
 *   - invoiceNo / buyer / supplier / po
 *                              -> matched on the parent Material Receive row,
 *                                 combined with AND. Supplier is optional
 *                                 free text at the invoice/parent level.
 *   - style | model           -> matched on the SAME materialReceiveStyles
 *                                 row (AND), so "Style=X, Model=Y" only
 *                                 matches a row that has both.
 *   - itemCodePdm / color / fabricDetails
 *                              -> matched on the SAME materialReceiveItems
 *                                 row (AND), so "Item Code=X, Color=Y" only
 *                                 matches a row that has both -- an item
 *                                 whose itemCodePdm happens to equal the
 *                                 color you typed (or vice versa) will NOT
 *                                 match anymore. Fabric Details is now REQUIRED
 *                                 free text at the item/batch level (see
 *                                 createMaterialReceive / updateMaterialReceive).
 *
 * All groups that were actually supplied are combined with AND (a Receive
 * must satisfy every field the user filled in). Newest Receive first
 * (createdAt DESC) when no filters are supplied; otherwise sorted the same
 * way after filtering.
 *
 * PAGINATION: after filtering + sorting, the full id list is sliced down
 * to just the requested page (?page=, 1-based, default 1; ?limit=, default
 * 20, capped at 100) BEFORE styles/items/locations are fetched -- so a
 * request for page 3 never pulls the child rows for the other 1000+
 * receives, keeping the response small and fast regardless of table size.
 */
export const getAllMaterialReceives = async (req, res) => {
  try {
    const { invoiceNo, buyer, supplier, po, style, model, itemCodePdm, color, fabricDetails } = req.query;

    const has = (v) => typeof v === "string" && v.trim().length > 0;
    const term = (v) => `%${v.trim()}%`;

    // null = no filter group has been applied yet (i.e. show everything).
    // Once at least one group runs, this becomes the running intersection
    // of matching materialReceive ids across all supplied groups.
    let candidateIds = null;

    const intersect = (ids) => {
      const idSet = new Set(ids);
      candidateIds = candidateIds === null ? idSet : new Set([...candidateIds].filter((id) => idSet.has(id)));
    };

    // --- Parent-level fields: Invoice No. / Buyer / Supplier / PO (AND together) ---
    if (has(invoiceNo) || has(buyer) || has(supplier) || has(po)) {
      const conditions = [];
      if (has(invoiceNo)) conditions.push(like(materialReceives.invoiceNo, term(invoiceNo)));
      if (has(buyer)) conditions.push(like(materialReceives.buyer, term(buyer)));
      if (has(supplier)) conditions.push(like(materialReceives.supplier, term(supplier)));
      if (has(po)) conditions.push(like(materialReceives.po, term(po)));
      const rows = await db
        .select({ id: materialReceives.id })
        .from(materialReceives)
        .where(and(...conditions));
      intersect(rows.map((r) => r.id));
    }

    // --- Style + Model: must match on the SAME style row ---
    if (has(style) || has(model)) {
      const conditions = [];
      if (has(style)) conditions.push(like(materialReceiveStyles.style, term(style)));
      if (has(model)) conditions.push(like(materialReceiveStyles.model, term(model)));
      const rows = await db
        .select({ materialReceiveId: materialReceiveStyles.materialReceiveId })
        .from(materialReceiveStyles)
        .where(and(...conditions));
      intersect(rows.map((r) => r.materialReceiveId));
    }

    // --- Item Code/PDM + Color + Fabric Details: must match on the SAME item row ---
    if (has(itemCodePdm) || has(color) || has(fabricDetails)) {
      const conditions = [];
      if (has(itemCodePdm)) conditions.push(like(materialReceiveItems.itemCodePdm, term(itemCodePdm)));
      if (has(color)) conditions.push(like(materialReceiveItems.color, term(color)));
      if (has(fabricDetails)) conditions.push(like(materialReceiveItems.fabricDetails, term(fabricDetails)));
      const rows = await db
        .select({ materialReceiveId: materialReceiveItems.materialReceiveId })
        .from(materialReceiveItems)
        .where(and(...conditions));
      intersect(rows.map((r) => r.materialReceiveId));
    }

    let receives;
    if (candidateIds === null) {
      // No filters supplied at all -- return everything (before pagination).
      receives = await db.select().from(materialReceives).orderBy(desc(materialReceives.createdAt));
    } else {
      const ids = Array.from(candidateIds);
      receives = ids.length
        ? await db.select().from(materialReceives).where(inArray(materialReceives.id, ids))
        : [];
    }

    // Always end up newest-first, even for the filtered branch (which
    // merges several separate queries and loses ordering along the way).
    receives = receives.slice().sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (tb !== ta) return tb - ta;
      return b.id - a.id;
    });

    // --- Pagination -----------------------------------------------------
    // Slice the (already filtered + sorted) id list down to one page
    // BEFORE fetching any child rows, so styles/items/locations are only
    // ever loaded for the receives actually being returned.
    const total = receives.length;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_PAGE_SIZE));
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const start = (page - 1) * limit;
    const pageReceives = receives.slice(start, start + limit);
    // ---------------------------------------------------------------------

    const receiveIds = pageReceives.map((r) => r.id);
    const allStyles = receiveIds.length
      ? await db.select().from(materialReceiveStyles).where(inArray(materialReceiveStyles.materialReceiveId, receiveIds))
      : [];
    const allItems = receiveIds.length
      ? await db.select().from(materialReceiveItems).where(inArray(materialReceiveItems.materialReceiveId, receiveIds))
      : [];
    const allItemIds = allItems.map((i) => i.id);
    const allLocations = allItemIds.length
      ? await db.select().from(materialReceiveItemLocations).where(inArray(materialReceiveItemLocations.itemId, allItemIds))
      : [];

    const withDetails = pageReceives.map((r) => {
      const styles = allStyles.filter((s) => s.materialReceiveId === r.id);
      const items = allItems
        .filter((i) => i.materialReceiveId === r.id)
        .map((it) => ({ ...it, locations: allLocations.filter((l) => l.itemId === it.id) }));
      return { ...r, styles, items, totalItems: items.length };
    });

    res.json({ data: withDetails, total, page, limit, totalPages });
  } catch (error) {
    console.error("getAllMaterialReceives error:", error);
    res.status(500).json({ message: "Failed to fetch material receives" });
  }
};

/**
 * GET /material-receive/:id
 */
export const getMaterialReceiveById = async (req, res) => {
  try {
    const full = await getFullReceive(req.params.id);
    if (!full) return res.status(404).json({ message: "Material receive not found" });
    res.json(full);
  } catch (error) {
    console.error("getMaterialReceiveById error:", error);
    res.status(500).json({ message: "Failed to fetch material receive" });
  }
};

/**
 * POST /material-receive
 * Body: { date, invoiceNo, fromType, warehouse, buyer, supplier, season, po, item, buy, remark,
 *         styles: [{ style, model }],
 *         items: [{ itemCodePdm, color, fabricDetails, rollQty, yds }] }
 *
 * "remark" is optional free text — not required, never validated.
 * "supplier" is optional free text at the invoice/parent level — not required.
 * "buy" is optional free text at the invoice/parent level — not required.
 * "fabricDetails" is REQUIRED free text at the item/batch level (one per Item
 * Code/PDM + Color row) — every item row must have non-empty Fabric Details.
 *
 * NOTE: Location/Rack is intentionally never accepted here, and neither is
 * a Passed/Rejected quantity. Every item row is created as status
 * "pending_inspection" with unassignedRoll/Yds = 0 -- it is NOT available
 * for Location Assignment until Material Inspection approves a Passed
 * Roll/Yds for it (which may be less than what was received). The whole
 * parent record starts "pending" too.
 *
 * Every batch created also gets a "receive" row in stock_history, so the
 * ledger has a record of it entering the system before inspection or any
 * rack is ever assigned (needed for future FIFO / batch auditing).
 */
export const createMaterialReceive = async (req, res) => {
  try {
    const { date, invoiceNo, fromType, warehouse, buyer, supplier, season, po, item, buy, remark, styles, items } = req.body;

    // "buy" is no longer required at the invoice/parent level.
    if (!date || !invoiceNo || !fromType || !warehouse || !buyer || !season || !po || !item) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    if (!Array.isArray(styles) || styles.filter((s) => s?.style).length === 0) {
      return res.status(400).json({ message: "At least one Style (with its Model) is required" });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "At least one Item Code/PDM + Color row is required" });
    }
    // "fabricDetails" is now required for every item/batch row.
    if (items.some((row) => !row.fabricDetails || !row.fabricDetails.trim())) {
      return res.status(400).json({ message: "Fabric Details is required for every Item Code/PDM + Color row" });
    }

    // Transaction: parent + styles + item batches + history succeed together or not at all.
    const newId = await db.transaction(async (tx) => {
      const [inserted] = await tx.insert(materialReceives).values({
        date, invoiceNo, fromType, warehouse, buyer,
        supplier: supplier?.trim() || null,
        season, po, item,
        buy: buy?.trim() || null,
        remark: remark?.trim() || null,
        status: "pending",
      });
      const materialReceiveId = inserted.insertId;

      const styleRows = styles
        .filter((s) => s?.style)
        .map((s) => ({ materialReceiveId, style: s.style, model: s.model || null }));
      await tx.insert(materialReceiveStyles).values(styleRows);

      const itemRows = items.map((row) => {
        const rollQty = Number(row.rollQty) || 0;
        const yds = row.yds || 0;
        return {
          materialReceiveId,
          itemCodePdm: row.itemCodePdm,
          color: row.color,
          fabricDetails: row.fabricDetails.trim(),
          rollQty,
          yds,
          passedRoll: 0,
          passedYds: 0,
          rejectedRoll: 0,
          rejectedYds: 0,
          unassignedRoll: 0, // nothing to assign until Material Inspection approves it
          unassignedYds: 0,
          status: "pending_inspection",
          isRead: false,
        };
      });
      await tx.insert(materialReceiveItems).values(itemRows);

      // Read the batches back so we have their real ids for the history ledger.
      const insertedBatches = await tx
        .select()
        .from(materialReceiveItems)
        .where(eq(materialReceiveItems.materialReceiveId, materialReceiveId));

      if (insertedBatches.length) {
        const historyRows = insertedBatches.map((batch) => ({
          batchId: batch.id,
          allocationId: null,
          materialReceiveId,
          action: "receive",
          location: null,
          rollQty: batch.rollQty,
          yds: batch.yds,
          note: `Received via invoice ${invoiceNo}`,
        }));
        await tx.insert(stockHistory).values(historyRows);
      }

      return materialReceiveId;
    });

    res.status(201).json(await getFullReceive(newId));
  } catch (error) {
    console.error("createMaterialReceive error:", error);
    res.status(500).json({ message: "Failed to create material receive" });
  }
};

/**
 * PATCH /material-receive/:id
 * Replaces styles + item batches, same "delete old, insert new" approach
 * as before — but only while nothing has been racked yet. Batches that
 * are "pending_inspection", "pending" (inspected but not racked), or
 * "rejected" are all still safe to wipe and recreate; only "partial" /
 * "approved" (i.e. actually has rack stock) locks editing.
 *
 * "buy" is optional here too; "fabricDetails" is required for every incoming
 * item row, same as create.
 *
 * Any such batch that gets deleted here has its stock_history rows
 * cascade-deleted with it (FK ON DELETE CASCADE), and every newly inserted
 * replacement batch goes back to "pending_inspection" (needs to be
 * re-inspected) with its own fresh "receive" history row, so the ledger
 * always matches what's actually pending right now.
 */
export const updateMaterialReceive = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, invoiceNo, fromType, warehouse, buyer, supplier, season, po, item, buy, remark, styles, items } = req.body;

    if (Array.isArray(items) && items.some((row) => !row.fabricDetails || !row.fabricDetails.trim())) {
      return res.status(400).json({ message: "Fabric Details is required for every Item Code/PDM + Color row" });
    }

    const [existing] = await db.select().from(materialReceives).where(eq(materialReceives.id, id));
    if (!existing) return res.status(404).json({ message: "Material receive not found" });
    if (existing.status === "approved") {
      return res.status(400).json({
        message: "This receive is fully approved and already has rack stock assigned; it can no longer be edited here.",
      });
    }

    // Block edit if ANY item batch already has rack stock (partial or
    // approved) -- pending_inspection / pending / rejected batches are
    // still safe to edit since nothing has been racked against them yet.
    const lockedItems = await db
      .select()
      .from(materialReceiveItems)
      .where(and(eq(materialReceiveItems.materialReceiveId, id), inArray(materialReceiveItems.status, RACKED_STATUSES)));
    if (lockedItems.length > 0) {
      return res.status(400).json({
        message: "Some batches on this receive already have rack stock assigned; remove that stock first before editing.",
      });
    }

    await db.transaction(async (tx) => {
      await tx
        .update(materialReceives)
        .set({
          date, invoiceNo, fromType, warehouse, buyer,
          supplier: supplier?.trim() || null,
          season, po, item,
          buy: buy?.trim() || null,
          remark: remark?.trim() || null,
        })
        .where(eq(materialReceives.id, id));

      await tx.delete(materialReceiveStyles).where(eq(materialReceiveStyles.materialReceiveId, id));
      const styleRows = (Array.isArray(styles) ? styles : [])
        .filter((s) => s?.style)
        .map((s) => ({ materialReceiveId: Number(id), style: s.style, model: s.model || null }));
      if (styleRows.length) await tx.insert(materialReceiveStyles).values(styleRows);

      // Only pending_inspection / pending / rejected batches exist at this
      // point (guarded above), so it's safe to delete all of them and
      // reinsert -- they all go back to "pending_inspection" and need to
      // be re-inspected fresh.
      await tx
        .delete(materialReceiveItems)
        .where(
          and(
            eq(materialReceiveItems.materialReceiveId, id),
            inArray(materialReceiveItems.status, ["pending_inspection", "pending", "rejected"])
          )
        );

      if (Array.isArray(items) && items.length > 0) {
        const itemRows = items.map((row) => {
          const rollQty = Number(row.rollQty) || 0;
          const yds = row.yds || 0;
          return {
            materialReceiveId: Number(id),
            itemCodePdm: row.itemCodePdm,
            color: row.color,
            fabricDetails: row.fabricDetails.trim(),
            rollQty,
            yds,
            passedRoll: 0,
            passedYds: 0,
            rejectedRoll: 0,
            rejectedYds: 0,
            unassignedRoll: 0,
            unassignedYds: 0,
            status: "pending_inspection",
            isRead: false,
          };
        });
        await tx.insert(materialReceiveItems).values(itemRows);

        const insertedBatches = await tx
          .select()
          .from(materialReceiveItems)
          .where(
            and(
              eq(materialReceiveItems.materialReceiveId, Number(id)),
              eq(materialReceiveItems.status, "pending_inspection")
            )
          );

        if (insertedBatches.length) {
          const historyRows = insertedBatches.map((batch) => ({
            batchId: batch.id,
            allocationId: null,
            materialReceiveId: Number(id),
            action: "receive",
            location: null,
            rollQty: batch.rollQty,
            yds: batch.yds,
            note: `Updated via invoice ${invoiceNo}`,
          }));
          await tx.insert(stockHistory).values(historyRows);
        }
      }
    });

    res.json(await getFullReceive(id));
  } catch (error) {
    console.error("updateMaterialReceive error:", error);
    res.status(500).json({ message: "Failed to update material receive" });
  }
};

/**
 * DELETE /material-receive/:id
 * Blocked once any item batch already has rack stock assigned (status
 * "partial" or "approved"), so a Receive can't be deleted out from under
 * stock that Location Assignment (or Cutting Issue) already relies on.
 * Batches that are only "pending_inspection", "pending", or "rejected"
 * (never racked) can still be deleted freely.
 */
export const deleteMaterialReceive = async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await db.select().from(materialReceives).where(eq(materialReceives.id, id));
    if (!existing) return res.status(404).json({ message: "Material receive not found" });

    const lockedItems = await db
      .select()
      .from(materialReceiveItems)
      .where(and(eq(materialReceiveItems.materialReceiveId, id), inArray(materialReceiveItems.status, RACKED_STATUSES)));

    if (lockedItems.length > 0) {
      return res.status(400).json({
        message: "Cannot delete: some batches already have rack stock assigned. Remove that stock first.",
      });
    }

    await db.delete(materialReceives).where(eq(materialReceives.id, id));
    res.json({ message: "Material receive deleted successfully" });
  } catch (error) {
    console.error("deleteMaterialReceive error:", error);
    res.status(500).json({ message: "Failed to delete material receive" });
  }
};
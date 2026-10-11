// backend/src/controllers/material-warehouse/cuttingIssue.controllers.js

//
// Used by the MATERIAL WAREHOUSE side page (Material-warehouse -> Cutting
// Issue). Shows incoming Requisitions from Cutting as notifications
// (bell icon, read/unread), lets the warehouse user issue stock against
// them from a specific rack (decrementing the SAME
// material_receive_item_locations.availableRoll/Yds that Material Stock
// reads from), and keeps a History ledger of every issue action.
//
// Cutting requisition items no longer carry a "requested Roll" (Roll is a
// Material Warehouse-only decision, made freely at issue time based on
// what's actually on the shelf) and there is NO hard cap stopping the
// warehouse from issuing more Yds than was requested -- Cutting's
// Consumption-based estimate can be off, and the warehouse is trusted to
// judge that on the floor. The frontend shows a confirmation prompt when
// an issue would exceed the requested Yds; the backend only guards against
// issuing more than a rack physically has available.
//
// UPDATE 3: Roll and Yds no longer both have to be > 0 to issue. Some
// racks are tracked by Yds only, some by Roll only -- the warehouse user
// can now leave EITHER one at 0 (e.g. Roll=0, Yds=50, or Roll=50, Yds=0)
// and the row still goes through. Only BOTH being 0 (or missing) is
// rejected, since that isn't an issue action at all.
//
// UPDATE 4: Issuing now only requires an ITEM CODE/PDM match between the
// requisition item and the rack being issued from -- Color is
// intentionally NOT checked anymore. A rack holding a different Color of
// the same Item Code/PDM can be issued against a requisition item that
// asked for a different Color. (The frontend's "Check stock" panel also
// no longer filters by Color for this reason -- it shows every Color for
// the requested Item Code/PDM, visually flagging Color/Season mismatches,
// and lets the user pick freely.)
//
// UPDATE 5 (bugfix): the Item Code/PDM match check used to be a plain
// `batch.itemCodePdm !== reqItem.itemCodePdm` strict string compare. Real
// data can have identical-looking codes that differ only by leading/
// trailing whitespace or letter case (e.g. "4137688 " vs "4137688", or
// "ABC123" vs "abc123") -- these are the SAME item code for all practical
// purposes but fail a strict `!==` check, incorrectly blocking a valid
// issue with "Selected rack does not hold this Item Code/PDM" even though
// both rows visibly show the same code on screen. The match is now done
// via `normalizeCode()` (trim + lowercase) on both sides, same normalization
// style already used for search/filter matching in
// materialStock.controllers.js.

import { db, schema } from "../../db/db.js";
import { eq, desc, ne, inArray } from "drizzle-orm";

const {
  cuttingRequisitions,
  cuttingRequisitionItems,
  cuttingIssues,
  materialReceiveItems,
  materialReceiveItemLocations,
  materialReceives,
  stockHistory,
} = schema;

// Normalizes an Item Code/PDM for comparison: trims surrounding
// whitespace and lowercases it, so "4137688 ", "4137688", and "4137688"
// (or differing letter case on alphanumeric codes) are all treated as the
// same code. Never used for display -- only for equality checks.
function normalizeCode(v) {
  return (v ?? "").toString().trim().toLowerCase();
}

async function attachItems(requisitions) {
  const ids = requisitions.map((r) => r.id);
  const allItems = ids.length
    ? await db.select().from(cuttingRequisitionItems).where(inArray(cuttingRequisitionItems.cuttingRequisitionId, ids))
    : [];
  return requisitions.map((r) => ({
    ...r,
    items: allItems.filter((i) => i.cuttingRequisitionId === r.id),
  }));
}

/**
 * GET /cutting-issue/notifications
 *
 * Returns { unreadCount, notifications: [...] } -- unread first, then
 * newest first. Used to drive the bell icon + dropdown.
 */
export const getNotifications = async (req, res) => {
  try {
    const rows = await db.select().from(cuttingRequisitions).orderBy(desc(cuttingRequisitions.createdAt));
    const withItems = await attachItems(rows);
    const unreadCount = withItems.filter((r) => !r.isRead).length;
    const sorted = withItems
      .slice()
      .sort((a, b) => (a.isRead === b.isRead ? 0 : a.isRead ? 1 : -1));
    res.json({ unreadCount, notifications: sorted });
  } catch (error) {
    console.error("getNotifications error:", error);
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
};

/** PATCH /cutting-issue/:requisitionId/read -- marks one requisition read. */
export const markRequisitionRead = async (req, res) => {
  try {
    const { requisitionId } = req.params;
    await db.update(cuttingRequisitions).set({ isRead: true }).where(eq(cuttingRequisitions.id, requisitionId));
    res.json({ message: "Marked as read" });
  } catch (error) {
    console.error("markRequisitionRead error:", error);
    res.status(500).json({ message: "Failed to mark as read" });
  }
};

/**
 * GET /cutting-issue
 * GET /cutting-issue?search=...
 *
 * Main worklist for the Cutting Issue page: every requisition that isn't
 * fully fulfilled yet, newest first, with its item rows (requested /
 * issued / remaining Yds). Rack-wise available stock for a given Item
 * Code/PDM is fetched separately by the frontend via the existing
 * GET /material-stock?itemCodePdm=... endpoint, so this controller
 * doesn't duplicate that lookup.
 */
export const getWorklist = async (req, res) => {
  try {
    const search = req.query.search?.trim()?.toLowerCase();
    let rows = await db
      .select()
      .from(cuttingRequisitions)
      .where(ne(cuttingRequisitions.status, "fulfilled"))
      .orderBy(desc(cuttingRequisitions.createdAt));

    const withItems = await attachItems(rows);

    const filtered = search
      ? withItems.filter((r) =>
          [r.buyer, r.style, r.model, r.floor, ...r.items.flatMap((i) => [i.itemCodePdm, i.color])]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(search))
        )
      : withItems;

    res.json(filtered);
  } catch (error) {
    console.error("getWorklist error:", error);
    res.status(500).json({ message: "Failed to fetch cutting issue worklist" });
  }
};

/**
 * GET /cutting-issue/history
 *
 * Every issue action ever made, newest first, joined with its Requisition
 * Item + parent Requisition context, for the "History" tab.
 */
export const getIssueHistory = async (req, res) => {
  try {
    const rows = await db
      .select({
        id: cuttingIssues.id,
        requisitionItemId: cuttingIssues.requisitionItemId,
        cuttingRequisitionId: cuttingIssues.cuttingRequisitionId,
        allocationId: cuttingIssues.allocationId,
        itemId: cuttingIssues.itemId,
        location: cuttingIssues.location,
        rollQty: cuttingIssues.rollQty,
        yds: cuttingIssues.yds,
        createdAt: cuttingIssues.createdAt,
        itemCodePdm: cuttingRequisitionItems.itemCodePdm,
        color: cuttingRequisitionItems.color,
        requestedYds: cuttingRequisitionItems.requestedYds,
        date: cuttingRequisitions.date,
        buyer: cuttingRequisitions.buyer,
        floor: cuttingRequisitions.floor,
        season: cuttingRequisitions.season,
        style: cuttingRequisitions.style,
        model: cuttingRequisitions.model,
      })
      .from(cuttingIssues)
      .innerJoin(cuttingRequisitionItems, eq(cuttingIssues.requisitionItemId, cuttingRequisitionItems.id))
      .innerJoin(cuttingRequisitions, eq(cuttingIssues.cuttingRequisitionId, cuttingRequisitions.id))
      .orderBy(desc(cuttingIssues.createdAt));

    res.json(rows);
  } catch (error) {
    console.error("getIssueHistory error:", error);
    res.status(500).json({ message: "Failed to fetch issue history" });
  }
};

/**
 * Recomputes a requisition item's status from issued vs requested Yds
 * (Roll has no requested counterpart, so it never factors into status),
 * and cascades the parent requisition's status: "fulfilled" once every
 * item's issued Yds has reached or passed its requested Yds, "pending" if
 * nothing on the requisition has been touched yet, "partial" otherwise.
 * Issuing MORE than requestedYds is allowed (no cap) and still counts as
 * "fulfilled".
 */
async function recomputeRequisitionStatus(tx, requisitionItemId) {
  const [item] = await tx
    .select()
    .from(cuttingRequisitionItems)
    .where(eq(cuttingRequisitionItems.id, requisitionItemId));

  const issuedYds = Number(item.issuedYds);
  const requestedYds = Number(item.requestedYds);
  const fullyIssued = requestedYds > 0 && issuedYds >= requestedYds;
  const nothingIssued = issuedYds === 0;
  const status = fullyIssued ? "fulfilled" : nothingIssued ? "pending" : "partial";

  await tx
    .update(cuttingRequisitionItems)
    .set({ status, fulfilledAt: status === "fulfilled" ? new Date() : null })
    .where(eq(cuttingRequisitionItems.id, requisitionItemId));

  const siblings = await tx
    .select()
    .from(cuttingRequisitionItems)
    .where(eq(cuttingRequisitionItems.cuttingRequisitionId, item.cuttingRequisitionId));
  const effective = siblings.map((s) => (s.id === requisitionItemId ? status : s.status));
  const requisitionStatus = effective.every((s) => s === "fulfilled")
    ? "fulfilled"
    : effective.every((s) => s === "pending")
    ? "pending"
    : "partial";

  await tx
    .update(cuttingRequisitions)
    .set({ status: requisitionStatus })
    .where(eq(cuttingRequisitions.id, item.cuttingRequisitionId));

  return status;
}

/**
 * POST /cutting-issue/:requisitionItemId
 * Body: { allocationId, rollQty, yds }
 *
 * Issues stock from ONE specific rack allocation against a requisition
 * item. Can be called multiple times against the same requisition item
 * with different allocations (splitting across racks) and/or on different
 * days (partial issue over time), and there is NO cap tying this to the
 * item's requestedYds -- the warehouse can issue more than requested if
 * needed (the frontend confirms that with the user first). The only hard
 * limit enforced here is the rack's own availableRoll/Yds, since you
 * physically cannot issue more than what's on the shelf.
 *
 * Roll and Yds do NOT both have to be > 0 -- either one can be left at 0
 * (e.g. Roll=0 / Yds=50, or Roll=50 / Yds=0). Only rejected when BOTH are
 * 0, since that isn't an issue action.
 *
 * This decrements the SAME material_receive_item_locations.availableRoll/
 * Yds that Material Stock search reads from -- i.e. this is the actual
 * "minus from stock" step. Also logs to cutting_issues (this module's own
 * History) and to stock_history (action "issue") so the master ledger
 * used by Location Assignment/FIFO stays consistent.
 */
export const issueStock = async (req, res) => {
  try {
    const { requisitionItemId } = req.params;
    const { allocationId, rollQty, yds } = req.body;

    if (!allocationId) return res.status(400).json({ message: "Select a Rack to issue from" });
    const roll = Number(rollQty) || 0;
    const y = Number(yds) || 0;
    // Either Roll or Yds can be 0 -- only reject when BOTH are 0/missing.
    if (roll <= 0 && y <= 0) {
      return res.status(400).json({ message: "Enter a Roll or Yds quantity greater than 0 to issue" });
    }

    const [reqItem] = await db.select().from(cuttingRequisitionItems).where(eq(cuttingRequisitionItems.id, requisitionItemId));
    if (!reqItem) return res.status(404).json({ message: "Requisition item not found" });

    const [allocation] = await db
      .select()
      .from(materialReceiveItemLocations)
      .where(eq(materialReceiveItemLocations.id, allocationId));
    if (!allocation) return res.status(404).json({ message: "Rack allocation not found" });
    if (roll > Number(allocation.availableRoll) || y > Number(allocation.availableYds)) {
      return res.status(400).json({
        message: `Only ${allocation.availableRoll} Roll / ${allocation.availableYds} Yds available on ${allocation.location}`,
      });
    }

    // Sanity check: the rack must actually hold the same Item Code/PDM the
    // requisition item is asking for. Color is intentionally NOT checked
    // here anymore -- a rack of a different Color but the same Item
    // Code/PDM is still valid to issue against this requisition item.
    // Compared via normalizeCode() (trim + lowercase) rather than a strict
    // `!==` string compare, so identical-looking codes that only differ by
    // whitespace or letter case aren't wrongly treated as a mismatch.
    const [batch] = await db.select().from(materialReceiveItems).where(eq(materialReceiveItems.id, allocation.itemId));
    if (!batch || normalizeCode(batch.itemCodePdm) !== normalizeCode(reqItem.itemCodePdm)) {
      return res.status(400).json({ message: "Selected rack does not hold this Item Code/PDM" });
    }

    const [requisition] = await db
      .select()
      .from(cuttingRequisitions)
      .where(eq(cuttingRequisitions.id, reqItem.cuttingRequisitionId));

    await db.transaction(async (tx) => {
      await tx
        .update(materialReceiveItemLocations)
        .set({
          availableRoll: Number(allocation.availableRoll) - roll,
          availableYds: Number(allocation.availableYds) - y,
        })
        .where(eq(materialReceiveItemLocations.id, allocationId));

      await tx
        .update(cuttingRequisitionItems)
        .set({
          issuedRoll: Number(reqItem.issuedRoll) + roll,
          issuedYds: Number(reqItem.issuedYds) + y,
        })
        .where(eq(cuttingRequisitionItems.id, requisitionItemId));

      await tx.insert(cuttingIssues).values({
        requisitionItemId: Number(requisitionItemId),
        cuttingRequisitionId: reqItem.cuttingRequisitionId,
        allocationId: Number(allocationId),
        itemId: allocation.itemId,
        location: allocation.location,
        rollQty: roll,
        yds: y,
      });

      await tx.insert(stockHistory).values({
        batchId: allocation.itemId,
        allocationId: Number(allocationId),
        materialReceiveId: allocation.materialReceiveId,
        action: "issue",
        location: allocation.location,
        rollQty: roll,
        yds: y,
        note: `Issued ${roll} Roll / ${y} Yds to Cutting (Buyer ${requisition?.buyer ?? ""}, Floor ${requisition?.floor ?? ""}) from ${allocation.location}`,
      });

      await recomputeRequisitionStatus(tx, Number(requisitionItemId));
    });

    const [updatedItem] = await db.select().from(cuttingRequisitionItems).where(eq(cuttingRequisitionItems.id, requisitionItemId));
    res.json(updatedItem);
  } catch (error) {
    console.error("issueStock error:", error);
    res.status(500).json({ message: "Failed to issue stock" });
  }
};

/**
 * POST /cutting-issue/:requisitionItemId/batch
 * Body: { allocations: [{ allocationId, rollQty, yds }, ...] }
 *
 * MULTI-RACK issue in one action: the warehouse user can pick several
 * racks at once (e.g. 40 Roll from Rack-1 + 30 Roll from Rack-3) and issue
 * all of them together instead of repeating the single-rack call. All
 * rows are validated up front and applied in ONE transaction -- either
 * every row succeeds or none of them do, so stock can't end up half
 * decremented if row 2 turns out invalid.
 *
 * There is NO cap tying the total issued to the requisition item's
 * requestedYds -- the warehouse can issue more than requested (the
 * frontend confirms this with the user before calling). Each row still
 * can't exceed its own rack's availableRoll/Yds, the rack must hold the
 * same Item Code/PDM as the requisition item (Color is NOT checked -- see
 * below), and the same rack can't be picked twice in one batch (combine
 * it into a single row instead -- otherwise which row "wins" is
 * ambiguous).
 *
 * Roll and Yds do NOT both have to be > 0 on a row -- either one can be
 * left at 0. Only rejected when BOTH are 0 on a given row.
 */
export const issueStockBatch = async (req, res) => {
  try {
    const { requisitionItemId } = req.params;
    const { allocations } = req.body;

    if (!Array.isArray(allocations) || allocations.length === 0) {
      return res.status(400).json({ message: "Pick at least one rack to issue from" });
    }

    const rows = allocations.map((a) => ({
      allocationId: Number(a.allocationId),
      roll: Number(a.rollQty) || 0,
      yds: Number(a.yds) || 0,
    }));

    for (const r of rows) {
      if (!r.allocationId) return res.status(400).json({ message: "Every row needs a Rack selected" });
      // Either Roll or Yds can be 0 -- only reject when BOTH are 0/missing.
      if (r.roll <= 0 && r.yds <= 0) {
        return res.status(400).json({ message: "Every row needs a Roll or Yds quantity greater than 0" });
      }
    }
    const seen = new Set();
    for (const r of rows) {
      if (seen.has(r.allocationId)) {
        return res.status(400).json({ message: "The same rack was picked twice -- combine it into a single row" });
      }
      seen.add(r.allocationId);
    }

    const [reqItem] = await db.select().from(cuttingRequisitionItems).where(eq(cuttingRequisitionItems.id, requisitionItemId));
    if (!reqItem) return res.status(404).json({ message: "Requisition item not found" });

    const totalRoll = rows.reduce((s, r) => s + r.roll, 0);
    const totalYds = rows.reduce((s, r) => s + r.yds, 0);

    const allocationIds = rows.map((r) => r.allocationId);
    const allocs = await db
      .select()
      .from(materialReceiveItemLocations)
      .where(inArray(materialReceiveItemLocations.id, allocationIds));
    const allocById = new Map(allocs.map((a) => [a.id, a]));

    for (const r of rows) {
      const alloc = allocById.get(r.allocationId);
      if (!alloc) return res.status(404).json({ message: `Rack allocation ${r.allocationId} not found` });
      if (r.roll > Number(alloc.availableRoll) || r.yds > Number(alloc.availableYds)) {
        return res.status(400).json({
          message: `Only ${alloc.availableRoll} Roll / ${alloc.availableYds} Yds available on ${alloc.location}`,
        });
      }
    }

    // Sanity check every picked rack actually holds this Item Code/PDM.
    // Color is intentionally NOT checked here -- a rack of a different
    // Color but the same Item Code/PDM is still valid to issue from.
    // Compared via normalizeCode() (trim + lowercase) so identical-looking
    // codes that only differ by whitespace/case aren't wrongly rejected.
    const itemIds = [...new Set(allocs.map((a) => a.itemId))];
    const batches = itemIds.length
      ? await db.select().from(materialReceiveItems).where(inArray(materialReceiveItems.id, itemIds))
      : [];
    const batchById = new Map(batches.map((b) => [b.id, b]));
    const reqItemCodeNorm = normalizeCode(reqItem.itemCodePdm);
    for (const alloc of allocs) {
      const batch = batchById.get(alloc.itemId);
      if (!batch || normalizeCode(batch.itemCodePdm) !== reqItemCodeNorm) {
        return res.status(400).json({ message: `Rack ${alloc.location} does not hold this Item Code/PDM` });
      }
    }

    const [requisition] = await db
      .select()
      .from(cuttingRequisitions)
      .where(eq(cuttingRequisitions.id, reqItem.cuttingRequisitionId));

    await db.transaction(async (tx) => {
      for (const r of rows) {
        const alloc = allocById.get(r.allocationId);

        await tx
          .update(materialReceiveItemLocations)
          .set({
            availableRoll: Number(alloc.availableRoll) - r.roll,
            availableYds: Number(alloc.availableYds) - r.yds,
          })
          .where(eq(materialReceiveItemLocations.id, alloc.id));

        await tx.insert(cuttingIssues).values({
          requisitionItemId: Number(requisitionItemId),
          cuttingRequisitionId: reqItem.cuttingRequisitionId,
          allocationId: alloc.id,
          itemId: alloc.itemId,
          location: alloc.location,
          rollQty: r.roll,
          yds: r.yds,
        });

        await tx.insert(stockHistory).values({
          batchId: alloc.itemId,
          allocationId: alloc.id,
          materialReceiveId: alloc.materialReceiveId,
          action: "issue",
          location: alloc.location,
          rollQty: r.roll,
          yds: r.yds,
          note: `Issued ${r.roll} Roll / ${r.yds} Yds to Cutting (Buyer ${requisition?.buyer ?? ""}, Floor ${requisition?.floor ?? ""}) from ${alloc.location}`,
        });
      }

      await tx
        .update(cuttingRequisitionItems)
        .set({
          issuedRoll: Number(reqItem.issuedRoll) + totalRoll,
          issuedYds: Number(reqItem.issuedYds) + totalYds,
        })
        .where(eq(cuttingRequisitionItems.id, requisitionItemId));

      await recomputeRequisitionStatus(tx, Number(requisitionItemId));
    });

    const [updatedItem] = await db.select().from(cuttingRequisitionItems).where(eq(cuttingRequisitionItems.id, requisitionItemId));
    res.json(updatedItem);
  } catch (error) {
    console.error("issueStockBatch error:", error);
    res.status(500).json({ message: "Failed to issue stock" });
  }
};
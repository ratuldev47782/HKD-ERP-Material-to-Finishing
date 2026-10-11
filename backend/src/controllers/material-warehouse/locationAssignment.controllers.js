// backend/src/controllers/material-warehouse/locationAssignment.controllers.js

import { db, schema } from "../../db/db.js";
import { eq, asc, inArray } from "drizzle-orm";

const { materialReceives, materialReceiveItems, materialReceiveItemLocations, stockHistory } = schema;

/**
 * GET /location-assignment
 * GET /location-assignment?search=...
 *
 * Lists every batch that has PASSED Material Inspection and still has
 * unassigned quantity (status "pending" or "partial"), joined with its
 * parent Receive info AND its existing rack allocations, so the UI can
 * show e.g. "70 on Rack-1, 30 still unassigned".
 *
 * Batches still awaiting inspection ("pending_inspection") or fully
 * rejected ("rejected") never appear here -- only Material Inspection can
 * move a batch into "pending" (by approving a Passed Roll/Yds), which is
 * what makes it eligible for a rack in the first place.
 *
 * Ordered oldest Receive Date first (FIFO-first assignment).
 */
export const getPendingAssignments = async (req, res) => {
  try {
    const search = req.query.search?.trim()?.toLowerCase();

    const rows = await db
      .select({
        itemId: materialReceiveItems.id,
        materialReceiveId: materialReceiveItems.materialReceiveId,
        itemCodePdm: materialReceiveItems.itemCodePdm,
        color: materialReceiveItems.color,
        rollQty: materialReceiveItems.rollQty,
        yds: materialReceiveItems.yds,
        passedRoll: materialReceiveItems.passedRoll,
        passedYds: materialReceiveItems.passedYds,
        rejectedRoll: materialReceiveItems.rejectedRoll,
        rejectedYds: materialReceiveItems.rejectedYds,
        unassignedRoll: materialReceiveItems.unassignedRoll,
        unassignedYds: materialReceiveItems.unassignedYds,
        status: materialReceiveItems.status,
        date: materialReceives.date,
        invoiceNo: materialReceives.invoiceNo,
        buyer: materialReceives.buyer,
        season: materialReceives.season,
        po: materialReceives.po,
        warehouse: materialReceives.warehouse,
        item: materialReceives.item,
      })
      .from(materialReceiveItems)
      .innerJoin(materialReceives, eq(materialReceiveItems.materialReceiveId, materialReceives.id))
      // Only batches that have PASSED inspection and aren't fully racked --
      // "pending_inspection" isn't assignable yet, and "rejected"/"approved"
      // never/no-longer need to show up here.
      .where(inArray(materialReceiveItems.status, ["pending", "partial"]))
      .orderBy(asc(materialReceives.date));

    const filtered = search
      ? rows.filter((r) =>
          [r.itemCodePdm, r.color, r.invoiceNo, r.buyer, r.po, r.item]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(search))
        )
      : rows;

    const itemIds = filtered.map((r) => r.itemId);
    const allocations = itemIds.length ? await db.select().from(materialReceiveItemLocations) : [];
    const byItem = allocations.reduce((acc, a) => {
      (acc[a.itemId] ||= []).push(a);
      return acc;
    }, {});

    res.json(filtered.map((r) => ({ ...r, locations: byItem[r.itemId] || [] })));
  } catch (error) {
    console.error("getPendingAssignments error:", error);
    res.status(500).json({ message: "Failed to fetch pending location assignments" });
  }
};

/**
 * Recomputes an item's status from its unassigned quantities, and cascades
 * the parent Receive's status: "approved" once every one of its item
 * batches is fully racked, "pending" otherwise (covers both pending and
 * partial siblings, since the Receive list only distinguishes fully-done
 * vs not-yet-fully-done). Batches that are "pending_inspection" or
 * "rejected" are treated as "not yet approved" for the parent rollup,
 * same as before.
 */
async function recomputeItemStatus(tx, itemId) {
  const [item] = await tx.select().from(materialReceiveItems).where(eq(materialReceiveItems.id, itemId));
  const fullyUnassigned =
    Number(item.unassignedRoll) === Number(item.passedRoll) && Number(item.unassignedYds) === Number(item.passedYds);
  const fullyAssigned = Number(item.unassignedRoll) === 0 && Number(item.unassignedYds) === 0;

  const status = fullyAssigned ? "approved" : fullyUnassigned ? "pending" : "partial";
  await tx
    .update(materialReceiveItems)
    .set({ status, approvedAt: status === "approved" ? new Date() : null })
    .where(eq(materialReceiveItems.id, itemId));

  const siblings = await tx
    .select()
    .from(materialReceiveItems)
    .where(eq(materialReceiveItems.materialReceiveId, item.materialReceiveId));
  // A sibling that was rejected during inspection can never become
  // "approved" (it has nothing to rack), so it shouldn't block the parent
  // Receive from reaching "approved" once every OTHER batch is fully
  // racked -- treat "rejected" siblings as satisfied for this rollup.
  const allApproved = siblings.every((s) => {
    const effectiveStatus = s.id === itemId ? status : s.status;
    return effectiveStatus === "approved" || effectiveStatus === "rejected";
  });
  await tx
    .update(materialReceives)
    .set({ status: allApproved ? "approved" : "pending" })
    .where(eq(materialReceives.id, item.materialReceiveId));

  return status;
}

/**
 * POST /location-assignment/:itemId
 * Body: { location, rollQty, yds }
 *
 * Assigns PART (or all) of a batch's still-unassigned quantity to one
 * rack. Can be called multiple times against the same batch with
 * different racks to split it (e.g. 70 -> Rack-1, then later 30 -> Rack-2).
 * Only batches that have already passed Material Inspection (status
 * "pending" or "partial") can be targeted -- a batch that's still
 * "pending_inspection" or was "rejected" has no unassigned quantity to
 * give (unassignedRoll/Yds stay 0 in both cases), so this naturally fails
 * with "remaining unassigned" = 0 for those.
 *
 * MERGE BEHAVIOR: if this exact batch (itemId) already has an allocation
 * on the SAME rack (location), the new Roll/Yds are added into that
 * existing allocation row instead of creating a second, duplicate row for
 * the same batch + rack. This is what stops Material Stock search from
 * showing the same batch on the same rack as two separate lines just
 * because someone assigned to it in two calls (e.g. assigned some, then
 * came back later and assigned the rest to the same rack).
 *
 * Also writes a "location_assignment" row to stock_history either way.
 */
export const assignLocation = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { location, rollQty, yds } = req.body;

    if (!location || !location.trim()) {
      return res.status(400).json({ message: "Location/Rack is required" });
    }
    const roll = Number(rollQty) || 0;
    const y = Number(yds) || 0;

    // Both Roll AND Yds must be a positive quantity -- a rack assignment
    // that only sets one of the two (leaving the other at 0) is no longer
    // allowed, since a real rack placement always has both.
    if (roll <= 0 || y <= 0) {
      return res.status(400).json({ message: "Enter both a Roll and a Yds quantity greater than 0 to assign" });
    }

    const [item] = await db.select().from(materialReceiveItems).where(eq(materialReceiveItems.id, itemId));
    if (!item) return res.status(404).json({ message: "Item/Color batch not found" });
    if (item.status === "pending_inspection") {
      return res.status(400).json({ message: "This batch hasn't passed Material Inspection yet" });
    }
    if (item.status === "rejected") {
      return res.status(400).json({ message: "This batch was rejected during inspection and has nothing to assign" });
    }
    if (item.status === "approved") {
      return res.status(400).json({ message: "This batch is already fully assigned" });
    }
    if (roll > Number(item.unassignedRoll) || y > Number(item.unassignedYds)) {
      return res.status(400).json({
        message: `Only ${item.unassignedRoll} Roll / ${item.unassignedYds} Yds remain unassigned`,
      });
    }

    const trimmedLocation = location.trim();

    await db.transaction(async (tx) => {
      // Look for an existing allocation of THIS batch on THIS exact rack.
      const existingAllocs = await tx
        .select()
        .from(materialReceiveItemLocations)
        .where(eq(materialReceiveItemLocations.itemId, Number(itemId)));
      const existing = existingAllocs.find((a) => a.location === trimmedLocation);

      let allocationId;

      if (existing) {
        // MERGE: add the new quantity into the existing rack row instead of
        // creating a duplicate. availableRoll/Yds only track what hasn't
        // been issued yet, so the new quantity is added there too.
        await tx
          .update(materialReceiveItemLocations)
          .set({
            rollQty: Number(existing.rollQty) + roll,
            yds: Number(existing.yds) + y,
            availableRoll: Number(existing.availableRoll) + roll,
            availableYds: Number(existing.availableYds) + y,
          })
          .where(eq(materialReceiveItemLocations.id, existing.id));
        allocationId = existing.id;
      } else {
        const [inserted] = await tx.insert(materialReceiveItemLocations).values({
          itemId: Number(itemId),
          materialReceiveId: item.materialReceiveId,
          location: trimmedLocation,
          rollQty: roll,
          yds: y,
          availableRoll: roll,
          availableYds: y,
        });
        allocationId = inserted.insertId;
      }

      await tx
        .update(materialReceiveItems)
        .set({
          unassignedRoll: Number(item.unassignedRoll) - roll,
          unassignedYds: Number(item.unassignedYds) - y,
        })
        .where(eq(materialReceiveItems.id, itemId));

      await tx.insert(stockHistory).values({
        batchId: Number(itemId),
        allocationId,
        materialReceiveId: item.materialReceiveId,
        action: "location_assignment",
        location: trimmedLocation,
        rollQty: roll,
        yds: y,
        note: existing
          ? `Added ${roll} Roll / ${y} Yds to existing allocation on ${trimmedLocation}`
          : `Assigned ${roll} Roll / ${y} Yds to ${trimmedLocation}`,
      });

      await recomputeItemStatus(tx, Number(itemId));
    });

    const [updatedItem] = await db.select().from(materialReceiveItems).where(eq(materialReceiveItems.id, itemId));
    const locations = await db
      .select()
      .from(materialReceiveItemLocations)
      .where(eq(materialReceiveItemLocations.itemId, itemId));
    res.json({ ...updatedItem, locations });
  } catch (error) {
    console.error("assignLocation error:", error);
    res.status(500).json({ message: "Failed to assign location" });
  }
};

/**
 * PATCH /location-assignment/allocation/:allocationId
 * Body: { location?, rollQty?, yds? }
 *
 * Edits an existing rack allocation (move it to a different rack, or
 * change how much sits on it). Only allowed while nothing has been issued
 * from it yet (availableRoll/Yds must still equal rollQty/yds). Writes an
 * "adjustment" row to stock_history.
 *
 * Headroom is now computed against the batch's PASSED quantity (not the
 * originally received quantity), since a rejected portion of a batch can
 * never be racked no matter how an allocation is edited.
 *
 * NOTE: if the person edits the Location field here to a rack that ALREADY
 * has a separate allocation for this same batch, that's a genuine
 * ambiguous case (which of the two rows should "win"?) so we deliberately
 * do NOT silently merge on edit -- we block it and ask them to remove one
 * of the two allocations first. Merging only happens automatically on the
 * simpler, common path (assignLocation, i.e. the "Assign" button).
 */
export const updateAllocation = async (req, res) => {
  try {
    const { allocationId } = req.params;
    const { location, rollQty, yds } = req.body;

    const [alloc] = await db
      .select()
      .from(materialReceiveItemLocations)
      .where(eq(materialReceiveItemLocations.id, allocationId));
    if (!alloc) return res.status(404).json({ message: "Allocation not found" });
    if (Number(alloc.availableRoll) !== Number(alloc.rollQty) || Number(alloc.availableYds) !== Number(alloc.yds)) {
      return res.status(400).json({ message: "Can't edit: some of this rack's stock has already been issued" });
    }

    const [item] = await db.select().from(materialReceiveItems).where(eq(materialReceiveItems.id, alloc.itemId));

    const newRoll = rollQty !== undefined ? Number(rollQty) : Number(alloc.rollQty);
    const newYds = yds !== undefined ? Number(yds) : Number(alloc.yds);
    const newLocation = location?.trim() || alloc.location;

    // Guard against creating a duplicate rack row via edit: if moving this
    // allocation onto a rack that already holds another allocation for the
    // same batch, block it (ambiguous which one should absorb the other).
    if (newLocation !== alloc.location) {
      const siblingAllocs = await db
        .select()
        .from(materialReceiveItemLocations)
        .where(eq(materialReceiveItemLocations.itemId, alloc.itemId));
      const conflict = siblingAllocs.find((a) => a.id !== alloc.id && a.location === newLocation);
      if (conflict) {
        return res.status(400).json({
          message: `This batch already has a separate allocation on ${newLocation}. Remove one of them first, then re-assign to merge.`,
        });
      }
    }

    // Headroom = whatever's currently unassigned on the item PLUS what this
    // allocation already holds (since we're about to replace its old qty).
    // Bounded by the PASSED quantity, never the raw received quantity.
    const headroomRoll = Number(item.unassignedRoll) + Number(alloc.rollQty);
    const headroomYds = Number(item.unassignedYds) + Number(alloc.yds);
    if (newRoll > headroomRoll || newYds > headroomYds) {
      return res.status(400).json({ message: `Max available for this allocation is ${headroomRoll} Roll / ${headroomYds} Yds` });
    }
    if (newRoll < 0 || newYds < 0) {
      return res.status(400).json({ message: "Quantities can't be negative" });
    }

    await db.transaction(async (tx) => {
      await tx
        .update(materialReceiveItemLocations)
        .set({ location: newLocation, rollQty: newRoll, yds: newYds, availableRoll: newRoll, availableYds: newYds })
        .where(eq(materialReceiveItemLocations.id, allocationId));

      await tx
        .update(materialReceiveItems)
        .set({ unassignedRoll: headroomRoll - newRoll, unassignedYds: headroomYds - newYds })
        .where(eq(materialReceiveItems.id, alloc.itemId));

      await tx.insert(stockHistory).values({
        batchId: alloc.itemId,
        allocationId: Number(allocationId),
        materialReceiveId: alloc.materialReceiveId,
        action: "adjustment",
        location: newLocation,
        rollQty: newRoll,
        yds: newYds,
        note: `Allocation edited: now ${newRoll} Roll / ${newYds} Yds at ${newLocation}`,
      });

      await recomputeItemStatus(tx, alloc.itemId);
    });

    const [updatedItem] = await db.select().from(materialReceiveItems).where(eq(materialReceiveItems.id, alloc.itemId));
    const locations = await db
      .select()
      .from(materialReceiveItemLocations)
      .where(eq(materialReceiveItemLocations.itemId, alloc.itemId));
    res.json({ ...updatedItem, locations });
  } catch (error) {
    console.error("updateAllocation error:", error);
    res.status(500).json({ message: "Failed to update allocation" });
  }
};

/**
 * DELETE /location-assignment/allocation/:allocationId
 *
 * Removes an allocation entirely and returns its quantity to the batch's
 * unassigned pool. Only allowed if nothing's been issued from it yet.
 * Writes an "adjustment" row to stock_history before deleting.
 */
export const deleteAllocation = async (req, res) => {
  try {
    const { allocationId } = req.params;
    const [alloc] = await db
      .select()
      .from(materialReceiveItemLocations)
      .where(eq(materialReceiveItemLocations.id, allocationId));
    if (!alloc) return res.status(404).json({ message: "Allocation not found" });
    if (Number(alloc.availableRoll) !== Number(alloc.rollQty) || Number(alloc.availableYds) !== Number(alloc.yds)) {
      return res.status(400).json({ message: "Can't remove: some of this rack's stock has already been issued" });
    }

    await db.transaction(async (tx) => {
      const [item] = await tx.select().from(materialReceiveItems).where(eq(materialReceiveItems.id, alloc.itemId));

      await tx.insert(stockHistory).values({
        batchId: alloc.itemId,
        allocationId: Number(allocationId),
        materialReceiveId: alloc.materialReceiveId,
        action: "adjustment",
        location: alloc.location,
        rollQty: alloc.rollQty,
        yds: alloc.yds,
        note: `Allocation removed from ${alloc.location}: ${alloc.rollQty} Roll / ${alloc.yds} Yds returned to unassigned`,
      });

      await tx.delete(materialReceiveItemLocations).where(eq(materialReceiveItemLocations.id, allocationId));

      await tx
        .update(materialReceiveItems)
        .set({
          unassignedRoll: Number(item.unassignedRoll) + Number(alloc.rollQty),
          unassignedYds: Number(item.unassignedYds) + Number(alloc.yds),
        })
        .where(eq(materialReceiveItems.id, alloc.itemId));

      await recomputeItemStatus(tx, alloc.itemId);
    });

    res.json({ message: "Allocation removed" });
  } catch (error) {
    console.error("deleteAllocation error:", error);
    res.status(500).json({ message: "Failed to delete allocation" });
  }
};
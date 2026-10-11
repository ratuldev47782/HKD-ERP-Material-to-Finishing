// backend/src/controllers/material-warehouse/materialInspection.controllers.js

import { db, schema } from "../../db/db.js";
import { eq, desc, inArray, ne } from "drizzle-orm";

const { materialReceives, materialReceiveItems, materialReceiveStyles, stockHistory } = schema;

async function attachReceiveInfo(items) {
  const receiveIds = [...new Set(items.map((i) => i.materialReceiveId))];
  const receives = receiveIds.length
    ? await db.select().from(materialReceives).where(inArray(materialReceives.id, receiveIds))
    : [];
  const styles = receiveIds.length
    ? await db.select().from(materialReceiveStyles).where(inArray(materialReceiveStyles.materialReceiveId, receiveIds))
    : [];
  const stylesByReceive = styles.reduce((acc, s) => {
    (acc[s.materialReceiveId] ||= []).push(s);
    return acc;
  }, {});
  const byId = new Map(receives.map((r) => [r.id, { ...r, styles: stylesByReceive[r.id] || [] }]));
  return items.map((i) => ({ ...i, receive: byId.get(i.materialReceiveId) || null }));
}

/**
 * Normalizes whatever the frontend sent for "defects" into a clean array
 * of trimmed, non-empty, de-duplicated strings -- or null if there's
 * nothing worth storing. Accepts a single string too (defensive: in case
 * a caller ever sends one defect as a bare string instead of a 1-item
 * array), so both a "Single" defect and "Multiple" defects end up in the
 * exact same shape in the DB (a JSON array, or null).
 */
function normalizeDefects(defects) {
  if (defects == null) return null;
  const arr = Array.isArray(defects) ? defects : [defects];
  const cleaned = [...new Set(arr.map((d) => String(d).trim()).filter(Boolean))];
  return cleaned.length ? cleaned : null;
}

/**
 * GET /material-inspection/notifications
 * Returns { unreadCount, notifications: [...] } -- unread first, then
 * newest first. Drives the bell icon + dropdown.
 */
export const getNotifications = async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(materialReceiveItems)
      .where(eq(materialReceiveItems.status, "pending_inspection"))
      .orderBy(desc(materialReceiveItems.createdAt));
    const withReceive = await attachReceiveInfo(rows);
    const unreadCount = withReceive.filter((r) => !r.isRead).length;
    const sorted = withReceive.slice().sort((a, b) => (a.isRead === b.isRead ? 0 : a.isRead ? 1 : -1));
    res.json({ unreadCount, notifications: sorted });
  } catch (error) {
    console.error("getNotifications error:", error);
    res.status(500).json({ message: "Failed to fetch inspection notifications" });
  }
};

/** PATCH /material-inspection/:itemId/read -- marks one batch's notification read. */
export const markItemRead = async (req, res) => {
  try {
    const { itemId } = req.params;
    await db.update(materialReceiveItems).set({ isRead: true }).where(eq(materialReceiveItems.id, itemId));
    res.json({ message: "Marked as read" });
  } catch (error) {
    console.error("markItemRead error:", error);
    res.status(500).json({ message: "Failed to mark as read" });
  }
};

/**
 * GET /material-inspection
 * GET /material-inspection?search=...
 * Worklist: every batch still awaiting inspection, newest first.
 */
export const getWorklist = async (req, res) => {
  try {
    const search = req.query.search?.trim()?.toLowerCase();
    const rows = await db
      .select()
      .from(materialReceiveItems)
      .where(eq(materialReceiveItems.status, "pending_inspection"))
      .orderBy(desc(materialReceiveItems.createdAt));
    const withReceive = await attachReceiveInfo(rows);

    const filtered = search
      ? withReceive.filter((r) =>
          [r.itemCodePdm, r.color, r.receive?.invoiceNo, r.receive?.buyer, r.receive?.po, r.receive?.item]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(search))
        )
      : withReceive;

    res.json(filtered);
  } catch (error) {
    console.error("getWorklist error:", error);
    res.status(500).json({ message: "Failed to fetch inspection worklist" });
  }
};

/**
 * GET /material-inspection/history
 * Every batch that has already been inspected (passed and/or rejected),
 * newest inspected first. Each row includes `defects` -- the array of
 * defect names recorded at inspection time (or null if none).
 */
export const getHistory = async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(materialReceiveItems)
      .where(ne(materialReceiveItems.status, "pending_inspection"))
      .orderBy(desc(materialReceiveItems.inspectedAt));
    const withReceive = await attachReceiveInfo(rows);
    res.json(withReceive);
  } catch (error) {
    console.error("getHistory error:", error);
    res.status(500).json({ message: "Failed to fetch inspection history" });
  }
};

/**
 * GET /material-inspection/:itemId
 * Single batch lookup (used by the worklist detail expand, if ever
 * needed directly instead of via the list already fetched).
 */
export const getItemById = async (req, res) => {
  try {
    const { itemId } = req.params;
    const [item] = await db.select().from(materialReceiveItems).where(eq(materialReceiveItems.id, itemId));
    if (!item) return res.status(404).json({ message: "Batch not found" });
    const [withReceive] = await attachReceiveInfo([item]);
    res.json(withReceive);
  } catch (error) {
    console.error("getItemById error:", error);
    res.status(500).json({ message: "Failed to fetch batch" });
  }
};

/**
 * POST /material-inspection/:itemId
 * Body: { passedRoll, passedYds, note, defects }
 *
 * Records the inspection decision for one batch. passedRoll/passedYds
 * must each be between 0 and the batch's received rollQty/yds. Whatever
 * isn't passed is automatically recorded as rejected (received - passed).
 * A batch can only be inspected once while still "pending_inspection" --
 * re-inspecting an already-inspected batch is not supported here (that
 * would risk clobbering rack assignments already made against it).
 *
 * `defects` is optional -- an array of defect-name strings found during
 * inspection (Single = one entry, Multiple = several). It's normalized
 * (trimmed, de-duplicated, blanks dropped) and stored as-is in the
 * `defects` JSON column; no separate table is needed since a defect list
 * only ever belongs to exactly one batch/inspection. Left null when
 * nothing was recorded (e.g. the batch passed clean).
 *
 * On success: unassignedRoll/Yds are set to the PASSED amount (this is
 * what makes it available on Location Assignment), status becomes
 * "rejected" if nothing passed, otherwise "pending" (ready to be racked).
 * A "inspection" row is written to stock_history either way, with the
 * defect names folded into its note when present.
 */
export const inspectItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { passedRoll, passedYds, note, defects } = req.body;

    const [item] = await db.select().from(materialReceiveItems).where(eq(materialReceiveItems.id, itemId));
    if (!item) return res.status(404).json({ message: "Batch not found" });
    if (item.status !== "pending_inspection") {
      return res.status(400).json({ message: "This batch has already been inspected" });
    }

    const passRoll = Number(passedRoll);
    const passYds = Number(passedYds);
    if (Number.isNaN(passRoll) || Number.isNaN(passYds) || passRoll < 0 || passYds < 0) {
      return res.status(400).json({ message: "Passed Roll and Passed Yds must be 0 or more" });
    }
    if (passRoll > Number(item.rollQty) || passYds > Number(item.yds)) {
      return res.status(400).json({
        message: `Passed quantity can't exceed the received amount (${item.rollQty} Roll / ${item.yds} Yds)`,
      });
    }
    if (defects !== undefined && defects !== null && !Array.isArray(defects) && typeof defects !== "string") {
      return res.status(400).json({ message: "Defects must be a list of defect names" });
    }

    const rejectRoll = Number(item.rollQty) - passRoll;
    const rejectYds = Number(item.yds) - passYds;
    const fullyRejected = passRoll === 0 && passYds === 0;
    const newStatus = fullyRejected ? "rejected" : "pending";
    const normalizedDefects = normalizeDefects(defects);

    const [receive] = await db.select().from(materialReceives).where(eq(materialReceives.id, item.materialReceiveId));

    await db.transaction(async (tx) => {
      await tx
        .update(materialReceiveItems)
        .set({
          passedRoll: passRoll,
          passedYds: passYds,
          rejectedRoll: rejectRoll,
          rejectedYds: rejectYds,
          unassignedRoll: passRoll,
          unassignedYds: passYds,
          status: newStatus,
          inspectedAt: new Date(),
          inspectionNote: note?.trim() || null,
          defects: normalizedDefects,
          isRead: true,
        })
        .where(eq(materialReceiveItems.id, itemId));

      const baseNote = fullyRejected
        ? `Inspection rejected all ${item.rollQty} Roll / ${item.yds} Yds (invoice ${receive?.invoiceNo ?? ""})`
        : `Inspection passed ${passRoll} Roll / ${passYds} Yds, rejected ${rejectRoll} Roll / ${rejectYds} Yds (invoice ${receive?.invoiceNo ?? ""})`;
      const defectsSuffix = normalizedDefects ? ` -- Defects: ${normalizedDefects.join(", ")}` : "";

      await tx.insert(stockHistory).values({
        batchId: Number(itemId),
        allocationId: null,
        materialReceiveId: item.materialReceiveId,
        action: "inspection",
        location: null,
        rollQty: passRoll,
        yds: passYds,
        note: `${baseNote}${defectsSuffix}`,
      });
    });

    const [updated] = await db.select().from(materialReceiveItems).where(eq(materialReceiveItems.id, itemId));
    res.json(updated);
  } catch (error) {
    console.error("inspectItem error:", error);
    res.status(500).json({ message: "Failed to record inspection" });
  }
};
// backend/src/controllers/dashboard.controllers.js
//
// Controller for the main Dashboard overview screen.
//
// Powers a single GET endpoint that gives the frontend everything it
// needs in one call:
//   kpis                  -> headline numbers (Total Available Roll/Yds,
//                             Pending Inspection count, Total Receiving
//                             count) -- ALL-TIME, never date-filtered.
//   buyerStock             -> Available Roll/Yds summed per Buyer (bar
//                             chart) -- ALL-TIME, never date-filtered.
//   itemCodeStock           -> Available Roll/Yds summed per Item Code/PDM
//                             (bar chart) -- ALL-TIME, never date-filtered.
//   statusBreakdown        -> batch counts per material_receive_items.status
//                             (pie chart) -- filtered to batches whose
//                             PARENT Material Receive's `date` equals the
//                             requested date (defaults to today).
//   requisitionBreakdown   -> cutting_requisitions counts per status
//                             (pie chart) -- filtered to requisitions
//                             whose own `date` equals the requested date
//                             (defaults to today).
//
// Query params:
//   ?date=YYYY-MM-DD   -> optional. Controls ONLY statusBreakdown and
//                          requisitionBreakdown (exact-day match, not
//                          cumulative). Defaults to server "today" when
//                          omitted. Everything else on the response
//                          (kpis, buyerStock, itemCodeStock) always
//                          reflects the full, all-time dataset.
//
// Nothing here writes to the database -- pure read + aggregate, same as
// the existing materialRackView controller.

import { db, schema } from "../db/db.js";

const {
  materialReceives,
  materialReceiveItems,
  materialReceiveItemLocations,
  cuttingRequisitions,
} = schema;

const round2 = (n) => Math.round(Number(n) * 100) / 100;

// Server-local "today" as YYYY-MM-DD, matching the string format the
// `date` (mode: "string") columns are stored in.
const todayStr = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

/**
 * GET /dashboard/buyer-overview
 * GET /dashboard/buyer-overview?date=2026-08-24
 */
export const dashboardOverview = async (req, res) => {
  try {
    const requestedDate = typeof req.query.date === "string" && req.query.date.trim() ? req.query.date.trim() : null;
    const selectedDate = requestedDate || todayStr();

    const [receives, items, locations, requisitions] = await Promise.all([
      db.select().from(materialReceives),
      db.select().from(materialReceiveItems),
      db.select().from(materialReceiveItemLocations),
      db.select().from(cuttingRequisitions),
    ]);

    const receiveById = new Map(receives.map((r) => [r.id, r]));
    const itemById = new Map(items.map((i) => [i.id, i]));

    // ---------------- KPIs (all-time, NOT date filtered) ----------------
    const totalAvailableYds = locations.reduce((s, l) => s + Number(l.availableYds), 0);
    const totalAvailableRoll = locations.reduce((s, l) => s + Number(l.availableRoll), 0);
    const pendingInspectionCount = items.filter((i) => i.status === "pending_inspection").length;
    // Total number of DISTINCT invoice numbers ever received. One invoice
    // (invoiceNo) can produce multiple materialReceives rows -- e.g. the
    // same invoice re-entered across item codes/colors, or edited/split
    // over time -- so counting raw rows overcounts the true invoice count.
    // We count unique invoiceNo values instead so this reflects "how many
    // distinct invoices" rather than "how many Material Receive rows".
    const totalReceivingCount = new Set(
      receives.map((r) => r.invoiceNo).filter(Boolean)
    ).size;

    // ---------------- Available stock by Buyer (all-time) ----------------
    // via location -> its batch -> that batch's parent Receive.buyer
    const buyerTotals = new Map(); // buyer -> { buyer, roll, yds }
    for (const loc of locations) {
      const item = itemById.get(loc.itemId);
      const receive = item ? receiveById.get(item.materialReceiveId) : null;
      const buyer = receive?.buyer || "Unknown";
      const cur = buyerTotals.get(buyer) || { buyer, roll: 0, yds: 0 };
      cur.roll += Number(loc.availableRoll);
      cur.yds += Number(loc.availableYds);
      buyerTotals.set(buyer, cur);
    }
    const buyerStock = Array.from(buyerTotals.values())
      .map((b) => ({ buyer: b.buyer, roll: round2(b.roll), yds: round2(b.yds) }))
      .sort((a, b) => b.yds - a.yds);

    // ---------------- Available stock by Item Code/PDM (all-time) ----------------
    // via location -> its batch -> that batch's itemCodePdm. Replaces the
    // old "By Supplier" panel (was a straight reuse of the
    // materialRackView controller's stockBySupplier -- not aggregated
    // here at all anymore).
    const itemCodeTotals = new Map(); // itemCode -> { itemCode, roll, yds }
    for (const loc of locations) {
      const item = itemById.get(loc.itemId);
      const itemCode = item?.itemCodePdm || "Unknown";
      const cur = itemCodeTotals.get(itemCode) || { itemCode, roll: 0, yds: 0 };
      cur.roll += Number(loc.availableRoll);
      cur.yds += Number(loc.availableYds);
      itemCodeTotals.set(itemCode, cur);
    }
    const itemCodeStock = Array.from(itemCodeTotals.values())
      .map((b) => ({ itemCode: b.itemCode, roll: round2(b.roll), yds: round2(b.yds) }))
      .sort((a, b) => b.yds - a.yds);

    // ---------------- Batch status breakdown (pie) ----------------
    // Filtered to batches whose PARENT Material Receive's `date` equals
    // selectedDate (exact-day match, not cumulative). A batch has no date
    // of its own -- it inherits its parent Receive's Date/Invoice date.
    const STATUS_ORDER = ["approved", "partial", "pending", "pending_inspection", "rejected"];
    const itemsForDate = items.filter((i) => {
      const receive = receiveById.get(i.materialReceiveId);
      return receive?.date === selectedDate;
    });
    const statusBreakdown = STATUS_ORDER.map((status) => ({
      status,
      count: itemsForDate.filter((i) => i.status === status).length,
    })).filter((s) => s.count > 0);

    // ---------------- Cutting requisition breakdown (pie) ----------------
    // Filtered to requisitions whose own `date` equals selectedDate
    // (exact-day match, not cumulative).
    const REQ_STATUS_ORDER = ["pending", "partial", "fulfilled"];
    const requisitionsForDate = requisitions.filter((r) => r.date === selectedDate);
    const requisitionBreakdown = REQ_STATUS_ORDER.map((status) => ({
      status,
      count: requisitionsForDate.filter((r) => r.status === status).length,
    })).filter((s) => s.count > 0);

    res.json({
      selectedDate,
      kpis: {
        totalAvailableYds: round2(totalAvailableYds),
        totalAvailableRoll,
        pendingInspectionCount,
        totalReceivingCount,
      },
      buyerStock,
      itemCodeStock,
      statusBreakdown,
      requisitionBreakdown,
    });
  } catch (error) {
    console.error("dashboardOverview error:", error);
    res.status(500).json({ message: "Failed to load dashboard overview" });
  }
};
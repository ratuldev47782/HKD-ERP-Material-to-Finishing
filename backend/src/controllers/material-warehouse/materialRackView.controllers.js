// backend/src/controllers/material-warehouse/materialRackView.controllers.js


//
// One-shot aggregation endpoint that powers the Material Control
// dashboard (material-dashboard page). Pulls the handful of tables it
// needs and does all grouping/summing in JS -- same style as the rest
// of this codebase's controllers -- rather than SQL GROUP BY, since the
// tables involved are small and this keeps every number traceable back
// to a real row instead of hidden behind a query.

import { db, schema } from "../../db/db.js";
import { desc } from "drizzle-orm";

const {
  materialReceives,
  materialReceiveItems,
  materialReceiveItemLocations,
  cuttingRequisitions,
  cuttingRequisitionItems,
  stockHistory,
} = schema;

/**
 * GET /dashboard/material-overview
 *
 * Returns everything the Material Control dashboard needs in one call:
 *   kpis              -> headline numbers
 *   statusBreakdown    -> batch counts per material_receive_items.status
 *   stockByWarehouse   -> available Yds summed per Receive.warehouse
 *   stockBySupplier    -> available Yds summed per Receive.supplier
 *   topItems           -> top 8 Item Code/PDM + Color by available Yds
 *   rackOccupancy      -> per-rack fill % (availableYds / placed Yds),
 *                          plus a per-rack items[] breakdown (Item
 *                          Code/PDM + Color + Roll/Yds still available
 *                          on that specific rack) for the hover tooltip
 *   requisitionStatus  -> cutting_requisitions counts per status
 *   recentActivity     -> last 10 stock_history rows, newest first
 */
export const materialRackView = async (req, res) => {
  try {
    const [receives, items, locations, requisitions, requisitionItems, recentHistory] = await Promise.all([
      db.select().from(materialReceives),
      db.select().from(materialReceiveItems),
      db.select().from(materialReceiveItemLocations),
      db.select().from(cuttingRequisitions),
      db.select().from(cuttingRequisitionItems),
      db.select().from(stockHistory).orderBy(desc(stockHistory.createdAt)).limit(10),
    ]);

    const receiveById = new Map(receives.map((r) => [r.id, r]));
    const itemById = new Map(items.map((i) => [i.id, i]));

    // ---------------- KPIs ----------------
    const totalAvailableYds = locations.reduce((s, l) => s + Number(l.availableYds), 0);
    const totalAvailableRoll = locations.reduce((s, l) => s + Number(l.availableRoll), 0);
    const pendingInspectionCount = items.filter((i) => i.status === "pending_inspection").length;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const rejectedThisMonth = items.filter(
      (i) => i.status === "rejected" && i.inspectedAt && new Date(i.inspectedAt) >= startOfMonth
    ).length;

    const activeRequisitions = requisitions.filter((r) => r.status === "pending" || r.status === "partial").length;

    // ---------------- Batch status breakdown ----------------
    const STATUS_ORDER = ["approved", "partial", "pending", "pending_inspection", "rejected"];
    const statusBreakdown = STATUS_ORDER.map((status) => ({
      status,
      count: items.filter((i) => i.status === status).length,
    }));

    // ---------------- Available stock by warehouse ----------------
    // (via location -> its batch -> that batch's parent Receive.warehouse)
    const warehouseTotals = new Map();
    for (const loc of locations) {
      const item = itemById.get(loc.itemId);
      const receive = item ? receiveById.get(item.materialReceiveId) : null;
      const wh = receive?.warehouse || "Unknown";
      warehouseTotals.set(wh, (warehouseTotals.get(wh) || 0) + Number(loc.availableYds));
    }
    const stockByWarehouse = Array.from(warehouseTotals.entries())
      .map(([warehouse, yds]) => ({ warehouse, yds: Math.round(yds * 100) / 100 }))
      .sort((a, b) => a.warehouse.localeCompare(b.warehouse));

    // ---------------- Available stock by supplier ----------------
    // (via location -> its batch -> that batch's parent Receive.supplier)
    // supplier is optional/free-text at the Receive level, so anything
    // blank/null is bucketed under "Unknown" rather than dropped, same
    // treatment as warehouse above.
    //
    // Free text also means the same supplier gets typed inconsistently
    // ("SANLI" vs "Sanli" vs "sanli "). We group by a normalized key
    // (trimmed + uppercased) so those all collapse into ONE bar, but
    // still display a single consistent label -- the uppercased form --
    // rather than whichever casing happened to be typed most recently.
    const supplierTotals = new Map(); // normalizedKey -> { label, yds }
    for (const loc of locations) {
      const item = itemById.get(loc.itemId);
      const receive = item ? receiveById.get(item.materialReceiveId) : null;
      const raw = (receive?.supplier || "").trim();
      const label = raw ? raw.toUpperCase() : "UNKNOWN";
      const cur = supplierTotals.get(label) || { label, yds: 0 };
      cur.yds += Number(loc.availableYds);
      supplierTotals.set(label, cur);
    }
    const stockBySupplier = Array.from(supplierTotals.values())
      .map((r) => ({ supplier: r.label, yds: Math.round(r.yds * 100) / 100 }))
      .sort((a, b) => b.yds - a.yds);

    // ---------------- Top items by available Yds ----------------
    const itemTotals = new Map(); // "code||color" -> { itemCodePdm, color, yds }
    for (const loc of locations) {
      const item = itemById.get(loc.itemId);
      if (!item) continue;
      const key = `${item.itemCodePdm}||${item.color}`;
      const cur = itemTotals.get(key) || { itemCodePdm: item.itemCodePdm, color: item.color, yds: 0 };
      cur.yds += Number(loc.availableYds);
      itemTotals.set(key, cur);
    }
    const topItems = Array.from(itemTotals.values())
      .sort((a, b) => b.yds - a.yds)
      .slice(0, 8)
      .map((r) => ({ item: `${r.itemCodePdm} / ${r.color}`, yds: Math.round(r.yds * 100) / 100 }));

    // ---------------- Rack occupancy (+ per-rack item breakdown) ----------------
    // fillPercent = how much of what was ever placed on this rack is
    // STILL available (100% = nothing issued yet from it).
    //
    // IMPORTANT FIX: a rack can have MULTIPLE location-allocation rows
    // over its lifetime (one per batch ever assigned there). Previously
    // every row's original `yds` was added to placedYds forever, even
    // after that row's stock was 100% issued (availableYds === 0). That
    // meant a fully-issued old batch kept inflating the denominator, so
    // if the same rack was later refilled from scratch with a brand-new
    // batch, fillPercent came out much lower than the rack's true,
    // current occupancy (e.g. an actually-full rack showing 15-50%
    // instead of ~100%), and kept drifting lower with every future
    // receive/issue cycle.
    //
    // Fix: a location row that has been fully drawn down
    // (availableYds === 0) no longer occupies real physical space on the
    // rack, so it should NOT contribute to placedYds/availableYds at
    // all -- only rows that still hold live stock represent the rack's
    // current occupancy. The rack entry is still created/kept either
    // way, so a rack with only exhausted rows correctly shows up as an
    // empty rack (fillPercent 0) instead of vanishing or being skewed.
    const rackTotals = new Map(); // location -> { placedYds, availableYds, items: Map(key -> {itemCodePdm,color,availableRoll,availableYds}) }
    for (const loc of locations) {
      const cur = rackTotals.get(loc.location) || { placedYds: 0, availableYds: 0, items: new Map() };

      const availableYds = Number(loc.availableYds);
      // Only rows that still have live stock count toward current
      // occupancy -- a fully-issued row is no longer physically taking
      // up space on this rack.
      if (availableYds > 0) {
        cur.placedYds += Number(loc.yds);
        cur.availableYds += availableYds;
      }

      const item = itemById.get(loc.itemId);
      if (item) {
        const key = `${item.itemCodePdm}||${item.color}`;
        const itemCur = cur.items.get(key) || {
          itemCodePdm: item.itemCodePdm,
          color: item.color,
          availableRoll: 0,
          availableYds: 0,
        };
        itemCur.availableRoll += Number(loc.availableRoll);
        itemCur.availableYds += Number(loc.availableYds);
        cur.items.set(key, itemCur);
      }

      rackTotals.set(loc.location, cur);
    }
    const rackOccupancy = Array.from(rackTotals.entries())
      .map(([location, v]) => ({
        location,
        fillPercent: v.placedYds > 0 ? Math.round((v.availableYds / v.placedYds) * 100) : 0,
        availableYds: Math.round(v.availableYds * 100) / 100,
        items: Array.from(v.items.values())
          .filter((it) => it.availableYds > 0) // only stock still actually sitting there
          .sort((a, b) => b.availableYds - a.availableYds)
          .map((it) => ({
            item: `${it.itemCodePdm} / ${it.color}`,
            roll: it.availableRoll,
            yds: Math.round(it.availableYds * 100) / 100,
          })),
      }))
      .sort((a, b) => b.availableYds - a.availableYds);

    // ---------------- Requisition fulfillment breakdown ----------------
    const REQ_STATUS_ORDER = ["fulfilled", "partial", "pending"];
    const requisitionStatus = REQ_STATUS_ORDER.map((status) => ({
      status,
      count: requisitions.filter((r) => r.status === status).length,
    }));

    // ---------------- Recent activity ledger ----------------
    const recentActivity = recentHistory.map((h) => {
      const item = itemById.get(h.batchId);
      return {
        id: h.id,
        action: h.action,
        itemCodePdm: item?.itemCodePdm || null,
        color: item?.color || null,
        rollQty: h.rollQty,
        yds: h.yds,
        location: h.location,
        note: h.note,
        createdAt: h.createdAt,
      };
    });

    res.json({
      kpis: {
        totalAvailableYds: Math.round(totalAvailableYds * 100) / 100,
        totalAvailableRoll,
        pendingInspectionCount,
        rejectedThisMonth,
        activeRequisitions,
      },
      statusBreakdown,
      stockByWarehouse,
      stockBySupplier,
      topItems,
      rackOccupancy,
      requisitionStatus,
      recentActivity,
    });
  } catch (error) {
    console.error("getMaterialOverview error:", error);
    res.status(500).json({ message: "Failed to load dashboard overview" });
  }
};
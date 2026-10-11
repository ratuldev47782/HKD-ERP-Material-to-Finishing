// backend/src/controllers/material-warehouse/materialStock.controllers.js

import { asc, eq } from "drizzle-orm";
import { db, schema } from "../../db/db.js";

const { materialReceives, materialReceiveItems, materialReceiveItemLocations, materialReceiveStyles } = schema;

// ─── Ageing helpers ────────────────────────────────────────────────────────
// "Age" of a rack allocation = days since its parent Receive's Date. Buckets
// are the industry-standard 30/60/90/180 split used for stock ageing /
// dead-stock reports. Bucket order below is also the display order used by
// the ageingSummary aggregation (and matched by the frontend's badge colors).
const AGE_BUCKET_ORDER = ["0-30 days", "31-60 days", "61-90 days", "91-180 days", "180+ days"];
const MS_PER_DAY = 1000 * 60 * 60 * 24;

function computeAgeDays(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((today - d) / MS_PER_DAY));
}

function getAgeBucket(days) {
  if (days <= 30) return "0-30 days";
  if (days <= 60) return "31-60 days";
  if (days <= 90) return "61-90 days";
  if (days <= 180) return "91-180 days";
  return "180+ days";
}

/**
 * GET /material-stock
 * Query params (all optional, partial/case-insensitive match):
 *   itemCodePdm, style, color, model, season, buyer, invoiceNo, item,
 *   warehouse, location, supplier, fabricDetails
 *
 * Date range (optional, inclusive, matched against the parent Receive's
 * Date, format "YYYY-MM-DD" so plain string comparison sorts correctly):
 *   dateFrom, dateTo
 *
 * Reads from the rack allocations table (material_receive_item_locations),
 * NOT the batch table — so every row here is one Date + Item Code/PDM +
 * Color + Rack combination. A batch split across two racks now shows as
 * two rows, each with its own Roll/Yds and Available Roll/Yds, which is
 * exactly "which rack has how many rolls, and how many are still
 * available". Ordered oldest Receive Date first (FIFO). A "summary" array
 * gives Total Available Roll/Yds per Item Code/PDM + Color across ALL its
 * racks combined, for the headline "Total Available" figure.
 *
 * Supplier (invoice/parent-level) and Fabric Details (item/batch-level) are
 * both included in every row and are filterable the same way as the other
 * fields, so the frontend can search/display them without changing what
 * columns show by default.
 *
 * AGEING: every row also gets `ageDays` (days since its Receive Date) and
 * `ageBucket` (one of AGE_BUCKET_ORDER above). An `ageingSummary` array is
 * returned too — one entry per bucket (always all five, even if empty),
 * with batchCount / totalAvailableRoll / totalAvailableYds aggregated
 * ONLY over rows that still have stock (hasStock === true). Zero/negative
 * rows are excluded from ageing since "how old is stock that isn't there
 * anymore" isn't a meaningful ageing signal — they still show up in `rows`
 * as always, just not counted here.
 *
 * VISIBILITY POLICY: this endpoint used to hide any rack allocation with
 * availableRoll <= 0 AND availableYds <= 0, on the theory that "0 stock
 * isn't really stock". That silently hid rows that DO exist in the DB --
 * including legacy-import rows where the sheet's INHAND value was
 * genuinely 0, or even NEGATIVE (accounting-format cells like "(40)",
 * meaning -40, which happens when a sheet records more issued than was
 * ever received). Since the whole import pipeline's rule is "whatever's
 * in the sheet is exactly what lands in DB and stays visible", that
 * filter contradicted the data it was hiding. It has been removed --
 * EVERY rack allocation row now always shows up here, exactly as stored.
 * A `hasStock` boolean is added to each row (true only when
 * availableRoll > 0 OR availableYds > 0) so the frontend can badge
 * zero/negative rows distinctly (e.g. "No stock" / "Adjustment") instead
 * of presenting them as normal available inventory.
 */
export const searchMaterialStock = async (req, res) => {
  try {
    const q = (v) => (v || "").toString().trim().toLowerCase();
    const {
      itemCodePdm, style, color, model, season, buyer, invoiceNo, item,
      warehouse, location, supplier, fabricDetails, dateFrom, dateTo,
    } = req.query;

    const rows = await db
      .select({
        allocationId: materialReceiveItemLocations.id,
        batchItemId: materialReceiveItems.id,
        materialReceiveId: materialReceiveItems.materialReceiveId,
        itemCodePdm: materialReceiveItems.itemCodePdm,
        color: materialReceiveItems.color,
        fabricDetails: materialReceiveItems.fabricDetails,
        rollQty: materialReceiveItemLocations.rollQty, // roll placed on THIS rack
        yds: materialReceiveItemLocations.yds, // yds placed on THIS rack
        availableRoll: materialReceiveItemLocations.availableRoll,
        availableYds: materialReceiveItemLocations.availableYds,
        location: materialReceiveItemLocations.location,
        date: materialReceives.date,
        invoiceNo: materialReceives.invoiceNo,
        buyer: materialReceives.buyer,
        season: materialReceives.season,
        po: materialReceives.po,
        warehouse: materialReceives.warehouse,
        item: materialReceives.item,
        buy: materialReceives.buy,
        supplier: materialReceives.supplier,
      })
      .from(materialReceiveItemLocations)
      .innerJoin(materialReceiveItems, eq(materialReceiveItemLocations.itemId, materialReceiveItems.id))
      .innerJoin(materialReceives, eq(materialReceiveItems.materialReceiveId, materialReceives.id))
      .orderBy(asc(materialReceives.date));

    const styleRows = await db.select().from(materialReceiveStyles);
    const stylesByReceive = styleRows.reduce((acc, s) => {
      (acc[s.materialReceiveId] ||= []).push(s);
      return acc;
    }, {});

    const results = rows
      .map((r) => ({ ...r, styles: stylesByReceive[r.materialReceiveId] || [] }))
      .filter((r) => {
        if (itemCodePdm && !q(r.itemCodePdm).includes(q(itemCodePdm))) return false;
        if (color && !q(r.color).includes(q(color))) return false;
        if (season && !q(r.season).includes(q(season))) return false;
        if (buyer && !q(r.buyer).includes(q(buyer))) return false;
        if (invoiceNo && !q(r.invoiceNo).includes(q(invoiceNo))) return false;
        if (item && !q(r.item).includes(q(item))) return false;
        if (warehouse && !q(r.warehouse).includes(q(warehouse))) return false;
        if (location && !q(r.location).includes(q(location))) return false;
        if (supplier && !q(r.supplier).includes(q(supplier))) return false;
        if (fabricDetails && !q(r.fabricDetails).includes(q(fabricDetails))) return false;
        if (style && !r.styles.some((s) => q(s.style).includes(q(style)))) return false;
        if (model && !r.styles.some((s) => q(s.model).includes(q(model)))) return false;
        // Date range is inclusive on both ends. Dates are stored/queried as
        // "YYYY-MM-DD" strings, which sort identically to their calendar
        // order, so plain string comparison is safe here.
        if (dateFrom && r.date < dateFrom) return false;
        if (dateTo && r.date > dateTo) return false;
        return true;
      });
      // NOTE: the old ".filter((r) => Number(r.availableRoll) > 0 ||
      // Number(r.availableYds) > 0)" step that used to sit here has been
      // removed on purpose -- every rack allocation is shown now,
      // including 0 and negative available quantities, since those are
      // real rows in the DB and hiding them contradicted the "exact
      // sheet data, always visible" import policy.

    const summaryMap = new Map();
    // Always emit all five buckets, in a fixed order, even if some are
    // empty -- makes the ageing card stable rather than reshuffling
    // columns/rows as filters change what has stock.
    const ageingMap = new Map(
      AGE_BUCKET_ORDER.map((b) => [b, { ageBucket: b, batchCount: 0, totalAvailableRoll: 0, totalAvailableYds: 0 }])
    );

    for (const r of results) {
      const key = `${r.itemCodePdm}||${r.color}`;
      const cur = summaryMap.get(key) || {
        itemCodePdm: r.itemCodePdm,
        color: r.color,
        totalAvailableRoll: 0,
        totalAvailableYds: 0,
      };
      cur.totalAvailableRoll += Number(r.availableRoll);
      cur.totalAvailableYds += Number(r.availableYds);
      summaryMap.set(key, cur);

      const availRoll = Number(r.availableRoll);
      const availYds = Number(r.availableYds);
      if (availRoll > 0 || availYds > 0) {
        const bucket = ageingMap.get(getAgeBucket(computeAgeDays(r.date)));
        bucket.batchCount += 1;
        bucket.totalAvailableRoll += availRoll;
        bucket.totalAvailableYds += availYds;
      }
    }

    // itemId in the response = allocationId, so the frontend (which keys
    // table rows off r.itemId) gets a unique key per rack row, and each
    // row's Roll/Yds/Available already reflect that specific rack.
    //
    // hasStock: true only when this specific rack row actually has
    // positive available quantity. false covers both "0 available" and
    // "negative available" (an over-issued/adjustment row) -- the
    // frontend can use this to show a "No stock" / "Adjustment" badge
    // instead of presenting the row as normal available inventory, while
    // still keeping it visible and searchable.
    res.json({
      rows: results.map((r) => {
        const ageDays = computeAgeDays(r.date);
        return {
          ...r,
          itemId: r.allocationId,
          hasStock: Number(r.availableRoll) > 0 || Number(r.availableYds) > 0,
          ageDays,
          ageBucket: getAgeBucket(ageDays),
        };
      }),
      summary: Array.from(summaryMap.values()),
      ageingSummary: Array.from(ageingMap.values()),
    });
  } catch (error) {
    console.error("searchMaterialStock error:", error);
    res.status(500).json({ message: "Failed to search material stock" });
  }
};
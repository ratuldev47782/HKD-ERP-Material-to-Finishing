// backend/src/controllers/material-warehouse/materialImport.controllers.js
//
// IMPORT POLICY (unchanged): nothing blocks an import. Every row in the
// sheet gets imported and lands directly in stock, whatever the data
// looks like. Missing/blank text fields fall back to a placeholder ONLY
// because the DB column is NOT NULL -- the row itself is never rejected.
// Missing/blank NUMERIC fields (RCVD QTY, RCVD ROLL, INHAND QTY,
// INHAND ROLL, ISSUE YDS, ISSUE ROLL) always become 0, never anything
// else. Whatever the sheet has -- exactly that value -- is what gets
// pushed to DB. Wrong-looking Roll/Yds math is never "corrected".
//
// FIXED HEADER SET (exact columns this file is built for):
//   BUYER, DATE, INVOICE, SEASON, PO NO, STY NO, MODEL, ITEM, ITEM CODE,
//   COLOR NAME, RCVD QTY, RCVD ROLL, ISSUE YDS, ISSUE ROLL, INHAND QTY,
//   INHAND ROLL, RACK NO, REMARK, SUPLIER, ORIGIN, DESCRIPTION
//
// Column-to-field mapping actually used (see HEADER_ALIASES below):
//   BUYER       -> Buyer               (was previously NEVER read -- bug, fixed)
//   DATE        -> Date
//   INVOICE     -> Invoice No.
//   SEASON      -> Season
//   PO NO       -> PO
//   STY NO      -> Style
//   MODEL       -> Model
//   ITEM        -> Item
//   ITEM CODE   -> Item Code / PDM
//   COLOR NAME  -> Color
//   RCVD QTY    -> Yds (received)
//   RCVD ROLL   -> Roll (received)
//   ISSUE YDS   -> folded into Remark as "Issue Yds: n" (no dedicated
//                  DB column exists for this on material_receive_items,
//                  so nothing is silently dropped -- it's kept as text)
//   ISSUE ROLL  -> folded into Remark as "Issue Roll: n" (same reason)
//   INHAND QTY  -> Available Yds
//   INHAND ROLL -> Available Roll
//   RACK NO     -> Location / Rack
//   REMARK      -> Remark (base text, Issue/Origin appended after)
//   SUPLIER     -> Supplier
//   ORIGIN      -> From            (was previously HARDCODED "Overseas"
//                  regardless of sheet content -- bug, fixed. Whatever
//                  text is in ORIGIN is pushed exactly as-is into the
//                  `fromType` column, which is a free-text varchar(20),
//                  not a restricted enum)
//   DESCRIPTION -> Fabric Details  (was previously only matching a
//                  "DETAILS" header, so DESCRIPTION never matched at
//                  all -- bug, fixed)
//
// Two-step flow, matching the frontend's preview/commit split:
//   1. Pick a file -> POST /material-import -> parses the WHOLE workbook
//      and returns every row as an editable record. Nothing is written
//      to the DB yet.
//   2. Review (optional) -> POST /material-import/commit with the
//      (optionally edited) records. Every record is inserted -- none
//      are rejected.

import { eq } from "drizzle-orm";
import * as XLSX from "xlsx";
import { db, schema } from "../../db/db.js";

const { materialReceives, materialReceiveStyles, materialReceiveItems, materialReceiveItemLocations, stockHistory } = schema;

const DEFAULT_WAREHOUSE = "K-2";
const DEFAULT_BUYER = "Decathlon - Woven";
const DEFAULT_ITEM_CODE = "UNKNOWN";
const DEFAULT_COLOR = "UNKNOWN";
const DEFAULT_LOCATION = "UNASSIGNED";
const DEFAULT_FABRIC_DETAILS = "N/A";
const DEFAULT_FROM_TYPE = "Overseas";

// Canonical field -> acceptable header names (normalized: upper case,
// trimmed, internal whitespace collapsed to a single space). Extra
// aliases (e.g. "ITEM CODE/PDM", "SUPPLIER") are kept so older sheet
// variants still map correctly, but the fixed header set above is the
// one this file is guaranteed to fully support.
const HEADER_ALIASES = {
  buyer: ["BUYER"],
  date: ["DATE"],
  invoiceNo: ["INVOICE"],
  supInvoice: ["SUP INVOICE", "SUPPLIER INVOICE"],
  boe: ["BOE"],
  season: ["SEASON"],
  po: ["PO NO", "PO"],
  style: ["STY NO", "STYLE", "STY"],
  model: ["MODEL"],
  itemName: ["ITEM", "ITEM NAME"],
  itemCodePdm: ["ITEM CODE", "ITEM CODE/PDM", "PDM"],
  color: ["COLOR NAME", "COLOR"],
  rcvdYds: ["RCVD QTY", "QTY"],
  rcvdRoll: ["RCVD ROLL", "ROLL"],
  issueYds: ["ISSUE YDS"],
  issueRoll: ["ISSUE ROLL"],
  inhandYds: ["INHAND QTY", "STOCK QTY"],
  inhandRoll: ["INHAND ROLL", "STOCK ROLL"],
  location: ["RACK NO", "RACK", "LOCATION"],
  supplier: ["SUPLIER", "SUPPLIER"],
  origin: ["ORIGIN"],
  remark: ["REMARK", "REMARKS"],
  fabricDetails: ["DESCRIPTION", "DETAILS", "FABRIC DETAILS"],
};

function normalizeHeader(h) {
  return String(h ?? "").trim().toUpperCase().replace(/\s+/g, " ");
}

// Row 1 is frequently a stray title/merge artifact in these exports and
// the real column names sit on row 2 (occasionally row 1). Pick the
// first of the first few rows that has at least 5 non-empty cells.
function findHeaderRow(sheetRows) {
  for (let i = 0; i < Math.min(sheetRows.length, 5); i++) {
    const row = sheetRows[i] || [];
    const nonEmpty = row.filter((c) => c !== null && c !== undefined && String(c).trim() !== "");
    if (nonEmpty.length >= 5) return i;
  }
  return 0;
}

function buildColumnMap(headerRow) {
  const normalized = headerRow.map(normalizeHeader);
  const map = {}; // canonical field -> column index
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    for (const alias of aliases) {
      const idx = normalized.indexOf(alias);
      if (idx !== -1) { map[field] = idx; break; }
    }
  }
  return map;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

const MONTH_MAP = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/**
 * Converts an Excel date serial number into { y, m, d } using pure
 * integer/UTC arithmetic -- no XLSX.SSF, no Date/timezone mixing.
 *
 * Excel's epoch is Dec 30 1899 (not Dec 31/Jan 1) because this also
 * absorbs Excel's famous fake-1900-leap-year bug (it treats 1900 as a
 * leap year, which it wasn't) -- Dec 30 1899 + serial days lands on the
 * same calendar date Excel itself displays, for every serial Excel
 * actually produces (>= 60). Everything here runs through Date.UTC /
 * getUTC* only, so the result can never drift with the server's local
 * timezone, regardless of what xlsx build or version is installed.
 */
function excelSerialToYMD(serial) {
  const epochUTC = Date.UTC(1899, 11, 30);
  const ms = epochUTC + Math.round(serial) * 86400000;
  const d = new Date(ms);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
}

/**
 * Converts a raw cell value (real Date, Excel serial number, or text
 * date) into a plain "YYYY-MM-DD" string, always matching the calendar
 * date the sheet actually shows -- never shifted by a server timezone.
 */
function excelDateToISO(value) {
  if (value === null || value === undefined || value === "") return null;

  if (value instanceof Date) {
    return `${value.getUTCFullYear()}-${pad2(value.getUTCMonth() + 1)}-${pad2(value.getUTCDate())}`;
  }

  if (typeof value === "number") {
    const { y, m, d } = excelSerialToYMD(value);
    return `${y}-${pad2(m)}-${pad2(d)}`;
  }

  const s = String(value).trim();
  if (!s) return null;

  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (dmy) {
    let [, d, m, y] = dmy;
    if (y.length === 2) y = `20${y}`;
    return `${y}-${pad2(m)}-${pad2(d)}`;
  }

  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const [, y, m, d] = iso;
    return `${y}-${pad2(m)}-${pad2(d)}`;
  }

  const dmyText = s.match(/^(\d{1,2})[\s-]([A-Za-z]{3,})[\s-](\d{2,4})$/);
  if (dmyText) {
    const [, d, monRaw, yRaw] = dmyText;
    const mon = MONTH_MAP[monRaw.toLowerCase().slice(0, 3)];
    if (mon) {
      const y = yRaw.length === 2 ? `20${yRaw}` : yRaw;
      return `${y}-${pad2(mon)}-${pad2(d)}`;
    }
  }

  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${pad2(parsed.getMonth() + 1)}-${pad2(parsed.getDate())}`;
  }
  return null;
}

// Blank / missing -> ALWAYS 0. Never any other fallback. Used for every
// quantity field: RCVD QTY, RCVD ROLL, INHAND QTY, INHAND ROLL,
// ISSUE YDS, ISSUE ROLL.
//
// Handles the real-world cell formats these sheets actually contain:
//   "1,367"      -> 1367   (thousands separator)
//   "1367 "      -> 1367   (trailing/leading whitespace, incl. non-
//                            breaking space copy-pasted from Excel)
//   "(40)"       -> -40    (accounting-style negative -- parentheses
//                            mean negative, NOT "ignore this cell".
//                            Previously Number("(40)") produced NaN and
//                            silently fell back to 0, which is the exact
//                            "negative values not preserved" bug.)
//   "-40"        -> -40    (plain negative, already worked)
//   "-", "--"    -> 0      (sheets sometimes use a dash for "none")
//   real number 40 (already numeric from xlsx) -> 40, untouched
function num(v) {
  if (v === null || v === undefined || v === "") return 0;

  let s = String(v).trim();
  if (s === "" || s === "-" || s === "--") return 0;

  // Accounting-format negative: (40) or (40.50)
  let negative = false;
  const parenMatch = s.match(/^\((.*)\)$/);
  if (parenMatch) {
    negative = true;
    s = parenMatch[1].trim();
  }

  // Strip thousands separators, then strip anything that isn't a digit,
  // a dot, or a leading minus sign (guards against stray currency
  // symbols, unit suffixes, weird whitespace, etc. instead of just
  // giving up and returning 0).
  s = s.replace(/,/g, "").trim();
  s = s.replace(/[^\d.\-]/g, "");

  if (s === "" || s === "-" || s === ".") return 0;

  let n = Number(s);
  if (!Number.isFinite(n)) return 0;
  if (negative) n = -Math.abs(n);
  return n;
}

// Same as num(), but also reports back whether the RAW cell looked like
// it actually contained a real value that failed to parse cleanly (as
// opposed to genuinely being blank/zero) -- so the review table can flag
// it instead of silently turning bad data into an invisible 0.
function numChecked(raw) {
  const value = num(raw);
  const rawStr = str(raw);
  const looksBlankOrZero = rawStr === "" || /^\(?0*(\.0+)?\)?$/.test(rawStr.replace(/,/g, "").trim());
  const suspicious = value === 0 && rawStr !== "" && !looksBlankOrZero;
  return { value, suspicious, rawStr };
}

// Text-field normalizer. Collapses ANY internal whitespace run --
// including newlines and tabs from a multi-line Excel cell -- down to a
// single space, then trims. This does NOT change the actual content
// (still "exactly what the sheet says"), it only fixes an invisible
// formatting artifact: Excel lets a cell contain a line break (shown as
// e.g. "DKT-A07A" on one line and "ORANGE" on the next inside the same
// cell), which gets read back as "DKT-A07A\nORANGE" instead of
// "DKT-A07A ORANGE". Left as-is, that newline is invisible in the UI but
// breaks every substring match against it elsewhere in the app (Cutting
// Issue's stock lookup, filters, etc. all compare against a normal-space
// version of the same text and silently find no match). Every free-text
// field pulled from the sheet (Buyer, Item Code/PDM, Color, Style,
// Model, Item, Fabric Details, Supplier, Origin, Remark, PO, Season,
// Invoice No.) goes through this, so a stray line-break in any cell can
// never again cause a row to silently vanish from search/matching
// elsewhere.
function str(v) {
  if (v === null || v === undefined) return "";
  return String(v).replace(/\s+/g, " ").trim();
}

/**
 * Parses every sheet in the workbook and returns { records, warnings }.
 * `records` is the flat list of "one spreadsheet row = one future
 * Material Receive" objects. Every row is included -- nothing is ever
 * dropped or marked invalid. Text fields fall back to a placeholder ONLY
 * when truly blank (DB requires NOT NULL on some columns); numeric
 * fields always fall back to 0. `warnings` is a short-form list noting
 * which rows had a fallback applied, purely informational -- never
 * blocks preview or commit.
 */
function parseWorkbook(buffer) {
  // cellDates intentionally OFF -- real Excel date cells come through as
  // raw serial numbers, which excelDateToISO() converts via pure
  // integer/UTC math (excelSerialToYMD), with no Date object, no
  // XLSX.SSF dependency.
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const records = [];
  const warnings = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
    if (!rows.length) continue;

    const headerIdx = findHeaderRow(rows);
    const headerRow = rows[headerIdx] || [];
    const colMap = buildColumnMap(headerRow);

    // Skip sheets that clearly aren't the stock template at all -- no
    // Item Code and no Color column anywhere on the header row.
    if (colMap.itemCodePdm === undefined && colMap.color === undefined) continue;

    for (let r = headerIdx + 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.every((c) => c === null || c === undefined || String(c).trim() === "")) continue;

      const get = (field) => (colMap[field] !== undefined ? row[colMap[field]] : null);

      const rawBuyer = str(get("buyer"));
      const rawItemCodePdm = str(get("itemCodePdm"));
      const rawColor = str(get("color"));
      const rawLocation = str(get("location"));
      const rawOrigin = str(get("origin"));
      const rawFabricDetails = str(get("fabricDetails"));
      const rawDateCell = get("date");
      const parsedDate = excelDateToISO(rawDateCell);

      // --- Numeric fields: blank/missing ALWAYS becomes 0, nothing else.
      // Accounting-style negatives like "(40)" are preserved as -40 (see
      // num() above). numChecked() additionally flags a cell that had
      // real-looking content but still failed to parse, so that case is
      // visible in the review table instead of quietly becoming a 0 that
      // looks identical to a genuinely blank cell. ---
      const rcvdRollChk = numChecked(get("rcvdRoll"));       // RCVD ROLL
      const rcvdYdsChk = numChecked(get("rcvdYds"));         // RCVD QTY
      const inhandRollChk = numChecked(get("inhandRoll"));   // INHAND ROLL
      const inhandYdsChk = numChecked(get("inhandYds"));     // INHAND QTY
      const issueYdsChk = numChecked(get("issueYds"));       // ISSUE YDS
      const issueRollChk = numChecked(get("issueRoll"));     // ISSUE ROLL

      const rollQty = rcvdRollChk.value;
      const yds = rcvdYdsChk.value;
      const availableRoll = inhandRollChk.value;
      const availableYds = inhandYdsChk.value;
      const issueYds = issueYdsChk.value;
      const issueRoll = issueRollChk.value;

      const supplier = str(get("supplier"));
      const remarkRaw = str(get("remark"));
      const supInvoice = str(get("supInvoice"));
      const boe = str(get("boe"));

      // Nothing from the sheet is silently lost: SUP INVOICE / BOE /
      // Issue Yds / Issue Roll have no dedicated DB column on
      // material_receive_items, so they're folded into Remark as plain
      // text instead of being dropped. Issue Yds/Roll are only appended
      // when non-zero, so a row with no issue activity keeps a clean
      // Remark.
      const remark = [
        remarkRaw,
        supInvoice ? `Sup Invoice: ${supInvoice}` : "",
        boe ? `BOE: ${boe}` : "",
        issueYds ? `Issue Yds: ${issueYds}` : "",
        issueRoll ? `Issue Roll: ${issueRoll}` : "",
      ].filter(Boolean).join(" | ") || null;

      const defaultsApplied = [];
      if (!rawBuyer) defaultsApplied.push("Buyer");
      if (!rawItemCodePdm) defaultsApplied.push("Item Code/PDM");
      if (!rawColor) defaultsApplied.push("Color");
      if (!rawLocation) defaultsApplied.push("Rack No");
      if (!rawOrigin) defaultsApplied.push("From (Origin)");
      if (!rawFabricDetails) defaultsApplied.push("Fabric Details (Description)");
      if (!parsedDate) defaultsApplied.push("Date");
      // Cell had real-looking content but couldn't be read as a number --
      // surfaced here instead of silently becoming an indistinguishable 0.
      if (rcvdRollChk.suspicious) defaultsApplied.push(`RCVD ROLL unreadable ("${rcvdRollChk.rawStr}") -> 0`);
      if (rcvdYdsChk.suspicious) defaultsApplied.push(`RCVD QTY unreadable ("${rcvdYdsChk.rawStr}") -> 0`);
      if (inhandRollChk.suspicious) defaultsApplied.push(`INHAND ROLL unreadable ("${inhandRollChk.rawStr}") -> 0`);
      if (inhandYdsChk.suspicious) defaultsApplied.push(`INHAND QTY unreadable ("${inhandYdsChk.rawStr}") -> 0`);
      if (issueYdsChk.suspicious) defaultsApplied.push(`ISSUE YDS unreadable ("${issueYdsChk.rawStr}") -> 0`);
      if (issueRollChk.suspicious) defaultsApplied.push(`ISSUE ROLL unreadable ("${issueRollChk.rawStr}") -> 0`);

      const rec = {
        _key: `${sheetName}-${r + 1}`,
        sheet: sheetName,
        row: r + 1,
        date: parsedDate,
        invoiceNo: str(get("invoiceNo")) || `IMPORTED-${sheetName}-${r + 1}`,
        buyer: rawBuyer || DEFAULT_BUYER,
        fromType: rawOrigin || DEFAULT_FROM_TYPE,
        supplier: supplier || null,
        season: str(get("season")) || "N/A",
        po: str(get("po")) || "N/A",
        item: str(get("itemName")) || rawItemCodePdm || DEFAULT_ITEM_CODE,
        remark,
        style: str(get("style")) || "N/A",
        model: str(get("model")) || null,
        itemCodePdm: rawItemCodePdm || DEFAULT_ITEM_CODE,
        color: rawColor || DEFAULT_COLOR,
        fabricDetails: rawFabricDetails || DEFAULT_FABRIC_DETAILS,
        rollQty,
        yds,
        location: rawLocation || DEFAULT_LOCATION,
        availableRoll,
        availableYds,
        issueYds,
        issueRoll,
        // Purely informational -- never blocks preview or commit.
        defaultsApplied: defaultsApplied.length ? defaultsApplied : null,
      };

      if (defaultsApplied.length) {
        warnings.push({ sheet: sheetName, row: r + 1, defaultsApplied });
      }

      records.push(rec);
    }
  }

  return { records, warnings };
}

/**
 * Inserts a single record. Every record is treated as already-racked
 * ("approved"), since `location` always has a real value by this point
 * (a real rack from the sheet, or the "UNASSIGNED" fallback) -- nothing
 * is left in a not-yet-in-stock limbo.
 */
async function insertRecord(tx, rec) {
  const [inserted] = await tx.insert(materialReceives).values({
    date: rec.date || new Date().toISOString().slice(0, 10),
    invoiceNo: rec.invoiceNo,
    fromType: rec.fromType || DEFAULT_FROM_TYPE, // from sheet's ORIGIN column, exact text
    warehouse: DEFAULT_WAREHOUSE,
    buyer: rec.buyer,
    supplier: rec.supplier,
    season: rec.season,
    po: rec.po,
    item: rec.item,
    buy: null,
    remark: rec.remark,
    status: "approved",
  });
  const materialReceiveId = inserted.insertId;

  await tx.insert(materialReceiveStyles).values({
    materialReceiveId,
    style: rec.style,
    model: rec.model,
  });

  // Received Roll/Yds -- exactly what the sheet has (0 if blank), never
  // recalculated or "corrected".
  const passedRoll = num(rec.rollQty);
  const passedYds = num(rec.yds);

  await tx.insert(materialReceiveItems).values({
    materialReceiveId,
    itemCodePdm: rec.itemCodePdm,
    color: rec.color,
    fabricDetails: rec.fabricDetails,
    rollQty: passedRoll,
    yds: passedYds,
    passedRoll,
    passedYds,
    rejectedRoll: 0,
    rejectedYds: 0,
    unassignedRoll: 0,
    unassignedYds: 0,
    status: "approved",
    isRead: true,
    approvedAt: new Date(),
  });

  const [batch] = await tx
    .select()
    .from(materialReceiveItems)
    .where(eq(materialReceiveItems.materialReceiveId, materialReceiveId));

  await tx.insert(stockHistory).values({
    batchId: batch.id,
    allocationId: null,
    materialReceiveId,
    action: "receive",
    location: null,
    rollQty: passedRoll,
    yds: passedYds,
    note: `Imported from legacy spreadsheet (${rec.sheet ?? "edited"}, row ${rec.row ?? "n/a"})`,
  });

  // Always create a rack allocation -- location defaults to "UNASSIGNED"
  // when the sheet had no Rack No, so the row is still real stock and
  // shows up in Material Stock search immediately. Available comes from
  // the sheet's INHAND ROLL/QTY exactly (0 if blank), not mirrored from
  // Received.
  const [alloc] = await tx.insert(materialReceiveItemLocations).values({
    itemId: batch.id,
    materialReceiveId,
    location: rec.location,
    rollQty: passedRoll,
    yds: passedYds,
    availableRoll: num(rec.availableRoll),
    availableYds: num(rec.availableYds),
  });

  await tx.insert(stockHistory).values({
    batchId: batch.id,
    allocationId: alloc.insertId,
    materialReceiveId,
    action: "location_assignment",
    location: rec.location,
    rollQty: passedRoll,
    yds: passedYds,
    note: `Imported stock at ${rec.location}`,
  });
}

/**
 * POST /material-import
 * multipart/form-data, field "file" -- the .xlsx workbook.
 *
 * Preview only -- parses the workbook and returns EVERY parsed record
 * plus a purely-informational warnings list (which rows had a fallback
 * applied). Nothing is written to the DB. Use POST /material-import/commit
 * to actually insert -- every record there succeeds, none are rejected.
 */
export const importMaterialStock = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded (expected form field 'file')" });

    const { records, warnings } = parseWorkbook(req.file.buffer);

    if (!records.length) {
      return res.status(400).json({ message: "No usable rows found in this file", warnings });
    }

    return res.json({
      preview: true,
      totalRows: records.length,
      withDefaults: records.filter((r) => r.defaultsApplied).length,
      withoutRack: records.filter((r) => r.location === DEFAULT_LOCATION).length,
      warehouse: DEFAULT_WAREHOUSE,
      records,   // full list -- render as an editable table client-side (editing is optional)
      warnings,  // informational only, never blocks commit
    });
  } catch (error) {
    console.error("importMaterialStock error:", error);
    res.status(500).json({ message: "Failed to parse material stock file", detail: error.message });
  }
};

/**
 * POST /material-import/commit
 * application/json body: { records: [...] }
 *
 * `records` should be the array returned by the preview step above,
 * optionally hand-edited. Every record is inserted in one transaction --
 * nothing is rejected, nothing needs to pass a validation check first.
 * Numeric fields blank/missing always resolve to 0 here too, in case
 * records were constructed/edited client-side without going through
 * preview.
 */
export const commitMaterialStock = async (req, res) => {
  try {
    const records = req.body?.records;
    if (!Array.isArray(records) || !records.length) {
      return res.status(400).json({ message: "No records provided to commit (expected { records: [...] })" });
    }

    let created = 0;
    await db.transaction(async (tx) => {
      for (const rec of records) {
        const rollQty = num(rec.rollQty);
        const yds = num(rec.yds);
        const issueYds = num(rec.issueYds);
        const issueRoll = num(rec.issueRoll);

        // Re-apply the same fallbacks here too. Numeric -> always 0.
        // Text -> placeholder ONLY if truly blank (DB NOT NULL columns).
        const safeRec = {
          ...rec,
          buyer: str(rec.buyer) || DEFAULT_BUYER,
          fromType: str(rec.fromType) || DEFAULT_FROM_TYPE,
          itemCodePdm: str(rec.itemCodePdm) || DEFAULT_ITEM_CODE,
          color: str(rec.color) || DEFAULT_COLOR,
          location: str(rec.location) || DEFAULT_LOCATION,
          fabricDetails: str(rec.fabricDetails) || DEFAULT_FABRIC_DETAILS,
          season: str(rec.season) || "N/A",
          po: str(rec.po) || "N/A",
          style: str(rec.style) || "N/A",
          invoiceNo: str(rec.invoiceNo) || `IMPORTED-${rec._key ?? Date.now()}`,
          item: str(rec.item) || str(rec.itemCodePdm) || DEFAULT_ITEM_CODE,
          rollQty,
          yds,
          availableRoll: num(rec.availableRoll),
          availableYds: num(rec.availableYds),
          issueYds,
          issueRoll,
        };
        await insertRecord(tx, safeRec);
        created += 1;
      }
    });

    res.status(201).json({
      committed: true,
      created,
      attempted: records.length,
      stillInvalid: [], // nothing is ever rejected
    });
  } catch (error) {
    console.error("commitMaterialStock error:", error);
    res.status(500).json({ message: "Failed to import material stock", detail: error.message });
  }
};
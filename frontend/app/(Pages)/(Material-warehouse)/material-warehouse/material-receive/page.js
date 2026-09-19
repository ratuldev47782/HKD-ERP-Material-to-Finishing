// frontend/app/(Pages)/(Material-warehouse)/material-warehouse/material-receive/page.js
//
// THEME + RESPONSIVE UPDATE
// -------------------------
// Restyled to match the rest of the ERP (Material Stock / Style Register /
// Material Inspection): blue #3B9ED4 accent, #F0F4F8 page background, white
// rounded-xl cards with gray-200 borders, icon-square top bar, light-blue
// (#C8E3F5) table headers with #EEF6FC zebra rows. The old brown/orange
// palette and all dark-mode classes were removed.
//
// Responsive behaviour:
//   - Below `lg` (1024px) the form and the Saved Records table STACK
//     (form on top, full width) instead of sitting side by side. From `lg`
//     up it's the same side-by-side layout as before (340px sticky form +
//     records panel with its own scroll region).
//   - The "Items under Invoice X" drawer shows as stacked cards below `lg`
//     and as the full sub-table from `lg` up. On small screens the drawer is
//     pinned to the left edge (sticky) and limited to the viewport width, so
//     you never have to scroll sideways to reach the Rack Assignment form.
//   - Saved Records table keeps all columns (scrolls horizontally inside its
//     own strip, Column picker still works). Filters scroll horizontally.
//   - Top bar, pagination bar and buttons wrap / shrink on phones.
//
// All data logic, API calls and behaviour are unchanged.

"use client";

import {
  Check, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronUp,
  Info, MapPin, PackageSearch, Pencil, Plus, Search, SlidersHorizontal, Trash2, X,
} from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from "@tanstack/react-table";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

/* ============================================================
   Theme (matches Material Stock / Style Register)
   ============================================================ */

const BLUE = "#3B9ED4";
const BLUE_DARK = "#2E8EC4";
const BLUE_HDR = "#C8E3F5";   // table header bg
const BLUE_ROW = "#EEF6FC";   // zebra row / soft panel bg
const BLUE_FAINT = "#DBEEFF"; // hover
const BORDER_CLR = "#D1E4F0";
const PAGE_BG = "#F0F4F8";

// NOTE: every Tailwind color below is a literal class name (no template
// interpolation) so Tailwind's compiler can see it.
const card = "bg-white rounded-xl border border-gray-200 shadow-sm";

// Main form inputs: comfortable size on phones/tablets, compact from lg up
// (where the form is a 340px column).
const inputCls =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm lg:px-2.5 lg:py-1.5 lg:text-xs text-gray-800 " +
  "placeholder:text-gray-400 shadow-sm focus:outline-none focus:ring-2 " +
  "focus:ring-[#3B9ED4]/25 focus:border-[#3B9ED4] transition-all duration-150";

// Compact inputs for nested rows, tables and filters.
const inputSm =
  "w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-800 " +
  "placeholder:text-gray-400 shadow-sm focus:outline-none focus:ring-2 " +
  "focus:ring-[#3B9ED4]/25 focus:border-[#3B9ED4] transition-all duration-150";

const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-[#3B9ED4] hover:bg-[#2E8EC4] text-white " +
  "text-sm font-semibold px-4 py-2.5 transition-colors shadow-sm disabled:opacity-50 disabled:pointer-events-none";

const btnSecondary =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white " +
  "text-gray-600 text-sm font-medium px-3 py-2 hover:border-[#3B9ED4] " +
  "hover:text-[#3B9ED4] transition-colors disabled:opacity-40 disabled:pointer-events-none";

const btnIcon =
  "inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white " +
  "text-gray-500 w-8 h-8 hover:border-[#3B9ED4] hover:text-[#3B9ED4] " +
  "transition-colors disabled:opacity-30 disabled:pointer-events-none";

const labelCls = "block mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400";

// Chips
const chipBase = "inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold whitespace-nowrap";
const chip = `${chipBase} bg-[#3B9ED4]/10 text-[#2E8EC4]`;
const chipPending = `${chipBase} bg-amber-50 text-amber-700`;
const chipPartial = `${chipBase} bg-sky-50 text-sky-700`;
const chipApproved = `${chipBase} bg-green-50 text-green-700`;
// Two extra statuses introduced by the Material Inspection workflow --
// "pending_inspection" (just received, not looked at yet) and "rejected"
// (inspection passed 0 Roll / 0 Yds).
const chipInspection = `${chipBase} bg-purple-50 text-purple-700`;
const chipRejected = `${chipBase} bg-red-50 text-red-700`;

// Thin scrollbar in the ERP's blue-grey, applied to every independently
// scrolling region.
const scrollThin =
  "[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent " +
  "[&::-webkit-scrollbar-thumb]:bg-[#c8d9e8] [&::-webkit-scrollbar-thumb]:rounded-full " +
  "[&::-webkit-scrollbar-thumb:hover]:bg-[#9ab8cc] " +
  "[scrollbar-width:thin] [scrollbar-color:#c8d9e8_transparent]";

// Same scroll region, but the bar itself is fully hidden. Scrolling still
// works with wheel/trackpad/touch/keyboard. Used on the form column.
const scrollHidden =
  "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

const RACK_OPTIONS = [
  "G-J-19", "G-I-14", "G-W-8", "G-X-20", "G-X-19", "G-J-23", "G-W-7", "L-40", "G-F-3", "G-I-4", "G-I-5", "F-46", "QA", "K-20", "G-X-3", "G-J-17", "F-44", "G-J-26", "G-W-13", "G-I-21", "G-X-1", "G-X-25", "G-J-24", "G-X-17", "G-U-23", "G-Y-1", "J-48", "G-I-10", "G-W-27", "G-E-8", "G-E-14", "G-E-4", "G-U-17", "G-T-3", "G-Y-11", "G-F-16", "G-T-11", "G-T-5", "G-I-17", "G-W-5", "G-U-22", "G-Y-3", "G-J-15", "G-S-11", "G-X-21", "G-U-19", "G-U-2", "G-36", "G-33", "G-T-12", "G-U-20", "L-39", "G-I-9", "G-W-9", "G-I-15", "G-48", "H-11", "G-X-13", "U-46", "G-U-21", "J-35", "V-22", "W-33", "W-34", "I-38", "F-45", "G-H-11", "G-T-14", "G-T-15", "G-T-7", "G-W-10", "G-W-11", "G-H-5", "SAMPLE", "G-W-17", "G-H-7", "L-36", "I-40", "J-44", "G-X-22", "J-47", "G-X-15", "G-T-26", "G-T-28", "G-L-17", "G-I-13", "L-34", "J-43", "G-L-21", "G-L-13", "G-L-11", "G-F-1", "G-K-6", "G-X-18", "G-V-5", "G-J-18", "G-K-13", "G-L-16", "G-L-10", "G-X-23", "G-E-13", "G-T-25", "G-U-13", "G-V-3", "G-T-19", "G-U-28", "G-X-28", "T-37", "G-L-2", "G-S-12", "G-X-26", "G-S-7", "G-W-19", "F-47", "G-R-19", "G-I-31", "G-I-32", "G-U-4", "G-I-2", "G-L-1", "G-S-13", "G-L-15", "G-I-29", "G-L-5", "G-W-23", "G-U-18", "G-R-23", "G-W-22", "G-R-24", "G-R-26", "G-Y-14", "G-U-5", "G-W-1", "L-35", "J-42", "J-33", "G-L-9", "K-16", "J-45", "L-33", "G-U-3", "G-V-9", "G-U-7", "G-T-9", "U-39", "T-38", "T-34", "T-35", "G-K-4", "G-E-6", "G-L-4", "T-41", "T-36", "G-J-3", "G-I-24", "G-I-26", "G-I-19", "G-I-3", "G-R-20", "G-V-7", "G-U-25", "G-V-19", "AC ROOM", "G-40", "L-44", "U-34", "U-36", "G-X-9", "G-R-21", "G-R-22", "G-U-16", "G-E-12", "G-E-10", "K-18", "K-17", "G-Y-2", "U-43", "G-Y-8", "G-Y-6", "G-Y-4", "G-S-9", "T-40", "G-W-21", "G-X-5", "G-W-3", "G-W-25", "G-I-28", "G-W-15", "G-H-3", "G-H-2", "G-I-11", "G-I-25", "G-E-3", "G-R-17", "G-H-9", "F-41", "G-38", "G-R-25", "J-38", "I-48", "L-48", "K-15", "L-45", "L-47", "G-K-14", "G-L-3", "G-J-2", "G-J-4", "G-J-11", "G-J-13", "G-J-16", "G-J-14", "G-J-5", "G-J-7", "G-J-9", "G-J-1", "G-J-10", "L-46", "T-42", "U-42", "J-34", "V-19", "G-R-16", "G-W-6", "G-S-8", "T-44", "F-42", "F-48", "G-E-2", "G-E-5", "G-J-20", "G-J-31", "G-J-22", "G-J-25", "I-33", "I-35", "J-41", "I-44", "J-46", "G-K-7", "T-43", "T-46", "G-K-11", "G-W-4", "K-19", "G-X-7", "G-X-12", "G-X-14", "G-Y-7", "G-Y-10", "G-Y-12", "V-21", "G-L-22", "G-V-13", "G-X-27", "G-L-24", "L-38", "V-20", "J-39", "Z-20", "Z-19", "L-42", "T-33", "G-X-16", "G-X-4", "G-L-14", "G-L-7", "G-J-28", "U-38", "Y-18", "G-T-8", "G-I-8", "G-I-6", "G-I-1", "G-V-4", "G-E-9", "G-E-7", "G-F-7", "G-R-15", "G-J-30", "G-I-27", "G-K-9", "G-I-18", "V-23", "G-W-28", "G-Y-9", "G-V-2", "G-L-19", "G-L-12", "G-L-23", "G-Y-5", "I-43", "I-45", "I-47", "J-37", "T-39", "G-F-15", "G-J-12", "G-S-6", "G-X-10", "G-F-10", "G-R-27", "G-F-13", "G-F-9", "G-F-2", "G-W-12", "G-T-6", "J-36", "G-J-32", "G-H-8", "G-L-26", "I-46", "G-L-32", "G-L-18", "G-L-6", "G-F-4", "G-L-30", "G-W-16", "G-I-20", "G-X-11", "G-L-27", "G-I-30", "G-W-2", "G-L-31", "G-L-25", "G-L-29", "G-L-8", "G-L-20", "G-K-1", "G-K-3", "G-K-10", "G-K-12", "G-K-2"
];

// Warehouse codes (kept hyphenated everywhere: K-1 / K-2 / K-3).
const WAREHOUSE_OPTIONS = ["K-1", "K-2", "K-3"];

// Standard buyer list for the Buyer dropdown.
const BUYERS = [
  "Decathlon - Knit", "Decathlon - Woven", "Walmart", "Columbia",
  "ZXY", "CTC", "DIESEL", "Sports Group Denmark", "Identity", "Fifth Avenue",
];

// All free-text values are forced upper case as the user types.
const up = (v) => (v || "").toUpperCase();

// crypto.randomUUID() is only available in secure contexts (HTTPS or localhost).
// On a plain-HTTP origin (e.g. http://192.169.11.38:3000) it is undefined, and
// calling it during the initial render crashed the whole page. Use it when
// available and fall back to a locally-generated unique id otherwise.
const uid = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

// "supplier" is optional free text at the invoice/parent level (one per
// Material Receive, same as Buyer/PO/etc.). "buy" is also optional free
// text at the invoice/parent level -- whoever wants to fill it in, can.
const emptyForm = {
  date: "", invoiceNo: "", fromType: "Overseas", warehouse: "K-2",
  buyer: "", supplier: "", season: "", po: "", item: "", buy: "", remark: "",
};
// "fabricDetails" is REQUIRED free text at the item/batch level -- one per
// Item Code/PDM + Color row, since different colors/item codes on the
// same invoice can be different fabrics and this is now mandatory data.
const newColor = () => ({ key: uid(), color: "", fabricDetails: "", roll: "", yds: "" });
const newItemCode = () => ({ key: uid(), itemCodePdm: "", colors: [newColor()] });
const newStyleRow = () => ({ key: uid(), style: "", model: "" });

// Separate, clearly-labeled Saved Records search fields -- each one is its
// own small input (Buyer is a dropdown, same options as the form) so
// "Style" and "Model" (and everything else) never get confused with one
// another, but they all sit on a single scrollable row. Each field is sent
// to the backend as its OWN query param and matched only against its own
// column there -- see fetchReceives below.
const emptyRecordFilters = {
  invoiceNo: "", buyer: "", supplier: "", po: "", style: "", model: "", itemCodePdm: "", color: "", fabricDetails: "",
};
const RECORD_FILTER_FIELDS = [
  { key: "invoiceNo", label: "Invoice No." },
  { key: "buyer", label: "Buyer", type: "select" },
  { key: "supplier", label: "Supplier" },
  { key: "po", label: "PO" },
  { key: "style", label: "Style" },
  { key: "model", label: "Model" },
  { key: "itemCodePdm", label: "Item Code/PDM" },
  { key: "color", label: "Color" },
  { key: "fabricDetails", label: "Fabric Details" },
];

// Page-size choices for the Saved Records pagination bar.
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

// Which Saved Records columns the user has chosen to show/hide, kept in
// the browser's localStorage so the choice survives a refresh. Keyed by
// each column's id (see the `columns` array in RecordsPanel) -> label
// shown in the picker. "expander" is left out on purpose -- it's the
// row-expand chevron, not a real data column, so it can't be hidden.
const COLUMN_VISIBILITY_KEY = "materialReceive:columnVisibility";
const COLUMN_LABELS = {
  date: "Date", invoiceNo: "Invoice No.", remark: "Remark", fromType: "From",
  warehouse: "Warehouse", buyer: "Buyer", supplier: "Supplier", season: "Season",
  po: "PO", style: "Style", model: "Model", totalItems: "Items", status: "Status", actions: "Actions",
};
function loadColumnVisibility() {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(COLUMN_VISIBILITY_KEY)) || {};
  } catch {
    return {};
  }
}

/* ============================================================
   Small helpers
   ============================================================ */

function Field({ text, required, children }) {
  return (
    <label className="block">
      <span className={labelCls}>{text} {required && <span className="text-red-500">*</span>}</span>
      {children}
    </label>
  );
}

// Batch/item status chip. Five possible statuses now that Material
// Inspection sits between Receive and Location Assignment:
//   "pending_inspection" -> just received, nobody has inspected it yet
//   "pending"             -> inspected, some/all passed, nothing racked yet
//   "partial"             -> some racked, some still unassigned
//   "approved"            -> fully racked
//   "rejected"            -> inspection passed 0 Roll / 0 Yds
function statusChip(status) {
  if (status === "approved") return <span className={chipApproved}>Approved</span>;
  if (status === "partial") return <span className={chipPartial}>Partially Assigned</span>;
  if (status === "pending_inspection") return <span className={chipInspection}>Awaiting Inspection</span>;
  if (status === "rejected") return <span className={chipRejected}>Rejected</span>;
  return <span className={chipPending}>Pending</span>;
}

/* ============================================================
   Style + Model rows -- one Style always carries its own Model
   ============================================================ */

function StyleModelRows({ rows, onAdd, onRemove, onChange }) {
  return (
    <div className="space-y-1.5">
      {rows.map((row) => (
        <div key={row.key} className="bg-white border border-gray-200 rounded-lg p-1.5 grid grid-cols-2 gap-1.5">
          <input type="text" placeholder="Style" value={row.style} onChange={(e) => onChange(row.key, "style", up(e.target.value))} className={inputSm} />
          <div className="flex items-center gap-1.5">
            <input type="text" placeholder="Model" value={row.model} onChange={(e) => onChange(row.key, "model", up(e.target.value))} className={`${inputSm} flex-1 min-w-0`} />
            {rows.length > 1 && (
              <button type="button" onClick={() => onRemove(row.key)} className="text-base leading-none font-medium text-red-500 hover:text-red-700 shrink-0 px-1" aria-label="Remove style">×</button>
            )}
          </div>
        </div>
      ))}
      <button type="button" onClick={onAdd} className="inline-flex items-center gap-1 text-[11px] font-semibold hover:underline" style={{ color: BLUE }}>
        <Plus size={12} /> Add Style
      </button>
    </div>
  );
}

/* ============================================================
   StockPreview -- big, clear "already in stock" breakdown for a
   given Item Code/PDM + Color: grouped Rack-wise, then Date-wise
   underneath each rack, with a per-rack total. Shared by the form's
   live preview and the Location Assignment "search before assign".
   ============================================================ */

function StockPreview({ preview }) {
  if (!preview?.length) {
    return <div className="text-[11px] italic text-gray-400 px-1 py-1">No existing stock found for this Item Code/PDM + Color.</div>;
  }

  const byRack = preview.reduce((acc, r) => {
    const key = r.location || "Unassigned";
    (acc[key] ||= []).push(r);
    return acc;
  }, {});
  const rackNames = Object.keys(byRack).sort();

  return (
    <div className="space-y-2">
      {rackNames.map((rack) => {
        const rows = byRack[rack].slice().sort((a, b) => (a.date || "").localeCompare(b.date || ""));
        const totalRoll = rows.reduce((s, r) => s + Number(r.availableRoll || 0), 0);
        const totalYds = rows.reduce((s, r) => s + Number(r.availableYds || 0), 0);
        return (
          <div key={rack} className="rounded-lg border overflow-hidden bg-white" style={{ borderColor: BORDER_CLR }}>
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 px-2.5 py-1.5" style={{ background: BLUE_ROW }}>
              <span className="flex items-center gap-1 text-xs font-bold" style={{ color: BLUE_DARK }}>
                <MapPin size={13} /> {rack}
              </span>
              <span className="text-xs font-bold" style={{ color: BLUE_DARK }}>
                {totalRoll} Roll · {totalYds} Yds
              </span>
            </div>
            <table className="w-full text-xs">
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.itemId}
                    title={`Invoice ${r.invoiceNo}`}
                    className="border-t border-gray-100"
                  >
                    <td className="px-2.5 py-1.5 text-gray-500 whitespace-nowrap">
                      {r.date?.slice(0, 10)}
                    </td>
                    <td className="px-2.5 py-1.5 text-right font-semibold text-gray-800 whitespace-nowrap">
                      {r.availableRoll} Roll
                    </td>
                    <td className="px-2.5 py-1.5 text-right font-semibold text-gray-800 whitespace-nowrap">
                      {r.availableYds} Yds
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

/* ============================================================
   ColorRow -- Color/Fabric Details/Roll/Yds inputs, plus a live
   "already in stock" preview (Rack + Date + Qty) for this exact
   Item Code/PDM + Color, pulled from Available Stock as the user
   types. Fabric Details is REQUIRED and does not affect the stock
   lookup (which is keyed on Item Code/PDM + Color only).
   ============================================================ */

function ColorRow({ itemCodePdm, color, canRemove, onRemove, onChange }) {
  const [preview, setPreview] = useState([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    const code = (itemCodePdm || "").trim();
    const col = (color.color || "").trim();

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!code || !col) {
      setPreview([]);
      setHasSearched(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoadingPreview(true);
      try {
        const params = new URLSearchParams({ itemCodePdm: code, color: col });
        const res = await fetch(`${API_URL}/material-stock?${params.toString()}`, { credentials: "include" });
        if (!res.ok) throw new Error("lookup failed");
        const data = await res.json();
        setPreview(data.rows || []);
      } catch {
        setPreview([]);
      } finally {
        setLoadingPreview(false);
        setHasSearched(true);
      }
    }, 400);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };

  }, [itemCodePdm, color.color]);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-2 space-y-1.5">
      <div className="flex items-center gap-1.5">
        <input type="text" placeholder="Color" value={color.color} onChange={(e) => onChange(color.key, "color", up(e.target.value))} className={`${inputSm} flex-1 min-w-0`} />
        {canRemove && (
          <button type="button" onClick={() => onRemove(color.key)} className="text-base leading-none font-medium text-red-500 hover:text-red-700 shrink-0 px-1" aria-label="Remove color">
            ×
          </button>
        )}
      </div>
      <input
        type="text"
        required
        placeholder="Fabric Details *"
        value={color.fabricDetails}
        onChange={(e) => onChange(color.key, "fabricDetails", up(e.target.value))}
        className={inputSm}
      />
      <div className="grid grid-cols-2 gap-1.5">
        <input type="number" placeholder="Roll" value={color.roll} onChange={(e) => onChange(color.key, "roll", e.target.value)} className={inputSm} />
        <input type="number" placeholder="Yds" value={color.yds} onChange={(e) => onChange(color.key, "yds", e.target.value)} className={inputSm} />
      </div>

      {loadingPreview && (
        <div className="text-[10px] text-gray-400 italic">Checking existing stock...</div>
      )}
      {!loadingPreview && hasSearched && (
        <div className="pt-1 space-y-1.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
            Already in Stock
          </div>
          <StockPreview preview={preview} />
        </div>
      )}
    </div>
  );
}

/* ============================================================
   ItemCodeCard (merged) -- compact row layout
   ============================================================ */

function ItemCodeCard({ itemCode, index, canRemove, onNameChange, onRemove, onAddColor, onRemoveColor, onColorChange }) {
  return (
    <div className="rounded-xl border p-2 space-y-2" style={{ background: BLUE_ROW, borderColor: BORDER_CLR }}>
      <div className="flex items-center gap-1.5">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: BLUE }}>
          {index + 1}
        </span>
        <input type="text" placeholder="Item Code / PDM" value={itemCode.itemCodePdm}
          onChange={(e) => onNameChange(up(e.target.value))} className={`${inputSm} flex-1 min-w-0`} />
        {canRemove && (
          <button type="button" onClick={onRemove} className="text-[11px] font-semibold text-red-500 hover:text-red-700 hover:underline shrink-0">
            Remove
          </button>
        )}
      </div>

      <div className="space-y-1.5">
        {itemCode.colors.map((c) => (
          <ColorRow
            key={c.key}
            itemCodePdm={itemCode.itemCodePdm}
            color={c}
            canRemove={itemCode.colors.length > 1}
            onRemove={onRemoveColor}
            onChange={onColorChange}
          />
        ))}
      </div>

      <button type="button" onClick={onAddColor} className="inline-flex items-center gap-1 text-[11px] font-semibold hover:underline" style={{ color: BLUE }}>
        <Plus size={12} /> Add Color
      </button>
    </div>
  );
}

/* ============================================================
   AllocationList -- shows a batch's existing rack allocations
   (Rack, Roll, Yds), each editable inline or removable. This is
   what lets a single 100-roll batch show up as e.g.
     Rack-1: 70 Roll / 700 Yds   [Edit] [Remove]
     Rack-2: 30 Roll / 300 Yds   [Edit] [Remove]
   ============================================================ */

function AllocationList({ locations, onSaveEdit, onDelete, busyId }) {
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({ location: "", roll: "", yds: "" });

  if (!locations?.length) {
    return <div className="text-[10px] italic text-gray-400">No rack assigned yet.</div>;
  }

  const startEdit = (loc) => {
    setEditingId(loc.id);
    setDraft({ location: loc.location, roll: String(loc.rollQty), yds: String(loc.yds) });
  };

  const saveEdit = async (id) => {
    await onSaveEdit(id, { location: draft.location, rollQty: draft.roll, yds: draft.yds });
    setEditingId(null);
  };

  return (
    <div className="space-y-1">
      {locations.map((loc) => {
        const locked = Number(loc.availableRoll) !== Number(loc.rollQty) || Number(loc.availableYds) !== Number(loc.yds);
        const isEditing = editingId === loc.id;
        return (
          <div key={loc.id} className="flex flex-wrap items-center gap-x-1.5 gap-y-1 bg-white border rounded-lg px-2 py-1.5" style={{ borderColor: BORDER_CLR }}>
            {isEditing ? (
              <div className="w-full space-y-1.5">
                {/* Rack select on its own full-width row so the selected
                    rack name is always visible on narrow screens. */}
                <div className="relative">
                  <MapPin size={11} className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: BLUE }} />
                  <select
                    value={draft.location}
                    onChange={(e) => setDraft((p) => ({ ...p, location: e.target.value }))}
                    className={`${inputSm} w-full !pl-6 font-semibold`}
                  >
                    {RACK_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-1.5">
                  <input type="number" value={draft.roll} onChange={(e) => setDraft((p) => ({ ...p, roll: e.target.value }))} placeholder="Roll" className={`${inputSm} flex-1 min-w-0`} />
                  <input type="number" value={draft.yds} onChange={(e) => setDraft((p) => ({ ...p, yds: e.target.value }))} placeholder="Yds" className={`${inputSm} flex-1 min-w-0`} />
                  <button type="button" onClick={() => saveEdit(loc.id)} disabled={busyId === loc.id} className="text-green-600 hover:opacity-70 shrink-0 p-1" aria-label="Save"><Check size={16} /></button>
                  <button type="button" onClick={() => setEditingId(null)} className="text-red-500 hover:opacity-70 shrink-0 p-1" aria-label="Cancel"><X size={16} /></button>
                </div>
              </div>
            ) : (
              <>
                <MapPin size={11} className="shrink-0" style={{ color: BLUE }} />
                <span className="font-bold text-[11px]" style={{ color: BLUE_DARK }}>{loc.location}</span>
                <span className="text-[11px] text-gray-700 flex-1 min-w-0">
                  {loc.rollQty} Roll · {loc.yds} Yds
                  {locked && <span className="text-[9px] italic text-gray-400 ml-1">(issued, locked)</span>}
                </span>
                {!locked && (
                  <>
                    <button type="button" onClick={() => startEdit(loc)} className="hover:underline text-[11px] font-semibold shrink-0" style={{ color: BLUE }}>Edit</button>
                    <button type="button" onClick={() => onDelete(loc.id)} disabled={busyId === loc.id} className="text-red-500 hover:underline text-[11px] font-semibold shrink-0">Remove</button>
                  </>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ============================================================
   Item Code / Color breakdown -- with inline MULTI-RACK
   Location/Rack assignment for pending/partial rows: each row shows
   its existing per-rack allocations (editable / removable) plus a
   form to assign more of whatever's still unassigned, so one batch
   (e.g. 100 Roll) can be split across several racks (e.g. 70 ->
   Rack-1, 30 -> Rack-2). Also keeps the "search before assign"
   toggle that shows where this exact Item Code/PDM + Color already
   sits (Rack + Date-wise) before you commit to a rack.

   Fabric Details is shown read-only here (it's entered once on
   Material Receive and never edited from this drawer).

   A batch sits in one of FIVE statuses -- "pending_inspection"
   (Material Inspection hasn't looked at it yet) and "rejected"
   (inspection passed 0/0) are both dead ends here: the Rack
   Assignment form is hidden and a short explanatory note is shown
   instead, since Location Assignment can never place stock that
   hasn't passed inspection.

   RESPONSIVE: below `lg` each batch renders as a stacked card;
   from `lg` up it's the full sub-table. The whole drawer is pinned
   to the left edge and limited to the viewport width on small
   screens (sticky + width calc), because it sits inside a wide,
   horizontally-scrollable parent table.

   NOTE: colSpan is 14 to match the parent Saved Records table.
   ============================================================ */

function ItemsBreakdownTable({ invoiceNo, items, onAssigned }) {
  const [newAlloc, setNewAlloc] = useState({}); // { [itemId]: { location, roll, yds } }
  const [assigningId, setAssigningId] = useState(null);
  const [rowError, setRowError] = useState({});
  const [openPreviewId, setOpenPreviewId] = useState(null);
  const [previewData, setPreviewData] = useState({});
  const [previewLoadingId, setPreviewLoadingId] = useState(null);

  if (!items?.length) {
    return <tr><td colSpan={14} className="px-3 py-2 text-[11px] italic text-gray-400">No item code / color rows found.</td></tr>;
  }

  const getDraft = (itemId) => newAlloc[itemId] || { location: RACK_OPTIONS[0], roll: "", yds: "" };
  const setDraft = (itemId, field, v) =>
    setNewAlloc((p) => ({ ...p, [itemId]: { ...getDraft(itemId), [field]: v } }));

  const handleAssign = async (row) => {
    const draft = getDraft(row.id);
    setAssigningId(row.id);
    setRowError((p) => ({ ...p, [row.id]: "" }));
    try {
      const res = await fetch(`${API_URL}/location-assignment/${row.id}`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location: draft.location, rollQty: draft.roll || 0, yds: draft.yds || 0 }),
      });
      if (!res.ok) { const body = await res.json().catch(() => ({})); throw new Error(body.message || "Failed to assign location"); }
      setNewAlloc((p) => ({ ...p, [row.id]: { location: RACK_OPTIONS[0], roll: "", yds: "" } }));
      onAssigned?.();
    } catch (err) {
      setRowError((p) => ({ ...p, [row.id]: err.message }));
    } finally {
      setAssigningId(null);
    }
  };

  const handleSaveAllocationEdit = async (allocationId, { location, rollQty, yds }) => {
    try {
      const res = await fetch(`${API_URL}/location-assignment/allocation/${allocationId}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location, rollQty, yds }),
      });
      if (!res.ok) { const body = await res.json().catch(() => ({})); throw new Error(body.message || "Failed to update allocation"); }
      onAssigned?.();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteAllocation = async (allocationId) => {
    if (!confirm("Remove this rack allocation? The quantity returns to unassigned.")) return;
    try {
      const res = await fetch(`${API_URL}/location-assignment/allocation/${allocationId}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) { const body = await res.json().catch(() => ({})); throw new Error(body.message || "Failed to remove allocation"); }
      onAssigned?.();
    } catch (err) {
      alert(err.message);
    }
  };

  const togglePreview = async (row) => {
    if (openPreviewId === row.id) { setOpenPreviewId(null); return; }
    setOpenPreviewId(row.id);
    if (previewData[row.id]) return; // already fetched, no need to refetch
    setPreviewLoadingId(row.id);
    try {
      const params = new URLSearchParams({ itemCodePdm: row.itemCodePdm, color: row.color });
      const res = await fetch(`${API_URL}/material-stock?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("lookup failed");
      const data = await res.json();
      setPreviewData((p) => ({ ...p, [row.id]: data.rows || [] }));
    } catch {
      setPreviewData((p) => ({ ...p, [row.id]: [] }));
    } finally {
      setPreviewLoadingId(null);
    }
  };

  /* ---- shared render helpers (used by BOTH the card and table layouts) ---- */

  const passedInfo = (row) =>
    row.status === "pending_inspection" ? (
      <span className="italic text-gray-400">not inspected</span>
    ) : (
      <>
        <span className="text-green-600 font-semibold">{row.passedRoll} Roll / {row.passedYds} Yds</span>
        {Number(row.rejectedRoll) > 0 || Number(row.rejectedYds) > 0 ? (
          <span className="block text-red-600">{row.rejectedRoll} Roll / {row.rejectedYds} Yds rejected</span>
        ) : null}
      </>
    );

  const previewBody = (row) =>
    previewLoadingId === row.id ? (
      <div className="text-[11px] text-gray-400 italic">Checking existing stock...</div>
    ) : (
      <StockPreview preview={previewData[row.id] || []} />
    );

  const rackBlock = (row) => {
    // Only "pending" / "partial" (i.e. batches that have PASSED Material
    // Inspection and aren't fully racked yet) can be targeted for a new rack
    // assignment. "pending_inspection" and "rejected" have nothing available
    // to place; "approved" is already fully placed.
    const isLocked = row.status === "approved" || row.status === "pending_inspection" || row.status === "rejected";
    const previewOpen = openPreviewId === row.id;
    const draft = getDraft(row.id);
    return (
      <div className="space-y-2">
        {/* Existing rack allocations for this batch */}
        <AllocationList
          locations={row.locations}
          onSaveEdit={handleSaveAllocationEdit}
          onDelete={handleDeleteAllocation}
          busyId={assigningId}
        />

        {/* Search-before-assign toggle */}
        <button
          type="button"
          onClick={() => togglePreview(row)}
          className="inline-flex items-center gap-1 text-[11px] font-semibold hover:underline"
          style={{ color: previewOpen ? BLUE_DARK : BLUE }}
        >
          <Search size={11} /> {previewOpen ? "Hide" : "Check"} existing stock
        </button>

        {/* Explanatory notes for the two "can't be assigned" states. */}
        {row.status === "pending_inspection" && (
          <div className="text-[10px] italic text-purple-700">
            Awaiting Material Inspection approval before this batch can be racked.
          </div>
        )}
        {row.status === "rejected" && (
          <div className="text-[10px] italic text-red-600">
            Rejected during inspection ({row.rejectedRoll} Roll / {row.rejectedYds} Yds) -- not available for stock.
          </div>
        )}

        {/* Assign-more form, only while quantity remains unassigned */}
        {!isLocked && (
          <div className="space-y-1.5">
            <label className="block">
              <span className="block mb-0.5 text-[9px] font-bold uppercase tracking-wider text-gray-400">Rack</span>
              <div className="relative">
                <MapPin size={11} className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: BLUE }} />
                <select
                  value={draft.location}
                  onChange={(e) => setDraft(row.id, "location", e.target.value)}
                  className={`${inputSm} w-full !pl-6 font-semibold`}
                >
                  {RACK_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="number" placeholder="Roll" value={draft.roll}
                onChange={(e) => setDraft(row.id, "roll", e.target.value)}
                className={`${inputSm} flex-1 min-w-0`}
              />
              <input
                type="number" placeholder="Yds" value={draft.yds}
                onChange={(e) => setDraft(row.id, "yds", e.target.value)}
                className={`${inputSm} flex-1 min-w-0`}
              />
              <button
                type="button"
                onClick={() => handleAssign(row)}
                disabled={assigningId === row.id}
                className="inline-flex items-center gap-1 rounded-lg bg-[#3B9ED4] hover:bg-[#2E8EC4] text-white text-xs font-semibold px-3 py-1.5 transition-colors disabled:opacity-50 shrink-0"
              >
                {assigningId === row.id ? "..." : "Assign"}
              </button>
            </div>
            <div className="text-[10px] text-gray-400 leading-snug">
              Up to {row.unassignedRoll} Roll / {row.unassignedYds} Yds left to place. Assign part of it to split across racks — assigning to a Rack that already holds this batch merges into that same Rack instead of creating a duplicate.
            </div>
          </div>
        )}
        {rowError[row.id] && <div className="text-[11px] text-red-600">{rowError[row.id]}</div>}
      </div>
    );
  };

  return (
    <tr>
      <td colSpan={14} className="p-0">
        {/* Below lg: pinned to the left edge + capped to the viewport width so
            the drawer never needs sideways scrolling. From lg up: normal. */}
        <div className="sticky left-0 w-[calc(100vw-3.5rem)] lg:static lg:w-auto">
          <div
            className="mx-2 my-2 rounded-xl border overflow-hidden"
            style={{ background: BLUE_ROW, borderColor: BORDER_CLR, borderLeft: `4px solid ${BLUE}` }}
          >
            <div className="flex items-center gap-2 px-3 py-2" style={{ background: BLUE }}>
              <PackageSearch size={14} className="text-white shrink-0" />
              <span className="text-xs font-bold uppercase tracking-wider text-white break-words min-w-0">
                Items under Invoice {invoiceNo}
              </span>
            </div>

            {/* ── Below lg: stacked cards ── */}
            <div className="lg:hidden p-2.5 space-y-2.5">
              {items.map((row) => {
                const rowId = row.id ?? row.key ?? `${row.itemCodePdm}-${row.color}`;
                return (
                  <div key={rowId} className="rounded-lg border bg-white p-3 space-y-2.5" style={{ borderColor: BORDER_CLR }}>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-bold text-sm break-words" style={{ color: BLUE_DARK }}>{row.itemCodePdm}</span>
                      <span className="text-sm font-medium text-gray-700 break-words">{row.color}</span>
                      <span className="ml-auto">{statusChip(row.status)}</span>
                    </div>

                    {row.fabricDetails && (
                      <div className="text-xs text-gray-500 break-words">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Fabric · </span>
                        {row.fabricDetails}
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-1.5 rounded-lg px-3 py-2.5 text-xs" style={{ background: BLUE_ROW }}>
                      <div className="flex justify-between gap-3">
                        <span className="text-gray-500">Received</span>
                        <span className="font-semibold text-gray-700 text-right">{row.rollQty} Roll / {row.yds} Yds</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-gray-500">Passed / Rejected</span>
                        <span className="text-right">{passedInfo(row)}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-gray-500">Unassigned</span>
                        <span className="font-bold text-right" style={{ color: BLUE_DARK }}>{row.unassignedRoll} Roll / {row.unassignedYds} Yds</span>
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Rack Assignment</div>
                      {rackBlock(row)}
                    </div>

                    {openPreviewId === row.id && (
                      <div className="rounded-lg p-2.5" style={{ background: BLUE_ROW }}>
                        {previewBody(row)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* ── lg and up: full sub-table ── */}
            <div className={`hidden lg:block overflow-x-auto ${scrollThin}`}>
              <table className="min-w-full text-xs">
                <thead>
                  <tr style={{ background: BLUE_HDR }}>
                    {["Item Code / PDM", "Color", "Fabric Details", "Received Roll/Yds", "Passed / Rejected", "Unassigned", "Status", "Rack Assignment"].map((h, i) => (
                      <th
                        key={h}
                        className={`px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-gray-700 border-b ${i === 7 ? "w-96" : ""}`}
                        style={{ borderBottomColor: "#A8D3EC" }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((row, idx) => {
                    const rowId = row.id ?? row.key ?? `${row.itemCodePdm}-${row.color}`;
                    const previewOpen = openPreviewId === row.id;
                    return (
                      <Fragment key={rowId}>
                        <tr className={`border-b border-gray-100 ${idx % 2 === 0 ? "bg-white" : "bg-[#F7FBFE]"}`}>
                          <td className="px-3 py-2.5 font-bold align-top" style={{ color: BLUE_DARK }}>{row.itemCodePdm}</td>
                          <td className="px-3 py-2.5 font-medium text-gray-800 align-top">{row.color}</td>
                          <td className="px-3 py-2.5 text-gray-600 align-top">
                            {row.fabricDetails || <span className="italic text-gray-400">-</span>}
                          </td>
                          <td className="px-3 py-2.5 align-top whitespace-nowrap text-gray-700">{row.rollQty} Roll / {row.yds} Yds</td>
                          <td className="px-3 py-2.5 align-top whitespace-nowrap">{passedInfo(row)}</td>
                          <td className="px-3 py-2.5 align-top whitespace-nowrap font-bold" style={{ color: BLUE_DARK }}>
                            {row.unassignedRoll} Roll / {row.unassignedYds} Yds
                          </td>
                          <td className="px-3 py-2.5 align-top">{statusChip(row.status)}</td>
                          <td className="px-3 py-2.5 align-top">{rackBlock(row)}</td>
                        </tr>
                        {previewOpen && (
                          <tr style={{ background: BLUE_ROW }}>
                            <td colSpan={8} className="px-3 py-2.5">
                              {previewBody(row)}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}

/* ============================================================
   Saved Records search row -- one clearly-labeled input per field
   (Invoice No., Buyer [dropdown], Supplier, PO, Style, Model, Item
   Code/PDM, Color, Fabric Details), all sitting on a single
   horizontally-scrollable line. Each field is sent to the backend
   as its own query param and matched only against its own column
   there, so "Item Code/PDM" never accidentally matches a "Color"
   value or vice versa.
   ============================================================ */

function RecordFilterRow({ filters, setFilters }) {
  const anyActive = Object.values(filters).some((v) => v && v.trim());
  return (
    <div className={`flex items-end gap-2 overflow-x-auto pb-1 ${scrollThin}`}>
      {RECORD_FILTER_FIELDS.map((f, i) => (
        <label key={f.key} className="shrink-0 w-[140px]">
          <span className="block mb-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 whitespace-nowrap">
            {f.label}
          </span>
          <div className="relative">
            {i === 0 && <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />}
            {f.type === "select" ? (
              <select
                value={filters[f.key]}
                onChange={(e) => setFilters((p) => ({ ...p, [f.key]: e.target.value }))}
                className={`${inputSm} ${filters[f.key] ? "!border-[#3B9ED4]/60 !bg-[#EEF6FC]" : ""}`}
              >
                <option value="">All Buyers</option>
                {BUYERS.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            ) : (
              <input
                type="text"
                value={filters[f.key]}
                onChange={(e) => setFilters((p) => ({ ...p, [f.key]: e.target.value }))}
                placeholder={f.label}
                className={`${inputSm} ${i === 0 ? "!pl-6" : ""} ${filters[f.key] ? "!border-[#3B9ED4]/60 !bg-[#EEF6FC]" : ""}`}
              />
            )}
          </div>
        </label>
      ))}
      {anyActive && (
        <button
          type="button"
          onClick={() => setFilters(emptyRecordFilters)}
          className="shrink-0 self-end pb-2 text-[11px] font-semibold hover:underline px-1"
          style={{ color: BLUE }}
        >
          Clear
        </button>
      )}
    </div>
  );
}

/* ============================================================
   Records panel -- built on @tanstack/react-table.

   COLUMN WIDTH: the table is a normal auto-layout table (no
   table-fixed, no per-breakpoint hidden columns). Every column is
   always shown, sized to fit its content -- like a spreadsheet --
   and the whole table sits inside a horizontally scrollable strip
   (`overflow-auto`) so wide content never gets clipped, it just
   scrolls into view. Use the Columns picker to hide what you don't need.

   PAGINATION: `receives` is just the CURRENT PAGE (server-side paginated
   via ?page=&limit=), and a pagination bar sits below the scroll area
   showing Page X of Y / total count, a page-size selector, and
   First/Prev/Next/Last controls.

   STYLE / MODEL COLUMNS: Style and Model are two separate columns,
   each stacking one line per Style row (in the same order), so
   Model row N always lines up beside Style row N.

   HEIGHT: from `lg` up the panel fills its (fixed-height) parent and the
   table body scrolls inside; below `lg` the parent has no fixed height, so
   the scroll region is capped at 70vh instead.
   ============================================================ */

function RecordsPanel({
  filters, setFilters, receives, loading, expandedIds, toggleExpanded, onEdit, onDelete, onAssigned,
  page, totalPages, totalCount, pageSize, setPageSize, goToPage,
}) {
  // Column show/hide picker -- state starts empty (= everything visible)
  // and is replaced by whatever was saved in localStorage once mounted
  // (avoids an SSR/client mismatch from reading localStorage up front).
  // Every change is written straight back to localStorage.
  const [columnVisibility, setColumnVisibility] = useState({});
  const [columnsMenuOpen, setColumnsMenuOpen] = useState(false);
  const columnsMenuRef = useRef(null);

  useEffect(() => { setColumnVisibility(loadColumnVisibility()); }, []);
  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem(COLUMN_VISIBILITY_KEY, JSON.stringify(columnVisibility));
  }, [columnVisibility]);

  useEffect(() => {
    if (!columnsMenuOpen) return;
    const closeIfOutside = (e) => { if (columnsMenuRef.current && !columnsMenuRef.current.contains(e.target)) setColumnsMenuOpen(false); };
    document.addEventListener("mousedown", closeIfOutside);
    return () => document.removeEventListener("mousedown", closeIfOutside);
  }, [columnsMenuOpen]);

  const columns = useMemo(() => [
    {
      id: "expander",
      header: () => "",
      cell: ({ row }) => (expandedIds.has(row.original.id) ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />),
    },
    {
      accessorKey: "date",
      header: "Date",
      meta: { className: "whitespace-nowrap" },
      cell: ({ getValue }) => getValue()?.slice(0, 10),
    },
    {
      accessorKey: "invoiceNo",
      header: "Invoice No.",
      meta: { className: "whitespace-nowrap" },
      cell: ({ getValue }) => <span className="font-semibold text-gray-800">{getValue()}</span>,
    },
    {
      accessorKey: "remark",
      header: "Remark",
      cell: ({ getValue }) => {
        const v = getValue();
        return v
          ? <span title={v} className="block max-w-[220px] truncate text-gray-500">{v}</span>
          : <span className="italic text-gray-300">-</span>;
      },
    },
    {
      accessorKey: "fromType",
      header: "From",
      meta: { className: "whitespace-nowrap" },
      cell: ({ getValue }) => <span className={chip}>{getValue()}</span>,
    },
    {
      accessorKey: "warehouse",
      header: "Warehouse",
      meta: { className: "whitespace-nowrap" },
      cell: ({ getValue }) => <span className={chip}>{getValue()}</span>,
    },
    {
      accessorKey: "buyer",
      header: "Buyer",
      meta: { className: "whitespace-nowrap" },
      cell: ({ getValue }) => <span className="font-medium text-gray-800">{getValue()}</span>,
    },
    {
      accessorKey: "supplier",
      header: "Supplier",
      cell: ({ getValue }) => {
        const v = getValue();
        return v
          ? <span title={v} className="block max-w-[200px] truncate text-gray-500">{v}</span>
          : <span className="italic text-gray-300">-</span>;
      },
    },
    {
      accessorKey: "season",
      header: "Season",
      meta: { className: "whitespace-nowrap" },
      cell: ({ getValue }) => getValue(),
    },
    {
      accessorKey: "po",
      header: "PO",
      meta: { className: "whitespace-nowrap" },
      cell: ({ getValue }) => getValue(),
    },
    // Style and Model are two separate, aligned columns: each renders one
    // stacked line per style entry, in the same order, so line N in Style
    // always sits beside line N in Model -- no wrapping/expand logic needed.
    {
      id: "style",
      header: "Style",
      cell: ({ row }) => {
        const list = row.original.styles || [];
        if (!list.length) return <span className="italic text-gray-300">-</span>;
        return (
          <div className="flex flex-col gap-1">
            {list.map((s) => (
              <div key={s.id ?? s.style} className="truncate max-w-[140px] font-semibold" style={{ color: BLUE_DARK }} title={s.style}>
                {s.style}
              </div>
            ))}
          </div>
        );
      },
    },
    {
      id: "model",
      header: "Model",
      cell: ({ row }) => {
        const list = row.original.styles || [];
        if (!list.length) return <span className="italic text-gray-300">-</span>;
        return (
          <div className="flex flex-col gap-1">
            {list.map((s) => (
              <div key={s.id ?? s.style} className="truncate max-w-[140px] text-gray-600" title={s.model || "-"}>
                {s.model || <span className="italic text-gray-300">-</span>}
              </div>
            ))}
          </div>
        );
      },
    },
    {
      accessorKey: "totalItems",
      header: "Items",
      cell: ({ getValue }) => <span className={chip}>{getValue()}</span>,
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => statusChip(row.original.status === "approved" ? "approved" : "pending"),
    },
    {
      id: "actions",
      header: "Actions",
      meta: { className: "whitespace-nowrap" },
      cell: ({ row }) => {
        const r = row.original;
        const isApproved = r.status === "approved";
        return (
          <div className="flex gap-3" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => onEdit(r.id)} disabled={isApproved} title={isApproved ? "Fully approved receives can't be edited" : "Edit"}
              className="inline-flex items-center gap-1 font-semibold hover:underline disabled:opacity-40 disabled:pointer-events-none" style={{ color: BLUE }}>
              <Pencil size={12} /> <span>Edit</span>
            </button>
            <button onClick={() => onDelete(r.id)} disabled={isApproved} title={isApproved ? "Fully approved receives can't be deleted" : "Delete"}
              className="inline-flex items-center gap-1 font-semibold text-red-600 hover:underline disabled:opacity-40 disabled:pointer-events-none">
              <Trash2 size={12} /> <span>Delete</span>
            </button>
          </div>
        );
      },
    },
  ], [expandedIds, onEdit, onDelete]);

  const table = useReactTable({
    data: receives,
    columns,
    state: { columnVisibility },
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => String(row.id),
  });

  return (
    <div className={`${card} flex flex-col lg:h-full overflow-hidden`}>
      {/* Title bar */}
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2 px-4 sm:px-5 py-3 border-b border-gray-100 bg-gray-50 shrink-0">
        <PackageSearch size={16} style={{ color: BLUE }} />
        <h2 className="font-bold text-sm text-gray-800">Saved Records</h2>
        <span className="text-xs px-2 py-0.5 rounded-full font-semibold text-white" style={{ background: BLUE }}>
          {totalCount}
        </span>
        <span className="hidden sm:inline text-[10px] text-gray-400 ml-auto">Newest first</span>

        {/* Column show/hide picker -- tick which columns to show, saved to
            localStorage so the choice is remembered next time. */}
        <div className="relative ml-auto sm:ml-0" ref={columnsMenuRef}>
          <button type="button" onClick={() => setColumnsMenuOpen((o) => !o)} className={btnSecondary}>
            <SlidersHorizontal size={14} /> Columns
          </button>
          {columnsMenuOpen && (
            <div className="absolute right-0 top-full mt-1.5 z-30 w-52 rounded-xl bg-white border border-gray-200 shadow-xl overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Show/Hide</span>
                <button type="button" onClick={() => setColumnVisibility({})} className="text-[10px] font-semibold hover:underline" style={{ color: BLUE }}>
                  All
                </button>
              </div>
              <div className={`max-h-64 overflow-y-auto py-1 ${scrollThin}`}>
                {table.getAllLeafColumns().filter((c) => c.id !== "expander").map((c) => (
                  <label key={c.id} className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-[#EEF6FC] cursor-pointer transition-colors">
                    <input type="checkbox" checked={c.getIsVisible()} onChange={c.getToggleVisibilityHandler()} className="rounded" style={{ accentColor: BLUE }} />
                    {COLUMN_LABELS[c.id] || c.id}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="px-4 sm:px-5 py-3 border-b border-gray-100 bg-gray-50/60 shrink-0">
        <RecordFilterRow filters={filters} setFilters={setFilters} />
      </div>

      {/* Table scroll region. Below lg: capped at 70vh. From lg up: fills the
          panel (whose parent has a definite height). */}
      <div className={`min-h-0 overflow-auto max-h-[70vh] lg:max-h-none lg:flex-1 ${scrollThin}`}>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400 text-sm">
            <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: BLUE + "40", borderTopColor: BLUE }} />
            Loading records…
          </div>
        ) : receives.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400 text-sm text-center px-4">
            <PackageSearch size={32} className="opacity-30" />
            No material receives found.
          </div>
        ) : (
          <table className="min-w-full text-xs border-collapse">
            <thead className="sticky top-0 z-10">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} style={{ background: BLUE_HDR }}>
                  {hg.headers.map((header) => (
                    <th
                      key={header.id}
                      className={`px-3 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-700 border-b whitespace-nowrap ${header.column.columnDef.meta?.className || ""}`}
                      style={{ borderBottomColor: "#A8D3EC" }}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row, i) => {
                const r = row.original;
                const isOpen = expandedIds.has(r.id);
                return (
                  <Fragment key={row.id}>
                    <tr
                      onClick={() => toggleExpanded(r.id)}
                      className={`border-b border-gray-100 cursor-pointer transition-colors hover:bg-[#DBEEFF] ${isOpen ? "bg-[#DBEEFF]" : i % 2 === 0 ? "bg-white" : "bg-[#EEF6FC]"}`}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td
                          key={cell.id}
                          className={`px-3 py-2.5 align-top text-gray-700 ${cell.column.columnDef.meta?.className || ""}`}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                    {isOpen && <ItemsBreakdownTable invoiceNo={r.invoiceNo} items={r.items} onAssigned={onAssigned} />}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination bar -- server-side paginated (see fetchReceives),
          always visible at the bottom of the card regardless of scroll. */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 sm:px-5 py-3 border-t border-gray-100 bg-gray-50 shrink-0 text-xs text-gray-500">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="whitespace-nowrap font-medium">
            Page {page} of {totalPages} · {totalCount.toLocaleString()} total
          </span>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline">Rows per page</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="rounded-lg border border-gray-200 bg-white text-gray-700 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[#3B9ED4]/25"
            >
              {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" className={btnIcon} onClick={() => goToPage(1)} disabled={page <= 1} title="First"><ChevronsLeft size={13} /></button>
          <button type="button" className={btnIcon} onClick={() => goToPage(page - 1)} disabled={page <= 1} title="Prev"><ChevronLeft size={13} /></button>
          <span className="px-3 py-1 rounded-lg text-white text-xs font-bold whitespace-nowrap" style={{ background: BLUE }}>
            {page} / {totalPages}
          </span>
          <button type="button" className={btnIcon} onClick={() => goToPage(page + 1)} disabled={page >= totalPages} title="Next"><ChevronRight size={13} /></button>
          <button type="button" className={btnIcon} onClick={() => goToPage(totalPages)} disabled={page >= totalPages} title="Last"><ChevronsRight size={13} /></button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Main page
   ============================================================ */

export default function MaterialReceivePage() {
  const [form, setForm] = useState(emptyForm);
  const [styleRows, setStyleRows] = useState([newStyleRow()]);
  const [itemCodes, setItemCodes] = useState([newItemCode()]);
  const [receives, setReceives] = useState([]);
  const [recordFilters, setRecordFilters] = useState(emptyRecordFilters);
  const [editingId, setEditingId] = useState(null);
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [formOpen, setFormOpen] = useState(false);

  // Server-side pagination state for the Saved Records table.
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Each filter box is sent to the backend as its OWN query param
  // (invoiceNo=, buyer=, supplier=, po=, style=, model=, itemCodePdm=,
  // color=, fabricDetails=) and the backend matches each one only against its
  // own column (AND across whichever fields are filled in). This is what
  // fixes "Item Code/PDM = TEST-2" incorrectly matching a row whose Color
  // happens to be TEST-2.
  //
  // Also sends page=/limit= so the backend returns only ONE PAGE of
  // records (and their styles/items/locations) instead of all 1000+ at
  // once. Response shape is { data, total, page, limit, totalPages }.
  const fetchReceives = useCallback(async (filters = emptyRecordFilters, pageArg = 1, limitArg = 20) => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => {
        if (v && v.trim()) params.set(k, v.trim());
      });
      params.set("page", pageArg);
      params.set("limit", limitArg);
      const res = await fetch(`${API_URL}/material-receive?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load material receives");
      const body = await res.json();
      setReceives(body.data || []);
      setTotalPages(body.totalPages || 1);
      setTotalCount(body.total || 0);
      setPage(body.page || 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load.
  useEffect(() => {
    fetchReceives(recordFilters, 1, pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Whenever filters change, debounce and jump back to page 1 (a filtered
  // result set has its own page count, so staying on e.g. page 12 of the
  // unfiltered list would very likely be out of range).
  useEffect(() => {
    const t = setTimeout(() => fetchReceives(recordFilters, 1, pageSize), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordFilters]);

  const goToPage = (p) => {
    if (p < 1 || p > totalPages || p === page) return;
    fetchReceives(recordFilters, p, pageSize);
  };

  const changePageSize = (n) => {
    setPageSize(n);
    fetchReceives(recordFilters, 1, n);
  };

  const resetForm = () => {
    setForm(emptyForm); setStyleRows([newStyleRow()]); setItemCodes([newItemCode()]); setEditingId(null);
  };

  const addStyleRow = () => setStyleRows((p) => [...p, newStyleRow()]);
  const removeStyleRow = (key) => setStyleRows((p) => p.filter((s) => s.key !== key));
  const updateStyleRow = (key, field, v) => setStyleRows((p) => p.map((s) => (s.key === key ? { ...s, [field]: v } : s)));

  const addItemCode = () => setItemCodes((p) => [...p, newItemCode()]);
  const removeItemCode = (key) => setItemCodes((p) => p.filter((ic) => ic.key !== key));
  const updateItemCodeName = (key, v) => setItemCodes((p) => p.map((ic) => (ic.key === key ? { ...ic, itemCodePdm: v } : ic)));
  const addColor = (key) => setItemCodes((p) => p.map((ic) => (ic.key === key ? { ...ic, colors: [...ic.colors, newColor()] } : ic)));
  const removeColor = (key, ck) => setItemCodes((p) => p.map((ic) => (ic.key === key ? { ...ic, colors: ic.colors.filter((c) => c.key !== ck) } : ic)));
  const updateColor = (key, ck, field, v) =>
    setItemCodes((p) => p.map((ic) => (ic.key === key ? { ...ic, colors: ic.colors.map((c) => (c.key === ck ? { ...c, [field]: v } : c)) } : ic)));

  const toggleExpanded = (id) =>
    setExpandedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(""); setSuccess("");

    const styles = styleRows.filter((s) => s.style.trim()).map((s) => ({ style: s.style.trim(), model: s.model.trim() }));
    if (styles.length === 0) { setError("Add at least one Style (with its Model)."); return; }

    const items = itemCodes.flatMap((ic) =>
      ic.colors.filter((c) => c.color).map((c) => ({
        itemCodePdm: ic.itemCodePdm, color: c.color, fabricDetails: c.fabricDetails, rollQty: c.roll, yds: c.yds,
      }))
    );
    if (items.length === 0) { setError("Add at least one Item Code/PDM with a Color row."); return; }

    // Fabric Details is required for every Item Code/PDM + Color row.
    if (items.some((it) => !it.fabricDetails || !it.fabricDetails.trim())) {
      setError("Fabric Details is required for every Item Code/PDM + Color row.");
      return;
    }

    setSaving(true);
    try {
      const url = editingId ? `${API_URL}/material-receive/${editingId}` : `${API_URL}/material-receive`;
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST", credentials: "include",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, styles, items }),
      });
      if (!res.ok) { const body = await res.json().catch(() => ({})); throw new Error(body.message || "Failed to save material receive"); }
      setSuccess(editingId ? "Material receive updated." : "Material receive saved. It now awaits Material Inspection before it can be racked.");
      resetForm();
      // A newly created receive should be visible -- jump back to page 1
      // (newest-first ordering) rather than the page we happened to be on.
      fetchReceives(recordFilters, editingId ? page : 1, pageSize);
      setFormOpen(false);
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  const handleNewReceive = () => {
    resetForm();
    setFormOpen(true);
  };

  const handleEdit = async (id) => {
    setError("");
    try {
      const res = await fetch(`${API_URL}/material-receive/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load material receive");
      const data = await res.json();
      setForm({
        date: data.date?.slice(0, 10) || "", invoiceNo: data.invoiceNo || "", fromType: data.fromType || "Overseas",
        warehouse: data.warehouse || "K-2", buyer: data.buyer || "", supplier: data.supplier || "",
        season: data.season || "", po: data.po || "",
        item: data.item || "", buy: data.buy || "", remark: data.remark || "",
      });

      setStyleRows(
        (data.styles || []).length
          ? data.styles.map((s) => ({ key: uid(), style: s.style, model: s.model || "" }))
          : [newStyleRow()]
      );

      const grouped = [];
      for (const row of data.items) {
        let g = grouped.find((g) => g.itemCodePdm === row.itemCodePdm);
        if (!g) { g = { key: uid(), itemCodePdm: row.itemCodePdm, colors: [] }; grouped.push(g); }
        g.colors.push({ key: uid(), color: row.color, fabricDetails: row.fabricDetails || "", roll: row.rollQty, yds: row.yds });
      }
      setItemCodes(grouped.length ? grouped : [newItemCode()]);
      setEditingId(id);
      setFormOpen(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) { setError(err.message); }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this Material Receive? This cannot be undone.")) return;
    setError("");
    try {
      const res = await fetch(`${API_URL}/material-receive/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) { const body = await res.json().catch(() => ({})); throw new Error(body.message || "Failed to delete material receive"); }
      setSuccess("Material receive deleted.");
      // If we just deleted the last row on this page (and it wasn't page 1),
      // step back a page so we don't land on an empty page.
      const nextPage = receives.length === 1 && page > 1 ? page - 1 : page;
      fetchReceives(recordFilters, nextPage, pageSize);
    } catch (err) { setError(err.message); }
  };

  // Keep the current buyer visible in the dropdown even if it's not one of
  // the standard BUYERS (e.g. an older record saved before this list existed).
  const buyerOptions = form.buyer && !BUYERS.includes(form.buyer) ? [form.buyer, ...BUYERS] : BUYERS;

  return (
    <div className="min-h-screen" style={{ background: PAGE_BG, fontFamily: "Inter, system-ui, sans-serif" }}>

      {/* ── Top bar (matches Material Stock / Style Register) ── */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm shrink-0" style={{ background: BLUE }}>
            <PackageSearch size={18} className="text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-bold text-gray-800 leading-tight truncate">Material Receive</h1>
            <p className="text-[10px] text-gray-400 truncate">Record incoming fabric / material invoices</p>
          </div>
        </div>
        {!formOpen && (
          <button type="button" onClick={handleNewReceive} className={`${btnPrimary} shrink-0`}>
            <Plus size={15} />
            <span className="hidden sm:inline">New Material Receive</span>
            <span className="sm:hidden">New</span>
          </button>
        )}
      </div>

      <div className="max-w-[1440px] mx-auto px-3 sm:px-4 py-4 sm:py-5 space-y-4">

        {/* ── Info note ── */}
        <div
          className="flex items-start gap-2.5 rounded-xl border px-3 sm:px-4 py-3 text-xs text-gray-600"
          style={{ background: BLUE_ROW, borderColor: BORDER_CLR }}
        >
          <Info size={15} className="shrink-0 mt-0.5" style={{ color: BLUE }} />
          <p>
            Record incoming fabric/material invoices, grouped by Item Code/PDM and Color. Each batch first goes to
            Material Inspection for approval, then can be split across one or more Locations/Racks here.
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3">
            <span className="font-bold">Error:</span> {error}
          </div>
        )}
        {success && (
          <div className="rounded-xl border border-green-200 bg-green-50 text-green-700 text-sm px-4 py-3">{success}</div>
        )}

        {/*
          FORM + RECORDS TABLE.

          - lg and up: side by side, each with its OWN independent scroll
            region (sticky columns; the records column gets a FIXED viewport
            height so RecordsPanel's flex-1 scroll area has something definite
            to size against and actually scrolls).
          - below lg: stacked. The form (when open) sits on top at full width,
            the records panel below it with its scroll region capped at 70vh.
        */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-start gap-4">
          {/* FORM COLUMN */}
          <div
            className={`w-full lg:shrink-0 transition-all duration-300 ease-in-out ${formOpen
                ? "block lg:w-[340px] opacity-100 translate-x-0"
                : "hidden lg:block lg:w-0 opacity-0 -translate-x-6 pointer-events-none"
              }`}
          >
            <div className={`lg:sticky lg:top-4 lg:w-[340px] lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto overflow-x-hidden ${scrollHidden}`}>
              <form onSubmit={handleSubmit} className={`${card} p-3 sm:p-4 lg:p-3 space-y-3 w-full lg:w-[340px]`}>
                <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                  <h2 className="font-bold text-sm text-gray-800">
                    {editingId ? "Edit Receive" : "Receive Details"}
                  </h2>
                  <button type="button" onClick={() => { setFormOpen(false); if (editingId) resetForm(); }}
                    className="text-gray-400 hover:text-[#3B9ED4] transition-colors p-1 -m-1" title="Close">
                    <X size={16} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-x-2.5 gap-y-2.5">
                  <Field text="Date" required><input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={inputCls} /></Field>
                  <Field text="Invoice No." required><input type="text" required value={form.invoiceNo} onChange={(e) => setForm({ ...form, invoiceNo: up(e.target.value) })} className={inputCls} /></Field>
                  <Field text="From" required>
                    <select value={form.fromType} onChange={(e) => setForm({ ...form, fromType: e.target.value })} className={inputCls}>
                      <option value="Overseas">Overseas</option><option value="Local">Local</option>
                    </select>
                  </Field>
                  <Field text="Warehouse" required>
                    <select value={form.warehouse} onChange={(e) => setForm({ ...form, warehouse: e.target.value })} className={inputCls}>
                      {WAREHOUSE_OPTIONS.map((w) => <option key={w} value={w}>{w}</option>)}
                    </select>
                  </Field>
                  <div className="col-span-2">
                    <Field text="Buyer" required>
                      <select required value={form.buyer} onChange={(e) => setForm({ ...form, buyer: e.target.value })} className={inputCls}>
                        <option value="" disabled>Select buyer...</option>
                        {buyerOptions.map((b) => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </Field>
                  </div>
                  <div className="col-span-2">
                    <Field text="Supplier">
                      <input
                        type="text"
                        value={form.supplier}
                        onChange={(e) => setForm({ ...form, supplier: up(e.target.value) })}
                        placeholder="Optional"
                        className={inputCls}
                      />
                    </Field>
                  </div>
                  <Field text="Season" required><input type="text" required value={form.season} onChange={(e) => setForm({ ...form, season: up(e.target.value) })} className={inputCls} /></Field>
                  <Field text="PO" required><input type="text" required value={form.po} onChange={(e) => setForm({ ...form, po: up(e.target.value) })} className={inputCls} /></Field>
                  <Field text="Item" required><input type="text" required value={form.item} onChange={(e) => setForm({ ...form, item: up(e.target.value) })} className={inputCls} /></Field>
                  {/* Buy is OPTIONAL -- no "required" prop on Field (no
                      asterisk) and no "required" attribute on the input. */}
                  <Field text="Buy"><input type="text" value={form.buy} onChange={(e) => setForm({ ...form, buy: up(e.target.value) })} placeholder="Optional" className={inputCls} /></Field>

                  <div className="col-span-2">
                    <Field text="Remark">
                      <textarea
                        rows={2}
                        value={form.remark}
                        onChange={(e) => setForm({ ...form, remark: up(e.target.value) })}
                        placeholder="Optional note..."
                        className={`${inputCls} resize-none`}
                      />
                    </Field>
                  </div>

                  <div className="col-span-2">
                    <Field text="Style + Model" required>
                      <StyleModelRows rows={styleRows} onAdd={addStyleRow} onRemove={removeStyleRow} onChange={updateStyleRow} />
                    </Field>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                    <h2 className="font-bold text-sm text-gray-800">Item Code / PDM &amp; Colors</h2>
                  </div>
                  <button type="button" onClick={addItemCode} className={`${btnSecondary} w-full`}><Plus size={14} /> Add Item Code/PDM</button>
                  <div className="space-y-2">
                    {itemCodes.map((ic, i) => (
                      <ItemCodeCard key={ic.key} itemCode={ic} index={i} canRemove={itemCodes.length > 1}
                        onNameChange={(v) => updateItemCodeName(ic.key, v)} onRemove={() => removeItemCode(ic.key)}
                        onAddColor={() => addColor(ic.key)} onRemoveColor={(ck) => removeColor(ic.key, ck)}
                        onColorChange={(ck, f, v) => updateColor(ic.key, ck, f, v)} />
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-3 border-t border-gray-100">
                  <button type="submit" disabled={saving} className={`${btnPrimary} w-full`}>
                    {saving ? "Saving..." : editingId ? "Update Material Receive" : "Save Material Receive"}
                  </button>
                  {editingId && <button type="button" onClick={() => { resetForm(); setFormOpen(false); }} className={`${btnSecondary} w-full`}>Cancel Edit</button>}
                </div>
              </form>
            </div>
          </div>

          {/* RECORDS COLUMN */}
          <div className="w-full min-w-0 lg:w-auto lg:flex-1 lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] lg:overflow-hidden">
            <RecordsPanel
              filters={recordFilters}
              setFilters={setRecordFilters}
              receives={receives}
              loading={loading}
              expandedIds={expandedIds}
              toggleExpanded={toggleExpanded}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onAssigned={() => fetchReceives(recordFilters, page, pageSize)}
              page={page}
              totalPages={totalPages}
              totalCount={totalCount}
              pageSize={pageSize}
              setPageSize={changePageSize}
              goToPage={goToPage}
            />
          </div>
        </div>
      </div>

      <style>{`
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #c8d9e8; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #9ab8cc; }
      `}</style>
    </div>
  );
}
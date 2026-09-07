// app/(Pages)/(Material-warehouse)/material-warehouse/material-stock/page.js

"use client";
import React from "react";
import {
  ArrowUpDown, Boxes, ChevronDown, ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight, ChevronUp, Clock, Database, Filter,
  RotateCcw, Search, SlidersHorizontal, TrendingUp,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  flexRender, getCoreRowModel, getPaginationRowModel,
  getSortedRowModel, useReactTable,
} from "@tanstack/react-table";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

// ─── Theme (matches Style Register) ───────────────────────────────────────────
const BLUE = "#3B9ED4";
const BLUE_DARK = "#2E8EC4";
const BLUE_HDR = "#C8E3F5";  // table header bg
const BLUE_ROW = "#EEF6FC";  // odd row bg
const BLUE_FAINT = "#DBEEFF";  // hover
const BORDER_CLR = "#D1E4F0";
const PAGE_BG = "#F0F4F8";
const TEXT_MAIN = "#1a1a1a";
const TEXT_SUB = "#5a6a7a";

// ─── Shared class helpers ──────────────────────────────────────────────────────
const inputCls =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 " +
  "placeholder:text-gray-400 shadow-sm focus:outline-none focus:ring-2 " +
  `focus:ring-[${BLUE}]/25 focus:border-[${BLUE}] transition-all duration-150`;

const btnPrimary =
  "inline-flex items-center gap-2 rounded-lg text-white text-sm font-semibold px-4 py-2.5 transition-colors shadow-sm disabled:opacity-50 disabled:pointer-events-none";

const btnSecondary =
  "inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white " +
  "text-gray-600 text-sm font-medium px-3 py-2 hover:border-[#3B9ED4] " +
  "hover:text-[#3B9ED4] transition-colors disabled:opacity-40 disabled:pointer-events-none";

const btnIcon =
  "inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white " +
  "text-gray-500 w-8 h-8 hover:border-[#3B9ED4] hover:text-[#3B9ED4] " +
  "transition-colors disabled:opacity-30 disabled:pointer-events-none";

// ─── Filter / column config ───────────────────────────────────────────────────
// dateFrom / dateTo are handled with dedicated <input type="date"> controls
// in FilterPanel (see below) rather than the generic FILTER_FIELDS text-input
// loop, but they still live in the same `filters` state object so the
// existing "build querystring from every non-empty filter" logic in
// runSearch() picks them up automatically with no extra plumbing.
const emptyFilters = {
  itemCodePdm: "", style: "", color: "", model: "", season: "",
  buyer: "", invoiceNo: "", item: "", warehouse: "", location: "",
  supplier: "", fabricDetails: "", dateFrom: "", dateTo: "",
};

const FILTER_FIELDS = [
  { key: "itemCodePdm", label: "Item Code / PDM" },
  { key: "style", label: "Style" },
  { key: "model", label: "Model" },
  { key: "color", label: "Color" },
  { key: "season", label: "Season" },
  { key: "buyer", label: "Buyer" },
  { key: "invoiceNo", label: "Invoice No." },
  { key: "item", label: "Item" },
  { key: "warehouse", label: "Warehouse" },
  { key: "location", label: "Location" },
  { key: "supplier", label: "Supplier" },
  { key: "fabricDetails", label: "Fabric Details" },
];

// Age-bucket display order + colors, shared by the Ageing summary card and
// the optional "Age Bucket" table column. Must match the backend's
// AGE_BUCKET_ORDER in materialStock.controllers.js.
const AGE_BUCKET_COLORS = {
  "0-30 days": "#22c55e",
  "31-60 days": "#84cc16",
  "61-90 days": "#f59e0b",
  "91-180 days": "#f97316",
  "180+ days": "#ef4444",
};

const ALL_COLUMNS = [
  { key: "date", label: "Date", width: 6, defaultOn: true },
  { key: "invoiceNo", label: "Invoice No.", width: 7, defaultOn: false },
  { key: "buyer", label: "Buyer", width: 8, defaultOn: true },
  { key: "season", label: "Season", width: 6, defaultOn: false },
  { key: "styleModel", label: "Style | Model", width: 11, defaultOn: true },
  { key: "warehouse", label: "W/H", width: 5, defaultOn: false },
  { key: "item", label: "Item", width: 7, defaultOn: false },
  { key: "itemCodePdm", label: "Item Code/PDM", width: 9, defaultOn: true },
  { key: "color", label: "Color", width: 7, defaultOn: true },
  { key: "fabricDetails", label: "Fabric Details", width: 8, defaultOn: false },
  { key: "supplier", label: "Supplier", width: 8, defaultOn: false },
  { key: "location", label: "Location", width: 6, defaultOn: true },
  { key: "receivedRoll", label: "Recv. Roll", width: 6, align: "right", defaultOn: true },
  { key: "receivedYds", label: "Recv. Yds", width: 6, align: "right", defaultOn: true },
  { key: "availableRoll", label: "Avail. Roll", width: 6, align: "right", defaultOn: true },
  { key: "rollChart", label: "Roll %", width: 6, align: "center", defaultOn: true },
  { key: "availableYds", label: "Avail. Yds", width: 6, align: "right", defaultOn: true },
  { key: "ydsChart", label: "Yds %", width: 6, align: "center", defaultOn: true },
  { key: "ageDays", label: "Age (Days)", width: 6, align: "right", defaultOn: false },
  { key: "ageBucket", label: "Age Bucket", width: 7, align: "center", defaultOn: false },
];

const DEFAULT_KEYS = ALL_COLUMNS.filter((c) => c.defaultOn).map((c) => c.key);
const LS_KEY = "materialStock:visibleColumns";

function loadSavedColumns() {
  if (typeof window === "undefined") return DEFAULT_KEYS;
  try {
    const s = JSON.parse(window.localStorage.getItem(LS_KEY));
    return Array.isArray(s) && s.length ? s : DEFAULT_KEYS;
  } catch { return DEFAULT_KEYS; }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
const fmtNum = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return v ?? "";
  return n % 1 === 0 ? n.toLocaleString() : n.toLocaleString(undefined, { maximumFractionDigits: 2 });
};

const numFs = (t) => {
  const l = String(t).length;
  if (l <= 4) return "1em"; if (l <= 6) return "0.92em"; if (l <= 8) return "0.8em"; return "0.68em";
};

// ─── Mini donut ────────────────────────────────────────────────────────────────
function MiniDonut({ percent }) {
  const v = Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0));
  const size = 26; const sw = 4.5;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const color = v >= 70 ? "#22c55e" : v >= 35 ? "#f59e0b" : "#ef4444";
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={sw} stroke="#e2e8f0" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={sw}
        strokeDasharray={circ} strokeDashoffset={circ * (1 - v / 100)}
        strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`}
        stroke={color} style={{ transition: "stroke-dashoffset .35s ease" }}
      />
    </svg>
  );
}

// ─── KPI tile ──────────────────────────────────────────────────────────────────
function KpiTile({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4 flex items-center gap-4">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: color + "18" }}>
        <Icon size={20} style={{ color }} />
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">{label}</p>
        <p className="text-xl font-bold text-gray-800 leading-none">{value}</p>
      </div>
    </div>
  );
}

// ─── Columns picker dropdown ───────────────────────────────────────────────────
function ColumnsMenu({ visibleKeys, setVisibleKeys }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const fn = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [open]);

  const toggle = (key) =>
    setVisibleKeys((p) => p.includes(key) ? p.filter((k) => k !== key) : [...p, key]);

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} className={btnSecondary}>
        <SlidersHorizontal size={15} />
        Columns
        <span className="text-[10px] font-bold" style={{ color: BLUE }}>({visibleKeys.length})</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-30 w-52 rounded-xl bg-white border border-gray-200 shadow-xl overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Show/Hide</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => setVisibleKeys(ALL_COLUMNS.map((c) => c.key))}
                className="text-[10px] font-semibold hover:underline" style={{ color: BLUE }}>All</button>
              <button type="button" onClick={() => setVisibleKeys(DEFAULT_KEYS)}
                className="text-[10px] font-semibold hover:underline" style={{ color: BLUE }}>Default</button>
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {ALL_COLUMNS.map((c) => (
              <label key={c.key} className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-[#EEF6FC] cursor-pointer transition-colors">
                <input type="checkbox" checked={visibleKeys.includes(c.key)} onChange={() => toggle(c.key)}
                  className="rounded" style={{ accentColor: BLUE }} />
                {c.label}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Filter panel ──────────────────────────────────────────────────────────────
function FilterPanel({ filters, setFilters, onSearch, onReset, loading }) {
  const active = Object.values(filters).filter((v) => v?.trim()).length;

  return (
    <form onSubmit={onSearch} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-2">
          <Filter size={14} style={{ color: BLUE }} />
          <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Search Filters</span>
          {active > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold text-white" style={{ background: BLUE }}>
              {active} active
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={loading}
            style={{ backgroundColor: BLUE }}
            className={btnPrimary}
          >
            <Search size={14} />
            {loading ? "Searching…" : "Search"}
          </button>
        </div>
      </div>

      {/* Date range — filters against the parent Receive's Date, inclusive
          on both ends. Kept separate from the generic text-field grid below
          since these need type="date" pickers rather than free text. */}
      <div className="flex flex-wrap items-end gap-3 px-4 pt-4 pb-4 border-b border-gray-100 bg-gray-50/60">
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Date From</label>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
            className={`${inputCls} !py-2 !text-xs w-40 ${filters.dateFrom ? "border-[#3B9ED4]/60 bg-[#EEF6FC]" : ""}`}
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Date To</label>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
            className={`${inputCls} !py-2 !text-xs w-40 ${filters.dateTo ? "border-[#3B9ED4]/60 bg-[#EEF6FC]" : ""}`}
          />
        </div>
        {(filters.dateFrom || filters.dateTo) && (
          <button
            type="button"
            onClick={() => setFilters({ ...filters, dateFrom: "", dateTo: "" })}
            className="text-[10px] font-semibold hover:underline text-gray-400 mb-2.5"
          >
            Clear dates
          </button>
        )}
      </div>

      <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
        {FILTER_FIELDS.map((f) => (
          <div key={f.key} className="relative">
            <input
              type="text"
              value={filters[f.key]}
              onChange={(e) => setFilters({ ...filters, [f.key]: e.target.value })}
              placeholder={f.label}
              title={f.label}
              className={`${inputCls} !py-2 !text-xs pr-7 ${filters[f.key] ? "border-[#3B9ED4]/60 bg-[#EEF6FC]" : ""}`}
            />
            {filters[f.key] && (
              <button type="button" onClick={() => setFilters({ ...filters, [f.key]: "" })}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 text-base leading-none">
                ×
              </button>
            )}
          </div>
        ))}
      </div>
    </form>
  );
}

// ─── Summary table (Table 1) ───────────────────────────────────────────────────
function SummaryTable({ summary }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  if (!summary?.length) return null;

  const q = query.trim().toLowerCase();
  const rows = q
    ? summary.filter((s) => s.itemCodePdm?.toLowerCase().includes(q) || s.color?.toLowerCase().includes(q))
    : summary;

  const HEADERS = ["Item Code / PDM", "Color", "Avail. Roll", "Avail. Yds"];

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <TrendingUp size={16} style={{ color: BLUE }} />
          <span className="font-bold text-sm text-gray-800">Total Available</span>
          <span className="text-xs px-2 py-0.5 rounded-full font-semibold text-white" style={{ background: BLUE }}>
            {rows.length}{q ? ` / ${summary.length}` : ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {open && (
            <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search item or color…"
              className={`${inputCls} !py-1.5 w-44 !text-xs`} />
          )}
          <button type="button" onClick={() => setOpen((o) => !o)} className={btnSecondary}>
            {open ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      {open && (
        rows.length === 0
          ? <p className="text-sm text-gray-400 italic px-5 py-4">No matches found.</p>
          : (
            <div className="overflow-x-auto max-h-60 overflow-y-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr style={{ background: BLUE_HDR }}>
                    {HEADERS.map((h, i) => (
                      <th key={h}
                        className={`px-5 py-3 text-xs font-bold uppercase tracking-wider text-gray-700 border-b border-[#A8D3EC] ${i >= 2 ? "text-right" : "text-left"}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s, i) => (
                    <tr key={`${s.itemCodePdm}-${s.color}`}
                      className={`border-b border-gray-100 hover:bg-[${BLUE_FAINT}] transition-colors ${i % 2 === 0 ? "bg-white" : "bg-[#EEF6FC]"}`}>
                      <td className="px-5 py-3 text-xs font-semibold" style={{ color: BLUE }}>{s.itemCodePdm}</td>
                      <td className="px-5 py-3 text-xs text-gray-700">{s.color}</td>
                      <td className="px-5 py-3 text-xs text-right font-bold text-green-600 font-mono">
                        <span style={{ fontSize: numFs(s.totalAvailableRoll) }}>{fmtNum(s.totalAvailableRoll)}</span>
                      </td>
                      <td className="px-5 py-3 text-xs text-right font-bold text-green-600 font-mono">
                        <span style={{ fontSize: numFs(s.totalAvailableYds) }}>{fmtNum(s.totalAvailableYds)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
      )}
    </div>
  );
}

// ─── Inventory Ageing summary (Table 1b) ───────────────────────────────────────
// Mirrors SummaryTable's shape/behavior (collapsible card + table) but for
// the ageingSummary array from the backend: one row per age bucket
// (0-30 / 31-60 / 61-90 / 91-180 / 180+ days), always all five buckets in
// a fixed order, showing how many batches and how much available stock has
// been sitting that long. Helps spot slow-moving / dead stock at a glance.
function AgeingSummary({ ageing }) {
  const [open, setOpen] = useState(false);
  if (!ageing?.length) return null;

  const totalAvailableYds = ageing.reduce((s, a) => s + (Number(a.totalAvailableYds) || 0), 0);

  const HEADERS = ["Age Bucket", "Avail. Roll", "Avail. Yds"];
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <Clock size={16} style={{ color: BLUE }} />
          <span className="font-bold text-sm text-gray-800">Inventory Ageing</span>
        </div>
        <button type="button" onClick={() => setOpen((o) => !o)} className={btnSecondary}>
          {open ? "Hide" : "Show"}
        </button>
      </div>

      {open && (
        totalAvailableYds === 0
          ? <p className="text-sm text-gray-400 italic px-5 py-4">No stock in the current results to age.</p>
          : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr style={{ background: BLUE_HDR }}>
                    {HEADERS.map((h, i) => (
                      <th key={h}
                        className={`px-5 py-3 text-xs font-bold uppercase tracking-wider text-gray-700 border-b border-[#A8D3EC] ${i >= 1 ? "text-right" : "text-left"}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ageing.map((a, i) => (
                    <tr key={a.ageBucket}
                      className={`border-b border-gray-100 hover:bg-[${BLUE_FAINT}] transition-colors ${i % 2 === 0 ? "bg-white" : "bg-[#EEF6FC]"}`}>
                      <td className="px-5 py-3 text-xs">
                        <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold text-white"
                          style={{ background: AGE_BUCKET_COLORS[a.ageBucket] || "#6b7280" }}>
                          {a.ageBucket}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs text-right font-bold text-green-600 font-mono">
                        <span style={{ fontSize: numFs(a.totalAvailableRoll) }}>{fmtNum(a.totalAvailableRoll)}</span>
                      </td>
                      <td className="px-5 py-3 text-xs text-right font-bold text-green-600 font-mono">
                        <span style={{ fontSize: numFs(a.totalAvailableYds) }}>{fmtNum(a.totalAvailableYds)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
      )}
    </div>
  );
}
// ─── Cell primitives ───────────────────────────────────────────────────────────
const CP = "px-4 py-3 text-xs border-b border-gray-100 overflow-hidden";

function TCell({ children, align = "left", title, className = "" }) {
  const a = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  return (
    <td className={`${CP} ${a} ${className}`} title={title}>
      <div className="truncate">{children}</div>
    </td>
  );
}

function NumCell({ value }) {
  const t = fmtNum(value);
  return (
    <td className={`${CP} text-right`}>
      <div className="font-mono font-semibold text-gray-700 truncate" style={{ fontSize: numFs(t) }}>{t}</div>
    </td>
  );
}

function AvailCell({ value }) {
  const t = fmtNum(value);
  return (
    <td className={`${CP} text-right`}>
      <div className="font-mono font-bold text-green-600 truncate" style={{ fontSize: numFs(t) }}>{t}</div>
    </td>
  );
}

function PctCell({ percent, title }) {
  const v = Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0));
  const color = v >= 70 ? "#22c55e" : v >= 35 ? "#f59e0b" : "#ef4444";
  return (
    <td className={`${CP} text-center`} title={title}>
      <div className="flex items-center justify-center gap-1.5">
        <MiniDonut percent={v} />
        <span className="font-bold text-xs" style={{ color }}>{v}%</span>
      </div>
    </td>
  );
}

function StyleModelCell({ styles }) {
  const [exp, setExp] = useState(false);
  const list = styles || [];
  const vis = exp ? list : list.slice(0, 1);
  const hidden = list.length - vis.length;
  return (
    <td className={`${CP} align-top`}>
      <div className="flex flex-col gap-0.5">
        {vis.map((s) => (
          <span key={s.id ?? `${s.style}-${s.model}`} className="text-xs">
            <span className="font-semibold" style={{ color: BLUE }}>{s.style}</span>
            {s.model && <span className="text-gray-400"> | {s.model}</span>}
          </span>
        ))}
      </div>
      {list.length > 1 && (
        <button type="button" onClick={() => setExp((e) => !e)}
          className="mt-0.5 inline-flex items-center gap-0.5 text-[10px] font-semibold hover:underline" style={{ color: BLUE }}>
          {exp ? <><ChevronUp size={10} />Less</> : <><ChevronDown size={10} />+{hidden} more</>}
        </button>
      )}
    </td>
  );
}

function getSortValue(key, r) {
  switch (key) {
    case "date": return r.date || "";
    case "invoiceNo": return r.invoiceNo || "";
    case "buyer": return r.buyer || "";
    case "season": return r.season || "";
    case "styleModel": return r.styles?.[0]?.style || "";
    case "warehouse": return r.warehouse || "";
    case "item": return r.item || "";
    case "itemCodePdm": return r.itemCodePdm || "";
    case "color": return r.color || "";
    case "fabricDetails": return r.fabricDetails || "";
    case "supplier": return r.supplier || "";
    case "location": return r.location || "";
    case "receivedRoll": return Number(r.rollQty) || 0;
    case "receivedYds": return Number(r.yds) || 0;
    case "availableRoll": return Number(r.availableRoll) || 0;
    case "rollChart": return r.rollQty ? Math.round((Number(r.availableRoll) / Number(r.rollQty)) * 100) : 0;
    case "availableYds": return Number(r.availableYds) || 0;
    case "ydsChart": return r.yds ? Math.round((Number(r.availableYds) / Number(r.yds)) * 100) : 0;
    case "ageDays": return Number(r.ageDays) || 0;
    case "ageBucket": return r.ageBucket || "";
    default: return "";
  }
}

function renderCell(key, r) {
  const locChip = (v) => (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold text-white" style={{ background: "#0d9488" }}>{v}</span>
  );
  const whChip = (v) => (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold" style={{ background: BLUE + "18", color: BLUE }}>{v}</span>
  );
  const ageBucketChip = (v) => (
    <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold text-white"
      style={{ background: AGE_BUCKET_COLORS[v] || "#6b7280" }}>{v}</span>
  );
  switch (key) {
    case "date": return <TCell key="date" title={r.date?.slice(0, 10)}>{r.date?.slice(0, 10)}</TCell>;
    case "invoiceNo": return <TCell key="invoiceNo">{r.invoiceNo}</TCell>;
    case "buyer": return <TCell key="buyer" className="font-medium text-gray-800">{r.buyer}</TCell>;
    case "season": return <TCell key="season" align="center"><span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700">{r.season}</span></TCell>;
    case "styleModel": return <StyleModelCell key="styleModel" styles={r.styles} />;
    case "warehouse": return <TCell key="warehouse" align="center">{whChip(r.warehouse)}</TCell>;
    case "item": return <TCell key="item">{r.item}</TCell>;
    case "itemCodePdm": return <TCell key="itemCodePdm" className="font-semibold" style={{ color: BLUE }}>{r.itemCodePdm}</TCell>;
    case "color": return <TCell key="color">{r.color}</TCell>;
    case "fabricDetails": return <TCell key="fabricDetails">{r.fabricDetails || <span className="text-gray-300 italic">—</span>}</TCell>;
    case "supplier": return <TCell key="supplier">{r.supplier || <span className="text-gray-300 italic">—</span>}</TCell>;
    case "location": return <TCell key="location" align="center">{locChip(r.location)}</TCell>;
    case "receivedRoll": return <NumCell key="receivedRoll" value={r.rollQty} />;
    case "receivedYds": return <NumCell key="receivedYds" value={r.yds} />;
    case "availableRoll": return <AvailCell key="availableRoll" value={r.availableRoll} />;
    case "rollChart": {
      const p = r.rollQty ? Math.round((r.availableRoll / r.rollQty) * 100) : 0;
      return <PctCell key="rollChart" percent={p} title={`${p}% of received rolls available`} />;
    }
    case "availableYds": return <AvailCell key="availableYds" value={r.availableYds} />;
    case "ydsChart": {
      const p = r.yds ? Math.round((r.availableYds / r.yds) * 100) : 0;
      return <PctCell key="ydsChart" percent={p} title={`${p}% of received yards available`} />;
    }
    case "ageDays": return <NumCell key="ageDays" value={r.ageDays} />;
    case "ageBucket": return <TCell key="ageBucket" align="center">{r.ageBucket ? ageBucketChip(r.ageBucket) : <span className="text-gray-300 italic">—</span>}</TCell>;
    default: return null;
  }
}

// ─── Pagination bar ────────────────────────────────────────────────────────────
const PS_OPTS = [10, 25, 50, 100];

function PaginationBar({ table, total }) {
  const idx = table.getState().pagination.pageIndex;
  const size = table.getState().pagination.pageSize;
  const count = Math.max(table.getPageCount(), 1);
  const from = total === 0 ? 0 : idx * size + 1;
  const to = Math.min((idx + 1) * size, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-t border-gray-100 bg-gray-50 text-sm">
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span>Rows per page</span>
        <select value={size} onChange={(e) => table.setPageSize(Number(e.target.value))}
          className="rounded-lg border border-gray-200 bg-white text-gray-700 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[#3B9ED4]/25">
          {PS_OPTS.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>

      <span className="text-xs text-gray-500 font-medium">
        {total === 0 ? "0 rows" : `${from}–${to} of ${total.toLocaleString()}`}
      </span>

      <div className="flex items-center gap-1">
        <button type="button" className={btnIcon} onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()} title="First"><ChevronsLeft size={13} /></button>
        <button type="button" className={btnIcon} onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} title="Prev"><ChevronLeft size={13} /></button>
        <span className="px-3 py-1 rounded-lg text-white text-xs font-bold whitespace-nowrap" style={{ background: BLUE }}>
          {count === 0 ? 0 : idx + 1} / {count}
        </span>
        <button type="button" className={btnIcon} onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} title="Next"><ChevronRight size={13} /></button>
        <button type="button" className={btnIcon} onClick={() => table.setPageIndex(count - 1)} disabled={!table.getCanNextPage()} title="Last"><ChevronsRight size={13} /></button>
      </div>
    </div>
  );
}

// ─── Stock batches table (Table 2) ─────────────────────────────────────────────
function StockTable({ rows, loading, searched, visibleKeys }) {
  const [sorting, setSorting] = useState([]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 25 });

  const cols = useMemo(
    () => ALL_COLUMNS.filter((c) => visibleKeys.includes(c.key)).map((c) => ({
      id: c.key,
      accessorFn: (row) => getSortValue(c.key, row),
      header: c.label,
      cell: (info) => renderCell(c.key, info.row.original),
      meta: { align: c.align, width: c.width },
    })),
    [visibleKeys]
  );

  const table = useReactTable({
    data: rows, columns: cols,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  useEffect(() => {
    setPagination((p) => p.pageIndex === 0 ? p : { ...p, pageIndex: 0 });
  }, [rows]);

  const tw = cols.reduce((s, c) => s + (c.meta.width || 0), 0) || 1;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Table top bar */}
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: BLUE + "18" }}>
            <Boxes size={16} style={{ color: BLUE }} />
          </div>
          <div>
            <div>
              <p className="font-bold text-sm text-gray-800 leading-tight">Stock Records</p>
              <p className="text-[10px] text-gray-400 leading-tight">{rows.length.toLocaleString()} records</p>
            </div>
          </div>
        </div>
        <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full font-medium">
          {visibleKeys.length} columns
        </span>
      </div>

      {/* Scroll area */}
      <div className="overflow-auto max-h-[58vh]" style={{ scrollbarWidth: "thin" }}>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400 text-sm">
            <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: BLUE + "40", borderTopColor: BLUE }} />
            Loading stock data…
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400 text-sm">
            <Database size={32} className="opacity-30" />
            {searched ? "No stock batches match these filters." : "Use the filters above to search for stock."}
          </div>
        ) : cols.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">No columns selected — use the Columns picker.</div>
        ) : (
          <table className="w-full border-collapse table-fixed" style={{ fontSize: "clamp(0.65rem, 0.48rem + 0.5vw, 0.82rem)" }}>
            <colgroup>
              {cols.map((c) => <col key={c.id} style={{ width: `${(c.meta.width / tw) * 100}%` }} />)}
            </colgroup>
            <thead className="sticky top-0 z-10">
              <tr style={{ background: BLUE_HDR }}>
                {table.getHeaderGroups()[0]?.headers.map((h) => {
                  const align = h.column.columnDef.meta?.align;
                  const sorted = h.column.getIsSorted();
                  return (
                    <th
                      key={h.id}
                      onClick={h.column.getToggleSortingHandler()}
                      className={`px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-700 border-b select-none cursor-pointer transition-colors overflow-hidden ${align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"}`}
                      style={{ borderBottomColor: "#A8D3EC" }}
                    >
                      <div className={`flex items-center gap-1 ${align === "right" ? "justify-end" : align === "center" ? "justify-center" : ""}`}>
                        <span className="truncate">{flexRender(h.column.columnDef.header, h.getContext())}</span>
                        {sorted === "asc"
                          ? <ChevronUp size={11} style={{ color: BLUE }} className="shrink-0" />
                          : sorted === "desc"
                            ? <ChevronDown size={11} style={{ color: BLUE }} className="shrink-0" />
                            : <ArrowUpDown size={10} className="shrink-0 text-gray-400" />
                        }
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row, i) => (
                <tr
                  key={row.id}
                  className="transition-colors duration-75"
                  style={{ background: i % 2 === 0 ? "#ffffff" : BLUE_ROW }}
                  onMouseEnter={(e) => e.currentTarget.style.background = BLUE_FAINT}
                  onMouseLeave={(e) => e.currentTarget.style.background = i % 2 === 0 ? "#ffffff" : BLUE_ROW}
                >
                  {row.getVisibleCells().map((cell) => (
  <React.Fragment key={cell.id}>
    {flexRender(cell.column.columnDef.cell, cell.getContext())}
  </React.Fragment>
))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {!loading && rows.length > 0 && cols.length > 0 && (
        <PaginationBar table={table} total={rows.length} />
      )}
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function MaterialStockPage() {
  const [filters, setFilters] = useState(emptyFilters);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState([]);
  const [ageingSummary, setAgeingSummary] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const [visibleKeys, setVisibleKeys] = useState(DEFAULT_KEYS);

  useEffect(() => { setVisibleKeys(loadSavedColumns()); }, []);
  useEffect(() => {
    if (typeof window !== "undefined")
      window.localStorage.setItem(LS_KEY, JSON.stringify(visibleKeys));
  }, [visibleKeys]);

  const runSearch = useCallback(async (f) => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams();
      Object.entries(f).forEach(([k, v]) => { if (v?.trim()) params.set(k, v.trim()); });
      const qs = params.toString();
      const res = await fetch(`${API_URL}/material-stock${qs ? `?${qs}` : ""}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch material stock");
      const data = await res.json();
      setRows(data.rows || []);
      setSummary(data.summary || []);
      setAgeingSummary(data.ageingSummary || []);
      setSearched(true);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { runSearch(emptyFilters); }, [runSearch]);

  const handleSubmit = (e) => { e.preventDefault(); runSearch(filters); };
  const handleReset = () => { setFilters(emptyFilters); runSearch(emptyFilters); };

  const totalRoll = rows.reduce((s, r) => s + (Number(r.availableRoll) || 0), 0);
  const totalYds = rows.reduce((s, r) => s + (Number(r.availableYds) || 0), 0);

  return (
    <div className="min-h-screen font-sans" style={{ background: PAGE_BG, fontFamily: "Inter, system-ui, sans-serif" }}>

      {/* ── Top bar (matches Style Register) ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm" style={{ background: BLUE }}>
            <Database size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-800 leading-tight">Material Stock</h1>
            <p className="text-[10px] text-gray-400">Warehouse inventory management</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ColumnsMenu visibleKeys={visibleKeys} setVisibleKeys={setVisibleKeys} />
        </div>
      </div>

      <div className="max-w-[1440px] mx-auto px-4 py-5 space-y-4">

        {/* ── KPI tiles ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* <KpiTile icon={Boxes}      label="Total Batches"    value={rows.length.toLocaleString()}       color={BLUE} /> */}
          <KpiTile icon={TrendingUp} label="Available Rolls" value={fmtNum(totalRoll)} color="#22c55e" />
          <KpiTile icon={Database} label="Available Yards" value={fmtNum(Math.round(totalYds))} color="#0d9488" />
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3">
            <span className="font-bold">Error:</span> {error}
          </div>
        )}

        {/* ── Filters ── */}
        <FilterPanel
          filters={filters} setFilters={setFilters}
          onSearch={handleSubmit} onReset={handleReset} loading={loading}
        />

        {/* ── Table 1: Summary ── */}
        <SummaryTable summary={summary} />

        {/* ── Table 1b: Inventory Ageing ── */}
        <AgeingSummary ageing={ageingSummary} />

        {/* ── Table 2: Stock Batches ── */}
        <StockTable
          rows={rows} loading={loading}
          searched={searched} visibleKeys={visibleKeys}
        />

        <p className="text-right text-xs text-gray-400">
          Showing {rows.length.toLocaleString()} stock records
        </p>
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
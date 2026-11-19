// app/(Pages)/(Material-warehouse)/material-warehouse/material-stock/page.js

"use client";
import React from "react";
import {
  ArrowUpDown, Boxes, ChevronDown, ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight, ChevronUp, Clock, Database, Filter,
  RotateCcw, Search, SlidersHorizontal, TrendingUp, X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  flexRender, getCoreRowModel, getPaginationRowModel,
  getSortedRowModel, useReactTable,
} from "@tanstack/react-table";
import { IBM_Plex_Sans } from "next/font/google";

const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

// ─── Theme: Flat Teal & Zinc (Tailwind-only) ───────────────────────────────────
const focus =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700/40";

const inputCls =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 " +
  "placeholder:text-zinc-400 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/25";

const btnPrimary = `inline-flex items-center gap-2 rounded-md bg-teal-800 px-4 py-2 text-sm font-medium text-white hover:bg-teal-900 disabled:opacity-60 ${focus}`;
const btnSecondary = `inline-flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60 ${focus}`;
const btnIcon = `inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 ${focus}`;

const inputSm =
  "w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 " +
  "placeholder:text-zinc-400 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/25";
const btnSm = `inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 ${focus}`;
const btnPrimarySm = `inline-flex items-center gap-1.5 rounded-md bg-teal-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-900 disabled:opacity-60 ${focus}`;

const th = "px-3 py-2.5 font-medium";
const td = "px-3 py-2 align-top border-b border-zinc-200";
const thead = "sticky top-0 z-10 border-b border-zinc-300 bg-zinc-50 text-zinc-500";

// ─── Filter / column config ───────────────────────────────────────────────────
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

// Must match the backend's AGE_BUCKET_ORDER in materialStock.controllers.js.
const AGE_BUCKET_COLORS = {
  "0-30 days": "#115e59",
  "31-60 days": "#0d9488",
  "61-90 days": "#a1a1aa",
  "91-180 days": "#b45309",
  "180+ days": "#b91c1c",
};

// width = relative weight, used to derive each column's minimum pixel width
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
const PX_PER_WIDTH_UNIT = 16; // min column width = width * 16px

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

const pctColor = (v) => (v >= 70 ? "#0f766e" : v >= 35 ? "#71717a" : "#b91c1c");

// ─── Mini donut ────────────────────────────────────────────────────────────────
function MiniDonut({ percent }) {
  const v = Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0));
  const size = 26; const sw = 4.5;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={sw} stroke="#e4e4e7" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={sw}
        strokeDasharray={circ} strokeDashoffset={circ * (1 - v / 100)}
        strokeLinecap="butt" transform={`rotate(-90 ${size / 2} ${size / 2})`}
        stroke={pctColor(v)}
      />
    </svg>
  );
}

// ─── KPI strip ─────────────────────────────────────────────────────────────────
function KpiStrip({ items }) {
  return (
    <div className="grid grid-cols-2 gap-px border border-zinc-300 bg-zinc-200 sm:grid-cols-2 lg:max-w-xl">
      {items.map((k) => (
        <div key={k.label} className="bg-white px-3 py-2">
          <div className="text-xs text-zinc-500">{k.label}</div>
          <div className="text-xl font-semibold tabular-nums text-teal-800">{k.value}</div>
        </div>
      ))}
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
    setVisibleKeys((p) => (p.includes(key) ? p.filter((k) => k !== key) : [...p, key]));

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} className={btnSm}>
        <SlidersHorizontal className="h-3.5 w-3.5" />
        Columns
        <span className="text-xs font-semibold tabular-nums text-teal-800">({visibleKeys.length})</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1.5 w-56 overflow-hidden rounded-md border border-zinc-300 bg-white">
          <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-3 py-2">
            <span className="text-xs font-medium text-zinc-500">Show / hide columns</span>
            <div className="flex gap-3">
              <button type="button" onClick={() => setVisibleKeys(ALL_COLUMNS.map((c) => c.key))}
                className="text-xs font-medium text-teal-800 hover:underline">All</button>
              <button type="button" onClick={() => setVisibleKeys(DEFAULT_KEYS)}
                className="text-xs font-medium text-teal-800 hover:underline">Default</button>
            </div>
          </div>
          <div className="max-h-64 divide-y divide-zinc-200 overflow-y-auto">
            {ALL_COLUMNS.map((c) => (
              <label key={c.key} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50">
                <input type="checkbox" checked={visibleKeys.includes(c.key)} onChange={() => toggle(c.key)}
                  className="accent-teal-800" />
                {c.label}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Filter panel (compact) ────────────────────────────────────────────────────
function FilterPanel({ filters, setFilters, onSearch, onReset, loading }) {
  const active = Object.values(filters).filter((v) => v?.trim()).length;
  const filled = "border-teal-700 bg-teal-50/40";

  return (
    <form onSubmit={onSearch} className="rounded-md border border-zinc-300 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 px-3 py-2">
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-teal-800" />
          <h3 className="text-xs font-semibold text-zinc-900">Search filters</h3>
          {active > 0 && (
            <span className="rounded bg-teal-800 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-white">
              {active} active
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={onReset} disabled={loading || active === 0} className={btnSm}>
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </button>
          <button type="submit" disabled={loading} className={btnPrimarySm}>
            <Search className="h-3.5 w-3.5" />
            {loading ? "Searching…" : "Search"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 items-end gap-2 p-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
        <div>
          <label className="mb-0.5 block text-[10px] text-zinc-500">Date from</label>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
            className={`${inputSm} ${filters.dateFrom ? filled : ""}`}
          />
        </div>
        <div>
          <label className="mb-0.5 block text-[10px] text-zinc-500">Date to</label>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
            className={`${inputSm} ${filters.dateTo ? filled : ""}`}
          />
        </div>
        {FILTER_FIELDS.map((f) => (
          <div key={f.key} className="relative">
            <input
              type="text"
              value={filters[f.key]}
              onChange={(e) => setFilters({ ...filters, [f.key]: e.target.value })}
              placeholder={f.label}
              title={f.label}
              className={`${inputSm} pr-6 ${filters[f.key] ? filled : ""}`}
            />
            {filters[f.key] && (
              <button type="button" aria-label={`Clear ${f.label}`}
                onClick={() => setFilters({ ...filters, [f.key]: "" })}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-sm leading-none text-zinc-400 hover:text-zinc-700">
                ×
              </button>
            )}
          </div>
        ))}
      </div>
    </form>
  );
}

// ─── Side drawer (slides in from the right) ────────────────────────────────────
function SideDrawer({ open, onClose, title, icon: Icon, badge, toolbar, children }) {
  useEffect(() => {
    if (!open) return;
    const fn = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [open, onClose]);

  return (
    <div className={`fixed inset-0 z-40 ${open ? "" : "pointer-events-none"}`}>
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-zinc-900/30 transition-opacity duration-200 motion-reduce:transition-none ${open ? "opacity-100" : "opacity-0"}`}
      />
      <aside
        role="dialog"
        aria-label={title}
        inert={!open}
        className={`absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-zinc-300 bg-white transition-transform duration-200 ease-out motion-reduce:transition-none ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <Icon className="h-4 w-4 text-teal-800" />
            <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
            {badge != null && (
              <span className="rounded bg-teal-800 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-white">{badge}</span>
            )}
          </div>
          <button type="button" onClick={onClose} className={btnIcon} title="Close" aria-label="Close panel">
            <X className="h-4 w-4" />
          </button>
        </div>
        {toolbar && <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-2">{toolbar}</div>}
        <div className="min-h-0 flex-1 overflow-auto">{children}</div>
      </aside>
    </div>
  );
}

// ─── Total available (drawer content) ──────────────────────────────────────────
function SummaryContent({ rows }) {
  if (rows.length === 0)
    return <p className="px-4 py-12 text-center text-sm text-zinc-500">No matches found.</p>;
  return (
    <table className="w-full text-left text-[13px]">
      <thead className={thead}>
        <tr>
          <th className={th}>Item Code / PDM</th>
          <th className={th}>Color</th>
          <th className={`${th} text-right`}>Avail. Roll</th>
          <th className={`${th} text-right`}>Avail. Yds</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-zinc-200 text-zinc-800 tabular-nums">
        {rows.map((s) => (
          <tr key={`${s.itemCodePdm}-${s.color}`} className="hover:bg-zinc-50">
            <td className="break-words px-3 py-2 align-top font-medium text-teal-800">{s.itemCodePdm}</td>
            <td className="break-words px-3 py-2 align-top">{s.color}</td>
            <td className="px-3 py-2 text-right align-top font-semibold text-teal-800">{fmtNum(s.totalAvailableRoll)}</td>
            <td className="px-3 py-2 text-right align-top font-semibold text-teal-800">{fmtNum(s.totalAvailableYds)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Inventory ageing (drawer content) ─────────────────────────────────────────
function AgeingContent({ ageing }) {
  const totalAvailableYds = ageing.reduce((s, a) => s + (Number(a.totalAvailableYds) || 0), 0);
  if (totalAvailableYds === 0)
    return <p className="px-4 py-12 text-center text-sm text-zinc-500">No stock in the current results to age.</p>;
  return (
    <table className="w-full text-left text-[13px]">
      <thead className={thead}>
        <tr>
          <th className={th}>Age Bucket</th>
          <th className={`${th} text-right`}>Avail. Roll</th>
          <th className={`${th} text-right`}>Avail. Yds</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-zinc-200 text-zinc-800 tabular-nums">
        {ageing.map((a) => (
          <tr key={a.ageBucket} className="hover:bg-zinc-50">
            <td className="px-3 py-2 align-top">
              <span className="inline-flex rounded-md px-2 py-0.5 text-xs font-medium text-white"
                style={{ background: AGE_BUCKET_COLORS[a.ageBucket] || "#71717a" }}>
                {a.ageBucket}
              </span>
            </td>
            <td className="px-3 py-2 text-right align-top font-semibold text-teal-800">{fmtNum(a.totalAvailableRoll)}</td>
            <td className="px-3 py-2 text-right align-top font-semibold text-teal-800">{fmtNum(a.totalAvailableYds)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Cell primitives (text wraps fully — no truncation) ────────────────────────
const alignCls = (align) =>
  align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";

function TCell({ children, align = "left", title, className = "", style }) {
  return (
    <td className={`${td} ${alignCls(align)} whitespace-normal break-words ${className}`} title={title} style={style}>
      {children}
    </td>
  );
}

function NumCell({ value }) {
  return <td className={`${td} text-right font-medium text-zinc-800`}>{fmtNum(value)}</td>;
}

function AvailCell({ value }) {
  return <td className={`${td} text-right font-semibold text-teal-800`}>{fmtNum(value)}</td>;
}

function PctCell({ percent, title }) {
  const v = Math.max(0, Math.min(100, Number.isFinite(percent) ? percent : 0));
  return (
    <td className={`${td} text-center`} title={title}>
      <div className="flex items-center justify-center gap-1.5">
        <MiniDonut percent={v} />
        <span className="text-xs font-semibold" style={{ color: pctColor(v) }}>{v}%</span>
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
    <td className={`${td} whitespace-normal break-words`}>
      <div className="flex flex-col gap-0.5">
        {vis.map((s) => (
          <span key={s.id ?? `${s.style}-${s.model}`}>
            <span className="font-medium text-teal-800">{s.style}</span>
            {s.model && <span className="text-zinc-500"> | {s.model}</span>}
          </span>
        ))}
      </div>
      {list.length > 1 && (
        <button type="button" onClick={() => setExp((e) => !e)}
          className="mt-0.5 inline-flex items-center gap-0.5 text-xs font-medium text-teal-800 hover:underline">
          {exp ? <><ChevronUp className="h-3 w-3" />Less</> : <><ChevronDown className="h-3 w-3" />+{hidden} more</>}
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
  const dash = <span className="text-zinc-400">—</span>;
  const locChip = (v) => (
    <span className="inline-flex rounded-md bg-teal-800 px-2 py-0.5 text-xs font-medium text-white break-all">{v}</span>
  );
  const whChip = (v) => (
    <span className="inline-flex rounded-md border border-zinc-300 bg-zinc-50 px-2 py-0.5 text-xs font-medium text-zinc-700 break-all">{v}</span>
  );
  const ageBucketChip = (v) => (
    <span className="inline-flex rounded-md px-2 py-0.5 text-xs font-medium text-white"
      style={{ background: AGE_BUCKET_COLORS[v] || "#71717a" }}>{v}</span>
  );
  switch (key) {
    case "date": return <TCell key="date" title={r.date?.slice(0, 10)}>{r.date?.slice(0, 10)}</TCell>;
    case "invoiceNo": return <TCell key="invoiceNo">{r.invoiceNo}</TCell>;
    case "buyer": return <TCell key="buyer" className="font-medium text-zinc-900">{r.buyer}</TCell>;
    case "season": return <TCell key="season" align="center"><span className="inline-flex rounded-md border border-zinc-300 bg-zinc-50 px-2 py-0.5 text-xs font-medium text-zinc-700">{r.season}</span></TCell>;
    case "styleModel": return <StyleModelCell key="styleModel" styles={r.styles} />;
    case "warehouse": return <TCell key="warehouse" align="center">{whChip(r.warehouse)}</TCell>;
    case "item": return <TCell key="item">{r.item}</TCell>;
    case "itemCodePdm": return <TCell key="itemCodePdm" className="font-medium text-teal-800">{r.itemCodePdm}</TCell>;
    case "color": return <TCell key="color">{r.color}</TCell>;
    case "fabricDetails": return <TCell key="fabricDetails">{r.fabricDetails || dash}</TCell>;
    case "supplier": return <TCell key="supplier">{r.supplier || dash}</TCell>;
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
    case "ageBucket": return <TCell key="ageBucket" align="center">{r.ageBucket ? ageBucketChip(r.ageBucket) : dash}</TCell>;
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
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-300 bg-zinc-50 px-4 py-2.5 text-sm">
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <span>Rows per page</span>
        <select value={size} onChange={(e) => table.setPageSize(Number(e.target.value))}
          className={`rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700 ${focus}`}>
          {PS_OPTS.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>

      <span className="text-xs tabular-nums text-zinc-500">
        {total === 0 ? "0 rows" : `${from}–${to} of ${total.toLocaleString()}`}
      </span>

      <div className="flex items-center gap-1">
        <button type="button" className={btnIcon} onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()} title="First"><ChevronsLeft className="h-4 w-4" /></button>
        <button type="button" className={btnIcon} onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} title="Previous"><ChevronLeft className="h-4 w-4" /></button>
        <span className="whitespace-nowrap rounded-md bg-teal-800 px-3 py-1.5 text-xs font-medium tabular-nums text-white">
          {idx + 1} / {count}
        </span>
        <button type="button" className={btnIcon} onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} title="Next"><ChevronRight className="h-4 w-4" /></button>
        <button type="button" className={btnIcon} onClick={() => table.setPageIndex(count - 1)} disabled={!table.getCanNextPage()} title="Last"><ChevronsRight className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

// ─── Horizontal slider (synced with the table's scroll position) ───────────────
function ScrollSlider({ scrollRef, maxScroll, scrollLeft }) {
  if (maxScroll <= 0) return null;

  const step = 200;
  const go = (delta) => {
    scrollRef.current?.scrollBy({ left: delta, behavior: "smooth" });
  };

  return (
    <div className="flex items-center gap-3 border-b border-zinc-200 bg-zinc-50 px-4 py-2">
      <button type="button" className={btnIcon} onClick={() => go(-step)} disabled={scrollLeft <= 0} title="Scroll left">
        <ChevronLeft className="h-4 w-4" />
      </button>
      <input
        type="range"
        min={0}
        max={Math.round(maxScroll)}
        step={1}
        value={Math.round(scrollLeft)}
        onChange={(e) => {
          if (scrollRef.current) scrollRef.current.scrollLeft = Number(e.target.value);
        }}
        aria-label="Slide table left or right"
        className="h-1.5 flex-1 cursor-pointer accent-teal-800"
      />
      <button type="button" className={btnIcon} onClick={() => go(step)} disabled={scrollLeft >= maxScroll - 1} title="Scroll right">
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

// ─── Stock batches table (Table 2) ─────────────────────────────────────────────
function StockTable({ rows, loading, searched, visibleKeys }) {
  const [sorting, setSorting] = useState([]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 25 });

  const scrollRef = useRef(null);
  const [maxScroll, setMaxScroll] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

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
    setPagination((p) => (p.pageIndex === 0 ? p : { ...p, pageIndex: 0 }));
  }, [rows]);

  // Each column gets a minimum width so text wraps instead of squeezing;
  // the table is as wide as the sum of those minimums (or the container).
  const tableMinWidth = cols.reduce((s, c) => s + (c.meta.width || 6) * PX_PER_WIDTH_UNIT, 0);

  // Keep slider range in sync with the scroll container's real overflow.
  const measure = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setMaxScroll(Math.max(0, el.scrollWidth - el.clientWidth));
    setScrollLeft(el.scrollLeft);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, [measure, loading, rows, cols.length, pagination.pageSize, pagination.pageIndex]);

  const showTable = !loading && rows.length > 0 && cols.length > 0;

  return (
    <section className="overflow-hidden rounded-md border border-zinc-300 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <Boxes className="h-4 w-4 text-teal-800" />
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">Stock records</h3>
            <p className="mt-0.5 text-xs tabular-nums text-zinc-500">{rows.length.toLocaleString()} records</p>
          </div>
        </div>
        <span className="rounded-md border border-zinc-300 bg-zinc-50 px-2.5 py-1 text-xs tabular-nums text-zinc-600">
          {visibleKeys.length} columns
        </span>
      </div>

      {/* Slider above the table */}
      {showTable && (
        <ScrollSlider scrollRef={scrollRef} maxScroll={maxScroll} scrollLeft={scrollLeft} />
      )}

      {/* Scroll area */}
      <div
        ref={scrollRef}
        onScroll={(e) => setScrollLeft(e.currentTarget.scrollLeft)}
        className="max-h-[58vh] overflow-auto"
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 px-4 py-12 text-sm text-zinc-500">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-200 border-t-teal-800 motion-reduce:animate-none" />
            Loading stock data…
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-4 py-12 text-center text-sm text-zinc-500">
            <Database className="h-6 w-6 text-zinc-400" />
            {searched ? "No stock batches match these filters." : "Use the filters above to search for stock."}
          </div>
        ) : cols.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-zinc-500">No columns selected. Use the Columns menu to pick some.</div>
        ) : (
          <table
            className="w-full table-auto border-collapse text-left text-[13px] tabular-nums text-zinc-800"
            style={{ minWidth: tableMinWidth }}
          >
            <thead className={thead}>
              <tr>
                {table.getHeaderGroups()[0]?.headers.map((h) => {
                  const meta = h.column.columnDef.meta || {};
                  const sorted = h.column.getIsSorted();
                  return (
                    <th
                      key={h.id}
                      onClick={h.column.getToggleSortingHandler()}
                      style={{ minWidth: (meta.width || 6) * PX_PER_WIDTH_UNIT }}
                      className={`${th} cursor-pointer select-none whitespace-normal break-words hover:text-zinc-900 ${alignCls(meta.align)}`}
                    >
                      <div className={`flex items-center gap-1 ${meta.align === "right" ? "justify-end" : meta.align === "center" ? "justify-center" : ""}`}>
                        <span>{flexRender(h.column.columnDef.header, h.getContext())}</span>
                        {sorted === "asc"
                          ? <ChevronUp className="h-3 w-3 shrink-0 text-teal-800" />
                          : sorted === "desc"
                            ? <ChevronDown className="h-3 w-3 shrink-0 text-teal-800" />
                            : <ArrowUpDown className="h-3 w-3 shrink-0 text-zinc-400" />}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row, i) => (
                <tr key={row.id} className={`hover:bg-zinc-100 ${i % 2 === 0 ? "bg-white" : "bg-zinc-50"}`}>
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

      {showTable && <PaginationBar table={table} total={rows.length} />}
    </section>
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
  const [panel, setPanel] = useState(null); // null | "summary" | "ageing"
  const [summaryQuery, setSummaryQuery] = useState("");
  const closePanel = useCallback(() => setPanel(null), []);

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

  const sq = summaryQuery.trim().toLowerCase();
  const summaryRows = sq
    ? summary.filter((x) => x.itemCodePdm?.toLowerCase().includes(sq) || x.color?.toLowerCase().includes(sq))
    : summary;

  return (
    <div className={`min-h-screen bg-zinc-100 text-zinc-900 ${plex.className}`}>
      <main className="mx-auto max-w-[1440px] space-y-4 p-4 pt-16 md:p-5 md:pt-5">

        {/* ── Title + columns ── */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold text-zinc-900">Material Stock</h2>
            <p className="mt-0.5 text-sm tabular-nums text-zinc-500">Warehouse inventory management</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setPanel("summary")} disabled={!summary.length} className={btnSm}>
              <TrendingUp className="h-3.5 w-3.5 text-teal-800" />
              Total available
              <span className="rounded bg-teal-800 px-1.5 text-[11px] tabular-nums text-white">{summary.length}</span>
            </button>
            <button type="button" onClick={() => setPanel("ageing")} disabled={!ageingSummary.length} className={btnSm}>
              <Clock className="h-3.5 w-3.5 text-teal-800" />
              Inventory ageing
            </button>
            <ColumnsMenu visibleKeys={visibleKeys} setVisibleKeys={setVisibleKeys} />
          </div>
        </div>

        {/* ── KPI strip ── */}
        <KpiStrip
          items={[
            { label: "Available rolls", value: fmtNum(totalRoll) },
            { label: "Available yards", value: fmtNum(Math.round(totalYds)) },
          ]}
        />

        {/* ── Error ── */}
        {error && (
          <div className="rounded-md border border-l-4 border-zinc-300 border-l-red-700 bg-white px-4 py-2.5 text-sm text-red-700">
            <span className="font-semibold">Error:</span> {error}
          </div>
        )}

        {/* ── Filters ── */}
        <FilterPanel
          filters={filters} setFilters={setFilters}
          onSearch={handleSubmit} onReset={handleReset} loading={loading}
        />

        {/* ── Table 2: Stock Batches ── */}
        <StockTable
          rows={rows} loading={loading}
          searched={searched} visibleKeys={visibleKeys}
        />

        <p className="text-right text-xs tabular-nums text-zinc-500">
          Showing {rows.length.toLocaleString()} stock records
        </p>
      </main>

      {/* ── Side drawers ── */}
      <SideDrawer
        open={panel === "summary"} onClose={closePanel}
        title="Total available" icon={TrendingUp} badge={summary.length}
        toolbar={
          <input type="text" value={summaryQuery} onChange={(e) => setSummaryQuery(e.target.value)}
            placeholder="Search item or color…" className={inputSm} />
        }
      >
        <SummaryContent rows={summaryRows} />
      </SideDrawer>

      <SideDrawer
        open={panel === "ageing"} onClose={closePanel}
        title="Inventory ageing" icon={Clock}
      >
        <AgeingContent ageing={ageingSummary} />
      </SideDrawer>
    </div>
  );
}
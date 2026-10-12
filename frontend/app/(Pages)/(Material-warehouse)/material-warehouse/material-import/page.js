// frontend/app/(Pages)/(Material-warehouse)/material-warehouse/material-import/page.js

"use client";

import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Info,
  Loader2,
  RotateCcw,
  UploadCloud,
  X,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import DataResetCard from "./DataResetCard.js";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const PAGE_SIZE = 50;

/* ============================================================
   Style tokens -- same warm HKD theme as the Material Receive page,
   since this import feeds directly into that same table.
   ============================================================ */

const card = "bg-[#f7f5f0] dark:bg-[#221d16] border border-[#2c2417]/10 dark:border-[#e8ddd0]/10 rounded-xl shadow-sm";
const btnPrimary =
  "inline-flex items-center gap-1.5 rounded-full bg-[#2c2417] dark:bg-[#e8ddd0] text-[#f0ede6] dark:text-[#1b1712] text-sm font-medium px-5 py-2.5 hover:bg-[#b87a4a] dark:hover:bg-[#d4955e] transition-colors disabled:opacity-50";
const btnSecondary =
  "inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-[#2c2417]/25 dark:border-[#e8ddd0]/25 bg-white dark:bg-[#2a241b] text-[#7a6250] dark:text-[#a8917d] text-sm font-medium px-4 py-2 hover:border-[#b87a4a] hover:text-[#b87a4a] dark:hover:border-[#d4955e] dark:hover:text-[#d4955e] transition-colors disabled:opacity-40 disabled:pointer-events-none";
const btnGhost =
  "inline-flex items-center gap-1 rounded-full text-xs font-medium px-2.5 py-1 text-[#7a6250] dark:text-[#a8917d] hover:bg-[#2c2417]/8 dark:hover:bg-[#e8ddd0]/8 transition-colors disabled:opacity-30 disabled:pointer-events-none";
const chip = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#b87a4a]/12 text-[#8a4a24] dark:bg-[#d4955e]/15 dark:text-[#d4955e]";
const cellInput =
  "w-full min-w-[80px] bg-transparent border-0 border-b border-transparent hover:border-[#2c2417]/20 focus:border-[#b87a4a] focus:outline-none text-[11px] px-1 py-0.5 text-[#1a1208] dark:text-[#f0e8dc] dark:hover:border-[#e8ddd0]/20";

// Exact excel header set this page is built for (order matches the
// user's confirmed template).
const REQUIRED_COLUMNS = [
  "BUYER", "DATE", "INVOICE", "SEASON", "PO NO", "STY NO", "MODEL",
  "ITEM", "ITEM CODE", "COLOR NAME", "RCVD QTY", "RCVD ROLL",
  "ISSUE YDS", "ISSUE ROLL", "INHAND QTY", "INHAND ROLL", "RACK NO",
  "REMARK", "SUPLIER", "ORIGIN", "DESCRIPTION",
];

// Fields exposed as inline-editable cells, in table order. Nothing here
// is "required" -- every field is optional, everything imports exactly
// as the sheet has it (blank numbers become 0, blank text falls back to
// a placeholder only where the database needs a value).
const EDITABLE_FIELDS = [
  { key: "date", label: "Date", width: "w-24" },
  { key: "invoiceNo", label: "Invoice", width: "w-28" },
  { key: "buyer", label: "Buyer", width: "w-32" },
  { key: "supplier", label: "Supplier", width: "w-28" },
  { key: "fromType", label: "From (Origin)", width: "w-24" },
  { key: "season", label: "Season", width: "w-20" },
  { key: "po", label: "PO", width: "w-20" },
  { key: "style", label: "Style", width: "w-20" },
  { key: "model", label: "Model", width: "w-20" },
  { key: "item", label: "Item", width: "w-24" },
  { key: "itemCodePdm", label: "Item Code/PDM", width: "w-28" },
  { key: "color", label: "Color", width: "w-24" },
  { key: "fabricDetails", label: "Fabric Details", width: "w-32" },
  { key: "rollQty", label: "Recv. Roll", width: "w-16", numeric: true },
  { key: "yds", label: "Recv. Yds", width: "w-16", numeric: true },
  { key: "issueRoll", label: "Issue Roll", width: "w-16", numeric: true },
  { key: "issueYds", label: "Issue Yds", width: "w-16", numeric: true },
  { key: "availableRoll", label: "Avail. Roll", width: "w-16", numeric: true },
  { key: "availableYds", label: "Avail. Yds", width: "w-16", numeric: true },
  { key: "location", label: "Rack", width: "w-20" },
  { key: "remark", label: "Remark", width: "w-40" },
];

function StepDot({ active, done, label, index }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-colors ${
          done
            ? "bg-[#5ca068] text-white"
            : active
            ? "bg-[#2c2417] dark:bg-[#e8ddd0] text-[#f0ede6] dark:text-[#1b1712]"
            : "bg-[#2c2417]/10 dark:bg-[#e8ddd0]/10 text-[#a08060]"
        }`}
      >
        {done ? <CheckCircle2 size={14} /> : index}
      </div>
      <span className={`text-sm font-medium ${active || done ? "text-[#1a1208] dark:text-[#f0e8dc]" : "text-[#a08060]"}`}>
        {label}
      </span>
    </div>
  );
}

/* ============================================================
   Drop zone
   ============================================================ */

function DropZone({ file, onFile, onClear, disabled }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = useCallback(
    (files) => {
      const f = files?.[0];
      if (!f) return;
      if (!/\.(xlsx|xlsm|xls)$/i.test(f.name)) return;
      onFile(f);
    },
    [onFile]
  );

  if (file) {
    return (
      <div className={`${card} flex items-center gap-3 px-4 py-3`}>
        <FileSpreadsheet size={22} className="text-[#b87a4a] shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-[#1a1208] dark:text-[#f0e8dc] truncate">{file.name}</div>
          <div className="text-[11px] text-[#a08060]">{(file.size / 1024).toFixed(0)} KB</div>
        </div>
        {!disabled && (
          <button type="button" onClick={onClear} className="text-[#a08060] hover:text-[#b87a4a] transition-colors shrink-0" title="Remove file">
            <X size={16} />
          </button>
        )}
      </div>
    );
  }

  return (
    <label
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
      className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center cursor-pointer transition-colors ${
        dragging
          ? "border-[#b87a4a] bg-[#b87a4a]/5"
          : "border-[#2c2417]/20 dark:border-[#e8ddd0]/20 hover:border-[#b87a4a]/50"
      }`}
    >
      <UploadCloud size={28} className="text-[#b87a4a]" />
      <div className="text-sm font-medium text-[#1a1208] dark:text-[#f0e8dc]">
        Click to choose, or drag &amp; drop your Excel file
      </div>
      <div className="text-xs text-[#a08060]">.xlsx, .xlsm or .xls — the "Material Stock" template</div>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xlsm,.xls"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </label>
  );
}

/* ============================================================
   Editable preview table -- purely optional tweaking, nothing here
   blocks the import. Rows where the backend applied a fallback (missing
   Buyer/Item Code/Color/Rack/From/Fabric Details/Date in the sheet) get
   a soft highlight + a small info note, just so you know what happened
   -- not an error.
   ============================================================ */

function EditableTable({ pageRecords, onEdit }) {
  if (!pageRecords.length) {
    return (
      <div className="py-10 text-center text-sm text-[#a08060]">
        No rows to show for this filter.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-[#2c2417]/10 dark:border-[#e8ddd0]/10">
      <table className="min-w-full text-[11px]">
        <thead className="bg-[#e6e0d4]/70 dark:bg-[#221d16] text-[#7a6250] dark:text-[#a8917d]">
          <tr>
            <th className="px-2 py-2 text-left font-semibold whitespace-nowrap">Row</th>
            {EDITABLE_FIELDS.map((f) => (
              <th key={f.key} className="px-2 py-2 text-left font-semibold whitespace-nowrap">
                {f.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pageRecords.map((r) => {
            const hadDefaults = Boolean(r.defaultsApplied?.length);
            return (
              <tr
                key={r._key}
                className={`border-t border-[#2c2417]/8 dark:border-[#e8ddd0]/8 ${
                  hadDefaults ? "bg-[#b8933a]/6 dark:bg-[#e0c068]/8" : ""
                }`}
              >
                <td className="px-2 py-1 whitespace-nowrap text-[#a08060]">
                  {r.sheet ? `${r.sheet} · ${r.row}` : r.row}
                  {hadDefaults && (
                    <span title={`Defaulted: ${r.defaultsApplied.join(", ")}`}>
                      <Info size={11} className="inline-block ml-1 -mt-0.5 text-[#8a6a1a] dark:text-[#e0c068]" />
                    </span>
                  )}
                </td>
                {EDITABLE_FIELDS.map((f) => (
                  <td key={f.key} className={`px-1 py-0.5 ${f.width}`}>
                    <input
                      type={f.numeric ? "number" : "text"}
                      value={r[f.key] ?? ""}
                      onChange={(e) =>
                        onEdit(r._key, f.key, f.numeric ? e.target.value.replace(/[^0-9.]/g, "") : e.target.value)
                      }
                      className={cellInput}
                      placeholder="-"
                    />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ============================================================
   Main page
   ============================================================ */

export default function MaterialImportPage() {
  const [file, setFile] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [committing, setCommitting] = useState(false);

  const [meta, setMeta] = useState(null);        // { totalRows, withDefaults, withoutRack, warehouse }
  const [records, setRecords] = useState([]);     // current editable working set
  const [totalCreated, setTotalCreated] = useState(0);
  const [error, setError] = useState("");
  const [onlyDefaulted, setOnlyDefaulted] = useState(false);
  const [page, setPage] = useState(0);
  const [finished, setFinished] = useState(false);

  const reset = () => {
    setFile(null);
    setMeta(null);
    setRecords([]);
    setTotalCreated(0);
    setError("");
    setOnlyDefaulted(false);
    setPage(0);
    setFinished(false);
  };

  const handleFile = (f) => {
    setFile(f);
    setMeta(null);
    setRecords([]);
    setTotalCreated(0);
    setError("");
    setFinished(false);
  };

  const runPreview = async () => {
    if (!file) return;
    setPreviewing(true); setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_URL}/material-import`, {
        method: "POST", credentials: "include", body: formData,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || "Failed to read this file");
      setMeta({
        totalRows: body.totalRows,
        withDefaults: body.withDefaults,
        withoutRack: body.withoutRack,
        warehouse: body.warehouse,
      });
      setRecords(body.records || []);
      setPage(0);
    } catch (err) {
      setError(err.message);
    } finally {
      setPreviewing(false);
    }
  };

  const editField = (key, field, value) => {
    setRecords((prev) => prev.map((r) => (r._key === key ? { ...r, [field]: value } : r)));
  };

  // Imports EVERY row currently in `records` -- nothing is filtered out
  // or held back. Runs in one shot.
  const runCommit = async () => {
    if (!records.length) return;
    setCommitting(true); setError("");
    try {
      const res = await fetch(`${API_URL}/material-import/commit`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || "Failed to import");

      setTotalCreated((c) => c + (body.created || 0));
      setRecords([]);
      setFinished(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setCommitting(false);
    }
  };

  const filteredRecords = useMemo(
    () => (onlyDefaulted ? records.filter((r) => r.defaultsApplied?.length) : records),
    [records, onlyDefaulted]
  );
  const defaultedCount = useMemo(() => records.filter((r) => r.defaultsApplied?.length).length, [records]);
  const pageCount = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
  const pageRecords = filteredRecords.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const step = finished ? 3 : meta ? 2 : 1;

  return (
    <div className="min-h-screen bg-[#f0ede6] dark:bg-[#1b1712]">
      <div className="max-w-[1100px] mx-auto px-4 py-6 space-y-5">
        <div className="flex items-center gap-2">
          <UploadCloud size={22} className="text-[#b87a4a]" />
          <div>
            <h1 className="font-serif text-2xl text-[#1a1208] dark:text-[#f0e8dc]">
              Material Stock <em className="italic text-[#b87a4a] dark:text-[#d4955e]">Import</em>
            </h1>
            <p className="text-xs text-[#7a6250] dark:text-[#a8917d]">
              Upload the legacy Material Stock Excel template — every row is imported straight into stock exactly as the sheet has it: blank numbers become 0, nothing is validated or blocked.
            </p>
          </div>
        </div>

        {/* Steps */}
        <div className="flex items-center gap-4 flex-wrap">
          <StepDot index={1} active={step === 1} done={step > 1} label="Upload file" />
          <ArrowRight size={14} className="text-[#a08060]" />
          <StepDot index={2} active={step === 2} done={step > 2} label="Review (optional)" />
          <ArrowRight size={14} className="text-[#a08060]" />
          <StepDot index={3} active={step === 3} done={false} label="Imported" />
          
        </div>
<DataResetCard />
        {error && (
          <div className="rounded-lg bg-[#a04a3a]/10 border border-[#a04a3a]/25 text-[#7a3325] dark:text-[#e08a78] text-xs px-3 py-2">
            <b>Error:</b> {error}
          </div>
        )}

        {/* Expected columns hint */}
        {!meta && (
          <div className={`${card} p-4 space-y-2`}>
            <h2 className="font-serif text-sm text-[#1a1208] dark:text-[#f0e8dc]">Expected columns</h2>
            <p className="text-xs text-[#7a6250] dark:text-[#a8917d]">
              This is the exact header row expected (order doesn't matter). Every row imports regardless of what's missing — blank text gets a placeholder only where the database requires one, blank numbers always become 0.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {REQUIRED_COLUMNS.map((c) => (
                <span key={c} className={chip}>{c}</span>
              ))}
            </div>
          </div>
        )}

        {/* Upload */}
        {!meta && (
          <div className={`${card} p-4 space-y-3`}>
            <DropZone file={file} onFile={handleFile} onClear={reset} disabled={previewing} />
            {file && (
              <button type="button" onClick={runPreview} disabled={previewing} className={btnPrimary}>
                {previewing ? <Loader2 size={14} className="animate-spin" /> : null}
                {previewing ? "Reading file..." : "Preview Import"}
              </button>
            )}
          </div>
        )}

        {/* Review (optional) */}
        {meta && !finished && (
          <div className={`${card} p-4 space-y-4`}>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="font-serif text-sm text-[#1a1208] dark:text-[#f0e8dc]">Review (optional)</h2>
              <div className="flex flex-wrap gap-1.5">
                <span className={chip}>{meta.totalRows} rows found</span>
                {meta.withoutRack > 0 && <span className={chip}>{meta.withoutRack} defaulted to Rack "UNASSIGNED"</span>}
                {defaultedCount > 0 && <span className={chip}>{defaultedCount} row(s) had a fallback applied</span>}
                <span className={chip}>Warehouse: {meta.warehouse}</span>
              </div>
            </div>

            <div className="rounded-lg bg-[#5ca068]/10 border border-[#5ca068]/25 text-[#3d7a4a] dark:text-[#8fca9c] text-xs px-3 py-2 flex items-center gap-1.5">
              <CheckCircle2 size={13} />
              Every row here will be imported exactly as-is — blank numbers are 0, nothing is required or validated. Edit anything below only if you want to.
            </div>

            <div className="flex items-center justify-between flex-wrap gap-2">
              <button
                type="button"
                onClick={() => { setOnlyDefaulted((v) => !v); setPage(0); }}
                className={`${btnGhost} ${onlyDefaulted ? "bg-[#2c2417]/8 dark:bg-[#e8ddd0]/8" : ""}`}
                disabled={defaultedCount === 0}
              >
                <Info size={12} /> {onlyDefaulted ? "Showing defaulted rows" : "Show only rows with a fallback applied"}
              </button>

              <div className="flex items-center gap-1 text-xs text-[#7a6250] dark:text-[#a8917d]">
                <button type="button" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className={btnGhost}>
                  <ChevronLeft size={14} />
                </button>
                Page {page + 1} of {pageCount}
                <button type="button" onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} disabled={page >= pageCount - 1} className={btnGhost}>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>

            <EditableTable pageRecords={pageRecords} onEdit={editField} />

            <div className="flex gap-2 pt-1 border-t border-[#2c2417]/10 dark:border-[#e8ddd0]/10">
              <button
                type="button"
                onClick={runCommit}
                disabled={committing || records.length === 0}
                className={btnPrimary}
              >
                {committing ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                {committing ? "Importing..." : `Import All ${records.length} Row(s)`}
              </button>
              <button type="button" onClick={reset} disabled={committing} className={btnSecondary}>
                <RotateCcw size={14} /> Start Over
              </button>
            </div>
          </div>
        )}

        {/* Result */}
        {finished && (
          <div className={`${card} p-5 space-y-3`}>
            <div className="flex items-center gap-2 text-[#3d7a4a] dark:text-[#8fca9c]">
              <CheckCircle2 size={20} />
              <h2 className="font-serif text-base">Import complete</h2>
            </div>
            <p className="text-sm text-[#2c2417] dark:text-[#e8ddd0]">
              <b>{totalCreated}</b> Material Receive record(s) created out of {meta.totalRows} rows in the file, all already in stock.
            </p>
            <div className="flex gap-2 pt-1 border-t border-[#2c2417]/10 dark:border-[#e8ddd0]/10">
              <a href="/material-warehouse/material-stock" className={btnPrimary}>
                View Material Stock <ArrowRight size={14} />
              </a>
              <button type="button" onClick={reset} className={btnSecondary}>
                <UploadCloud size={14} /> Import Another File
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
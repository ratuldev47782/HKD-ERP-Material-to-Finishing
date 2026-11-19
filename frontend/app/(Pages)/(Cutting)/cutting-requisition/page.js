// frontend/app/(Pages)/(Cutting)/cutting-requisition/page.js
//
// Cutting side: submit a Requisition to Material Warehouse asking for
// specific Item Code/PDM + Color + Pcs/Wastage%/Consumption to be issued
// from stock, and track the status (Pending / Partially Issued /
// Fulfilled) of everything already sent. Fulfillment itself happens on
// the Material Warehouse's "Cutting Issue" page -- this page is read-only
// once a requisition has anything issued against it.
//
// Cutting never enters a PO or a Roll count here. Cutting only knows
// Pcs (how many pieces are being cut), the Consumption (yds of fabric per
// piece) and a Wastage % -- the actual Requested Yds is calculated
// automatically from those three numbers:
//     Requested Yds = Pcs x Consumption x (1 + Wastage % / 100)
// Roll is entirely a Material Warehouse decision made when they issue
// stock (they know how many yds sit on a given roll, Cutting doesn't).

"use client";

import { useCallback, useEffect, useState, Fragment } from "react";
import { Scissors, Plus, Pencil, Trash2, PackageSearch, ChevronDown, ChevronUp, X, MapPin } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

/* ============================================================
   Shared style tokens (same warm HKD theme as Material Receive/Stock)
   ============================================================ */

const card = "bg-[#f7f5f0] dark:bg-[#221d16] border border-[#2c2417]/10 dark:border-[#e8ddd0]/10 rounded-xl shadow-sm";
const inputCls =
  "w-full rounded-md border-[1.5px] border-[#2c2417]/25 dark:border-[#e8ddd0]/25 bg-white dark:bg-[#2a241b] px-2.5 py-1.5 text-xs text-[#2c2417] dark:text-[#e8ddd0] placeholder:text-[#a08060] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#b87a4a]/30 focus:border-[#b87a4a] dark:focus:border-[#d4955e] transition-colors";
const btnPrimary =
  "inline-flex items-center gap-1.5 rounded-full bg-[#2c2417] dark:bg-[#e8ddd0] text-[#f0ede6] dark:text-[#1b1712] text-xs font-medium px-4 py-2 hover:bg-[#b87a4a] dark:hover:bg-[#d4955e] transition-colors disabled:opacity-50";
const btnSecondary =
  "inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-[#2c2417]/25 dark:border-[#e8ddd0]/25 bg-white dark:bg-[#2a241b] text-[#7a6250] dark:text-[#a8917d] text-xs font-medium px-3 py-1.5 hover:border-[#b87a4a] hover:text-[#b87a4a] dark:hover:border-[#d4955e] dark:hover:text-[#d4955e] transition-colors disabled:opacity-40 disabled:pointer-events-none";
const label = "block mb-1 text-[11px] font-medium tracking-wide text-[#7a6250] dark:text-[#a8917d]";
const chip = "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#b87a4a]/12 text-[#8a4a24] dark:bg-[#d4955e]/15 dark:text-[#d4955e]";
const chipPending = "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#b8933a]/15 text-[#8a6a1a] dark:bg-[#e0c068]/15 dark:text-[#e0c068]";
const chipPartial = "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#3d6a8a]/15 text-[#2c4a63] dark:bg-[#6fa8d0]/15 dark:text-[#6fa8d0]";
const chipFulfilled = "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#5ca068]/15 text-[#3d7a4a] dark:bg-[#8fca9c]/15 dark:text-[#8fca9c]";

const scrollThin =
  "[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent " +
  "[&::-webkit-scrollbar-thumb]:bg-[#b87a4a]/30 [&::-webkit-scrollbar-thumb]:rounded-full " +
  "[&::-webkit-scrollbar-thumb:hover]:bg-[#b87a4a]/50 " +
  "[scrollbar-width:thin] [scrollbar-color:#b87a4a4d_transparent]";

const FLOOR_OPTIONS = ["A-2", "B-2", "A-3", "B-3", "A-4", "B-4", "A-5", "B-5", "A-6", "B-6"];

const BUYERS = [
  "Decathlon - Knit", "Decathlon - Woven", "Walmart", "Columbia",
  "ZXY", "CTC", "DIESEL", "Sports Group Denmark", "Identity", "Fifth Avenur",
];

const up = (v) => (v || "").toUpperCase();

// crypto.randomUUID() is only available in secure contexts (HTTPS or localhost).
// On a plain-HTTP origin (e.g. http://192.169.11.38:3000) it is undefined, and
// calling it during the initial render crashed the whole page. Use it when
// available and fall back to a locally-generated unique id otherwise.
const uid = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const emptyForm = { date: "", buyer: "", floor: "A-2", season: "", style: "", model: "" };
const newItem = () => ({ key: uid(), itemCodePdm: "", color: "", pcs: "", percentage: "", consumption: "" });

// Requested Yds = Pcs x Consumption x (1 + Wastage% / 100). Purely a
// display-side preview -- the backend always recomputes this itself from
// the same three numbers before saving, so it can never be spoofed.
function calcYds(item) {
  const pcs = Number(item.pcs);
  const consumption = Number(item.consumption);
  const percentage = item.percentage === "" ? 0 : Number(item.percentage);
  if (!(pcs > 0) || !(consumption > 0) || Number.isNaN(percentage)) return 0;
  return Math.round(pcs * consumption * (1 + percentage / 100) * 100) / 100;
}

const emptyRecordFilters = { buyer: "", style: "", model: "", itemCodePdm: "", color: "", floor: "", status: "" };
const RECORD_FILTER_FIELDS = [
  { key: "buyer", label: "Buyer", type: "select" },
  { key: "style", label: "Style" },
  { key: "model", label: "Model" },
  { key: "itemCodePdm", label: "Item Code/PDM" },
  { key: "color", label: "Color" },
  { key: "floor", label: "Floor", type: "floorSelect" },
];

function Field({ text, required, children }) {
  return (
    <label className="block text-xs">
      <span className={label}>{text} {required && <span className="text-[#b87a4a]">*</span>}</span>
      {children}
    </label>
  );
}

function statusChip(status) {
  if (status === "fulfilled") return <span className={chipFulfilled}>Fulfilled</span>;
  if (status === "partial") return <span className={chipPartial}>Partially Issued</span>;
  return <span className={chipPending}>Pending</span>;
}

/* ============================================================
   ItemRow -- Item Code/PDM, Color, Pcs, Wastage % and Consumption,
   with the resulting Requested Yds calculated live and shown read-only.
   Also keeps a live "already in stock" check (rack-wise) so Cutting can
   see what's actually available before sending the requisition.
   ============================================================ */

function ItemRow({ item, canRemove, onRemove, onChange }) {
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const requestedYds = calcYds(item);

  const checkStock = async () => {
    const code = (item.itemCodePdm || "").trim();
    const col = (item.color || "").trim();
    if (!code || !col) return;
    setLoadingPreview(true);
    try {
      const params = new URLSearchParams({ itemCodePdm: code, color: col });
      const res = await fetch(`${API_URL}/material-stock?${params.toString()}`, { credentials: "include" });
      const data = await res.json();
      setPreview(data.summary?.[0] || { totalAvailableRoll: 0, totalAvailableYds: 0 });
    } catch {
      setPreview({ totalAvailableRoll: 0, totalAvailableYds: 0 });
    } finally {
      setLoadingPreview(false);
    }
  };

  return (
    <div className="bg-white dark:bg-[#2a241b] border border-[#2c2417]/8 dark:border-[#e8ddd0]/8 rounded-md p-1.5 space-y-1.5">
      <div className="flex items-center gap-1.5">
        <input type="text" placeholder="Item Code / PDM" value={item.itemCodePdm}
          onChange={(e) => onChange(item.key, "itemCodePdm", up(e.target.value))} className={`${inputCls} flex-1`} />
        <input type="text" placeholder="Color" value={item.color}
          onChange={(e) => onChange(item.key, "color", up(e.target.value))} className={`${inputCls} flex-1`} />
        {canRemove && (
          <button type="button" onClick={() => onRemove(item.key)} className="text-[10px] font-medium text-[#b87a4a] hover:underline shrink-0">×</button>
        )}
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        <label className="block">
          <span className="block mb-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#a08060]">Pcs</span>
          <input type="number" placeholder="Pcs" value={item.pcs}
            onChange={(e) => onChange(item.key, "pcs", e.target.value)} className={inputCls} />
        </label>
        <label className="block">
          <span className="block mb-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#a08060]">Wastage %</span>
          <input type="number" placeholder="Wastage %" value={item.percentage}
            onChange={(e) => onChange(item.key, "percentage", e.target.value)} className={inputCls} />
        </label>
        <label className="block">
          <span className="block mb-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#a08060]">Consumption</span>
          <input type="number" placeholder="Yds/Pcs" value={item.consumption}
            onChange={(e) => onChange(item.key, "consumption", e.target.value)} className={inputCls} />
        </label>
      </div>
      <div className="rounded-md bg-[#b87a4a]/10 dark:bg-[#d4955e]/10 px-2 py-1 text-[11px] text-[#8a4a24] dark:text-[#d4955e]">
        Requested Yds (auto): <b>{requestedYds || 0}</b>
        <span className="text-[#a08060] font-normal"> — Roll is decided by Material Warehouse at issue time.</span>
      </div>
      <button type="button" onClick={checkStock} disabled={loadingPreview} className="text-[10px] font-medium text-[#3d6a8a] dark:text-[#6fa8d0] hover:underline">
        {loadingPreview ? "Checking..." : "Check total available stock"}
      </button>
      {preview && (
        <div className="text-[10px] text-[#7a6250] dark:text-[#a8917d]">
          Total available: <b>{preview.totalAvailableRoll} Roll · {preview.totalAvailableYds} Yds</b>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Items breakdown drawer for an expanded Saved Record
   ============================================================ */

function ItemsBreakdown({ items }) {
  if (!items?.length) return <div className="text-[11px] italic text-[#a08060] px-3 py-2">No item rows.</div>;
  return (
    <div className="mx-2 my-2 rounded-lg border-l-4 border-[#3d6a8a] dark:border-[#6fa8d0] bg-[#eef3f7] dark:bg-[#182530] shadow-inner overflow-hidden">
      <table className="min-w-full text-[11px]">
        <thead>
          <tr className="text-[#4a6578] dark:text-[#8fb0c4] border-b-2 border-[#3d6a8a]/20 dark:border-[#6fa8d0]/20 bg-[#dde8ef]/60 dark:bg-white/[0.03]">
            <th className="px-3 py-2 text-left font-semibold">Item Code / PDM</th>
            <th className="px-3 py-2 text-left font-semibold">Color</th>
            <th className="px-3 py-2 text-left font-semibold">Pcs</th>
            <th className="px-3 py-2 text-left font-semibold">Wastage %</th>
            <th className="px-3 py-2 text-left font-semibold">Consumption</th>
            <th className="px-3 py-2 text-left font-semibold">Requested Yds</th>
            <th className="px-3 py-2 text-left font-semibold">Issued</th>
            <th className="px-3 py-2 text-left font-semibold">Remaining Yds</th>
            <th className="px-3 py-2 text-left font-semibold">Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map((row, idx) => {
            const remainingYds = Number(row.requestedYds) - Number(row.issuedYds);
            return (
              <tr key={row.id} className={`border-b border-[#3d6a8a]/10 dark:border-[#6fa8d0]/10 last:border-b-0 ${idx % 2 === 1 ? "bg-[#3d6a8a]/[0.04] dark:bg-[#6fa8d0]/[0.04]" : ""}`}>
                <td className="px-3 py-2 text-[#2c4a63] dark:text-[#8fb0c4] font-bold">{row.itemCodePdm}</td>
                <td className="px-3 py-2 font-medium">{row.color}</td>
                <td className="px-3 py-2 whitespace-nowrap">{row.pcs}</td>
                <td className="px-3 py-2 whitespace-nowrap">{row.percentage}%</td>
                <td className="px-3 py-2 whitespace-nowrap">{row.consumption}</td>
                <td className="px-3 py-2 whitespace-nowrap font-semibold">{row.requestedYds} Yds</td>
                <td className="px-3 py-2 whitespace-nowrap text-[#3d7a4a] dark:text-[#8fca9c] font-medium">{row.issuedRoll} Roll / {row.issuedYds} Yds</td>
                <td className="px-3 py-2 whitespace-nowrap font-semibold text-[#8a4a24] dark:text-[#d4955e]">
                  {remainingYds > 0 ? `${remainingYds} Yds` : remainingYds < 0 ? `Over by ${Math.abs(remainingYds)} Yds` : "0 Yds"}
                </td>
                <td className="px-3 py-2">{statusChip(row.status)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ============================================================
   Filter row + Records table
   ============================================================ */

function RecordFilterRow({ filters, setFilters }) {
  const anyActive = Object.values(filters).some((v) => v && v.trim());
  return (
    <div className={`flex items-end gap-1.5 overflow-x-auto pb-0.5 ${scrollThin}`}>
      {RECORD_FILTER_FIELDS.map((f) => (
        <label key={f.key} className="shrink-0 w-[132px]">
          <span className="block mb-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#a08060] whitespace-nowrap">{f.label}</span>
          {f.type === "select" ? (
            <select value={filters[f.key]} onChange={(e) => setFilters((p) => ({ ...p, [f.key]: e.target.value }))} className={`${inputCls} text-[11px] py-1`}>
              <option value="">All Buyers</option>
              {BUYERS.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          ) : f.type === "floorSelect" ? (
            <select value={filters[f.key]} onChange={(e) => setFilters((p) => ({ ...p, [f.key]: e.target.value }))} className={`${inputCls} text-[11px] py-1`}>
              <option value="">All Floors</option>
              {FLOOR_OPTIONS.map((fl) => <option key={fl} value={fl}>{fl}</option>)}
            </select>
          ) : (
            <input type="text" value={filters[f.key]} onChange={(e) => setFilters((p) => ({ ...p, [f.key]: e.target.value }))} placeholder={f.label} className={`${inputCls} text-[11px] py-1`} />
          )}
        </label>
      ))}
      {anyActive && (
        <button type="button" onClick={() => setFilters(emptyRecordFilters)} className="shrink-0 self-stretch flex items-center text-[10px] font-medium text-[#b87a4a] hover:underline px-1">Clear</button>
      )}
    </div>
  );
}

function RecordsPanel({ filters, setFilters, requisitions, loading, expandedIds, toggleExpanded, onEdit, onDelete }) {
  return (
    <div className={`${card} flex flex-col h-full overflow-hidden`}>
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#2c2417]/10 dark:border-[#e8ddd0]/10 shrink-0">
        <PackageSearch size={16} className="text-[#b87a4a]" />
        <h2 className="font-serif text-base text-[#1a1208] dark:text-[#f0e8dc]">Sent Requisitions</h2>
        <span className="text-[11px] text-[#a08060]">({requisitions.length})</span>
        <span className="text-[10px] text-[#a08060] ml-auto">Newest first</span>
      </div>
      <div className="px-4 py-2.5 border-b border-[#2c2417]/10 dark:border-[#e8ddd0]/10 shrink-0">
        <RecordFilterRow filters={filters} setFilters={setFilters} />
      </div>
      <div className={`flex-1 min-h-0 overflow-auto ${scrollThin}`}>
        {loading ? (
          <div className="text-center py-8 text-[#a08060] text-xs">Loading...</div>
        ) : requisitions.length === 0 ? (
          <div className="text-center py-8 text-[#a08060] text-xs">No requisitions found.</div>
        ) : (
          <table className="min-w-full text-[11px] border-collapse">
            <thead className="sticky top-0 bg-[#e6e0d4]/70 dark:bg-[#221d16] text-[#7a6250] dark:text-[#a8917d] backdrop-blur z-10">
              <tr>
                <th className="px-3 py-2 text-left font-semibold w-6"></th>
                <th className="px-3 py-2 text-left font-semibold">Date</th>
                <th className="px-3 py-2 text-left font-semibold">Buyer</th>
                <th className="px-3 py-2 text-left font-semibold">Floor</th>
                <th className="px-3 py-2 text-left font-semibold">Season</th>
                <th className="px-3 py-2 text-left font-semibold">Style / Model</th>
                <th className="px-3 py-2 text-left font-semibold">Items</th>
                <th className="px-3 py-2 text-left font-semibold">Status</th>
                <th className="px-3 py-2 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {requisitions.map((r) => {
                const isOpen = expandedIds.has(r.id);
                const locked = r.status !== "pending";
                return (
                  <Fragment key={r.id}>
                    <tr onClick={() => toggleExpanded(r.id)} className="border-t border-[#2c2417]/8 dark:border-[#e8ddd0]/8 cursor-pointer hover:bg-[#b87a4a]/5">
                      <td className="px-3 py-2 text-[#a08060]">{isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{r.date?.slice(0, 10)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{r.buyer}</td>
                      <td className="px-3 py-2"><span className={chip}><MapPin size={10} className="mr-0.5" />{r.floor}</span></td>
                      <td className="px-3 py-2 whitespace-nowrap">{r.season}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{r.style}{r.model ? ` · ${r.model}` : ""}</td>
                      <td className="px-3 py-2"><span className={chip}>{r.totalItems}</span></td>
                      <td className="px-3 py-2">{statusChip(r.status)}</td>
                      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-2">
                          <button onClick={() => onEdit(r.id)} disabled={locked} title={locked ? "Material already issued; can't edit" : "Edit"}
                            className="inline-flex items-center gap-1 font-medium text-[#b87a4a] hover:underline disabled:opacity-40 disabled:pointer-events-none">
                            <Pencil size={11} /> Edit
                          </button>
                          <button onClick={() => onDelete(r.id)} disabled={locked} title={locked ? "Material already issued; can't delete" : "Delete"}
                            className="inline-flex items-center gap-1 font-medium text-[#a04a3a] hover:underline disabled:opacity-40 disabled:pointer-events-none">
                            <Trash2 size={11} /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr><td colSpan={9} className="p-0"><ItemsBreakdown items={r.items} /></td></tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   Main page
   ============================================================ */

export default function CuttingRequisitionPage() {
  const [form, setForm] = useState(emptyForm);
  const [items, setItems] = useState([newItem()]);
  const [requisitions, setRequisitions] = useState([]);
  const [recordFilters, setRecordFilters] = useState(emptyRecordFilters);
  const [editingId, setEditingId] = useState(null);
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [formOpen, setFormOpen] = useState(false);

  const fetchRequisitions = useCallback(async (filters = emptyRecordFilters) => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => { if (v && v.trim()) params.set(k, v.trim()); });
      const qs = params.toString();
      const url = qs ? `${API_URL}/cutting-requisition?${qs}` : `${API_URL}/cutting-requisition`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load requisitions");
      setRequisitions(await res.json());
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchRequisitions(); }, [fetchRequisitions]);
  useEffect(() => {
    const t = setTimeout(() => fetchRequisitions(recordFilters), 400);
    return () => clearTimeout(t);
  }, [recordFilters, fetchRequisitions]);

  const resetForm = () => { setForm(emptyForm); setItems([newItem()]); setEditingId(null); };
  const addItem = () => setItems((p) => [...p, newItem()]);
  const removeItem = (key) => setItems((p) => p.filter((i) => i.key !== key));
  const updateItem = (key, field, v) => setItems((p) => p.map((i) => (i.key === key ? { ...i, [field]: v } : i)));

  const toggleExpanded = (id) =>
    setExpandedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(""); setSuccess("");
    const rows = items.filter((i) => i.itemCodePdm && i.color && Number(i.pcs) > 0 && Number(i.consumption) > 0);
    if (rows.length === 0) {
      setError("Add at least one Item Code/PDM + Color row with Pcs and Consumption filled in.");
      return;
    }

    setSaving(true);
    try {
      const url = editingId ? `${API_URL}/cutting-requisition/${editingId}` : `${API_URL}/cutting-requisition`;
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST", credentials: "include",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, items: rows }),
      });
      if (!res.ok) { const body = await res.json().catch(() => ({})); throw new Error(body.message || "Failed to save requisition"); }
      setSuccess(editingId ? "Requisition updated." : "Requisition sent to Material Warehouse.");
      resetForm(); fetchRequisitions(recordFilters); setFormOpen(false);
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  const handleNew = () => { resetForm(); setFormOpen(true); };

  const handleEdit = async (id) => {
    setError("");
    try {
      const res = await fetch(`${API_URL}/cutting-requisition/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load requisition");
      const data = await res.json();
      setForm({
        date: data.date?.slice(0, 10) || "", buyer: data.buyer || "", floor: data.floor || "A-2",
        season: data.season || "", style: data.style || "", model: data.model || "",
      });
      setItems(
        (data.items || []).length
          ? data.items.map((i) => ({
              key: uid(), itemCodePdm: i.itemCodePdm, color: i.color,
              pcs: i.pcs, percentage: i.percentage, consumption: i.consumption,
            }))
          : [newItem()]
      );
      setEditingId(id); setFormOpen(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) { setError(err.message); }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this Requisition? This cannot be undone.")) return;
    setError("");
    try {
      const res = await fetch(`${API_URL}/cutting-requisition/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) { const body = await res.json().catch(() => ({})); throw new Error(body.message || "Failed to delete requisition"); }
      setSuccess("Requisition deleted."); fetchRequisitions(recordFilters);
    } catch (err) { setError(err.message); }
  };

  const buyerOptions = form.buyer && !BUYERS.includes(form.buyer) ? [form.buyer, ...BUYERS] : BUYERS;

  return (
    <div className="min-h-screen bg-[#f0ede6] dark:bg-[#1b1712]">
      <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Scissors size={22} className="text-[#b87a4a]" />
            <div>
              <h1 className="font-serif text-2xl text-[#1a1208] dark:text-[#f0e8dc]">
                Cutting <em className="italic text-[#b87a4a] dark:text-[#d4955e]">Requisition</em>
              </h1>
              <p className="text-xs text-[#7a6250] dark:text-[#a8917d]">
                Request Item Code/PDM + Color from Material Warehouse by Pcs, Wastage % and Consumption -- the
                Requested Yds is calculated automatically. Roll is decided by the warehouse when they issue. Sent
                requisitions show up as notifications on the warehouse's Cutting Issue page.
              </p>
            </div>
          </div>
          {!formOpen && (
            <button type="button" onClick={handleNew} className={btnPrimary}><Plus size={13} /> New Requisition</button>
          )}
        </div>

        {error && <div className="rounded-lg bg-[#b87a4a]/10 border border-[#b87a4a]/25 text-[#8a4a24] dark:text-[#e0a878] text-xs px-3 py-2"><b>Error:</b> {error}</div>}
        {success && <div className="rounded-lg bg-[#5ca068]/10 border border-[#5ca068]/25 text-[#3d7a4a] dark:text-[#8fca9c] text-xs px-3 py-2">{success}</div>}

        <div className="flex items-start gap-4">
          <div className={`shrink-0 transition-all duration-300 ease-in-out ${formOpen ? "w-[340px] opacity-100 translate-x-0" : "w-0 opacity-0 -translate-x-6 pointer-events-none"}`}>
            <div className={`sticky top-6 w-[340px] max-h-[calc(100vh-3rem)] overflow-y-auto overflow-x-hidden ${scrollThin}`}>
              <form onSubmit={handleSubmit} className={`${card} p-3 space-y-3 w-[340px]`}>
                <div className="flex items-center justify-between pb-1 border-b border-[#2c2417]/10 dark:border-[#e8ddd0]/10">
                  <h2 className="font-serif text-sm text-[#1a1208] dark:text-[#f0e8dc]">{editingId ? "Edit Requisition" : "Requisition Details"}</h2>
                  <button type="button" onClick={() => { setFormOpen(false); if (editingId) resetForm(); }} className="text-[#a08060] hover:text-[#b87a4a] transition-colors" title="Close">
                    <X size={14} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-x-2 gap-y-2">
                  <Field text="Date" required><input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={inputCls} /></Field>
                  <Field text="Floor" required>
                    <select value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} className={inputCls}>
                      {FLOOR_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
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
                  <Field text="Season" required><input type="text" required value={form.season} onChange={(e) => setForm({ ...form, season: up(e.target.value) })} className={inputCls} /></Field>
                  <Field text="Style" required><input type="text" required value={form.style} onChange={(e) => setForm({ ...form, style: up(e.target.value) })} className={inputCls} /></Field>
                  <div className="col-span-2">
                    <Field text="Model"><input type="text" value={form.model} onChange={(e) => setForm({ ...form, model: up(e.target.value) })} className={inputCls} /></Field>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between pb-1 border-b border-[#2c2417]/10 dark:border-[#e8ddd0]/10">
                    <h2 className="font-serif text-sm text-[#1a1208] dark:text-[#f0e8dc]">Item Code / PDM, Color &amp; Consumption</h2>
                  </div>
                  <div className="space-y-1.5">
                    {items.map((it) => (
                      <ItemRow key={it.key} item={it} canRemove={items.length > 1} onRemove={removeItem} onChange={updateItem} />
                    ))}
                  </div>
                  <button type="button" onClick={addItem} className={`${btnSecondary} w-full justify-center`}><Plus size={13} /> Add Item Row</button>
                </div>

                <div className="flex flex-col gap-2 pt-1 border-t border-[#2c2417]/10 dark:border-[#e8ddd0]/10">
                  <button type="submit" disabled={saving} className={`${btnPrimary} w-full justify-center`}>
                    {saving ? "Saving..." : editingId ? "Update Requisition" : "Send Requisition"}
                  </button>
                  {editingId && <button type="button" onClick={() => { resetForm(); setFormOpen(false); }} className={`${btnSecondary} w-full justify-center`}>Cancel Edit</button>}
                </div>
              </form>
            </div>
          </div>

          <div className="flex-1 min-w-0 sticky top-6 h-[calc(100vh-3rem)] overflow-hidden">
            <RecordsPanel
              filters={recordFilters} setFilters={setRecordFilters}
              requisitions={requisitions} loading={loading}
              expandedIds={expandedIds} toggleExpanded={toggleExpanded}
              onEdit={handleEdit} onDelete={handleDelete}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
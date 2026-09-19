// frontend/app/(Pages)/(Material-warehouse)/material-warehouse/material-inspection/page.js

//
// UPDATE: Inspection can now also record what DEFECTS were found on a
// batch -- zero, one ("Single"), or several ("Multiple") -- via a
// checkbox picker plus a free-text "Other" option, stored as a simple
// list against the batch's own row (no separate defects table needed,
// since a defect list only ever belongs to exactly one
// batch/inspection). Recorded defects show up in the History tab.
//
// THEME UPDATE: restyled to match the rest of the ERP (Material Stock /
// Style Register): blue #3B9ED4 accent, #F0F4F8 page background, white
// rounded-xl cards with gray-200 borders, icon-square top bar, and the
// light-blue (#C8E3F5) table header with #EEF6FC zebra rows. The old
// brown/purple palette + dark-mode classes were removed.
//
// RESPONSIVE UPDATE:
//   - Top bar wraps on small screens; the long description sits in an
//     info note below it instead of squeezing into the header.
//   - Worklist card headers wrap onto multiple lines instead of overflowing.
//   - Received Info grid: 2 cols (mobile) -> 3 (sm) -> 4 (lg); long
//     values wrap instead of being cut off.
//   - Defect checkboxes reflow 2 -> 3 -> 4 columns; form buttons are
//     full-width on mobile.
//   - Notification dropdown never exceeds the viewport width.
//   - History: full table on md+ screens, stacked cards on phones (no
//     sideways scrolling needed on mobile).
//
// Logic / API calls are unchanged.

"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bell, ChevronDown, ChevronUp, History as HistoryIcon, ClipboardCheck, PackageSearch, AlertOctagon, X, Info,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

// ─── Theme (matches Material Stock / Style Register) ─────────────────────────
const BLUE = "#3B9ED4";
const BLUE_HDR = "#C8E3F5";   // table header bg
const BLUE_ROW = "#EEF6FC";   // zebra row / soft panel bg
const PAGE_BG = "#F0F4F8";

// ─── Shared class helpers ────────────────────────────────────────────────────
// NOTE: all Tailwind colors are written as literal class names (no
// template-string interpolation) so Tailwind's compiler can see them.
const card = "bg-white rounded-xl border border-gray-200 shadow-sm";

const inputCls =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 " +
  "placeholder:text-gray-400 shadow-sm focus:outline-none focus:ring-2 " +
  "focus:ring-[#3B9ED4]/25 focus:border-[#3B9ED4] transition-all duration-150";

const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-[#3B9ED4] hover:bg-[#2E8EC4] text-white " +
  "text-sm font-semibold px-4 py-2.5 transition-colors shadow-sm disabled:opacity-50 disabled:pointer-events-none";

const btnSecondary =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white " +
  "text-gray-600 text-sm font-medium px-3 py-2 hover:border-[#3B9ED4] " +
  "hover:text-[#3B9ED4] transition-colors disabled:opacity-40 disabled:pointer-events-none";

const btnDanger =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-red-300 bg-white " +
  "text-red-600 text-sm font-semibold px-4 py-2.5 hover:bg-red-50 transition-colors " +
  "disabled:opacity-40 disabled:pointer-events-none";

// Tabs (same padding for active/inactive so they don't jump in height).
const tabBase =
  "inline-flex flex-1 sm:flex-none items-center justify-center gap-2 rounded-lg border text-sm font-semibold px-4 py-2.5 transition-colors";
const tabActive = `${tabBase} bg-[#3B9ED4] border-[#3B9ED4] text-white shadow-sm`;
const tabInactive = `${tabBase} bg-white border-gray-300 text-gray-600 hover:border-[#3B9ED4] hover:text-[#3B9ED4]`;

// Chips
const chipBase = "inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold whitespace-nowrap";
const chip = `${chipBase} bg-[#3B9ED4]/10 text-[#2E8EC4]`;
const chipPending = `${chipBase} bg-amber-50 text-amber-700`;
const chipPartial = `${chipBase} bg-sky-50 text-sky-700`;
const chipApproved = `${chipBase} bg-green-50 text-green-700`;
const chipRejected = `${chipBase} bg-red-50 text-red-700`;
const chipAwaiting = `${chipBase} bg-purple-50 text-purple-700`;
// Small chip used to display/pick an individual defect name.
const chipDefect =
  "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-red-50 text-red-700 border border-red-100";

const labelCls = "block mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400";

// Thin scrollbar in the ERP's blue-grey.
const scrollThin =
  "[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent " +
  "[&::-webkit-scrollbar-thumb]:bg-[#c8d9e8] [&::-webkit-scrollbar-thumb]:rounded-full " +
  "[&::-webkit-scrollbar-thumb:hover]:bg-[#9ab8cc] " +
  "[scrollbar-width:thin] [scrollbar-color:#c8d9e8_transparent]";

// Common fabric-defect vocabulary shown as quick-pick checkboxes. The user
// can also type any custom defect name via the "Other" input below these
// -- the two lists get merged into one array on submit, so picking one
// box ("Single") or several boxes/entries ("Multiple") both just add
// strings to the same list.
const DEFECT_OPTIONS = [
  "Shade Variation",
  "Fabric Fault",
  "Width Shortage",
  "Weaving Defect",
  "Color Bleeding",
  "Stain / Dirty Mark",
  "Hole / Tear",
  "Uneven GSM",
];

function statusChip(status) {
  if (status === "approved") return <span className={chipApproved}>Approved</span>;
  if (status === "partial") return <span className={chipPartial}>Partially Assigned</span>;
  if (status === "rejected") return <span className={chipRejected}>Rejected</span>;
  if (status === "pending_inspection") return <span className={chipAwaiting}>Awaiting Inspection</span>;
  return <span className={chipPending}>Pending (not racked)</span>;
}

function Field({ label, value, valueClassName = "" }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</div>
      <div className={`text-sm font-bold text-gray-800 break-words ${valueClassName}`}>{value ?? "-"}</div>
    </div>
  );
}

function Spinner({ label }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400 text-sm">
      <div
        className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
        style={{ borderColor: BLUE + "40", borderTopColor: BLUE }}
      />
      {label}
    </div>
  );
}

function EmptyState({ children }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400 text-sm text-center px-4">
      <PackageSearch size={32} className="opacity-30" />
      {children}
    </div>
  );
}

/* ============================================================
   Notification bell -- unread count + dropdown list. Clicking an
   item marks it read and jumps to/expands it in the Worklist tab.
   ============================================================ */

function NotificationBell({ notifications, unreadCount, onRefresh, onSelect }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); if (!open) onRefresh(); }}
        className="relative inline-flex items-center justify-center h-9 w-9 rounded-xl bg-white border border-gray-200 text-gray-500 shadow-sm hover:border-[#3B9ED4] hover:text-[#3B9ED4] transition-colors"
        title="Material Inspection notifications"
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className={`absolute right-0 mt-2 w-[calc(100vw-2rem)] max-w-sm max-h-96 overflow-auto ${scrollThin} bg-white rounded-xl border border-gray-200 shadow-xl z-30`}>
          <div className="px-3 py-2 border-b border-gray-100 bg-gray-50 text-[10px] font-bold uppercase tracking-wider text-gray-500">
            Batches Awaiting Inspection
          </div>
          <div className="p-1.5 space-y-0.5">
            {notifications.length === 0 ? (
              <div className="text-xs italic text-gray-400 px-2 py-3">Nothing new.</div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => { setOpen(false); onSelect(n.id); }}
                  className={`w-full text-left rounded-lg px-2.5 py-2 text-xs transition-colors hover:bg-[#DBEEFF] ${!n.isRead ? "bg-[#EEF6FC]" : ""}`}
                >
                  <div className="flex flex-wrap items-center gap-x-1.5">
                    {!n.isRead && <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />}
                    <span className="font-bold text-sm text-gray-800">{n.receive?.buyer}</span>
                    <span className="text-gray-400">· {n.receive?.invoiceNo}</span>
                  </div>
                  <div className="text-[11px] font-medium text-gray-500 mt-0.5 break-words">
                    {n.itemCodePdm} · {n.color} · {n.rollQty} Roll / {n.yds} Yds · {n.receive?.date?.slice(0, 10)}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   InspectionForm -- Passed Roll/Yds inputs, auto-computed Rejected,
   optional Defects Found (Single/Multiple via checkboxes + custom),
   optional note, Save + Reject All.
   ============================================================ */

function InspectionForm({ item, onDone }) {
  const [passedRoll, setPassedRoll] = useState(String(item.rollQty));
  const [passedYds, setPassedYds] = useState(String(item.yds));
  const [note, setNote] = useState("");
  // Defects picked from the quick-pick checkbox list above.
  const [checkedDefects, setCheckedDefects] = useState([]);
  // Defects typed in manually via the "Other" input (kept separate from
  // checkedDefects so each has its own remove control, then merged with
  // checkedDefects into one array right before submit).
  const [customDefects, setCustomDefects] = useState([]);
  const [customDefectInput, setCustomDefectInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const pr = Number(passedRoll) || 0;
  const py = Number(passedYds) || 0;
  const rejRoll = Math.max(0, Number(item.rollQty) - pr);
  const rejYds = Math.max(0, Number(item.yds) - py);
  const isPartialPass = pr < Number(item.rollQty) || py < Number(item.yds);

  const toggleDefect = (name) => {
    setCheckedDefects((cur) => (cur.includes(name) ? cur.filter((d) => d !== name) : [...cur, name]));
  };

  const addCustomDefect = () => {
    const v = customDefectInput.trim();
    if (!v) return;
    setCustomDefects((cur) => (cur.includes(v) ? cur : [...cur, v]));
    setCustomDefectInput("");
  };

  const removeCustomDefect = (name) => setCustomDefects((cur) => cur.filter((d) => d !== name));

  const allDefects = [...checkedDefects, ...customDefects];

  const submit = async (finalRoll, finalYds, confirmMsg) => {
    setErr("");
    if (finalRoll < 0 || finalYds < 0 || finalRoll > Number(item.rollQty) || finalYds > Number(item.yds)) {
      setErr(`Passed quantity must be between 0 and the received amount (${item.rollQty} Roll / ${item.yds} Yds).`);
      return;
    }
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/material-inspection/${item.id}`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passedRoll: finalRoll, passedYds: finalYds, note, defects: allDefects }),
      });
      if (!res.ok) { const body = await res.json().catch(() => ({})); throw new Error(body.message || "Failed to save inspection"); }
      onDone?.();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4 space-y-3">
      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-600">
        <ClipboardCheck size={14} style={{ color: BLUE }} /> Record Inspection Result
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:max-w-md">
        <label className="block">
          <span className={labelCls}>Passed Roll</span>
          <input type="number" min="0" max={item.rollQty} value={passedRoll} onChange={(e) => setPassedRoll(e.target.value)} className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>Passed Yds</span>
          <input type="number" min="0" max={item.yds} value={passedYds} onChange={(e) => setPassedYds(e.target.value)} className={inputCls} />
        </label>
      </div>

      <div className="text-xs text-gray-500">
        Rejected (auto-calculated): <b className="text-red-600">{rejRoll} Roll / {rejYds} Yds</b>
        <span className="block text-[11px] text-gray-400">Received was {item.rollQty} Roll / {item.yds} Yds.</span>
      </div>

      {/* Defects Found -- optional, Single (one box/entry) or Multiple
         (several) both just add to the same list. Not required to save
         an inspection (a clean full pass has none), but especially
         useful to fill in whenever something is being rejected. */}
      <div className="rounded-xl border border-red-200 bg-red-50/60 p-3 space-y-2.5">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-red-700">
          <AlertOctagon size={12} /> Defects Found (optional)
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-3 gap-y-2">
          {DEFECT_OPTIONS.map((name) => (
            <label key={name} className="inline-flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={checkedDefects.includes(name)}
                onChange={() => toggleDefect(name)}
                className="h-4 w-4 shrink-0 rounded accent-red-600"
              />
              <span className="min-w-0 break-words">{name}</span>
            </label>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <input
            type="text"
            value={customDefectInput}
            onChange={(e) => setCustomDefectInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomDefect(); } }}
            placeholder="Other defect (type and press Enter)"
            className={`${inputCls} sm:flex-1`}
          />
          <button type="button" onClick={addCustomDefect} className={`${btnSecondary} w-full sm:w-auto`}>
            Add
          </button>
        </div>
        {customDefects.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {customDefects.map((d) => (
              <span key={d} className={chipDefect}>
                {d}
                <button type="button" onClick={() => removeCustomDefect(d)} className="hover:text-red-900" aria-label={`Remove ${d}`}>
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
        )}
        {allDefects.length > 0 && (
          <div className="text-[11px] text-gray-500">
            {allDefects.length === 1 ? "1 defect" : `${allDefects.length} defects`} will be recorded with this inspection.
          </div>
        )}
      </div>

      <label className="block">
        <span className={labelCls}>Note (optional)</span>
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Inspection remarks..." className={`${inputCls} resize-none`} />
      </label>

      <div className="flex flex-col sm:flex-row gap-2 pt-0.5">
        <button
          type="button" disabled={busy}
          onClick={() => submit(pr, py, isPartialPass ? `Approve ${pr} Roll / ${py} Yds and reject ${rejRoll} Roll / ${rejYds} Yds?` : null)}
          className={`${btnPrimary} w-full sm:w-auto`}
        >
          {busy ? "Saving..." : "Save Inspection"}
        </button>
        <button
          type="button" disabled={busy}
          onClick={() => submit(0, 0, `Reject ALL ${item.rollQty} Roll / ${item.yds} Yds for this batch? This cannot be undone.`)}
          className={`${btnDanger} w-full sm:w-auto`}
        >
          Reject All
        </button>
      </div>
      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs px-3 py-2">{err}</div>
      )}
    </div>
  );
}

/* ============================================================
   WorklistItem -- one batch card, expandable
   ============================================================ */

function WorklistItem({ item, forceOpen, onAfterOpen, onDone }) {
  const [open, setOpen] = useState(!!forceOpen);
  useEffect(() => { if (forceOpen) { setOpen(true); onAfterOpen?.(); } }, [forceOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const r = item.receive || {};
  const styleLabel = (r.styles || []).map((s) => (s.model ? `${s.style} | ${s.model}` : s.style)).join(", ");

  return (
    <div className={`${card} overflow-hidden`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex flex-wrap items-center gap-x-2.5 gap-y-1 px-4 py-3 text-left transition-colors hover:bg-[#EEF6FC] ${open ? "bg-[#EEF6FC]" : ""}`}
      >
        {open ? <ChevronUp size={15} className="text-gray-400 shrink-0" /> : <ChevronDown size={15} className="text-gray-400 shrink-0" />}
        <span className="text-sm font-bold text-gray-800">{r.buyer}</span>
        <span className={chip}>{r.invoiceNo}</span>
        <span className="text-xs font-semibold break-words" style={{ color: BLUE }}>{item.itemCodePdm} · {item.color}</span>
        <span className="text-[11px] font-medium text-gray-400">{r.date?.slice(0, 10)}</span>
        <span className="ml-auto">{statusChip(item.status)}</span>
      </button>

      {open && (
        <div className="border-t border-gray-100 p-3 sm:p-4 space-y-3">
          <div className="rounded-xl border px-3 py-3 sm:px-4" style={{ background: BLUE_ROW, borderColor: "#D1E4F0" }}>
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider mb-2.5" style={{ color: BLUE }}>
              <ClipboardCheck size={13} /> Received Info
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-3">
              <Field label="Date" value={r.date?.slice(0, 10)} />
              <Field label="Invoice No." value={r.invoiceNo} />
              <Field label="From" value={r.fromType} />
              <Field label="Warehouse" value={r.warehouse} />
              <Field label="Buyer" value={r.buyer} />
              <Field label="Season" value={r.season} />
              <Field label="PO" value={r.po} />
              <Field label="Style | Model" value={styleLabel || "-"} />
              <Field label="Item" value={r.item} />
              <Field label="Buy" value={r.buy} />
              <Field label="Item Code/PDM" value={item.itemCodePdm} valueClassName="text-[#2E8EC4]" />
              <Field label="Color" value={item.color} />
              <Field label="Received Roll / Yds" value={`${item.rollQty} Roll / ${item.yds} Yds`} valueClassName="text-base" />
              {r.remark && <Field label="Remark" value={r.remark} />}
            </div>
          </div>

          <InspectionForm item={item} onDone={onDone} />
        </div>
      )}
    </div>
  );
}

/* ============================================================
   History tab -- every batch already inspected.
   md+ screens: full table. Phones: stacked cards.
   ============================================================ */

function DefectList({ defects }) {
  if (defects.length === 0) return <span className="text-gray-400 italic">None</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {defects.map((d) => (
        <span key={d} className={chipDefect}>{d}</span>
      ))}
    </div>
  );
}

function HistoryTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/material-inspection/history`, { credentials: "include" });
        setRows(await res.json());
      } catch {
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const HEADERS = [
    "Inspected On", "Invoice", "Buyer", "Item Code/PDM", "Color", "Received",
    "Passed", "Rejected", "Defects", "Status", "Note",
  ];

  return (
    <div className={`${card} overflow-hidden`}>
      <div className="flex items-center gap-2.5 px-4 sm:px-5 py-3 border-b border-gray-100 bg-gray-50">
        <HistoryIcon size={16} style={{ color: BLUE }} />
        <h2 className="font-bold text-sm text-gray-800">Inspection History</h2>
        <span className="text-xs px-2 py-0.5 rounded-full font-semibold text-white" style={{ background: BLUE }}>
          {rows.length}
        </span>
      </div>

      {loading ? (
        <Spinner label="Loading history…" />
      ) : rows.length === 0 ? (
        <EmptyState>No inspections yet.</EmptyState>
      ) : (
        <>
          {/* ── md and up: table ── */}
          <div className={`hidden md:block max-h-[70vh] overflow-auto ${scrollThin}`}>
            <table className="min-w-full border-collapse text-xs">
              <thead className="sticky top-0 z-10">
                <tr style={{ background: BLUE_HDR }}>
                  {HEADERS.map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-700 border-b whitespace-nowrap"
                      style={{ borderBottomColor: "#A8D3EC" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const defects = Array.isArray(r.defects) ? r.defects : [];
                  return (
                    <tr
                      key={r.id}
                      className={`border-b border-gray-100 transition-colors ${i % 2 === 0 ? "bg-white" : "bg-[#EEF6FC]"} hover:bg-[#DBEEFF]`}
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600">{r.inspectedAt?.slice(0, 10) || "-"}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-700">{r.receive?.invoiceNo}</td>
                      <td className="px-4 py-3 font-semibold whitespace-nowrap text-gray-800">{r.receive?.buyer}</td>
                      <td className="px-4 py-3 font-semibold whitespace-nowrap" style={{ color: BLUE }}>{r.itemCodePdm}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-700">{r.color}</td>
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-gray-700">{r.rollQty} Roll / {r.yds} Yds</td>
                      <td className="px-4 py-3 whitespace-nowrap font-mono font-bold text-green-600">{r.passedRoll} Roll / {r.passedYds} Yds</td>
                      <td className="px-4 py-3 whitespace-nowrap font-mono font-bold text-red-600">{r.rejectedRoll} Roll / {r.rejectedYds} Yds</td>
                      <td className="px-4 py-3 max-w-[240px]"><DefectList defects={defects} /></td>
                      <td className="px-4 py-3 whitespace-nowrap">{statusChip(r.status)}</td>
                      <td className="px-4 py-3 max-w-[200px] truncate text-gray-600" title={r.inspectionNote || undefined}>{r.inspectionNote || "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── below md: stacked cards ── */}
          <div className={`md:hidden max-h-[75vh] overflow-auto ${scrollThin} p-3 space-y-2.5`}>
            {rows.map((r) => {
              const defects = Array.isArray(r.defects) ? r.defects : [];
              return (
                <div key={r.id} className="rounded-xl border border-gray-200 bg-white p-3 space-y-2.5">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-sm font-bold text-gray-800">{r.receive?.buyer}</span>
                    <span className={chip}>{r.receive?.invoiceNo}</span>
                    <span className="ml-auto">{statusChip(r.status)}</span>
                  </div>

                  <div className="text-xs font-semibold break-words" style={{ color: BLUE }}>
                    {r.itemCodePdm} · {r.color}
                  </div>

                  <div className="grid grid-cols-1 gap-1.5 rounded-lg px-3 py-2.5" style={{ background: BLUE_ROW }}>
                    <div className="flex justify-between gap-3 text-xs">
                      <span className="text-gray-500">Received</span>
                      <span className="font-mono font-semibold text-gray-700 text-right">{r.rollQty} Roll / {r.yds} Yds</span>
                    </div>
                    <div className="flex justify-between gap-3 text-xs">
                      <span className="text-gray-500">Passed</span>
                      <span className="font-mono font-bold text-green-600 text-right">{r.passedRoll} Roll / {r.passedYds} Yds</span>
                    </div>
                    <div className="flex justify-between gap-3 text-xs">
                      <span className="text-gray-500">Rejected</span>
                      <span className="font-mono font-bold text-red-600 text-right">{r.rejectedRoll} Roll / {r.rejectedYds} Yds</span>
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Defects</div>
                    <div className="text-xs"><DefectList defects={defects} /></div>
                  </div>

                  {r.inspectionNote && (
                    <div className="text-xs text-gray-600 break-words">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Note · </span>
                      {r.inspectionNote}
                    </div>
                  )}

                  <div className="text-[11px] text-gray-400">Inspected on {r.inspectedAt?.slice(0, 10) || "-"}</div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/* ============================================================
   Main page
   ============================================================ */

export default function MaterialInspectionPage() {
  const [tab, setTab] = useState("worklist"); // "worklist" | "history"
  const [worklist, setWorklist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [openId, setOpenId] = useState(null);
  const [error, setError] = useState("");

  const fetchWorklist = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API_URL}/material-inspection`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load worklist");
      setWorklist(await res.json());
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/material-inspection/notifications`, { credentials: "include" });
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchWorklist(); fetchNotifications(); }, [fetchWorklist, fetchNotifications]);

  const handleSelectNotification = async (id) => {
    setTab("worklist");
    setOpenId(id);
    try {
      await fetch(`${API_URL}/material-inspection/${id}/read`, { method: "PATCH", credentials: "include" });
      fetchNotifications();
    } catch { /* ignore */ }
  };

  const refreshAll = () => { fetchWorklist(); fetchNotifications(); };

  return (
    <div className="min-h-screen" style={{ background: PAGE_BG, fontFamily: "Inter, system-ui, sans-serif" }}>

      {/* ── Top bar (matches Material Stock / Style Register) ── */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm shrink-0" style={{ background: BLUE }}>
            <ClipboardCheck size={18} className="text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-bold text-gray-800 leading-tight truncate">Material Inspection</h1>
            <p className="text-[10px] text-gray-400 truncate">Review received batches &amp; record QC results</p>
          </div>
        </div>
        <NotificationBell
          notifications={notifications}
          unreadCount={unreadCount}
          onRefresh={fetchNotifications}
          onSelect={handleSelectNotification}
        />
      </div>

      <div className="max-w-[1440px] mx-auto px-3 sm:px-4 py-4 sm:py-5 space-y-4">

        {/* ── Info note ── */}
        <div
          className="flex items-start gap-2.5 rounded-xl border px-3 sm:px-4 py-3 text-xs text-gray-600"
          style={{ background: BLUE_ROW, borderColor: "#D1E4F0" }}
        >
          <Info size={15} className="shrink-0 mt-0.5" style={{ color: BLUE }} />
          <p>
            Approve how much of each newly received batch actually passed QC. Only the Passed Roll/Yds becomes
            available for rack assignment; the rest is recorded as Rejected. Defects found (single or multiple)
            can be recorded alongside the result.
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3">
            <span className="font-bold">Error:</span> {error}
          </div>
        )}

        {/* ── Tabs ── */}
        <div className="flex gap-2">
          <button type="button" onClick={() => setTab("worklist")} className={tab === "worklist" ? tabActive : tabInactive}>
            <PackageSearch size={14} /> Worklist
            {!loading && worklist.length > 0 && (
              <span
                className={`px-1.5 rounded-full text-[10px] font-bold ${tab === "worklist" ? "bg-white/25 text-white" : "bg-[#3B9ED4]/10 text-[#2E8EC4]"}`}
              >
                {worklist.length}
              </span>
            )}
          </button>
          <button type="button" onClick={() => setTab("history")} className={tab === "history" ? tabActive : tabInactive}>
            <HistoryIcon size={14} /> History
          </button>
        </div>

        {tab === "worklist" ? (
          loading ? (
            <div className={card}><Spinner label="Loading worklist…" /></div>
          ) : worklist.length === 0 ? (
            <div className={card}><EmptyState>No batches waiting for inspection.</EmptyState></div>
          ) : (
            <div className="space-y-2.5">
              {worklist.map((item) => (
                <WorklistItem
                  key={item.id}
                  item={item}
                  forceOpen={openId === item.id}
                  onAfterOpen={() => setOpenId(null)}
                  onDone={refreshAll}
                />
              ))}
            </div>
          )
        ) : (
          <HistoryTab />
        )}
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
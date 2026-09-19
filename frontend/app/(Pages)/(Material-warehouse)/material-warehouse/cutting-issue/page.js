// frontend/app/(Pages)/(Material-warehouse)/material-warehouse/cutting-issue/page.js
//
// Same structure as before -- only the theme changed: #3B9ED4 accent,
// #F0F4F8 page, white rounded-xl cards, icon-square top bar, #C8E3F5 table
// headers with zebra rows and blue hover, rounded-md chips, light-blue info
// note. Brown/orange palette, serif headings and every `dark:` class removed.
// Tables become stacked cards below lg. No data logic or API calls touched.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle, Bell, Boxes, Check, ChevronDown, ChevronUp, ClipboardList,
  History as HistoryIcon, Info, MapPin, PackageSearch, Search,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

/* ---------- theme (literal Tailwind class strings) ---------- */

const card = "bg-white rounded-xl border border-gray-200 shadow-sm";
const soft = "bg-[#EEF6FC] border border-[#D1E4F0]";
const inputCls =
  "w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-800 placeholder:text-gray-400 " +
  "shadow-sm transition focus:outline-none focus:ring-2 focus:ring-[#3B9ED4]/25 focus:border-[#3B9ED4]";
const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-[#3B9ED4] px-4 py-2 text-sm font-semibold text-white " +
  "shadow-sm transition-colors hover:bg-[#2E8EC4] disabled:opacity-50 disabled:pointer-events-none";
const btnSecondary =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium " +
  "text-gray-600 transition-colors hover:border-[#3B9ED4] hover:text-[#3B9ED4] disabled:opacity-40 disabled:pointer-events-none";
const th =
  "border-b border-[#A8D3EC] bg-[#C8E3F5] px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-gray-700 whitespace-nowrap";
const chipBase = "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold whitespace-nowrap";
const chip = `${chipBase} bg-[#3B9ED4]/10 text-[#2E8EC4]`;
const chipAmber = `${chipBase} bg-amber-50 text-amber-700`;
const chipGreen = `${chipBase} bg-green-50 text-green-700`;
const scrollThin =
  "[&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent " +
  "[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#c8d9e8] " +
  "[&::-webkit-scrollbar-thumb:hover]:bg-[#9ab8cc] [scrollbar-width:thin] [scrollbar-color:#c8d9e8_transparent]";

const d = (v) => v?.slice(0, 10) || "-";

function statusChip(status) {
  if (status === "fulfilled") return <span className={chipGreen}>Fulfilled</span>;
  if (status === "partial") return <span className={`${chipBase} bg-sky-50 text-sky-700`}>Partially Issued</span>;
  return <span className={chipAmber}>Pending</span>;
}

// Large, impossible-to-miss error banner, used everywhere an issue or
// validation error needs to be shown.
function ErrorBanner({ message }) {
  if (!message) return null;
  return (
    <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5">
      <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-600" />
      <span className="break-words text-sm font-bold leading-snug text-red-700 sm:text-base">{message}</span>
    </div>
  );
}

// Tiny uppercase label above a larger value, so the meaning of every number
// is unambiguous instead of relying on color alone.
function Field({ label, value, valueClassName = "" }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</div>
      <div className={`truncate text-sm font-bold text-gray-800 ${valueClassName}`}>{value}</div>
    </div>
  );
}

/* ============================================================
   Notification bell -- unread count + dropdown list. Clicking an
   item marks it read and jumps to/expands it in the Worklist tab.
   ============================================================ */

function NotificationBell({ notifications, unreadCount, onRefresh, onSelect }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); if (!open) onRefresh(); }}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 shadow-sm transition-colors hover:border-[#3B9ED4] hover:text-[#3B9ED4]"
        title="Requisition notifications"
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className={`absolute right-0 z-30 mt-2 max-h-96 w-[min(20rem,calc(100vw-2rem))] space-y-1 overflow-auto p-2 shadow-xl ${card} ${scrollThin}`}>
          <div className="px-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-gray-500">Cutting Requisitions</div>
          {notifications.length === 0 ? (
            <div className="px-1 py-2 text-xs italic text-gray-400">No requisitions yet.</div>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => { setOpen(false); onSelect(n.id); }}
                className={`w-full rounded-lg px-2.5 py-2 text-left text-xs transition-colors hover:bg-[#DBEEFF] ${n.isRead ? "" : "bg-[#EEF6FC]"}`}
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  {!n.isRead && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />}
                  <span className="break-words text-sm font-bold text-gray-800">{n.buyer}</span>
                  <span className="text-gray-400">{n.floor}</span>
                  <span className="ml-auto">{statusChip(n.status)}</span>
                </div>
                <div className="mt-0.5 break-words text-[11px] font-medium text-gray-500">
                  Style {n.style}{n.model ? ` · ${n.model}` : ""} · {n.season} · {d(n.date)}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   IssueForm -- "Check stock" shows every rack allocation matching this
   Item Code/PDM (Date, Buyer, Season, Item, Item Code/PDM, Color,
   Style/Model, Rack, Available), so the right batch can be confirmed
   before picking. Only Item Code/PDM has to match -- Color is neither
   filtered on nor enforced; rows whose Color or Season differ from the
   request are flagged red without blocking the pick.

   "Pick" adds a rack to the list below instead of issuing immediately,
   so several racks can each be given a Roll/Yds amount and applied
   together with one "Issue All" request. Each picked row shows a
   "Need: X Yds" badge (remaining requested Yds minus what's typed into
   the other rows), turning green once nothing more is needed.

   Responsive: stacked cards below lg, full table from lg up.
   ============================================================ */

function IssueForm({ item, requisition, onIssued }) {
  const [stockOpen, setStockOpen] = useState(false);
  const [stockRows, setStockRows] = useState([]);
  const [loadingStock, setLoadingStock] = useState(false);
  // Cart of racks picked for this issue action:
  // [{ allocationId, location, availableRoll, availableYds, roll, yds }]
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const remainingYds = Math.max(0, Number(item.requestedYds) - Number(item.issuedYds));
  const isDone = item.status === "fulfilled";

  const pickedTotalRoll = picked.reduce((s, p) => s + (Number(p.roll) || 0), 0);
  const pickedTotalYds = picked.reduce((s, p) => s + (Number(p.yds) || 0), 0);
  const pickedIds = new Set(picked.map((p) => p.allocationId));

  // Still-needed amount AFTER everything currently typed into the cart,
  // so the figure reflects "what's left once these amounts go through".
  const stillNeeded = Math.max(0, remainingYds - pickedTotalYds);
  const needChip = stillNeeded > 0 ? chipAmber : chipGreen;

  const checkStock = async () => {
    if (stockOpen) { setStockOpen(false); return; }
    setStockOpen(true);
    setLoadingStock(true);
    try {
      // Color intentionally NOT sent -- issuing only requires an Item
      // Code/PDM match, so this shows racks across every Color.
      const params = new URLSearchParams({ itemCodePdm: item.itemCodePdm });
      const res = await fetch(`${API_URL}/material-stock?${params.toString()}`, { credentials: "include" });
      const data = await res.json();
      setStockRows(data.rows || []);
    } catch {
      setStockRows([]);
    } finally {
      setLoadingStock(false);
    }
  };

  const pickRack = (row) => {
    setErr("");
    setPicked((p) => {
      if (p.some((x) => x.allocationId === row.itemId)) return p; // already picked
      return [...p, { allocationId: row.itemId, location: row.location, availableRoll: row.availableRoll, availableYds: row.availableYds, roll: "", yds: "" }];
    });
  };

  const removePicked = (allocationId) => setPicked((p) => p.filter((x) => x.allocationId !== allocationId));

  const updatePicked = (allocationId, field, v) =>
    setPicked((p) => p.map((x) => (x.allocationId === allocationId ? { ...x, [field]: v } : x)));

  const handleIssueAll = async () => {
    setErr("");
    if (picked.length === 0) { setErr("Pick at least one rack first."); return; }
    // Roll and Yds do NOT both have to be filled in -- only reject a row
    // where BOTH are 0/blank, since that wouldn't issue anything at all.
    for (const p of picked) {
      if ((Number(p.roll) || 0) <= 0 && (Number(p.yds) || 0) <= 0) {
        setErr(`Enter a Roll or Yds amount for ${p.location}.`);
        return;
      }
    }

    // No hard cap on issuing more than requested -- just confirm first,
    // since Cutting's Consumption-based Yds is an estimate and the
    // warehouse is trusted to judge the real need on the floor.
    if (pickedTotalYds > remainingYds) {
      const over = Math.round((pickedTotalYds - remainingYds) * 100) / 100;
      const proceed = window.confirm(
        `This issues ${pickedTotalYds} Yds, which is ${over} Yds more than the ${remainingYds} Yds still remaining on the Requisition (Requested ${item.requestedYds} Yds total). Continue anyway?`
      );
      if (!proceed) return;
    }

    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/cutting-issue/${item.id}/batch`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allocations: picked.map((p) => ({ allocationId: p.allocationId, rollQty: p.roll || 0, yds: p.yds || 0 })),
        }),
      });
      if (!res.ok) { const body = await res.json().catch(() => ({})); throw new Error(body.message || "Failed to issue"); }
      setPicked([]); setStockOpen(false);
      onIssued?.();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  // Per-row flags shared by the card and table layouts.
  const meta = (r) => ({
    isPicked: pickedIds.has(r.itemId),
    badSeason: !!(requisition?.season && r.season && r.season !== requisition.season),
    badColor: !!(item?.color && r.color && r.color !== item.color),
    styleLabel: (r.styles || []).map((s) => (s.model ? `${s.style} | ${s.model}` : s.style)).join(", ") || "-",
  });

  const PickBtn = ({ r, isPicked }) => (
    <button
      type="button" onClick={() => pickRack(r)} disabled={isPicked}
      className={`inline-flex items-center gap-1 text-[11px] font-bold hover:underline disabled:pointer-events-none ${isPicked ? "text-green-600" : "text-[#3B9ED4]"}`}
    >
      {isPicked ? <><Check size={11} /> Picked</> : "Pick"}
    </button>
  );

  return (
    <div className="space-y-2.5">
      <button
        type="button" onClick={checkStock}
        className={`inline-flex items-center gap-1.5 text-xs font-bold hover:underline ${stockOpen ? "text-[#2E8EC4]" : "text-[#3B9ED4]"}`}
      >
        <Search size={13} /> {stockOpen ? "Hide" : "Check"} stock (rack + date wise)
      </button>

      {stockOpen && (
        loadingStock ? (
          <div className="text-xs italic text-gray-400">Checking existing stock…</div>
        ) : stockRows.length === 0 ? (
          <div className="text-xs italic text-gray-400">No available stock found for this Item Code/PDM.</div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[#D1E4F0]">
            <div className="flex flex-wrap items-center justify-between gap-2 bg-[#EEF6FC] px-3 py-2">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#2E8EC4]">
                <Boxes size={13} /> Available Stock ({stockRows.length} rack{stockRows.length > 1 ? "s" : ""})
              </div>
              <div className="text-[10px] text-gray-500">
                A different Season or Color than requested is highlighted red; picked racks green.
              </div>
            </div>

            {/* below lg: stacked cards */}
            <div className="space-y-2.5 bg-white p-2.5 lg:hidden">
              {stockRows.map((r) => {
                const { isPicked, badSeason, badColor, styleLabel } = meta(r);
                return (
                  <div
                    key={r.itemId}
                    className={`space-y-2 rounded-lg border border-[#D1E4F0] p-3 ${isPicked ? "bg-green-50/60" : badSeason || badColor ? "bg-red-50/60" : "bg-white"}`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-sm font-bold text-[#2E8EC4]"><MapPin size={12} />{r.location}</span>
                      <span className="ml-auto whitespace-nowrap text-xs font-bold text-gray-800">{r.availableRoll} Roll / {r.availableYds} Yds</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-lg bg-[#EEF6FC] px-3 py-2.5">
                      <Field label="Date" value={d(r.date)} />
                      <Field label="Buyer" value={r.buyer || "-"} />
                      <Field label="Season" value={r.season || "-"} valueClassName={badSeason && !isPicked ? "text-red-600" : ""} />
                      <Field label="Item" value={r.item || "-"} />
                      <Field label="Item Code/PDM" value={r.itemCodePdm} valueClassName="text-[#2E8EC4]" />
                      <Field label="Color" value={r.color || "-"} valueClassName={badColor && !isPicked ? "text-red-600" : ""} />
                      <div className="col-span-2"><Field label="Style | Model" value={styleLabel} /></div>
                    </div>
                    <div className="flex justify-end"><PickBtn r={r} isPicked={isPicked} /></div>
                  </div>
                );
              })}
            </div>

            {/* lg and up: full table */}
            <div className={`hidden overflow-x-auto bg-white lg:block ${scrollThin}`}>
              <table className="min-w-full text-xs">
                <thead>
                  <tr>
                    {["Date", "Buyer", "Season", "Item", "Item Code/PDM", "Color", "Style | Model", "Rack", "Available", ""].map((h, i) => (
                      <th key={h || i} className={`${th} ${i >= 8 ? "text-right" : ""}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stockRows.map((r, i) => {
                    const { isPicked, badSeason, badColor, styleLabel } = meta(r);
                    // Picked takes visual priority over the mismatch highlight.
                    const bg = isPicked ? "bg-green-50" : badSeason || badColor ? "bg-red-50" : i % 2 ? "bg-[#F7FBFE]" : "bg-white";
                    return (
                      <tr key={r.itemId} className={`border-b border-gray-100 align-top transition-colors hover:bg-[#DBEEFF] ${bg}`}>
                        <td className="whitespace-nowrap px-3 py-2.5 text-gray-600">{d(r.date)}</td>
                        <td className="px-3 py-2.5 text-gray-700">{r.buyer}</td>
                        <td className={`px-3 py-2.5 font-semibold ${badSeason && !isPicked ? "text-red-600" : "text-gray-700"}`}>{r.season}</td>
                        <td className="px-3 py-2.5 text-gray-700">{r.item}</td>
                        <td className="px-3 py-2.5 font-bold text-[#2E8EC4]">{r.itemCodePdm}</td>
                        <td className={`px-3 py-2.5 ${badColor && !isPicked ? "font-semibold text-red-600" : "text-gray-700"}`}>{r.color}</td>
                        <td className="px-3 py-2.5 text-gray-600">{styleLabel}</td>
                        <td className="whitespace-nowrap px-3 py-2.5"><span className={chip}><MapPin size={10} />{r.location}</span></td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold text-gray-800">{r.availableRoll} Roll / {r.availableYds} Yds</td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right"><PickBtn r={r} isPicked={isPicked} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* picked-rack cart */}
      <div className={`space-y-2 rounded-xl p-2.5 ${soft}`}>
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
            {picked.length === 0 ? "Pick one or more racks above to issue from" : `${picked.length} rack${picked.length > 1 ? "s" : ""} picked`}
          </div>
          {/* Live "still need X Yds" summary, updates as amounts are typed. */}
          {picked.length > 0 && (
            <span className={needChip}>{stillNeeded > 0 ? `Still need: ${stillNeeded} Yds` : "Fully covered"}</span>
          )}
        </div>

        {picked.length > 0 && (
          <div className="space-y-1.5">
            {picked.map((p) => (
              <div key={p.allocationId} className="flex flex-col gap-1.5 rounded-lg border border-[#D1E4F0] bg-white px-2.5 py-2 sm:flex-row sm:items-center">
                <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-bold text-[#2E8EC4] sm:w-20">
                  <MapPin size={11} />{p.location}
                </span>
                <div className="flex min-w-0 flex-1 items-center gap-1.5">
                  <input
                    type="number" placeholder="Roll" value={p.roll}
                    onChange={(e) => updatePicked(p.allocationId, "roll", e.target.value)}
                    className={`${inputCls} min-w-0 flex-1`}
                  />
                  <input
                    type="number" placeholder="Yds" value={p.yds}
                    onChange={(e) => updatePicked(p.allocationId, "yds", e.target.value)}
                    className={`${inputCls} min-w-0 flex-1`}
                  />
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <span className="whitespace-nowrap text-[10px] text-gray-400">max {p.availableRoll}/{p.availableYds}</span>
                  {/* Per-row badge -- the outstanding requirement sits right
                      where the amount is being typed. */}
                  <span className={needChip}>{stillNeeded > 0 ? `Need: ${stillNeeded} Yds` : "Covered"}</span>
                  <button type="button" onClick={() => removePicked(p.allocationId)} className="text-[11px] font-bold text-red-500 hover:underline">
                    Remove
                  </button>
                </div>
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <span className="text-[11px] text-gray-600">
                Total: <b className="text-gray-800">{pickedTotalRoll} Roll / {pickedTotalYds} Yds</b>
              </span>
              <button type="button" onClick={handleIssueAll} disabled={busy} className={`${btnPrimary} ml-auto !px-3 !py-1.5 !text-xs`}>
                {busy ? "Issuing…" : `Issue All (${picked.length})`}
              </button>
            </div>
          </div>
        )}

        <div className="text-[10px] leading-snug text-gray-500">
          Up to {remainingYds} Yds remaining against the {item.requestedYds} Yds requested. Roll is entirely your
          call — Cutting didn&apos;t request a Roll count. Either Roll or Yds can be left at 0 on a picked rack (e.g.
          Yds-only or Roll-only issues are fine). Only the Item Code/PDM has to match — Color is not enforced, so
          racks of a different Color can be picked too (they&apos;re highlighted above). You can also issue more than
          requested if needed (you&apos;ll be asked to confirm).
          {isDone && <span className="font-semibold text-green-600"> This item is already marked Fulfilled.</span>}
        </div>
        <ErrorBanner message={err} />
      </div>
    </div>
  );
}

/* ============================================================
   Worklist -- requisitions not yet fully fulfilled
   ============================================================ */

function WorklistItem({ req, forceOpen, onAfterOpen, onIssued }) {
  const [open, setOpen] = useState(!!forceOpen);

  useEffect(() => { if (forceOpen) { setOpen(true); onAfterOpen?.(); } }, [forceOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`${card} overflow-hidden`}>
      <button
        type="button" onClick={() => setOpen((o) => !o)}
        className={`flex w-full flex-wrap items-center gap-2 px-3 py-3 text-left transition-colors hover:bg-[#DBEEFF] sm:px-4 ${open ? "bg-[#EEF6FC]" : "bg-white"}`}
      >
        {open ? <ChevronUp size={14} className="shrink-0 text-gray-400" /> : <ChevronDown size={14} className="shrink-0 text-gray-400" />}
        <span className="break-words text-sm font-bold text-gray-800">{req.buyer}</span>
        <span className={chip}><MapPin size={10} />{req.floor}</span>
        <span className="break-words text-xs font-semibold text-gray-500">
          Style {req.style}{req.model ? ` · ${req.model}` : ""} · {req.season}
        </span>
        <span className="whitespace-nowrap text-[11px] font-medium text-gray-400">{d(req.date)}</span>
        <span className="ml-auto">{statusChip(req.status)}</span>
      </button>

      {open && (
        <div className="divide-y divide-gray-100 border-t border-gray-100">
          {req.items.map((item) => {
            // Remaining = Requested minus Issued, floored at 0 -- its own
            // labeled figure so it never has to be worked out by hand.
            const remaining = Math.max(0, Number(item.requestedYds) - Number(item.issuedYds));
            return (
              <div key={item.id} className="space-y-3 p-3 sm:p-4">
                {/* "Cutting Requested" -- everything Cutting typed in (Pcs /
                   Wastage % / Consumption), the Requested Yds derived from
                   them, what's Issued so far, and what's still Remaining. */}
                <div className={`rounded-xl px-3 py-2.5 ${soft}`}>
                  <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#2E8EC4]">
                      <ClipboardList size={13} /> Cutting Requested
                    </div>
                    {statusChip(item.status)}
                  </div>
                  <div className="grid grid-cols-1 gap-x-4 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-4">
                    <Field label="Buyer" value={req.buyer} />
                    <Field label="Floor" value={req.floor} />
                    <Field label="Season" value={req.season} />
                    <Field label="Style | Model" value={req.model ? `${req.style} | ${req.model}` : req.style} />
                    <Field label="Item Code/PDM" value={item.itemCodePdm} valueClassName="text-[#2E8EC4]" />
                    <Field label="Color" value={item.color} />
                    <Field label="Pcs" value={item.pcs} />
                    <Field label="Wastage %" value={`${item.percentage}%`} />
                    <Field label="Consumption" value={`${item.consumption} yds/pc`} />
                    <Field label="Requested Yds" value={`${item.requestedYds} Yds`} valueClassName="text-base" />
                    <Field label="Issued So Far" value={`${item.issuedRoll} Roll / ${item.issuedYds} Yds`} valueClassName="text-green-600" />
                    <Field
                      label="Remaining Yds"
                      value={`${remaining} Yds`}
                      valueClassName={`text-base ${remaining > 0 ? "text-amber-600" : "text-green-600"}`}
                    />
                  </div>
                </div>

                <IssueForm item={item} requisition={req} onIssued={onIssued} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   History tab -- cards below lg, table from lg up
   ============================================================ */

const HISTORY_HEADERS = [
  "Issued On", "Req. Date", "Buyer", "Floor", "Season", "Style | Model",
  "Item Code/PDM", "Color", "Requested Yds", "Rack", "Issued Qty",
];

function HistoryTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/cutting-issue/history`, { credentials: "include" });
        const data = await res.json();
        setRows(Array.isArray(data) ? data : []);
      } catch {
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className={`${card} overflow-hidden`}>
      <div className="flex flex-wrap items-center gap-2.5 border-b border-gray-100 bg-gray-50 px-4 py-3 sm:px-5">
        <HistoryIcon size={16} className="text-[#3B9ED4]" />
        <h2 className="text-sm font-bold text-gray-800">Issue History</h2>
        <span className="rounded-full bg-[#3B9ED4] px-2 py-0.5 text-xs font-semibold text-white">{rows.length}</span>
        <span className="ml-auto hidden text-[10px] text-gray-400 sm:inline">Newest first</span>
      </div>

      <div className={`max-h-[70vh] overflow-auto ${scrollThin}`}>
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-sm text-gray-400">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#3B9ED4]/25 border-t-[#3B9ED4]" />
            Loading issue history…
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center text-sm text-gray-400">
            <HistoryIcon size={32} className="opacity-30" />
            Nothing has been issued yet.
          </div>
        ) : (
          <>
            {/* below lg: stacked cards */}
            <div className="space-y-2.5 p-3 lg:hidden">
              {rows.map((r) => (
                <div key={r.id} className="space-y-2.5 rounded-xl border border-[#D1E4F0] bg-white p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="break-words text-sm font-bold text-gray-800">{r.buyer}</span>
                    <span className={chip}><MapPin size={10} />{r.floor}</span>
                    <span className="ml-auto whitespace-nowrap text-[11px] text-gray-400">{d(r.createdAt)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-lg bg-[#EEF6FC] px-3 py-2.5">
                    <Field label="Req. Date" value={d(r.date)} />
                    <Field label="Season" value={r.season || "-"} />
                    <Field label="Style | Model" value={`${r.style}${r.model ? ` | ${r.model}` : ""}`} />
                    <Field label="Item Code/PDM" value={r.itemCodePdm} valueClassName="text-[#2E8EC4]" />
                    <Field label="Color" value={r.color || "-"} />
                    <Field label="Requested Yds" value={`${r.requestedYds} Yds`} />
                    <Field label="Rack" value={r.location} />
                    <Field label="Issued Qty" value={`${r.rollQty} Roll / ${r.yds} Yds`} valueClassName="text-green-600" />
                  </div>
                </div>
              ))}
            </div>

            {/* lg and up: full table */}
            <table className="hidden min-w-full border-collapse text-xs lg:table">
              <thead className="sticky top-0 z-10">
                <tr>{HISTORY_HEADERS.map((h) => <th key={h} className={th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id} className={`border-b border-gray-100 transition-colors hover:bg-[#DBEEFF] ${i % 2 ? "bg-[#EEF6FC]" : "bg-white"}`}>
                    <td className="whitespace-nowrap px-3 py-2.5 text-gray-600">{d(r.createdAt)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-gray-600">{d(r.date)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-semibold text-gray-800">{r.buyer}</td>
                    <td className="whitespace-nowrap px-3 py-2.5"><span className={chip}>{r.floor}</span></td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-gray-700">{r.season}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-gray-700">{r.style}{r.model ? ` | ${r.model}` : ""}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-bold text-[#2E8EC4]">{r.itemCodePdm}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-medium text-gray-800">{r.color}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-gray-700">{r.requestedYds} Yds</td>
                    <td className="whitespace-nowrap px-3 py-2.5"><span className={chip}><MapPin size={10} />{r.location}</span></td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-semibold text-green-600">{r.rollQty} Roll / {r.yds} Yds</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   Main page
   ============================================================ */

export default function CuttingIssuePage() {
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
      const res = await fetch(`${API_URL}/cutting-issue`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load worklist");
      setWorklist(await res.json());
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/cutting-issue/notifications`, { credentials: "include" });
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
      await fetch(`${API_URL}/cutting-issue/${id}/read`, { method: "PATCH", credentials: "include" });
      fetchNotifications();
    } catch { /* ignore */ }
  };

  const refreshAll = () => { fetchWorklist(); fetchNotifications(); };

  return (
    <div className="min-h-screen bg-[#F0F4F8] font-sans">

      {/* ── Top bar (icon square, matches Material Receive / Material Stock) ── */}
      <div className="flex items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#3B9ED4] shadow-sm">
            <ClipboardList size={18} className="text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold leading-tight text-gray-800">Cutting Issue</h1>
            <p className="truncate text-[10px] text-gray-400">Issue rack stock against cutting requisitions</p>
          </div>
        </div>
        <NotificationBell
          notifications={notifications}
          unreadCount={unreadCount}
          onRefresh={fetchNotifications}
          onSelect={handleSelectNotification}
        />
      </div>

      <div className="mx-auto max-w-[1700px] space-y-4 px-3 py-4 sm:px-4 sm:py-5">

        {/* ── Info note ── */}
        <div className={`flex items-start gap-2.5 rounded-xl px-3 py-3 text-xs text-gray-600 sm:px-4 ${soft}`}>
          <Info size={15} className="mt-0.5 shrink-0 text-[#3B9ED4]" />
          <p>
            Fulfill requisitions sent by Cutting: check available rack stock for the requested Item Code/PDM, pick one
            or more racks, and issue the Yds needed. Roll is entirely your call — Cutting doesn&apos;t request a Roll count.
          </p>
        </div>

        <ErrorBanner message={error} />

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setTab("worklist")} className={tab === "worklist" ? btnPrimary : btnSecondary}>
            <PackageSearch size={14} /> Worklist
          </button>
          <button type="button" onClick={() => setTab("history")} className={tab === "history" ? btnPrimary : btnSecondary}>
            <HistoryIcon size={14} /> History
          </button>
        </div>

        {tab === "history" ? <HistoryTab />
          : loading ? (
            <div className={`${card} flex flex-col items-center justify-center gap-3 py-16 text-sm text-gray-400`}>
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#3B9ED4]/25 border-t-[#3B9ED4]" />
              Loading worklist…
            </div>
          ) : worklist.length === 0 ? (
            <div className={`${card} flex flex-col items-center justify-center gap-3 py-16 text-sm text-gray-400`}>
              <PackageSearch size={32} className="opacity-30" />
              No pending cutting requisitions.
            </div>
          ) : (
            <div className="space-y-2.5">
              {worklist.map((req) => (
                <WorklistItem
                  key={req.id}
                  req={req}
                  forceOpen={openId === req.id}
                  onAfterOpen={() => setOpenId(null)}
                  onIssued={refreshAll}
                />
              ))}
            </div>
          )}
      </div>
    </div>
  );
}
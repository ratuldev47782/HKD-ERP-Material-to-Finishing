// frontend/app/(Pages)/(Material-warehouse)/material-warehouse/cutting-issue/page.js
//
// ERP blue theme (#3B9ED4 accent, #F0F4F8 page, #C8E3F5 table headers,
// zebra rows, rounded-md chips). Pure Tailwind classes -- no inline style
// objects, no colour constants, no dark: classes, no serif.
// Data logic and API calls are unchanged; History paging/search are
// client-side over the rows /cutting-issue/history already returns.

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, Bell, Boxes, Check, ChevronDown, ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight, ChevronUp, ClipboardList, History as HistoryIcon,
  Info, MapPin, PackageSearch, Search, SlidersHorizontal,
} from "lucide-react";
import { useReactTable, getCoreRowModel, flexRender } from "@tanstack/react-table";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

/* ---------- theme (literal class strings so Tailwind can see them) ---------- */

const card = "bg-white rounded-xl border border-gray-200 shadow-sm";
const soft = "bg-[#EEF6FC] border border-[#D1E4F0]";
const input =
  "w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-800 placeholder:text-gray-400 " +
  "shadow-sm transition focus:outline-none focus:ring-2 focus:ring-[#3B9ED4]/25 focus:border-[#3B9ED4]";
const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-[#3B9ED4] px-4 py-2 text-sm font-semibold text-white " +
  "shadow-sm transition-colors hover:bg-[#2E8EC4] disabled:opacity-50 disabled:pointer-events-none";
const btnSecondary =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm " +
  "font-medium text-gray-600 transition-colors hover:border-[#3B9ED4] hover:text-[#3B9ED4] disabled:opacity-40 disabled:pointer-events-none";
const btnIcon =
  "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 " +
  "transition-colors hover:border-[#3B9ED4] hover:text-[#3B9ED4] disabled:opacity-30 disabled:pointer-events-none";
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

const PAGE_SIZES = [10, 20, 50, 100];
const COLS_KEY = "cuttingIssue:historyColumnVisibility";

const statusChip = (s) =>
  s === "fulfilled" ? <span className={chipGreen}>Fulfilled</span>
    : s === "partial" ? <span className={`${chipBase} bg-sky-50 text-sky-700`}>Partially Issued</span>
      : <span className={chipAmber}>Pending</span>;

const d = (v) => v?.slice(0, 10) || "-";

/* ---------- tiny shared bits ---------- */

const ErrorBanner = ({ message }) => message ? (
  <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5">
    <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-600" />
    <span className="break-words text-sm font-bold leading-snug text-red-700 sm:text-base">{message}</span>
  </div>
) : null;

const Field = ({ label, value, cls = "" }) => (
  <div className="min-w-0">
    <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</div>
    <div className={`truncate text-sm font-bold text-gray-800 ${cls}`}>{value}</div>
  </div>
);

const Spinner = ({ label = "Loading…" }) => (
  <div className="flex flex-col items-center justify-center gap-3 py-16 text-sm text-gray-400">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#3B9ED4]/25 border-t-[#3B9ED4]" />
    {label}
  </div>
);

const Empty = ({ icon: Icon = PackageSearch, children }) => (
  <div className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center text-sm text-gray-400">
    <Icon size={32} className="opacity-30" />
    {children}
  </div>
);

function useOutsideClose(open, onClose) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open, onClose]);
  return ref;
}

/* ---------- notification bell ---------- */

function NotificationBell({ notifications, unreadCount, onRefresh, onSelect }) {
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(open, () => setOpen(false));

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button" title="Requisition notifications"
        onClick={() => { setOpen((o) => !o); if (!open) onRefresh(); }}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 shadow-sm transition-colors hover:border-[#3B9ED4] hover:text-[#3B9ED4]"
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
          ) : notifications.map((n) => (
            <button
              key={n.id} type="button" onClick={() => { setOpen(false); onSelect(n.id); }}
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
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- issue form ----------
   "Check stock" lists every rack holding this Item Code/PDM (Color is not
   filtered or enforced -- a different Color is a valid source, it's just
   flagged red, same for a different Season). "Pick" adds a rack to the cart
   below; each picked rack gets its own Roll/Yds and "Issue All" applies them
   in one request. Stacked cards below lg, full table from lg up.
------------------------------------ */

function IssueForm({ item, requisition, onIssued }) {
  const [stockOpen, setStockOpen] = useState(false);
  const [stockRows, setStockRows] = useState([]);
  const [loadingStock, setLoadingStock] = useState(false);
  const [picked, setPicked] = useState([]); // [{allocationId, location, availableRoll, availableYds, roll, yds}]
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const remainingYds = Math.max(0, Number(item.requestedYds) - Number(item.issuedYds));
  const totalRoll = picked.reduce((s, p) => s + (Number(p.roll) || 0), 0);
  const totalYds = picked.reduce((s, p) => s + (Number(p.yds) || 0), 0);
  const pickedIds = new Set(picked.map((p) => p.allocationId));
  // Still needed AFTER what's already typed into the cart.
  const stillNeeded = Math.max(0, remainingYds - totalYds);
  const needChip = stillNeeded > 0 ? chipAmber : chipGreen;

  const checkStock = async () => {
    if (stockOpen) return setStockOpen(false);
    setStockOpen(true); setLoadingStock(true);
    try {
      // Color intentionally not sent -- only Item Code/PDM has to match.
      const res = await fetch(`${API_URL}/material-stock?itemCodePdm=${encodeURIComponent(item.itemCodePdm)}`, { credentials: "include" });
      const data = await res.json();
      setStockRows(data.rows || []);
    } catch { setStockRows([]); } finally { setLoadingStock(false); }
  };

  const pickRack = (r) => {
    setErr("");
    setPicked((p) => p.some((x) => x.allocationId === r.itemId) ? p : [...p, {
      allocationId: r.itemId, location: r.location, availableRoll: r.availableRoll, availableYds: r.availableYds, roll: "", yds: "",
    }]);
  };
  const removePicked = (id) => setPicked((p) => p.filter((x) => x.allocationId !== id));
  const updatePicked = (id, f, v) => setPicked((p) => p.map((x) => (x.allocationId === id ? { ...x, [f]: v } : x)));

  const handleIssueAll = async () => {
    setErr("");
    if (!picked.length) return setErr("Pick at least one rack first.");
    // Only reject a row where BOTH Roll and Yds are 0/blank.
    const blank = picked.find((p) => (Number(p.roll) || 0) <= 0 && (Number(p.yds) || 0) <= 0);
    if (blank) return setErr(`Enter a Roll or Yds amount for ${blank.location}.`);

    // Over-issuing is allowed (Cutting's Yds is an estimate) -- just confirm.
    if (totalYds > remainingYds) {
      const over = Math.round((totalYds - remainingYds) * 100) / 100;
      if (!window.confirm(`This issues ${totalYds} Yds, which is ${over} Yds more than the ${remainingYds} Yds still remaining on the Requisition (Requested ${item.requestedYds} Yds total). Continue anyway?`)) return;
    }

    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/cutting-issue/${item.id}/batch`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allocations: picked.map((p) => ({ allocationId: p.allocationId, rollQty: p.roll || 0, yds: p.yds || 0 })) }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || "Failed to issue");
      setPicked([]); setStockOpen(false); onIssued?.();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

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
      <button type="button" onClick={checkStock} className={`inline-flex items-center gap-1.5 text-xs font-bold hover:underline ${stockOpen ? "text-[#2E8EC4]" : "text-[#3B9ED4]"}`}>
        <Search size={13} /> {stockOpen ? "Hide" : "Check"} stock (rack + date wise)
      </button>

      {stockOpen && (loadingStock ? (
        <div className="text-xs italic text-gray-400">Checking existing stock…</div>
      ) : stockRows.length === 0 ? (
        <div className="text-xs italic text-gray-400">No available stock found for this Item Code/PDM.</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#D1E4F0]">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-[#EEF6FC] px-3 py-2">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#2E8EC4]">
              <Boxes size={13} /> Available Stock ({stockRows.length} rack{stockRows.length > 1 ? "s" : ""})
            </div>
            <div className="text-[10px] text-gray-500">A different Season or Color than requested is highlighted red; picked racks green.</div>
          </div>

          {/* below lg: cards */}
          <div className="space-y-2.5 bg-white p-2.5 lg:hidden">
            {stockRows.map((r) => {
              const { isPicked, badSeason, badColor, styleLabel } = meta(r);
              return (
                <div key={r.itemId} className={`space-y-2 rounded-lg border border-[#D1E4F0] p-3 ${isPicked ? "bg-green-50/60" : badSeason || badColor ? "bg-red-50/60" : "bg-white"}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-sm font-bold text-[#2E8EC4]"><MapPin size={12} />{r.location}</span>
                    <span className="ml-auto whitespace-nowrap text-xs font-bold text-gray-800">{r.availableRoll} Roll / {r.availableYds} Yds</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-lg bg-[#EEF6FC] px-3 py-2.5">
                    <Field label="Date" value={d(r.date)} />
                    <Field label="Buyer" value={r.buyer || "-"} />
                    <Field label="Season" value={r.season || "-"} cls={badSeason && !isPicked ? "text-red-600" : ""} />
                    <Field label="Item" value={r.item || "-"} />
                    <Field label="Item Code/PDM" value={r.itemCodePdm} cls="text-[#2E8EC4]" />
                    <Field label="Color" value={r.color || "-"} cls={badColor && !isPicked ? "text-red-600" : ""} />
                    <div className="col-span-2"><Field label="Style | Model" value={styleLabel} /></div>
                  </div>
                  <div className="flex justify-end"><PickBtn r={r} isPicked={isPicked} /></div>
                </div>
              );
            })}
          </div>

          {/* lg and up: table */}
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
                  // Picked wins over the mismatch highlight.
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
      ))}

      {/* picked-rack cart */}
      <div className={`space-y-2 rounded-xl p-2.5 ${soft}`}>
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
            {picked.length ? `${picked.length} rack${picked.length > 1 ? "s" : ""} picked` : "Pick one or more racks above to issue from"}
          </div>
          {picked.length > 0 && <span className={needChip}>{stillNeeded > 0 ? `Still need: ${stillNeeded} Yds` : "Fully covered"}</span>}
        </div>

        {picked.length > 0 && (
          <div className="space-y-1.5">
            {picked.map((p) => (
              <div key={p.allocationId} className="flex flex-col gap-1.5 rounded-lg border border-[#D1E4F0] bg-white px-2.5 py-2 sm:flex-row sm:items-center">
                <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-bold text-[#2E8EC4] sm:w-20"><MapPin size={11} />{p.location}</span>
                <div className="flex min-w-0 flex-1 items-center gap-1.5">
                  <input type="number" placeholder="Roll" value={p.roll} onChange={(e) => updatePicked(p.allocationId, "roll", e.target.value)} className={`${input} min-w-0 flex-1`} />
                  <input type="number" placeholder="Yds" value={p.yds} onChange={(e) => updatePicked(p.allocationId, "yds", e.target.value)} className={`${input} min-w-0 flex-1`} />
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <span className="whitespace-nowrap text-[10px] text-gray-400">max {p.availableRoll}/{p.availableYds}</span>
                  <span className={needChip}>{stillNeeded > 0 ? `Need: ${stillNeeded} Yds` : "Covered"}</span>
                  <button type="button" onClick={() => removePicked(p.allocationId)} className="text-[11px] font-bold text-red-500 hover:underline">Remove</button>
                </div>
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <span className="text-[11px] text-gray-600">Total: <b className="text-gray-800">{totalRoll} Roll / {totalYds} Yds</b></span>
              <button type="button" onClick={handleIssueAll} disabled={busy} className={`${btnPrimary} ml-auto !px-3 !py-1.5 !text-xs`}>
                {busy ? "Issuing…" : `Issue All (${picked.length})`}
              </button>
            </div>
          </div>
        )}

        <div className="text-[10px] leading-snug text-gray-500">
          Up to {remainingYds} Yds remaining against the {item.requestedYds} Yds requested. Roll is entirely your call.
          Either Roll or Yds can be left at 0 on a picked rack. Only the Item Code/PDM has to match — Color is not
          enforced. Issuing more than requested is allowed (you&apos;ll be asked to confirm).
          {item.status === "fulfilled" && <span className="font-semibold text-green-600"> This item is already marked Fulfilled.</span>}
        </div>
        <ErrorBanner message={err} />
      </div>
    </div>
  );
}

/* ---------- worklist ---------- */

const reqFields = (req, item) => [
  ["Buyer", req.buyer], ["Floor", req.floor], ["Season", req.season],
  ["Style | Model", req.model ? `${req.style} | ${req.model}` : req.style],
  ["Item Code/PDM", item.itemCodePdm, "text-[#2E8EC4]"], ["Color", item.color],
  ["Pcs", item.pcs], ["Wastage %", `${item.percentage}%`], ["Consumption", `${item.consumption} yds/pc`],
  ["Requested Yds", `${item.requestedYds} Yds`, "text-base"],
  ["Issued So Far", `${item.issuedRoll} Roll / ${item.issuedYds} Yds`, "text-green-600"],
];

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
            const remaining = Math.max(0, Number(item.requestedYds) - Number(item.issuedYds));
            return (
              <div key={item.id} className="space-y-3 p-3 sm:p-4">
                <div className={`rounded-xl px-3 py-2.5 ${soft}`}>
                  <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#2E8EC4]">
                      <ClipboardList size={13} /> Cutting Requested
                    </div>
                    {statusChip(item.status)}
                  </div>
                  <div className="grid grid-cols-1 gap-x-4 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-4">
                    {reqFields(req, item).map(([label, value, cls]) => <Field key={label} label={label} value={value} cls={cls} />)}
                    <Field label="Remaining Yds" value={`${remaining} Yds`} cls={`text-base ${remaining > 0 ? "text-amber-600" : "text-green-600"}`} />
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

/* ---------- history ----------
   Columns picker (saved to localStorage) + client-side search and paging
   over what /cutting-issue/history returns. Cards below lg, table from lg up.
------------------------------- */

const HCOLS = [
  ["issuedOn", "Issued On", (r) => <span className="text-gray-600">{d(r.createdAt)}</span>],
  ["reqDate", "Req. Date", (r) => <span className="text-gray-600">{d(r.date)}</span>],
  ["buyer", "Buyer", (r) => <span className="font-semibold text-gray-800">{r.buyer}</span>],
  ["floor", "Floor", (r) => <span className={chip}>{r.floor}</span>],
  ["season", "Season", (r) => r.season],
  ["styleModel", "Style | Model", (r) => `${r.style}${r.model ? ` | ${r.model}` : ""}`],
  ["itemCodePdm", "Item Code/PDM", (r) => <span className="font-bold text-[#2E8EC4]">{r.itemCodePdm}</span>],
  ["color", "Color", (r) => <span className="font-medium text-gray-800">{r.color}</span>],
  ["requestedYds", "Requested Yds", (r) => `${r.requestedYds} Yds`],
  ["rack", "Rack", (r) => <span className={chip}><MapPin size={10} />{r.location}</span>],
  ["issuedQty", "Issued Qty", (r) => <span className="font-semibold text-green-600">{r.rollQty} Roll / {r.yds} Yds</span>],
];

function HistoryTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [columnVisibility, setColumnVisibility] = useState({});
  const [colsOpen, setColsOpen] = useState(false);
  const colsRef = useOutsideClose(colsOpen, () => setColsOpen(false));

  useEffect(() => {
    try { setColumnVisibility(JSON.parse(window.localStorage.getItem(COLS_KEY)) || {}); } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    try { window.localStorage.setItem(COLS_KEY, JSON.stringify(columnVisibility)); } catch { /* ignore */ }
  }, [columnVisibility]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/cutting-issue/history`, { credentials: "include" });
        const data = await res.json();
        setRows(Array.isArray(data) ? data : []);
      } catch { setRows([]); } finally { setLoading(false); }
    })();
  }, []);

  useEffect(() => { setPage(1); }, [search, pageSize]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => [r.buyer, r.floor, r.season, r.style, r.model, r.itemCodePdm, r.color, r.location]
      .some((v) => v && String(v).toLowerCase().includes(q)));
  }, [rows, search]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = useMemo(() => filtered.slice((safePage - 1) * pageSize, safePage * pageSize), [filtered, safePage, pageSize]);

  const columns = useMemo(() => HCOLS.map(([id, header, render]) => ({
    id, header, cell: ({ row }) => render(row.original),
  })), []);

  const table = useReactTable({
    data: pageRows, columns, state: { columnVisibility },
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (r) => String(r.id),
  });

  const goTo = (p) => { if (p >= 1 && p <= totalPages && p !== safePage) setPage(p); };

  return (
    <div className={`${card} flex flex-col overflow-hidden`}>
      <div className="flex shrink-0 flex-wrap items-center gap-x-2.5 gap-y-2 border-b border-gray-100 bg-gray-50 px-4 py-3 sm:px-5">
        <HistoryIcon size={16} className="text-[#3B9ED4]" />
        <h2 className="text-sm font-bold text-gray-800">Issue History</h2>
        <span className="rounded-full bg-[#3B9ED4] px-2 py-0.5 text-xs font-semibold text-white">{total}</span>
        <span className="ml-auto hidden text-[10px] text-gray-400 sm:inline">Newest first</span>

        <div className="relative ml-auto sm:ml-0" ref={colsRef}>
          <button type="button" onClick={() => setColsOpen((o) => !o)} className={btnSecondary}>
            <SlidersHorizontal size={14} /> Columns
          </button>
          {colsOpen && (
            <div className="absolute right-0 top-full z-30 mt-1.5 w-52 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-3 py-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Show/Hide</span>
                <button type="button" onClick={() => setColumnVisibility({})} className="text-[10px] font-semibold text-[#3B9ED4] hover:underline">All</button>
              </div>
              <div className={`max-h-64 overflow-y-auto py-1 ${scrollThin}`}>
                {table.getAllLeafColumns().map((c) => (
                  <label key={c.id} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs text-gray-700 transition-colors hover:bg-[#EEF6FC]">
                    <input type="checkbox" checked={c.getIsVisible()} onChange={c.getToggleVisibilityHandler()} className="rounded accent-[#3B9ED4]" />
                    {c.columnDef.header}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 border-b border-gray-100 bg-gray-50/60 px-4 py-3 sm:px-5">
        <label className="block max-w-xs">
          <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-gray-400">Search</span>
          <div className="relative">
            <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Buyer, style, item code, color, rack…"
              className={`${input} !pl-6 ${search ? "!border-[#3B9ED4]/60 !bg-[#EEF6FC]" : ""}`}
            />
          </div>
        </label>
      </div>

      <div className={`max-h-[70vh] min-h-0 overflow-auto ${scrollThin}`}>
        {loading ? <Spinner label="Loading issue history…" />
          : !pageRows.length ? <Empty icon={HistoryIcon}>Nothing has been issued yet.</Empty>
            : (
              <>
                <div className="space-y-2.5 p-3 lg:hidden">
                  {pageRows.map((r) => (
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
                        <Field label="Item Code/PDM" value={r.itemCodePdm} cls="text-[#2E8EC4]" />
                        <Field label="Color" value={r.color || "-"} />
                        <Field label="Requested Yds" value={`${r.requestedYds} Yds`} />
                        <Field label="Rack" value={r.location} />
                        <Field label="Issued Qty" value={`${r.rollQty} Roll / ${r.yds} Yds`} cls="text-green-600" />
                      </div>
                    </div>
                  ))}
                </div>

                <table className="hidden min-w-full border-collapse text-xs lg:table">
                  <thead className="sticky top-0 z-10">
                    {table.getHeaderGroups().map((hg) => (
                      <tr key={hg.id}>
                        {hg.headers.map((h) => (
                          <th key={h.id} className={th}>{flexRender(h.column.columnDef.header, h.getContext())}</th>
                        ))}
                      </tr>
                    ))}
                  </thead>
                  <tbody>
                    {table.getRowModel().rows.map((row, i) => (
                      <tr key={row.id} className={`border-b border-gray-100 transition-colors hover:bg-[#DBEEFF] ${i % 2 ? "bg-[#EEF6FC]" : "bg-white"}`}>
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className="whitespace-nowrap px-3 py-2.5 align-top text-gray-700">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-gray-100 bg-gray-50 px-4 py-3 text-xs text-gray-500 sm:px-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="whitespace-nowrap font-medium">Page {safePage} of {totalPages} · {total.toLocaleString()} total</span>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline">Rows per page</span>
            <select
              value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}
              className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#3B9ED4]/25"
            >
              {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" title="First" className={btnIcon} onClick={() => goTo(1)} disabled={safePage <= 1}><ChevronsLeft size={13} /></button>
          <button type="button" title="Prev" className={btnIcon} onClick={() => goTo(safePage - 1)} disabled={safePage <= 1}><ChevronLeft size={13} /></button>
          <span className="whitespace-nowrap rounded-lg bg-[#3B9ED4] px-3 py-1 text-xs font-bold text-white">{safePage} / {totalPages}</span>
          <button type="button" title="Next" className={btnIcon} onClick={() => goTo(safePage + 1)} disabled={safePage >= totalPages}><ChevronRight size={13} /></button>
          <button type="button" title="Last" className={btnIcon} onClick={() => goTo(totalPages)} disabled={safePage >= totalPages}><ChevronsRight size={13} /></button>
        </div>
      </div>
    </div>
  );
}

/* ---------- page ---------- */

export default function CuttingIssuePage() {
  const [tab, setTab] = useState("worklist");
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
    } catch (e) { setError(e.message); } finally { setLoading(false); }
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
    setTab("worklist"); setOpenId(id);
    try {
      await fetch(`${API_URL}/cutting-issue/${id}/read`, { method: "PATCH", credentials: "include" });
      fetchNotifications();
    } catch { /* ignore */ }
  };

  const refreshAll = () => { fetchWorklist(); fetchNotifications(); };

  return (
    <div className="min-h-screen bg-[#F0F4F8] font-sans">
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
        <NotificationBell notifications={notifications} unreadCount={unreadCount} onRefresh={fetchNotifications} onSelect={handleSelectNotification} />
      </div>

      <div className="mx-auto max-w-[1700px] space-y-4 px-3 py-4 sm:px-4 sm:py-5">
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
          : loading ? <div className={card}><Spinner label="Loading worklist…" /></div>
            : !worklist.length ? <div className={card}><Empty>No pending cutting requisitions.</Empty></div>
              : (
                <div className="space-y-2.5">
                  {worklist.map((req) => (
                    <WorklistItem key={req.id} req={req} forceOpen={openId === req.id} onAfterOpen={() => setOpenId(null)} onIssued={refreshAll} />
                  ))}
                </div>
              )}
      </div>
    </div>
  );
}
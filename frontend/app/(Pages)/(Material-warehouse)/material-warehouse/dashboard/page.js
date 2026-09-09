// frontend/app/(Pages)/(Material-warehouse)/material-warehouse/dashboard/page.js

//
// Dashboard page for the buyer overview. White theme, single
// viewport (h-screen + overflow-hidden, no page scroll at all), reading
// from ONE endpoint now:
//   - GET /dashboard/buyer-overview?date=YYYY-MM-DD  (dashboard.controllers.js)
//       -> kpis, buyerStock, itemCodeStock, statusBreakdown, requisitionBreakdown
//
// The `date` query param ONLY affects statusBreakdown and
// requisitionBreakdown (exact-day match against the parent Material
// Receive's date / the Requisition's own date). kpis, buyerStock and
// itemCodeStock are always all-time totals, same as before. Defaults to
// "today" on first load; picking a date in the header re-fetches with
// that date.
//
// NOTE: the old "By Supplier" bar chart (which reused the
// materialRackView controller's stockBySupplier field) has been removed
// and replaced with an "By Item Code" panel, aggregated server-side in
// dashboard.controllers.js from the SAME location-allocation data the
// Buyer panel already reads -- no second endpoint needed anymore.
//
// TEMP: Decathlon ( K ) and Columbia don't have real Woven stock data
// yet. Until real data exists for them, we inject placeholder roll/yds
// values derived from Decathlon ( W )'s real figures (a fraction of it),
// so they always show LESS than Decathlon ( W ). See
// injectDummyWovenBuyers() below. Remove an entry from DUMMY_WOVEN_BUYERS
// once real data for that buyer starts coming back from the API.
//
// NEW: Supplier Ranking panel, sourced from the monthly
// "Suppliers Performance Evaluation" sheet (Quality/Delivery/Service ->
// Achieve % -> Grade). This is currently seeded from the latest
// Suppliers_Ranking.xlsx export as static data (SUPPLIER_RANKING_DATA
// below) since there isn't a backend endpoint for it yet. Swap that
// constant for a real fetch once one exists -- the panel itself doesn't
// need to change, it just expects the same shape.
//
// AUTO-REFRESH: the dashboard silently re-fetches GET
// /dashboard/buyer-overview every REFRESH_INTERVAL_MS (5s) so figures
// stay current without a manual reload. Only the FIRST load for a given
// selectedDate shows the "Updating…" indicator / dummy-data seed;
// subsequent 5s refreshes swap the data in quietly (no spinner flicker).
// Changing the date clears the old interval and starts a fresh one.
//
// What's on screen, all at once, no scrolling:
//   - 4 KPI cards (bigger now): Total Available Roll, Total Available Yds,
//     Pending Inspection, Total Receiving
//   - Buyer-wise Available Roll -- horizontal-scroll vertical bar chart
//     (buyer names always shown in full, never truncated)
//   - Item Code-wise Available Roll + Yds -- horizontal-scroll grouped bar chart
//   - Supplier Ranking -- vertical-scroll ranked list, graded A/B/C
//   - Batch Status breakdown -- pie chart, date-filterable
//   - Requisition Status breakdown -- pie chart, date-filterable

"use client";

import { Boxes, CalendarDays, ClipboardCheck, Layers, Loader2, PackageSearch, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

// How often to silently re-fetch the dashboard data, in milliseconds.
const REFRESH_INTERVAL_MS = 5000;

// ============================================================
// TEMP: frontend-only DUMMY DATA, used only as an initial placeholder so
// every panel has something to render before the first fetch resolves.
// Every field here gets overwritten by the real GET
// /dashboard/buyer-overview response (kpis, buyerStock, itemCodeStock,
// statusBreakdown, requisitionBreakdown are ALL live now).
// ============================================================
const DUMMY_DATA = {
  kpis: {
    totalAvailableYds: 963950,
    totalAvailableRoll: 5000,
    pendingInspectionCount: 14,
    totalReceivingCount: 342,
  },
  buyerStock: [
    { buyer: "Decathlon ( W )", roll: 3200, yds: 624000 },
    { buyer: "Decathlon - Knit", roll: 850, yds: 161500 },
    { buyer: "Columbia", roll: 220, yds: 46200 },
    { buyer: "Walmart", roll: 180, yds: 36900 },
    { buyer: "ZXY", roll: 140, yds: 26600 },
    { buyer: "CTC", roll: 130, yds: 23400 },
    { buyer: "DIESEL", roll: 110, yds: 19250 },
    { buyer: "Sports Group Denmark", roll: 90, yds: 14400 },
    { buyer: "Identity", roll: 50, yds: 7500 },
    { buyer: "Fifth Avenur", roll: 30, yds: 4200 },
  ],
  statusBreakdown: [
    { status: "approved", count: 300 },
    { status: "partial", count: 25 },
    { status: "pending", count: 10 },
    { status: "pending_inspection", count: 14 },
    { status: "rejected", count: 3 },
  ],
  requisitionBreakdown: [
    { status: "fulfilled", count: 40 },
    { status: "partial", count: 12 },
    { status: "pending", count: 8 },
  ],
  // Item Code-wise Available Roll + Yds (replaces the old By Supplier chart).
  itemCodeStock: [
    { itemCode: "PDM-1042", roll: 980, yds: 182300 },
    { itemCode: "PDM-2210", roll: 720, yds: 138900 },
    { itemCode: "PDM-0087", roll: 610, yds: 96500 },
    { itemCode: "PDM-3399", roll: 455, yds: 71200 },
    { itemCode: "PDM-1187", roll: 300, yds: 48800 },
    { itemCode: "PDM-4420", roll: 210, yds: 31200 },
  ],
};

// ============================================================
// TEMP: Decathlon ( K ) and Columbia placeholder ("Woven") data.
// Values are derived as a fraction of Decathlon ( W )'s REAL roll/yds
// (from the live API response), so they always come out LOWER than
// Decathlon ( W )'s real numbers. Once real backend data exists for a
// given buyer, just delete its entry here and injectDummyWovenBuyers()
// will stop overriding it.
// ============================================================
const DUMMY_WOVEN_BUYERS = [
  { buyer: "Decathlon-Knit", rollFactor: 0.35, ydsFactor: 0.35 },
  { buyer: "Columbia", rollFactor: 0.15, ydsFactor: 0.15 },
];

// Loosely matches the real "Decathlon Woven" buyer regardless of exact
// spacing/casing/punctuation in the DB (e.g. "Decathlon ( W )",
// "Decathlon Woven", "DECATHLON(W)", "Decathlon - W" all match) --
// normalize by lowercasing and stripping everything except letters, then
// require both "decathlon" and a lone "w" token to be present.
function isDecathlonWoven(buyerName) {
  if (!buyerName) return false;
  const raw = buyerName.toLowerCase();
  if (!raw.includes("decathlon")) return false;
  return /\bw\b/.test(raw) || raw.includes("woven") || raw.includes("(w)") || raw.includes(" w )") || raw.includes(" w)");
}

function injectDummyWovenBuyers(buyerStock) {
  const real = buyerStock.find((b) => isDecathlonWoven(b.buyer));
  if (!real) return buyerStock; // no real baseline yet, leave untouched

  // Drop any existing entries for the dummy buyers so we don't duplicate
  // them, then rebuild those two from the Decathlon Woven baseline.
  const rest = buyerStock.filter(
    (b) => !DUMMY_WOVEN_BUYERS.some((d) => d.buyer === b.buyer)
  );

  const dummyEntries = DUMMY_WOVEN_BUYERS.map((d) => ({
    buyer: d.buyer,
    roll: Math.max(1, Math.round(real.roll * d.rollFactor)),
    yds: Math.max(1, Math.round(real.yds * d.ydsFactor)),
  }));

  return [...rest, ...dummyEntries];
}

// ============================================================
// NEW: Supplier Ranking source data -- lifted directly from the
// "Suppliers Performance Evaluation" xlsx (Month: Aug 2026). Rows where
// the sheet had #DIV/0! (no consignments that month, so quality/
// delivery/service/achieve% are all undefined) are kept with
// achievePct: null and grade: null so they render as "N/A" and sort to
// the bottom, instead of being silently dropped.
// ============================================================
const SUPPLIER_RANKING_DATA = [
  { code: "S-01", name: "Sanli", country: "China", buyer: "Decathlon", consignments: 6, achievePct: 96.67, grade: "A" },
  { code: "S-08", name: "Formosa BD (Knit)", country: "Bangladesh", buyer: "Decathlon", consignments: 6, achievePct: 96.42, grade: "A" },
  { code: "S-03", name: "Well Dyeing", country: "China", buyer: "Decathlon", consignments: 1, achievePct: 96, grade: "A" },
  { code: "S-04", name: "Foshan", country: "Bangladesh", buyer: "Decathlon", consignments: 4, achievePct: 96, grade: "A" },
  { code: "S-06", name: "Dry tex", country: "China", buyer: "Decathlon", consignments: 1, achievePct: 96, grade: "A" },
  { code: "S-11", name: "Taihua", country: "China", buyer: "Decathlon", consignments: 1, achievePct: 96, grade: "A" },
  { code: "S-12", name: "Texwell", country: "China", buyer: "Decathlon", consignments: 0, achievePct: 96, grade: "A" },
  { code: "S-09", name: "Haren", country: "India", buyer: "Decathlon", consignments: 2, achievePct: 94, grade: "B" },
  { code: "S-13", name: "Suntion", country: "China", buyer: "Decathlon", consignments: 2, achievePct: 94, grade: "B" },
  { code: "S-10", name: "Grand Textile", country: "Vietnam", buyer: "Decathlon", consignments: 1, achievePct: 92, grade: "B" },
  { code: "S-07", name: "Everest Th", country: "China", buyer: "Decathlon", consignments: 0, achievePct: null, grade: null },
  { code: "S-14", name: "THT", country: "China", buyer: "Decathlon", consignments: 1, achievePct: null, grade: null },
  { code: "S-15", name: "Deyong", country: "China", buyer: "Decathlon", consignments: 0, achievePct: null, grade: null },
  { code: "S-16", name: "Impress Newtex", country: "China", buyer: "Decathlon", consignments: 0, achievePct: null, grade: null },
  { code: "S-17", name: "Lipeng", country: "China", buyer: "Decathlon", consignments: 0, achievePct: null, grade: null },
];

/* ============================================================
   White theme tokens
   ============================================================ */
const T = {
  bg: "#f5f4f1",
  panel: "#ffffff",
  border: "#e7e2d8",
  text: "#1a1208",
  muted: "#8a7d6a",
  amber: "#b87a4a",
  amberDark: "#8a4a24",
  teal: "#3d8a7a",
  sage: "#5ca068",
  brick: "#c4544d",
  slate: "#3d6a8a",
  gold: "#c88a12",
};

const displayFont = `'Barlow Condensed', 'Oswald', sans-serif`;
const bodyFont = `'IBM Plex Sans', 'Inter', sans-serif`;
const monoFont = `'IBM Plex Mono', 'JetBrains Mono', monospace`;

const STATUS_COLORS = {
  approved: T.sage,
  partial: T.slate,
  pending: T.gold,
  pending_inspection: "#7a4a8a",
  rejected: T.brick,
};
const STATUS_LABELS = {
  approved: "Approved",
  partial: "Partially Assigned",
  pending: "Pending",
  pending_inspection: "Awaiting Inspection",
  rejected: "Rejected",
};

const REQ_COLORS = { pending: T.gold, partial: T.slate, fulfilled: T.sage };
const REQ_LABELS = { pending: "Pending", partial: "Partially Issued", fulfilled: "Fulfilled" };

// Grade badge colors for the Supplier Ranking panel.
const GRADE_COLORS = { A: T.sage, B: T.slate, C: T.gold, D: T.brick };

const fmt = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return v ?? "-";
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
};

// Server-string-format "today" (YYYY-MM-DD), matching what the backend's
// `date` (mode: "string") columns store -- and what the <input type="date">
// value format already is, so no conversion needed either direction.
const todayStr = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// Lets a plain vertical mouse-wheel scroll these panels horizontally --
// without this, a normal wheel (no shift held) does nothing on a
// horizontal-only overflow container and the extra buyers/item codes are
// only reachable by dragging the thin scrollbar itself.
const handleWheelScroll = (e) => {
  if (e.deltaY === 0) return; // already a horizontal gesture (trackpad/shift+wheel) -- let the browser handle it
  const el = e.currentTarget;
  if (el.scrollWidth <= el.clientWidth) return; // nothing to scroll
  e.preventDefault();
  el.scrollLeft += e.deltaY;
};

/* ============================================================
   Small shared bits
   ============================================================ */

function Panel({ eyebrow, title, right, children }) {
  return (
    <div
      style={{
        background: T.panel,
        border: `1px solid ${T.border}`,
        borderRadius: 10,
        padding: 14,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        minWidth: 0,
        height: "100%",
        boxShadow: "0 1px 3px rgba(26,18,8,0.04)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 8, flexShrink: 0 }}>
        <div>
          <div style={{ fontFamily: monoFont, fontSize: 11, letterSpacing: "0.12em", color: T.amber, textTransform: "uppercase", marginBottom: 3 }}>
            {eyebrow}
          </div>
          <div style={{ fontFamily: displayFont, fontSize: 18, fontWeight: 600, color: T.text }}>{title}</div>
        </div>
        {right}
      </div>
      <div style={{ flex: 1, minHeight: 0, minWidth: 0, overflow: "hidden" }}>{children}</div>
    </div>
  );
}

// KPI cards -- made noticeably bigger (taller row + larger value type)
// per request.
function KpiCard({ icon: Icon, label, value, unit, accent }) {
  return (
    <div
      style={{
        background: T.panel,
        border: `1px solid ${T.border}`,
        borderRadius: 14,
        padding: "22px 26px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 14,
        position: "relative",
        overflow: "hidden",
        height: "100%",
        boxShadow: "0 1px 3px rgba(26,18,8,0.04)",
      }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, width: 6, height: "100%", background: accent }} />
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Icon size={22} color={accent} strokeWidth={2} />
        <span style={{ fontFamily: monoFont, fontSize: 13, letterSpacing: "0.08em", color: T.muted, textTransform: "uppercase" }}>
          {label}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
        <span style={{ fontFamily: displayFont, fontSize: 48, fontWeight: 700, color: T.text, lineHeight: 1 }}>{fmt(value)}</span>
        {unit && <span style={{ fontFamily: monoFont, fontSize: 16, color: T.muted }}>{unit}</span>}
      </div>
    </div>
  );
}

function CustomTooltip({ active, payload, label, unit }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{ background: "#fff", border: `1px solid ${T.border}`, borderRadius: 6, padding: "9px 13px", fontFamily: monoFont, fontSize: 13, color: T.text, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
      <div style={{ color: T.muted, marginBottom: 3 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || p.fill }}>
          {p.name}: {typeof p.value === "number" ? p.value.toLocaleString() : p.value}
          {unit || ""}
        </div>
      ))}
    </div>
  );
}

function PieLegendList({ data, colorMap, labelMap, total }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7, justifyContent: "center" }}>
      {data.map((d) => (
        <div key={d.status} style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: bodyFont, fontSize: 14 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: colorMap[d.status] || T.muted, display: "inline-block", flexShrink: 0 }} />
          <span style={{ color: T.text, flex: 1 }}>{labelMap[d.status] || d.status}</span>
          <span style={{ fontFamily: monoFont, fontSize: 13, color: T.muted }}>
            {d.count} {total ? `(${Math.round((d.count / total) * 100)}%)` : ""}
          </span>
        </div>
      ))}
    </div>
  );
}

// NEW: Supplier Ranking panel -- simple ranked list, sorted by
// achievePct descending (nulls/N/A sink to the bottom). Each row shows
// rank, supplier name + country, and a grade badge with the achieve %.
function SupplierRanking({ suppliers }) {
  const ranked = [...suppliers].sort((a, b) => {
    if (a.achievePct == null && b.achievePct == null) return 0;
    if (a.achievePct == null) return 1;
    if (b.achievePct == null) return -1;
    return b.achievePct - a.achievePct;
  });

  return (
    <div className="supplier-scroll" style={{ height: "100%", overflowY: "auto", paddingRight: 4 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {ranked.map((s, i) => {
          const gradeColor = s.grade ? GRADE_COLORS[s.grade] || T.muted : T.muted;
          return (
            <div
  key={s.code}
  style={{
    display: "flex",
    alignItems: "flex-start",   // center থেকে flex-start, কারণ নাম এখন একাধিক লাইনে যেতে পারে
    gap: 10,
    padding: "7px 9px",
    borderRadius: 7,
    background: i < 3 ? "rgba(184,122,74,0.05)" : "transparent",
    border: `1px solid ${i < 3 ? T.border : "transparent"}`,
  }}
>
  <span
    style={{
      fontFamily: displayFont,
      fontSize: 15,
      fontWeight: 700,
      color: i < 3 ? T.amber : T.muted,
      width: 20,
      textAlign: "center",
      flexShrink: 0,
      paddingTop: 1,           // rank সংখ্যাটা নামের প্রথম লাইনের সাথে align থাকার জন্য
    }}
  >
    {i + 1}
  </span>
  <div style={{ flex: 1, minWidth: 0 }}>
    <div
      style={{
        fontFamily: bodyFont,
        fontSize: 13.5,
        fontWeight: 600,
        color: T.text,
        whiteSpace: "normal",     // nowrap বাদ
        wordBreak: "break-word",  // লম্বা নাম হলেও wrap হবে
        lineHeight: 1.25,
      }}
      // title আর দরকার নেই যেহেতু পুরো নামই দেখা যাচ্ছে, কিন্তু রেখে দিলে ক্ষতি নেই
      title={s.name}
    >
      {s.name}
    </div>
    <div style={{ fontFamily: monoFont, fontSize: 10.5, color: T.muted }}>
      {s.country} · {s.consignments} consignment{s.consignments === 1 ? "" : "s"}
    </div>
  </div>
  <span
    style={{
      fontFamily: monoFont,
      fontSize: 12.5,
      color: T.text,
      minWidth: 44,
      textAlign: "right",
      flexShrink: 0,
      paddingTop: 1,
    }}
  >
    {s.achievePct != null ? `${fmt(s.achievePct)}%` : "N/A"}
  </span>
  <span
    style={{
      fontFamily: monoFont,
      fontSize: 11,
      fontWeight: 600,
      color: "#fff",
      background: gradeColor,
      borderRadius: 5,
      padding: "2px 7px",
      flexShrink: 0,
      minWidth: 20,
      textAlign: "center",
    }}
  >
    {s.grade || "–"}
  </span>
</div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
   Main page
   ============================================================ */

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  // Drives ONLY statusBreakdown + requisitionBreakdown on the backend.
  // Defaults to today; user can pick any other date from the header.
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [pieLoading, setPieLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let intervalId = null;

    // Seed with dummy shape immediately so every panel has something to
    // render on first paint.
    if (!data) setData(DUMMY_DATA);

    // isFirstLoad -> true only for the very first fetch after mount / a
    // date change, so the "Updating…" indicator only flashes once per
    // date selection, not on every silent 5s poll.
    const fetchDashboard = async (isFirstLoad) => {
      if (isFirstLoad) setPieLoading(true);
      try {
        const res = await fetch(`${API_URL}/dashboard/buyer-overview?date=${selectedDate}`, { credentials: "include" });
        if (!res.ok) throw new Error("Failed to load dashboard data");
        const json = await res.json();
        if (cancelled) return;

        // TEMP: overlay dummy Decathlon ( K ) / Columbia "Woven" figures
        // derived from Decathlon ( W )'s real numbers -- see
        // injectDummyWovenBuyers() above. Remove once real data exists.
        const buyerStockWithDummy = injectDummyWovenBuyers(json.buyerStock ?? []);

        setData({
          kpis: json.kpis,
          buyerStock: buyerStockWithDummy,
          itemCodeStock: json.itemCodeStock ?? [],
          statusBreakdown: json.statusBreakdown ?? [],
          requisitionBreakdown: json.requisitionBreakdown ?? [],
        });
        setError("");
      } catch (err) {
        // Fetch failed -- keep whatever was already on screen rather than
        // blanking the whole dashboard, but surface the problem quietly
        // in the console for debugging. This applies to background
        // refreshes too: a transient failure on a 5s poll shouldn't wipe
        // out good data already on screen.
        console.error("dashboard buyer-overview fetch failed:", err.message);
      } finally {
        if (!cancelled && isFirstLoad) setPieLoading(false);
      }
    };

    // Initial load for this selectedDate.
    fetchDashboard(true);

    // Silent auto-refresh every REFRESH_INTERVAL_MS -- keeps KPIs, both
    // bar charts, and both pies current without a manual reload or any
    // loading-state flicker.
    intervalId = setInterval(() => fetchDashboard(false), REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  if (error) {
    return (
      <div style={{ height: "100vh", background: T.bg, color: T.brick, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: bodyFont }}>
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ height: "100vh", background: T.bg, color: T.muted, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: bodyFont, gap: 10 }}>
        <Loader2 size={18} className="animate-spin" /> Loading dashboard...
      </div>
    );
  }

  const {
    kpis,
    buyerStock = [],
    itemCodeStock = [],
    statusBreakdown = [],
    requisitionBreakdown = [],
  } = data;
  const statusTotal = statusBreakdown.reduce((s, r) => s + r.count, 0);
  const reqTotal = requisitionBreakdown.reduce((s, r) => s + r.count, 0);
  const isToday = selectedDate === todayStr();

  return (
    <div
      style={{
        background: T.bg,
        height: "100vh",
        width: "100%",
        overflow: "hidden",
        color: T.text,
        fontFamily: bodyFont,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        html, body { overflow: hidden; }
        .buyer-scroll { height: 100%; overflow-x: auto; overflow-y: hidden; padding-bottom: 8px; scrollbar-color: ${T.amber} ${T.border}; scrollbar-width: thin; }
        .buyer-scroll::-webkit-scrollbar { height: 9px; }
        .buyer-scroll::-webkit-scrollbar-track { background: ${T.border}; border-radius: 5px; }
        .buyer-scroll::-webkit-scrollbar-thumb { background: ${T.amber}; border-radius: 5px; }
        .buyer-scroll::-webkit-scrollbar-thumb:hover { background: ${T.amberDark}; }
        .itemcode-scroll { height: 100%; overflow-x: auto; overflow-y: hidden; padding-bottom: 8px; scrollbar-color: ${T.slate} ${T.border}; scrollbar-width: thin; }
        .itemcode-scroll::-webkit-scrollbar { height: 9px; }
        .itemcode-scroll::-webkit-scrollbar-track { background: ${T.border}; border-radius: 5px; }
        .itemcode-scroll::-webkit-scrollbar-thumb { background: ${T.slate}; border-radius: 5px; }
        .itemcode-scroll::-webkit-scrollbar-thumb:hover { background: #2a4a63; }
        .supplier-scroll { scrollbar-color: ${T.amber} ${T.border}; scrollbar-width: thin; }
        .supplier-scroll::-webkit-scrollbar { width: 7px; }
        .supplier-scroll::-webkit-scrollbar-track { background: ${T.border}; border-radius: 5px; }
        .supplier-scroll::-webkit-scrollbar-thumb { background: ${T.amber}; border-radius: 5px; }
        .date-picker { font-family: ${monoFont}; font-size: 12px; color: ${T.text}; background: #fff; border: 1px solid ${T.border}; border-radius: 6px; padding: 5px 9px; outline: none; }
        .date-picker:focus { border-color: ${T.amber}; }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
        <div>
          {/* <div style={{ fontFamily: monoFont, fontSize: 10, letterSpacing: "0.14em", color: T.muted, textTransform: "uppercase", marginBottom: 2 }}>
            HKD Outdoor Innovations · Material Warehouse
          </div> */}
          <div style={{ fontFamily: displayFont, fontSize: 20, fontWeight: 700, color: T.text }}>
            <em style={{ color: T.amber, fontStyle: "italic" }}>Overview</em>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <CalendarDays size={14} color={T.muted} />
            <input
              type="date"
              className="date-picker"
              value={selectedDate}
              max={todayStr()}
              onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
            />
            {!isToday && (
              <button
                onClick={() => setSelectedDate(todayStr())}
                style={{ fontFamily: monoFont, fontSize: 11, color: T.amber, background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}
              >
                Today
              </button>
            )}
          </div>
          <div style={{ fontFamily: monoFont, fontSize: 11, color: T.muted, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: pieLoading ? T.gold : T.sage, display: "inline-block" }} />
            {pieLoading ? "Updating…" : "Live"}
          </div>
        </div>
      </div>

      {/* KPI row -- bigger cards per request */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, flexShrink: 0, height: 150 }}>
        <KpiCard icon={Boxes} label="Available Roll" value={kpis.totalAvailableRoll} unit="Roll" accent={T.amber} />
        <KpiCard icon={Layers} label="Available Yds" value={kpis.totalAvailableYds} unit="Yds" accent={T.teal} />
        <KpiCard icon={ClipboardCheck} label="Inspection Pending" value={kpis.pendingInspectionCount} unit="Invoices" accent="#7a4a8a" />
        <KpiCard icon={PackageSearch} label="Total Receiving" value={kpis.totalReceivingCount} unit="invoices" accent={T.slate} />
      </div>

      {/* Charts row -- buyer bar, item-code bar, supplier ranking list,
          batch pie, requisition pie. Only the BARS inside the two bar-chart
          panels were made bigger (see barSize below), not the panels
          themselves. */}
      <div style={{ display: "grid", gridTemplateColumns: "1.15fr 1.15fr 0.95fr 0.8fr 0.8fr", gap: 10, flex: 1, minHeight: 0 }}>
        {/* Buyer-wise Roll -- main VERTICAL bar chart (bars rise from the
            bottom, buyer names along the X axis), horizontally scrollable
            when there are many buyers. All-time totals, not date-filtered.
            Buyer names are always shown IN FULL (no truncation/ellipsis) --
            the horizontal scroll container is what handles overflow. */}
        <Panel
          eyebrow="By Buyer · All-time"
          title="Available Roll"
          right={<span style={{ fontFamily: monoFont, fontSize: 11, color: T.muted }}>{buyerStock.length} buyers</span>}
        >
          {buyerStock.length === 0 ? (
            <div style={{ color: T.muted, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
              No stock data yet.
            </div>
          ) : (
            <div className="buyer-scroll" onWheel={handleWheelScroll}>
              <div style={{ height: "100%", minWidth: Math.max(buyerStock.length * 108, 100) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={buyerStock} margin={{ left: 4, right: 16, top: 4, bottom: 4 }} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
                    <XAxis
                      dataKey="buyer"
                      tick={{ fill: T.text, fontSize: 11.5, fontFamily: bodyFont }}
                      axisLine={{ stroke: T.border }}
                      tickLine={false}
                      interval={0}
                    // No tickFormatter here on purpose -- buyer names must
                    // always render in full, never truncated with "…".
                    />
                    <YAxis type="number" tick={{ fill: T.muted, fontSize: 11, fontFamily: monoFont }} axisLine={false} tickLine={false} width={44} />
                    <Tooltip content={<CustomTooltip unit=" roll" />} cursor={{ fill: "rgba(184,122,74,0.06)" }} />
                    <Bar dataKey="roll" name="Roll" fill={T.amber} radius={[5, 5, 0, 0]} barSize={54} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </Panel>

        {/* Item Code-wise Roll + Yds -- NEW. Replaces the old "By
            Supplier" panel. Grouped bars (Roll on the left axis, Yds on
            the right axis since the two scales are very different),
            aggregated server-side from the same location-allocation data
            the Buyer panel reads. All-time totals, not date-filtered. */}
        <Panel
          eyebrow="By Item Code · All-time"
          title="Available Roll & Yds"
          right={<span style={{ fontFamily: monoFont, fontSize: 11, color: T.muted }}>{itemCodeStock.length} item codes</span>}
        >
          {itemCodeStock.length === 0 ? (
            <div style={{ color: T.muted, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
              No item code data yet.
            </div>
          ) : (
            <div className="itemcode-scroll" onWheel={handleWheelScroll}>
              <div style={{ height: "100%", minWidth: Math.max(itemCodeStock.length * 130, 100) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={itemCodeStock} margin={{ left: 4, right: 8, top: 4, bottom: 4 }} barCategoryGap="20%" barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
                    <XAxis
                      dataKey="itemCode"
                      tick={{ fill: T.text, fontSize: 11.5, fontFamily: bodyFont }}
                      axisLine={{ stroke: T.border }}
                      tickLine={false}
                      interval={0}
                      tickFormatter={(v) => (typeof v === "string" && v.length > 10 ? `${v.slice(0, 10)}…` : v)}
                    />
                    <YAxis yAxisId="roll" type="number" tick={{ fill: T.amber, fontSize: 11, fontFamily: monoFont }} axisLine={false} tickLine={false} width={40} />
                    <YAxis yAxisId="yds" orientation="right" type="number" tick={{ fill: T.slate, fontSize: 11, fontFamily: monoFont }} axisLine={false} tickLine={false} width={48} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(61,106,138,0.06)" }} />
                    <Bar yAxisId="roll" dataKey="roll" name="Roll" fill={T.amber} radius={[5, 5, 0, 0]} barSize={28} />
                    <Bar yAxisId="yds" dataKey="yds" name="Yds" fill={T.slate} radius={[5, 5, 0, 0]} barSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </Panel>

        {/* NEW: Supplier Ranking -- ranked list from the monthly Supplier
            Performance Evaluation sheet. Sorted by Achieve % (nulls/
            #DIV/0! rows sink to the bottom, shown as "N/A"). Not
            date-filtered -- it reflects the latest evaluation month. */}
        <Panel
          eyebrow="Suppliers · Aug 2026"
          title="Supplier Ranking"
          right={
            <span style={{ display: "flex", alignItems: "center", gap: 5, fontFamily: monoFont, fontSize: 11, color: T.muted }}>
              <Trophy size={12} color={T.amber} /> {SUPPLIER_RANKING_DATA.length}
            </span>
          }
        >
          <SupplierRanking suppliers={SUPPLIER_RANKING_DATA} />
        </Panel>

        {/* Batch status pie -- date-filtered to the selected date (via the
            parent Material Receive's date). */}
        <Panel eyebrow={`Stock Batches · ${selectedDate}`} title="Status Breakdown">
          {statusBreakdown.length === 0 ? (
            <div style={{ color: T.muted, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
              No batches received on this date.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 4 }}>
              <div style={{ flex: 1.3, minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusBreakdown}
                      dataKey="count"
                      nameKey="status"
                      innerRadius="55%"
                      outerRadius="88%"
                      paddingAngle={2}
                      strokeWidth={1}
                      stroke={T.panel}
                    >
                      {statusBreakdown.map((entry) => (
                        <Cell key={entry.status} fill={STATUS_COLORS[entry.status] || T.muted} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload;
                        return (
                          <div style={{ background: "#fff", border: `1px solid ${T.border}`, borderRadius: 6, padding: "7px 11px", fontFamily: bodyFont, fontSize: 13, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
                            {STATUS_LABELS[d.status] || d.status}: <b>{d.count}</b>
                          </div>
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
                <PieLegendList data={statusBreakdown} colorMap={STATUS_COLORS} labelMap={STATUS_LABELS} total={statusTotal} />
              </div>
            </div>
          )}
        </Panel>

        {/* Requisition status pie -- date-filtered to the selected date
            (via the requisition's own date). */}
        <Panel eyebrow={`Cutting Requisitions · ${selectedDate}`} title="Fulfillment Status">
          {requisitionBreakdown.length === 0 ? (
            <div style={{ color: T.muted, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
              No requisitions on this date.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 4 }}>
              <div style={{ flex: 1.3, minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={requisitionBreakdown}
                      dataKey="count"
                      nameKey="status"
                      innerRadius="55%"
                      outerRadius="88%"
                      paddingAngle={2}
                      strokeWidth={1}
                      stroke={T.panel}
                    >
                      {requisitionBreakdown.map((entry) => (
                        <Cell key={entry.status} fill={REQ_COLORS[entry.status] || T.muted} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload;
                        return (
                          <div style={{ background: "#fff", border: `1px solid ${T.border}`, borderRadius: 6, padding: "7px 11px", fontFamily: bodyFont, fontSize: 13, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}>
                            {REQ_LABELS[d.status] || d.status}: <b>{d.count}</b>
                          </div>
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
                <PieLegendList data={requisitionBreakdown} colorMap={REQ_COLORS} labelMap={REQ_LABELS} total={reqTotal} />
              </div>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
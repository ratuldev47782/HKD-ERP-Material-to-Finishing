"use client";
import Image from "next/image";
import { useAuth } from "@/app/hooks/useAuth";
import { useCallback, useEffect, useMemo, useState } from "react";
import ExportSalaryReportsExcelButton from "./ExportSalaryReportsExcelButton";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const FLOORS = ["A-2", "B-2", "A-3", "B-3", "A-4", "B-4", "A-5", "B-5"];
const FACTORIES = ["K-1", "K-2", "K-3"];

// 🎨 Chart colors
const DIRECT_BAR = "#2563eb"; // blue-600
const INDIRECT_BAR = "#f97316"; // orange-500

// Pie colors
const PIE_COLORS = [
  "#2563eb",
  "#f97316",
  "#16a34a",
  "#a855f7",
  "#0ea5e9",
  "#ef4444",
  "#f59e0b",
  "#14b8a6",
  "#64748b",
  "#84cc16",
  "#db2777",
  "#22c55e",
  "#6366f1",
];

const MONTH_ABBR = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];

function normalizeUserId(auth) {
  return (
    auth?._id?.$oid ||
    auth?._id ||
    auth?.id ||
    auth?.user?._id?.$oid ||
    auth?.user?._id ||
    auth?.user?.id ||
    ""
  );
}
function getUserName(auth) {
  return auth?.user_name || auth?.user?.user_name || "";
}
function getUserRole(auth) {
  return auth?.role || auth?.user?.role || "";
}

function normalizeYM(v) {
  if (!v) return "";
  const s = String(v).trim();
  if (/^\d{4}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{4})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}`;
  return "";
}

function monthAbbrFromYM(ym) {
  const s = normalizeYM(ym);
  if (!s) return "—";
  const m = Number(s.slice(5, 7));
  if (m < 1 || m > 12) return "—";
  return MONTH_ABBR[m - 1];
}

function ymToLabel(ym) {
  const s = normalizeYM(ym);
  if (!s) return "—";
  const y = s.slice(0, 4);
  const ab = monthAbbrFromYM(s);
  return `${ab} ${y}`;
}

// ✅ previous month (YYYY-MM)
function getPrevYM() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

// ✅ current month (YYYY-MM)
function getThisYM() {
  const d = new Date();
  d.setDate(1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function addMonthsToYM(ym, deltaMonths) {
  const s = normalizeYM(ym);
  if (!s) return "";
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(5, 7)); // 1..12
  if (!Number.isFinite(y) || !Number.isFinite(m)) return "";
  const d = new Date(y, m - 1, 1);
  d.setMonth(d.getMonth() + deltaMonths);
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${yy}-${mm}`;
}

function Field({ label, children }) {
  return (
    <label className="block">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
        {label}
      </div>
      {children}
    </label>
  );
}

const VIEWS = [
  { value: "line", label: "Line-wise (By Floor)" },
  { value: "floor", label: "Floor-wise Total" },
  { value: "month", label: "Month-wise Total" },
  { value: "year", label: "Year-wise Total" },
];

function Segmented({ value, onChange, options, compact = false }) {
  return (
    <div
      className={[
        "inline-flex w-full rounded-xl border border-slate-200 bg-slate-50",
        compact ? "p-1" : "p-1",
      ].join(" ")}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            className={[
              "flex-1 rounded-lg font-semibold transition",
              compact ? "px-2 py-1.5 text-[11px]" : "px-3 py-2 text-[12px]",
              active
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900",
            ].join(" ")}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ✅ Vertical money label inside bars (rotated)
const makeVerticalMoneyLabel = (money) => (props) => {
  const { x, y, width, height, value } = props;

  if (!width || !height || height < 26) return null;

  const cx = x + width / 2;
  const cy = y + height / 2;

  const text = money(value);
  if (!text || text === "—") return null;

  return (
    <text
      x={cx}
      y={cy}
      textAnchor="middle"
      dominantBaseline="middle"
      fill="#fff"
      fontSize={11}
      fontWeight={500}
      transform={`rotate(-90 ${cx} ${cy})`}
      style={{ pointerEvents: "none" }}
    >
      {text}
    </text>
  );
};

function sumNums(arr) {
  return arr.reduce((acc, v) => acc + (Number(v) || 0), 0);
}
function groupTopN(rows, n = 12) {
  const sorted = rows.slice().sort((a, b) => (b.value || 0) - (a.value || 0));
  if (sorted.length <= n) return sorted;
  const head = sorted.slice(0, n);
  const tail = sorted.slice(n);
  const others = { name: "Others", value: sumNums(tail.map((x) => x.value)) };
  return others.value > 0 ? [...head, others] : head;
}

const RADIAN = Math.PI / 180;

export default function SalaryReportsPage() {
  const { auth } = useAuth();

  const userId = useMemo(() => String(normalizeUserId(auth) || ""), [auth]);
  const userName = getUserName(auth);
  const userRole = getUserRole(auth);

  const [view, setView] = useState("line");

  // ✅ by default factory will be K-2
  const [factory, setFactory] = useState("K-2");

  // Currency toggle
  const [currency, setCurrency] = useState("BDT"); // "BDT" | "USD"

  // ✅ line/floor filters (default previous month)
  const [yearMonth, setYearMonth] = useState(() => getPrevYM());
  const [yearMonthTouched, setYearMonthTouched] = useState(false);
  const [floor, setFloor] = useState("");

  // month/year range filters
  const [startYM, setStartYM] = useState("");
  const [endYM, setEndYM] = useState("");

  // ✅ DEFAULT = Total bar chart
  const [chartMode, setChartMode] = useState("total"); // "split" | "total"

  // ✅ Pie toggle
  const [pieMode, setPieMode] = useState("amount"); // "amount" | "percent"

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  function authHeaders() {
    const headers = { "Content-Type": "application/json" };
    if (userId) headers["x-user-id"] = userId;
    if (userName) headers["x-user-name"] = userName;
    if (userRole) headers["x-user-role"] = userRole;
    return headers;
  }

  const isLineOrFloor = view === "line" || view === "floor";
  const isMonthOrYear = view === "month" || view === "year";

  // server থেকে যে Year-Month এ ডাটা আসছে সেটা বের করার চেষ্টা
  const reportYM = useMemo(() => {
    const raw =
      data?.data?.yearMonth ||
      data?.data?.meta?.yearMonth ||
      data?.data?.filters?.yearMonth ||
      data?.yearMonth ||
      "";
    return normalizeYM(raw);
  }, [data]);

  // ✅ input এর ভিতরে যে value দেখাবেন
  const yearMonthShown = yearMonthTouched ? yearMonth : yearMonth || reportYM;

  // ✅ ইউজার touch না করলে server-month কে state এ সেট করে রাখি যাতে পরের fetch consistent হয়
  useEffect(() => {
    if (!isLineOrFloor) return;
    if (yearMonthTouched) return;
    if (yearMonth) return;
    if (!reportYM) return;
    setYearMonth(reportYM);
  }, [isLineOrFloor, yearMonthTouched, yearMonth, reportYM]);

  const fetchReport = useCallback(
    async (signal) => {
      try {
        setLoading(true);
        setErr("");

        const params = new URLSearchParams();
        params.set("view", view);
        if (factory) params.set("factory", factory);

        // line/floor filters
        if (view === "line" || view === "floor") {
          if (yearMonth) params.set("yearMonth", yearMonth);
          if (floor) params.set("floor", floor);
        }

        // month/year filters (date range)
        if (view === "month" || view === "year") {
          if (startYM) params.set("startYM", startYM);
          if (endYM) params.set("endYM", endYM);
        }

        const res = await fetch(`/api/salary-reports?${params.toString()}`, {
          headers: authHeaders(),
          cache: "no-store",
          signal,
        });

        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || json?.message || "Failed");

        setData(json);
      } catch (e) {
        if (String(e?.name || "") === "AbortError") return;
        setErr(String(e?.message || e));
      } finally {
        setLoading(false);
      }
    },
    [view, factory, yearMonth, floor, startYM, endYM, userId, userName, userRole]
  );

  // ✅ auto-search whenever filters change
  useEffect(() => {
    if (!userId) return;

    const controller = new AbortController();
    const t = setTimeout(() => {
      fetchReport(controller.signal);
    }, 250);

    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [userId, view, factory, yearMonth, floor, startYM, endYM, fetchReport]);

  // ✅ auto-refresh every 30 seconds
  useEffect(() => {
    if (!userId) return;
    const interval = setInterval(() => {
      const controller = new AbortController();
      fetchReport(controller.signal);
    }, 30_000);

    return () => clearInterval(interval);
  }, [userId, fetchReport]);

  const grand = data?.data?.grandTotals;
  const missingRateCount = Number(grand?.missingRateCount || 0);

  // UI money (keep your commas)
  function money(v) {
    if (v === null || v === undefined) return "—";
    const n = Number(v);
    if (!Number.isFinite(n)) return "—";

    const digits = currency === "USD" ? 2 : 0;
    const s = n.toLocaleString(undefined, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });

    return currency === "USD" ? `$${s}` : `${s} BDT`;
  }

  // ✅ Pie amount format (NO compact like 200K)
  // BDT => 200000BDT
  // USD => $300 (integer), else $300.25
  function pieAmount(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return "—";

    if (currency === "USD") {
      const isInt = Math.abs(n - Math.round(n)) < 1e-9;
      return isInt ? `$${Math.round(n)}` : `$${n.toFixed(2)}`;
    }
    return `${Math.round(n)}BDT`;
  }

  function pick(row, key) {
    if (!row) return null;
    if (currency === "USD") return row[`${key}USD`];
    return row[key];
  }

  // ✅ chart data for floor/month/year views (sorted) + includes total
  const topChart = useMemo(() => {
    const payload = data?.data;
    if (!payload) return null;

    if (view === "floor") {
      const rows = (payload?.rows || []).slice().sort((a, b) =>
        String(a.floor || "").localeCompare(String(b.floor || ""))
      );
      return {
        title: "Floor-wise Salary",
        subtitle: currency === "USD" ? "USD" : "BDT",
        data: rows.map((r) => ({
          name: r.floor,
          direct: Number(pick(r, "salaryDirect") || 0),
          indirect: Number(pick(r, "salaryIndirect") || 0),
          total: Number(pick(r, "salaryTotal") || 0),
        })),
      };
    }

    if (view === "month") {
      const rows = (payload?.rows || []).slice().sort((a, b) => {
        const ay = normalizeYM(a.yearMonth);
        const by = normalizeYM(b.yearMonth);
        return String(by).localeCompare(String(ay));
      });
      return {
        title: "Month-wise Salary",
        subtitle:
          startYM || endYM
            ? `${ymToLabel(startYM) || "—"} → ${ymToLabel(endYM) || "—"}`
            : "",
        data: rows.map((r) => ({
          name: r.yearMonth,
          direct: Number(pick(r, "salaryDirect") || 0),
          indirect: Number(pick(r, "salaryIndirect") || 0),
          total: Number(pick(r, "salaryTotal") || 0),
        })),
      };
    }

    if (view === "year") {
      const rows = (payload?.rows || []).slice().sort((a, b) => {
        const ay = Number(a.year);
        const by = Number(b.year);
        return (Number.isFinite(by) ? by : -Infinity) - (Number.isFinite(ay) ? ay : -Infinity);
      });
      return {
        title: "Year-wise Salary",
        subtitle: currency === "USD" ? "USD" : "BDT",
        data: rows.map((r) => ({
          name: r.year,
          direct: Number(pick(r, "salaryDirect") || 0),
          indirect: Number(pick(r, "salaryIndirect") || 0),
          total: Number(pick(r, "salaryTotal") || 0),
        })),
      };
    }

    return null;
  }, [data, view, currency, startYM, endYM]);

  const quickSetRange = useCallback((monthsBack) => {
    const end = getThisYM();
    const start = addMonthsToYM(end, -(monthsBack - 1));
    setStartYM(start);
    setEndYM(end);
  }, []);

  // ✅ NEW: Export request (kept minimal)
  const exportRequest = useMemo(() => {
    return {
      view,
      currency,
      factory,
      chartMode, // ✅ send current chart mode so Excel Chart Data matches
      filters: {
        yearMonth: isLineOrFloor ? yearMonthShown : "",
        floor: isLineOrFloor ? floor : "",
        startYM: isMonthOrYear ? startYM : "",
        endYM: isMonthOrYear ? endYM : "",
      },
    };
  }, [
    view,
    currency,
    factory,
    chartMode,
    isLineOrFloor,
    isMonthOrYear,
    yearMonthShown,
    floor,
    startYM,
    endYM,
  ]);

  // ✅ Pie data by view (always Total)
  const pieInfo = useMemo(() => {
    const payload = data?.data;
    if (!payload) return { title: "Distribution", subtitle: "", data: [] };

    const makeRows = (rows) =>
      rows
        .map((x) => ({ name: String(x.name ?? ""), value: Number(x.value || 0) }))
        .filter((x) => x.name && Number.isFinite(x.value) && x.value > 0);

    // line/floor => floor-wise distribution
    if (view === "line" || view === "floor") {
      let rows = [];

      if (view === "floor") {
        rows = makeRows(
          (payload.rows || []).map((r) => ({
            name: r.floor || "",
            value: Number(pick(r, "salaryTotal") || 0),
          }))
        );
      } else {
        const floorsArr = Array.isArray(payload.floors) ? payload.floors : [];
        rows = makeRows(
          floorsArr.map((f) => {
            const ft = f?.floorTotals;
            if (ft) {
              return { name: f.floor || "", value: Number(pick(ft, "salaryTotal") || 0) };
            }
            const rr = Array.isArray(f?.rows) ? f.rows : [];
            const total = rr.reduce((acc, r) => acc + Number(pick(r, "salaryTotal") || 0), 0);
            return { name: f.floor || "", value: total };
          })
        );
      }

      rows = groupTopN(rows, 10);
      return {
        title: "Floor-wise Distribution",
        subtitle: pieMode === "percent" ? "Percent" : "Amount",
        data: rows,
      };
    }

    if (view === "month") {
      let rows = makeRows(
        (payload.rows || []).map((r) => ({
          name: normalizeYM(r.yearMonth) || r.yearMonth || "",
          value: Number(pick(r, "salaryTotal") || 0),
        }))
      );
      rows = groupTopN(rows, 10);
      return {
        title: "Month-wise Distribution",
        subtitle: pieMode === "percent" ? "Percent" : "Amount",
        data: rows,
      };
    }

    // year
    let rows = makeRows(
      (payload.rows || []).map((r) => ({
        name: String(r.year ?? ""),
        value: Number(pick(r, "salaryTotal") || 0),
      }))
    );
    rows = groupTopN(rows, 10);
    return {
      title: "Year-wise Distribution",
      subtitle: pieMode === "percent" ? "Percent" : "Amount",
      data: rows,
    };
  }, [data, view, currency, pieMode]);

  const totalPieValue = useMemo(
    () => pieInfo.data.reduce((acc, x) => acc + (Number(x.value) || 0), 0),
    [pieInfo.data]
  );

  const piePercent = useCallback(
    (val) => {
      const n = Number(val);
      if (!Number.isFinite(n) || !totalPieValue) return "—";
      return `${Math.round((n / totalPieValue) * 100)}%`;
    },
    [totalPieValue]
  );

  const renderPieLabel = useCallback(
    (props) => {
      const { cx, cy, midAngle, innerRadius, outerRadius, percent, value } = props;

      // hide if slice tiny
      if (!percent || percent < 0.055) return null;

      const radius = innerRadius + (outerRadius - innerRadius) * 0.62;
      const x = cx + radius * Math.cos(-midAngle * RADIAN);
      const y = cy + radius * Math.sin(-midAngle * RADIAN);

      const amountTxt = pieAmount(value);
      const percentTxt = `${Math.round((percent || 0) * 100)}%`;

      // if amount too long -> show %
      const text =
        pieMode === "percent"
          ? percentTxt
          : String(amountTxt).length > 9
          ? percentTxt
          : amountTxt;

      return (
        <text
          x={x}
          y={y}
          fill="black"//pie chart text color
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={10}
          fontWeight={800}
          style={{ pointerEvents: "none" }}
        >
          {text}
        </text>
      );
    },
    [pieMode, currency, totalPieValue]
  );

  const centerText = pieAmount(totalPieValue);
  const centerFont = centerText.length > 12 ? 9 : centerText.length > 10 ? 10 : 11;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-2 max-w-8xl px-4 py-0.5">
        <div className="mb-0.5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          

          {/* <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm">
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span>
                <span className="text-slate-500">User:</span>{" "}
                <span className="font-medium">{userName || "—"}</span>
              </span>
              <span>
                <span className="text-slate-500">Role:</span>{" "}
                <span className="font-medium">{userRole || "—"}</span>
              </span>
            </div>
          </div> */}
        </div>

        {err ? (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-700">
            ❌ {err}
          </div>
        ) : null}

        {currency === "USD" && missingRateCount > 0 ? (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-800 text-sm">
            ⚠️ {missingRateCount} entry(ies) missing USD rate for their month. USD totals may be
            incomplete. Please set month-wise USD rate.
          </div>
        ) : null}

        {/* ✅ Filters (left half) + Pie (right half) - compact */}
        {/* ✅ Filters + Pie (new compact layout, less-white, legend beside pie) */}
<div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-12">
  {/* Filters */}
  <div className="lg:col-span-7 overflow-hidden rounded-2xl border border-slate-200/70 bg-white/60 backdrop-blur shadow-sm">
    <div className="flex items-center justify-between gap-2 px-3 py-2 bg-gradient-to-r from-slate-900 to-slate-700">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-xl bg-white text-white grid place-items-center text-2xl font-black">
          <Image src="/HKD_LOGO.png" alt="Logo" width={20} height={20} />
        </div>
        <div className="leading-tight">
          <h2 className="text-[20px] font-semibold text-white">ʜᴋᴅ ᴏᴜᴛᴅᴏᴏʀ ɪɴɴᴏᴠᴀᴛɪᴏɴꜱ ʟᴛᴅ.</h2>
          <h2 className="text-[14px] font-semibold text-white">ᴍᴏɴᴛʜʟʏ ꜱᴀʟᴀʀʏ ʀᴇᴘᴏʀᴛꜱ</h2>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {loading ? (
          <div className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-2.5 py-1.5 text-[11px] text-white">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
            Loading
          </div>
        ) : (
          <div className="rounded-xl bg-white/10 px-2.5 py-1.5 text-[11px] text-white/80">
            Ready
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            setFactory("K-2");
            setYearMonth(getPrevYM());
            setYearMonthTouched(false);
            setFloor("");
            setStartYM("");
            setEndYM("");
            setData(null);
          }}
          className="inline-flex items-center justify-center rounded-xl bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-800 hover:bg-slate-100"
        >
          Reset
        </button>
      </div>
    </div>

    <div className="p-3">
      <div className="grid grid-cols-12 gap-2">
        {/* View */}
        <div className="col-span-12">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
            View
          </div>

          {/* slightly nicer segmented */}
          <div className="inline-flex w-full rounded-xl border border-slate-200 bg-slate-100/70 p-1">
            {[
              { value: "line", label: "Line" },
              { value: "floor", label: "Floor" },
              { value: "month", label: "Month" },
              { value: "year", label: "Year" },
            ].map((opt) => {
              const active = opt.value === view;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setView(opt.value)}
                  aria-pressed={active}
                  className={[
                    "flex-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold transition",
                    active
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900",
                  ].join(" ")}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          <div className="mt-1 text-[10px] text-slate-500">
            {VIEWS.find((v) => v.value === view)?.label || "—"}
          </div>
        </div>

        {/* Factory */}
        <div className="col-span-12 sm:col-span-6">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
            Factory
          </div>
          <select
            className="w-full rounded-xl border border-slate-200 bg-white/80 px-2.5 py-1.5 text-[11px] text-slate-900 outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-900/10"
            value={factory}
            onChange={(e) => setFactory(e.target.value)}
          >
            <option value="">All</option>
            {FACTORIES.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>

        {/* Currency */}
        <div className="col-span-12 sm:col-span-6">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
            Currency
          </div>
          <div className="inline-flex w-full rounded-xl border border-slate-200 bg-slate-100/70 p-1">
            {[
              { value: "BDT", label: "BDT" },
              { value: "USD", label: "USD" },
            ].map((opt) => {
              const active = opt.value === currency;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setCurrency(opt.value)}
                  aria-pressed={active}
                  className={[
                    "flex-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold transition",
                    active
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900",
                  ].join(" ")}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Line/Floor filters */}
        {isLineOrFloor ? (
          <>
            <div className="col-span-12 sm:col-span-6">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                Year-Month
              </div>
              <div className="flex items-center gap-2">
                <input
                  className="w-full rounded-xl border border-slate-200 bg-white/80 px-2.5 py-1.5 text-[11px] text-slate-900 outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-900/10"
                  type="month"
                  value={yearMonthShown}
                  onChange={(e) => {
                    setYearMonthTouched(true);
                    setYearMonth(e.target.value);
                  }}
                />
               
              </div>
            </div>

            <div className="col-span-12 sm:col-span-6">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                Floor
              </div>
              <select
                className="w-full rounded-xl border border-slate-200 bg-white/80 px-2.5 py-1.5 text-[11px] text-slate-900 outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-900/10"
                value={floor}
                onChange={(e) => setFloor(e.target.value)}
              >
                <option value="">All</option>
                {FLOORS.map((fl) => (
                  <option key={fl} value={fl}>
                    {fl}
                  </option>
                ))}
              </select>
            </div>
          </>
        ) : null}

        {/* Month/Year range filters */}
        {isMonthOrYear ? (
          <>
            <div className="col-span-12 sm:col-span-6">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                From
              </div>
              <div className="flex items-center gap-2">
                <input
                  className="w-full rounded-xl border border-slate-200 bg-white/80 px-2.5 py-1.5 text-[11px] text-slate-900 outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-900/10"
                  type="month"
                  value={startYM}
                  onChange={(e) => setStartYM(e.target.value)}
                />
                <span className="shrink-0 rounded-xl border border-slate-200 bg-slate-100/70 px-2 py-1.5 text-[11px] font-extrabold text-slate-700">
                  {monthAbbrFromYM(startYM)}
                </span>
              </div>
            </div>

            <div className="col-span-12 sm:col-span-6">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                To
              </div>
              <div className="flex items-center gap-2">
                <input
                  className="w-full rounded-xl border border-slate-200 bg-white/80 px-2.5 py-1.5 text-[11px] text-slate-900 outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-900/10"
                  type="month"
                  value={endYM}
                  onChange={(e) => setEndYM(e.target.value)}
                />
                <span className="shrink-0 rounded-xl border border-slate-200 bg-slate-100/70 px-2 py-1.5 text-[11px] font-extrabold text-slate-700">
                  {monthAbbrFromYM(endYM)}
                </span>
              </div>
            </div>

            <div className="col-span-12">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                Quick ranges
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => quickSetRange(6)}
                  className="rounded-xl border border-slate-200 bg-white/80 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-white"
                >
                  Past 6 Months
                </button>
                <button
                  type="button"
                  onClick={() => quickSetRange(12)}
                  className="rounded-xl border border-slate-200 bg-white/80 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-white"
                >
                  Past 1 Year
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStartYM("");
                    setEndYM("");
                  }}
                  className="rounded-xl border border-slate-200 bg-slate-100/70 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Clear
                </button>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  </div>

  {/* Pie */}
  <div className="lg:col-span-5 overflow-hidden rounded-2xl border border-slate-200/70 bg-white/60 backdrop-blur shadow-sm">
    <div className="border-b border-slate-200/70 px-3 py-2 flex items-center justify-between gap-2 bg-gradient-to-r from-indigo-600 to-sky-600">
      <div className="min-w-0">
        <div className="text-[12px] font-semibold text-white truncate">{pieInfo.title}</div>
        <div className="text-[10px] text-white/80 truncate">{pieInfo.subtitle || " "}</div>
      </div>

      <div className="inline-flex rounded-xl bg-white/15 p-1">
        <button
          type="button"
          onClick={() => setPieMode("amount")}
          className={[
            "px-2 py-1 text-[10px] font-semibold rounded-lg transition",
            pieMode === "amount" ? "bg-white text-slate-900 shadow-sm" : "text-white/90 hover:text-white",
          ].join(" ")}
        >
          Amount
        </button>
        <button
          type="button"
          onClick={() => setPieMode("percent")}
          className={[
            "px-2 py-1 text-[10px] font-semibold rounded-lg transition",
            pieMode === "percent" ? "bg-white text-slate-900 shadow-sm" : "text-white/90 hover:text-white",
          ].join(" ")}
        >
          %
        </button>
      </div>
    </div>

    <div className="p-3">
      {pieInfo.data.length === 0 ? (
        <div className="h-[190px] rounded-xl border border-slate-200 bg-slate-50/70 grid place-items-center text-[12px] text-slate-600">
          No data
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-3 items-stretch">
          {/* Pie chart */}
          <div className="col-span-7">
            <div className="h-[190px] w-full rounded-xl border border-slate-200 bg-white/40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    formatter={(v) => {
                      const val = Number(v || 0);
                      const pct = piePercent(val);
                      return [`${pieAmount(val)} • ${pct}`, "Total"];
                    }}
                    labelFormatter={(label) => String(label)}
                  />
                  <Pie
                    data={pieInfo.data}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius="60%"
                    outerRadius="88%"
                    paddingAngle={2}
                    labelLine={false}
                    label={renderPieLabel}
                  >
                    {pieInfo.data.map((_, idx) => (
                      <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>

                  <text
                    x="50%"
                    y="50%"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#0f172a"
                    fontSize={centerFont}
                    fontWeight={900}
                  >
                    {centerText}
                  </text>
                  <text
                    x="50%"
                    y="50%"
                    dy={14}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#64748b"
                    fontSize={9}
                    fontWeight={700}
                  >
                    Total
                  </text>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Legend beside pie */}
          <div className="col-span-5">
            <div className="h-[190px] rounded-xl border border-slate-200 bg-slate-50/70 p-2 overflow-auto space-y-1">
              {pieInfo.data.map((x, idx) => {
                const val = Number(x.value || 0);
                const pctNum = totalPieValue ? (val / totalPieValue) * 100 : 0;

                return (
                  <div
                    key={`${x.name}-${idx}`}
                    className="rounded-lg border border-slate-200 bg-white/70 px-2 py-1"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="h-2.5 w-2.5 rounded-sm shrink-0"
                          style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
                        />
                        <div className="min-w-0">
                          <div className="truncate text-[10px] text-slate-800 font-semibold">
                            {x.name}
                          </div>
                          <div className="text-[9px] text-slate-500">
                            {pieAmount(val)}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <div className="text-[10px] font-extrabold text-slate-700">
                          {Math.round(pctNum)}%
                        </div>
                      </div>
                    </div>

                    <div className="mt-1 h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(100, Math.max(0, pctNum))}%`,
                          backgroundColor: PIE_COLORS[idx % PIE_COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  </div>
</div>


        {/* Results */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* ✅ Result header + toggle + export */}
          <div className="border-b border-slate-200 px-5 py-2 flex items-center justify-between gap-3 bg-sky-800/75 rounded-t-lg">
            <div>
              <h2 className="text-base font-semibold text-white ">Result</h2>
              <p className="text-xs text-slate-500">{loading ? "Loading..." : " "}</p>
            </div>

            <div className="flex items-center gap-2">
              <ExportSalaryReportsExcelButton
                request={exportRequest}
                headers={authHeaders()}
                disabled={!userId}
              />

              {/* Toggle */}
              <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
                <button
                  type="button"
                  onClick={() => setChartMode("split")}
                  className={[
                    "px-3 py-1.5 text-[12px] font-semibold rounded-lg transition ",
                    chartMode === "split"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900",
                  ].join(" ")}
                >
                  Salary (D/I)
                </button>
                <button
                  type="button"
                  onClick={() => setChartMode("total")}
                  className={[
                    "px-3 py-1.5 text-[12px] font-semibold rounded-lg transition",
                    chartMode === "total"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900",
                  ].join(" ")}
                >
                  Total
                </button>
              </div>
            </div>
          </div>

          <div className="p-4 space-y-4">
            {view !== "line" ? (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <ChartCard
                  title={topChart?.title}
                  subtitle={topChart?.subtitle}
                  data={topChart?.data || []}
                  money={money}
                  chartMode={chartMode}
                />

                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-200 px-4 py-3">
                    <div className="text-sm font-semibold text-slate-900">Table</div>
                    <div className="text-xs text-slate-500">{loading ? "Loading..." : " "}</div>
                  </div>
                  <div className="p-3">
                    <SimpleTotalsTable view={view} payload={data?.data} money={money} pick={pick} />
                  </div>
                </div>
              </div>
            ) : (
              <LineWiseByFloorTables payload={data?.data} money={money} pick={pick} chartMode={chartMode} />
            )}

            {grand ? (
              <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm">
                <div className="font-semibold text-indigo-900">Grand Total</div>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div className="rounded-xl bg-white/70 border border-indigo-100 p-3">
                    <div className="text-xs text-slate-500">Salary (Direct)</div>
                    <div className="text-base font-bold text-slate-900">
                      {money(pick(grand, "salaryDirect"))}
                    </div>
                  </div>
                  <div className="rounded-xl bg-white/70 border border-indigo-100 p-3">
                    <div className="text-xs text-slate-500">Salary (Indirect)</div>
                    <div className="text-base font-bold text-slate-900">
                      {money(pick(grand, "salaryIndirect"))}
                    </div>
                  </div>
                  <div className="rounded-xl bg-white/70 border border-indigo-100 p-3">
                    <div className="text-xs text-slate-500">Total</div>
                    <div className="text-base font-bold text-slate-900">
                      {money(pick(grand, "salaryTotal"))}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

/** ✅ Chart Card showing MONEY inside bars vertically */
function ChartCard({ title, subtitle, data, money, chartMode = "total" }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <div className="text-sm font-semibold text-slate-900">{title || "Chart"}</div>
        {subtitle ? <div className="text-xs text-slate-500">{subtitle}</div> : null}
      </div>

      <div className="p-3">
        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />

              <Tooltip
                formatter={(value, name) => {
                  if (name === "total") return [money(value), "Total"];
                  return [money(value), name === "direct" ? "Salary (Direct)" : "Salary (Indirect)"];
                }}
                labelFormatter={(label) => `${label}`}
              />

              <Legend
                formatter={(v) => {
                  if (v === "direct") return "Salary (Direct)";
                  if (v === "indirect") return "Salary (Indirect)";
                  if (v === "total") return "Total";
                  return v;
                }}
              />

              {chartMode === "total" ? (
                <Bar dataKey="total" name="total" fill={DIRECT_BAR} radius={[8, 8, 0, 0]}>
                  <LabelList content={makeVerticalMoneyLabel(money)} />
                </Bar>
              ) : (
                <>
                  <Bar dataKey="direct" name="direct" fill={DIRECT_BAR} radius={[8, 8, 0, 0]}>
                    <LabelList content={makeVerticalMoneyLabel(money)} />
                  </Bar>
                  <Bar dataKey="indirect" name="indirect" fill={INDIRECT_BAR} radius={[8, 8, 0, 0]}>
                    <LabelList content={makeVerticalMoneyLabel(money)} />
                  </Bar>
                </>
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

/** ✅ Line-wise */
function LineWiseByFloorTables({ payload, money, pick, chartMode }) {
  const floors = payload?.floors || [];

  if (floors.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        No data found
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      {floors.map((f) => (
        <FloorCardSideBySide key={f.floor} block={f} money={money} pick={pick} chartMode={chartMode} />
      ))}
    </div>
  );
}

function FloorCardSideBySide({ block, money, pick, chartMode }) {
  const rows = block?.rows || [];
  const ft = block?.floorTotals;

  const chartData = useMemo(() => {
    return (rows || []).map((r) => ({
      name: `L${r.line}`,
      direct: Number(pick(r, "salaryDirect") || 0),
      indirect: Number(pick(r, "salaryIndirect") || 0),
      total: Number(pick(r, "salaryTotal") || 0),
    }));
  }, [rows, pick]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2 ">
        <div className="text-sm font-semibold text-slate-900 ">
          Floor: <span className="font-bold">{block.floor}</span>
        </div>
        {ft ? (
          <div className="text-xs text-slate-600">
            Total: <span className="font-semibold">{money(pick(ft, "salaryTotal"))}</span>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-3 p-3 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
          <div className="mb-2 text-xs font-semibold text-slate-700">
            {chartMode === "total"
              ? "Total (by Line)"
              : "Salary (Direct) vs Salary (Indirect) (by Line)"}
          </div>

          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />

                <Tooltip
                  formatter={(value, name) => {
                    if (name === "total") return [money(value), "Total"];
                    return [money(value), name === "direct" ? "Salary (Direct)" : "Salary (Indirect)"];
                  }}
                />

                <Legend
                  formatter={(v) => {
                    if (v === "direct") return "Salary (Direct)";
                    if (v === "indirect") return "Salary (Indirect)";
                    if (v === "total") return "Total";
                    return v;
                  }}
                />

                {chartMode === "total" ? (
                  <Bar dataKey="total" name="total" fill={DIRECT_BAR} radius={[8, 8, 0, 0]}>
                    <LabelList content={makeVerticalMoneyLabel(money)} />
                  </Bar>
                ) : (
                  <>
                    <Bar dataKey="direct" name="direct" fill={DIRECT_BAR} radius={[8, 8, 0, 0]}>
                      <LabelList content={makeVerticalMoneyLabel(money)} />
                    </Bar>
                    <Bar dataKey="indirect" name="indirect" fill={INDIRECT_BAR} radius={[8, 8, 0, 0]}>
                      <LabelList content={makeVerticalMoneyLabel(money)} />
                    </Bar>
                  </>
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <div className="max-h-[320px] overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                <tr className="bg-indigo-50">
                  <th className="px-3 py-2 w-[70px] ">Line</th>
                  <th className="px-3 py-2 w-[160px]">Salary (Direct)</th>
                  <th className="px-3 py-2 w-[160px]">Salary (Indirect)</th>
                  <th className="px-3 py-2 w-[160px] bg-indigo-90 text-indigo-700">Total</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-slate-600">
                      No data found
                    </td>
                  </tr>
                ) : (
                  rows.map((r, idx) => (
                    <tr
                      key={`${block.floor}-${r.line}`}
                      className={`group hover:bg-slate-50 ${idx % 2 ? "bg-white" : "bg-slate-50/30"}`}
                    >
                      <td className="px-3 py-2">{r.line}</td>
                      <td className="px-3 py-2">{money(pick(r, "salaryDirect"))}</td>
                      <td className="px-3 py-2">{money(pick(r, "salaryIndirect"))}</td>
                      <td className="px-3 py-2 font-semibold bg-indigo-50 text-indigo-900 group-hover:bg-indigo-100">
                        {money(pick(r, "salaryTotal"))}
                      </td>
                    </tr>
                  ))
                )}

                {ft ? (
                  <tr className="sticky bottom-0 z-10 bg-indigo-100 font-semibold">
                    <td className="px-3 py-2">Total</td>
                    <td className="px-3 py-2">{money(pick(ft, "salaryDirect"))}</td>
                    <td className="px-3 py-2">{money(pick(ft, "salaryIndirect"))}</td>
                    <td className="px-3 py-2 text-indigo-900">{money(pick(ft, "salaryTotal"))}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function SimpleTotalsTable({ view, payload, money, pick }) {
  const rowsRaw = payload?.rows || [];
  const grand = payload?.grandTotals;

  const rows = useMemo(() => {
    const r = rowsRaw.slice();

    if (view === "month") {
      r.sort((a, b) => {
        const ay = normalizeYM(a.yearMonth);
        const by = normalizeYM(b.yearMonth);
        return String(by).localeCompare(String(ay));
      });
    } else if (view === "year") {
      r.sort((a, b) => {
        const ay = Number(a.year);
        const by = Number(b.year);
        return (Number.isFinite(by) ? by : -Infinity) - (Number.isFinite(ay) ? ay : -Infinity);
      });
    } else if (view === "floor") {
      r.sort((a, b) => String(a.floor || "").localeCompare(String(b.floor || "")));
    }

    return r;
  }, [rowsRaw, view]);

  const firstCol = view === "floor" ? "Floor" : view === "month" ? "Year-Month" : "Year";

  return (
    <div className="w-full overflow-hidden rounded-xl border border-slate-200">
      <div className="max-h-[380px] overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-3 py-2 w-[150px]">{firstCol}</th>
              <th className="px-3 py-2 w-[180px]">Salary (Direct)</th>
              <th className="px-3 py-2 w-[180px]">Salary (Indirect)</th>
              <th className="px-3 py-2 w-[180px] bg-indigo-50 text-indigo-700">Total</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-slate-600">
                  No data found
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr
                  key={i}
                  className={`group hover:bg-slate-50 ${i % 2 ? "bg-white" : "bg-slate-50/30"}`}
                >
                  <td className="px-3 py-2">{r.floor || r.yearMonth || r.year}</td>
                  <td className="px-3 py-2">{money(pick(r, "salaryDirect"))}</td>
                  <td className="px-3 py-2">{money(pick(r, "salaryIndirect"))}</td>
                  <td className="px-3 py-2 font-semibold bg-indigo-50 text-indigo-900 group-hover:bg-indigo-100">
                    {money(pick(r, "salaryTotal"))}
                  </td>
                </tr>
              ))
            )}

            {grand ? (
              <tr className="sticky bottom-0 z-10 bg-indigo-100 font-semibold">
                <td className="px-3 py-2">Grand Total</td>
                <td className="px-3 py-2">{money(pick(grand, "salaryDirect"))}</td>
                <td className="px-3 py-2">{money(pick(grand, "salaryIndirect"))}</td>
                <td className="px-3 py-2 text-indigo-900">{money(pick(grand, "salaryTotal"))}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

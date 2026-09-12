"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/app/hooks/useAuth";

const FLOORS = ["A-2", "B-2", "A-3", "B-3", "A-4", "B-4", "A-5", "B-5"];
const FACTORIES = ["K-2", "K-3"];

const POLL_MS = 15000; // ✅ 15000 = 15 sec, 10000 = 10 sec

// ✅ previous month (YYYY-MM)
function getPrevYM() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

// ✅ normalize any input to YYYY-MM
function normalizeYM(v) {
  if (!v) return "";
  const s = String(v).trim();

  if (/^\d{4}-\d{2}$/.test(s)) return s;

  const m = s.match(/^(\d{4})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}`;

  const dt = new Date(s);
  if (!Number.isNaN(dt.getTime())) {
    const y = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    return `${y}-${mm}`;
  }

  return "";
}

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
function cx(...cls) {
  return cls.filter(Boolean).join(" ");
}
function Field({ label, children }) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
        {label}
      </div>
      {children}
    </label>
  );
}

export default function SalaryEntriesPage() {
  const { auth } = useAuth();

  const userId = useMemo(() => String(normalizeUserId(auth) || ""), [auth]);
  const userName = getUserName(auth);
  const userRole = getUserRole(auth);

  const prevYM = useMemo(() => getPrevYM(), []);

  // ---------------------------
  // USD Rate (Month-wise)
  // ---------------------------
  const [rateMonth, setRateMonth] = useState(prevYM);
  const [usdRate, setUsdRate] = useState("");
  const [rateLoading, setRateLoading] = useState(false);
  const [rateMsg, setRateMsg] = useState("");
  const [rateErr, setRateErr] = useState("");

  // Entry month rate (auto show on entry form)
  const [entryUsdRate, setEntryUsdRate] = useState(null);
  const [entryRateLoading, setEntryRateLoading] = useState(false);
  const [entryRateErr, setEntryRateErr] = useState("");

  // ---------------------------
  // Salary Entry Form
  // ---------------------------
  const [editingId, setEditingId] = useState(null);
  const [factory, setFactory] = useState("K-2"); // fixed
  const [yearMonth, setYearMonth] = useState(prevYM);
  const [floor, setFloor] = useState("A-2");
  const [line, setLine] = useState(1);
  const [salaryDirect, setSalaryDirect] = useState("");
  const [salaryIndirect, setSalaryIndirect] = useState("");

  useEffect(() => {
    if (auth?.assigned_building) setFloor(auth.assigned_building);
  }, [auth]);

  const salaryTotal = useMemo(() => {
    const d = Number(salaryDirect || 0);
    const i = Number(salaryIndirect || 0);
    return d + i;
  }, [salaryDirect, salaryIndirect]);

  const salaryTotalUSD = useMemo(() => {
    const rate = Number(entryUsdRate || 0);
    if (!rate || rate <= 0) return 0;
    return Number(salaryTotal || 0) / rate;
  }, [salaryTotal, entryUsdRate]);

  // ---------------------------
  // Filters (NO Search button)
  // ---------------------------
  const [fFactory, setFFactory] = useState("");
  const [fYearMonth, setFYearMonth] = useState(prevYM);
  const [fFloor, setFFloor] = useState("");
  const [fLine, setFLine] = useState("");

  // Data
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  function authHeaders() {
    const headers = { "Content-Type": "application/json" };
    if (userId) headers["x-user-id"] = userId;
    if (userName) headers["x-user-name"] = userName;
    if (userRole) headers["x-user-role"] = userRole;
    return headers;
  }

  async function getUsdRateByMonth(ym, signal) {
    const nYm = normalizeYM(ym);
    if (!nYm) return null;

    const res = await fetch(
      `/api/usd-rates?yearMonth=${encodeURIComponent(nYm)}`,
      { headers: authHeaders(), cache: "no-store", signal }
    );

    const json = await res.json();
    if (!res.ok) throw new Error(json?.error || "Failed to load USD rate");
    return json?.data || null;
  }

  async function loadRateForRateForm(ym, signal) {
    try {
      setRateErr("");
      setRateMsg("");

      const nYm = normalizeYM(ym);
      if (!nYm) {
        setUsdRate("");
        return;
      }

      setRateLoading(true);
      const doc = await getUsdRateByMonth(nYm, signal);
      if (signal?.aborted) return;

      setUsdRate(doc?.rate ? String(doc.rate) : "");
    } catch (e) {
      if (String(e?.name || "") === "AbortError") return;
      setRateErr(String(e?.message || e));
      setUsdRate("");
    } finally {
      if (!signal?.aborted) setRateLoading(false);
    }
  }

  async function loadRateForEntryMonth(ym, signal) {
    try {
      setEntryRateErr("");

      const nYm = normalizeYM(ym);
      if (!nYm) {
        setEntryUsdRate(null);
        return;
      }

      setEntryRateLoading(true);
      const doc = await getUsdRateByMonth(nYm, signal);
      if (signal?.aborted) return;

      setEntryUsdRate(doc?.rate ?? null);
    } catch (e) {
      if (String(e?.name || "") === "AbortError") return;
      setEntryUsdRate(null);
      setEntryRateErr(String(e?.message || e));
    } finally {
      if (!signal?.aborted) setEntryRateLoading(false);
    }
  }

  async function saveUsdRate() {
    try {
      setRateErr("");
      setRateMsg("");

      const nRateMonth = normalizeYM(rateMonth);
      if (!nRateMonth) throw new Error("Please select month for USD rate.");

      const rateNum = Number(usdRate);
      if (!Number.isFinite(rateNum) || rateNum <= 0) {
        throw new Error("USD rate must be a number greater than 0.");
      }

      setRateLoading(true);

      const res = await fetch("/api/usd-rates", {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ yearMonth: nRateMonth, rate: rateNum }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to save USD rate");

      const savedRate = json?.data?.rate ?? rateNum;

      setRateMonth(nRateMonth);
      setUsdRate(String(savedRate));
      setRateMsg("✅ Saved.");

      // keep entry card in sync if same month
      const nEntryYM = normalizeYM(yearMonth);
      if (nEntryYM && nEntryYM === nRateMonth) {
        setEntryUsdRate(savedRate);
        setEntryRateErr("");

        const controller = new AbortController();
        await loadRateForEntryMonth(nEntryYM, controller.signal);
      }
    } catch (e) {
      setRateErr(String(e?.message || e));
    } finally {
      setRateLoading(false);
    }
  }

  // ✅ load usd rate for rate-month
  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    loadRateForRateForm(rateMonth, controller.signal);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, rateMonth]);

  // ✅ load usd rate for entry month
  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    loadRateForEntryMonth(yearMonth, controller.signal);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, yearMonth]);

  // ---------------------------
  // Fetch items (auto on filter change + polling)
  // ---------------------------
  const listControllerRef = useRef(null);
  const reqSeqRef = useRef(0);

  const fetchItems = useCallback(
    async (signal, { silent = false } = {}) => {
      const myReqId = ++reqSeqRef.current;

      try {
        if (!silent) setLoading(true);
        if (!silent) setErr("");

        const params = new URLSearchParams();

        // ✅ filter params (NO SEARCH button: filter change => fetch)
        if (fFactory) params.set("factory", fFactory);

        const nFYm = normalizeYM(fYearMonth);
        if (nFYm) params.set("yearMonth", nFYm);

        if (fFloor) params.set("floor", fFloor);

        // line only if valid
        const lineStr = String(fLine || "").trim();
        if (lineStr) params.set("line", lineStr);

        const res = await fetch(`/api/salary-entries?${params.toString()}`, {
          headers: authHeaders(),
          cache: "no-store",
          signal,
        });

        const json = await res.json();
        if (!res.ok) {
          throw new Error(
            json?.error ||
              json?.message ||
              `Load failed: ${res.status} ${res.statusText}`
          );
        }

        // ✅ ignore stale responses
        if (myReqId !== reqSeqRef.current) return;

        setItems(json.data || []);
      } catch (e) {
        if (String(e?.name || "") === "AbortError") return;
        if (!silent) setErr(String(e?.message || e));
      } finally {
        if (!signal?.aborted && !silent) setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, userName, userRole, fFactory, fYearMonth, fFloor, fLine]
  );

  const triggerFetch = useCallback(
    (opts) => {
      if (!userId) return;

      // abort previous in-flight
      if (listControllerRef.current) listControllerRef.current.abort();

      const c = new AbortController();
      listControllerRef.current = c;
      fetchItems(c.signal, opts);
    },
    [userId, fetchItems]
  );

  // ✅ initial load
  useEffect(() => {
    if (!userId) return;
    triggerFetch({ silent: false });
    return () => {
      if (listControllerRef.current) listControllerRef.current.abort();
      listControllerRef.current = null;
    };
  }, [userId, triggerFetch]);

  // ✅ FILTER CHANGE => AUTO FETCH (debounced)
  useEffect(() => {
    if (!userId) return;

    const t = setTimeout(() => {
      triggerFetch({ silent: false });
    }, 250); // ✅ debounce

    return () => clearTimeout(t);
  }, [userId, fFactory, fYearMonth, fFloor, fLine, triggerFetch]);

  // ✅ POLLING every 10/15 sec (silent)
  useEffect(() => {
    if (!userId) return;

    const id = setInterval(() => {
      triggerFetch({ silent: true }); // silent polling (no loader flicker)
    }, POLL_MS);

    return () => clearInterval(id);
  }, [userId, triggerFetch]);

  function resetForm() {
    setEditingId(null);
    setFactory("K-2");
    setYearMonth(prevYM);
    setFloor(auth?.assigned_building ?? "A-2");
    setLine(1);
    setSalaryDirect("");
    setSalaryIndirect("");
    setEntryUsdRate(null);
    setEntryRateErr("");
  }

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setMsg("");

    try {
      if (!userId) throw new Error("No authenticated userId found. Please login.");

      const payload = {
        factory: "K-2",
        yearMonth: normalizeYM(yearMonth),
        floor,
        line: Number(line),
        salaryDirect: Number(salaryDirect),
        salaryIndirect: Number(salaryIndirect),
      };

      if (!payload.yearMonth) throw new Error("Please select Year-Month.");

      const url = editingId
        ? `/api/salary-entries/${editingId}`
        : "/api/salary-entries";
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(
          json?.error ||
            json?.message ||
            `Save failed: ${res.status} ${res.statusText}`
        );
      }

      setMsg(editingId ? "✅ Updated successfully." : "✅ Created successfully.");
      resetForm();

      // ✅ refresh immediately (uses current filters)
      triggerFetch({ silent: false });
    } catch (e2) {
      setErr(String(e2.message || e2));
    }
  }

  function startEdit(row) {
    setEditingId(row._id);
    setFactory("K-2");
    setYearMonth(normalizeYM(row.yearMonth) || prevYM);
    setFloor(row.floor || "A-2");
    setLine(row.line || 1);
    setSalaryDirect(String(row.salaryDirect ?? ""));
    setSalaryIndirect(String(row.salaryIndirect ?? ""));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function onDelete(id) {
    setErr("");
    setMsg("");

    if (!window.confirm("Delete this entry?")) return;

    try {
      const res = await fetch(`/api/salary-entries/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(
          json?.error ||
            json?.message ||
            `Delete failed: ${res.status} ${res.statusText}`
        );
      }

      setMsg("🗑️ Deleted successfully.");

      // ✅ refresh immediately (uses current filters)
      triggerFetch({ silent: false });
    } catch (e) {
      setErr(String(e.message || e));
    }
  }

  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-900/10 disabled:bg-slate-50 disabled:opacity-60";

  // ✅ group by floor
  const groupedByFloor = useMemo(() => {
    const map = new Map();
    for (const it of items) {
      const fl = it.floor || "Unknown";
      if (!map.has(fl)) map.set(fl, []);
      map.get(fl).push(it);
    }
    const floors = Array.from(map.keys()).sort();
    return floors.map((fl) => ({
      floor: fl,
      rows: (map.get(fl) || []).slice().sort((a, b) => {
        const ay = normalizeYM(a.yearMonth);
        const by = normalizeYM(b.yearMonth);
        if (ay !== by) return String(by).localeCompare(String(ay));
        return Number(a.line) - Number(b.line);
      }),
    }));
  }, [items]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-8xl px-5 py-0.5">
        {msg ? (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-800">
            {msg}
          </div>
        ) : null}

        {err ? (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-700">
            ❌ {err}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Left */}
          <div className="lg:col-span-1">
            {/* ✅ Sticky wrapper for BOTH cards */}
            <div className="space-y-4 lg:sticky lg:top-4 lg:self-start lg:z-10 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:pr-2">
              {/* USD Rate */}
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-slate-900">
                      USD Rate
                    </h2>
                    <div className="text-xs text-slate-500">
                      {rateLoading ? "Loading..." : ""}
                    </div>
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Month-wise BDT per $1
                  </p>
                </div>

                <div className="p-4">
                  {rateMsg ? (
                    <div className="mb-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800 text-xs">
                      {rateMsg}
                    </div>
                  ) : null}
                  {rateErr ? (
                    <div className="mb-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700 text-xs">
                      ❌ {rateErr}
                    </div>
                  ) : null}

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Month">
                      <input
                        className={inputClass}
                        type="month"
                        value={rateMonth}
                        onChange={(e) =>
                          setRateMonth(normalizeYM(e.target.value))
                        }
                        disabled={!userId}
                      />
                    </Field>

                    <Field label="Rate">
                      <input
                        className={inputClass}
                        type="number"
                        min="0"
                        step="0.0001"
                        value={usdRate}
                        onChange={(e) => setUsdRate(e.target.value)}
                        disabled={!userId || !rateMonth}
                        placeholder="110.50"
                      />
                    </Field>
                  </div>

                  <button
                    type="button"
                    onClick={saveUsdRate}
                    disabled={!userId || !rateMonth || rateLoading}
                    className={cx(
                      "mt-3 w-full inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-white",
                      !userId || !rateMonth || rateLoading
                        ? "bg-slate-400 cursor-not-allowed"
                        : "bg-slate-900 hover:bg-slate-800"
                    )}
                  >
                    Save / Update
                  </button>
                </div>
              </div>

              {/* Salary Entry Form */}
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-2 py-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold text-slate-900">
                      {editingId ? "Edit Entry" : "Create Entry"}
                    </h2>
                    <span
                      className={cx(
                        "rounded-full px-3 py-1 text-xs font-medium",
                        editingId
                          ? "bg-amber-50 text-amber-700"
                          : "bg-slate-100 text-slate-700"
                      )}
                    >
                      {editingId ? "Editing" : "New"}
                    </span>
                  </div>
                </div>

                <form onSubmit={onSubmit} className="p-5">
                  <div className="grid grid-cols-1 gap-4">
                    <Field label="Factory">
                      <input
                        className={cx(inputClass, "bg-slate-50")}
                        value="K-2"
                        readOnly
                      />
                    </Field>

                    <Field label="Year-Month">
                      <input
                        className={inputClass}
                        type="month"
                        value={yearMonth}
                        onChange={(e) =>
                          setYearMonth(normalizeYM(e.target.value))
                        }
                        required
                        disabled={!userId}
                      />
                    </Field>

                    <Field label="Floor">
                      <select
                        className={inputClass}
                        value={floor}
                        onChange={(e) => setFloor(e.target.value)}
                        disabled={!userId}
                      >
                        {FLOORS.map((fl) => (
                          <option key={fl} value={fl}>
                            {fl}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field label="Line (1-20)">
                      <select
                        className={inputClass}
                        value={line}
                        onChange={(e) => setLine(Number(e.target.value))}
                        disabled={!userId}
                      >
                        {Array.from({ length: 20 }).map((_, i) => (
                          <option key={i + 1} value={i + 1}>
                            {i + 1}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Field label="Salary (Direct) - BDT">
                        <input
                          className={inputClass}
                          type="number"
                          min="0"
                          step="0.01"
                          value={salaryDirect}
                          onChange={(e) => setSalaryDirect(e.target.value)}
                          required
                          disabled={!userId}
                        />
                      </Field>

                      <Field label="Salary (Indirect) - BDT">
                        <input
                          className={inputClass}
                          type="number"
                          min="0"
                          step="0.01"
                          value={salaryIndirect}
                          onChange={(e) => setSalaryIndirect(e.target.value)}
                          required
                          disabled={!userId}
                        />
                      </Field>
                    </div>

                    <Field label="Total (BDT) - Auto">
                      <input
                        className={cx(inputClass, "bg-slate-50")}
                        type="number"
                        value={salaryTotal}
                        readOnly
                      />
                    </Field>

                    {(yearMonth && entryUsdRate) ||
                    entryRateLoading ||
                    entryRateErr ? (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-slate-700">
                            {entryRateLoading ? (
                              <span className="font-semibold">
                                USD rate loading...
                              </span>
                            ) : entryUsdRate ? (
                              <>
                                USD Rate:{" "}
                                <span className="font-semibold">
                                  {entryUsdRate}
                                </span>{" "}
                                <span className="text-xs text-slate-500">
                                  (BDT per $1)
                                </span>
                              </>
                            ) : null}
                          </div>

                          {entryUsdRate ? (
                            <div className="text-slate-800">
                              USD:{" "}
                              <span className="font-semibold">
                                {salaryTotalUSD.toFixed(2)}
                              </span>
                            </div>
                          ) : null}
                        </div>

                        {entryRateErr ? (
                          <div className="mt-2 text-rose-700 text-xs">
                            ⚠️ Failed to load USD rate: {entryRateErr}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                    <button
                      type="submit"
                      disabled={!userId}
                      className={cx(
                        "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors",
                        !userId && "cursor-not-allowed opacity-50",
                        editingId
                          ? "bg-amber-600 hover:bg-amber-700"
                          : "bg-slate-900 hover:bg-slate-800"
                      )}
                    >
                      {editingId ? "Update Entry" : "Save Entry"}
                    </button>

                    {editingId ? (
                      <button
                        type="button"
                        onClick={resetForm}
                        className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                    ) : null}
                  </div>
                </form>
              </div>
            </div>
          </div>

          {/* Right */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              {/* Filter (NO Search button) */}
              <div className="border-b border-slate-200 px-5 py-4">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Filter 
                    </h3>
                    
                  </div>
                  <div className="text-xs text-slate-500">
                    Entries: {loading ? "Loading..." : `${items.length} record(s)`}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                  <Field label="Factory">
                    <select
                      className={inputClass}
                      value={fFactory}
                      onChange={(e) => setFFactory(e.target.value)}
                    >
                      <option value="">All</option>
                      {FACTORIES.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Year-Month">
                    <input
                      className={inputClass}
                      type="month"
                      value={fYearMonth}
                      onChange={(e) => setFYearMonth(normalizeYM(e.target.value))}
                    />
                  </Field>

                  <Field label="Floor">
                    <select
                      className={inputClass}
                      value={fFloor}
                      onChange={(e) => setFFloor(e.target.value)}
                    >
                      <option value="">All</option>
                      {FLOORS.map((fl) => (
                        <option key={fl} value={fl}>
                          {fl}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Line">
                    <input
                      className={inputClass}
                      type="number"
                      min="1"
                      max="16"
                      value={fLine}
                      onChange={(e) => setFLine(e.target.value)}
                      placeholder="1..16"
                    />
                  </Field>

                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => {
                        setFFactory("");
                        setFYearMonth(prevYM);
                        setFFloor("");
                        setFLine("");
                      }}
                      className="w-full inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </div>

              {/* Floor-wise tables */}
              <div className="p-4">
                {items.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                    {loading ? "Loading..." : "No data found"}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {groupedByFloor.map((g) => (
                      <FloorEntriesCard
                        key={g.floor}
                        floor={g.floor}
                        rows={g.rows}
                        onEdit={startEdit}
                        onDelete={onDelete}
                      />
                    ))}
                  </div>
                )}

                {loading ? (
                  <div className="mt-3 text-sm text-slate-600">
                    Fetching data...
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FloorEntriesCard({ floor, rows, onEdit, onDelete }) {
  const totalBDT = useMemo(() => {
    return rows.reduce((acc, r) => acc + Number(r.salaryTotal || 0), 0);
  }, [rows]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div className="text-sm font-semibold text-slate-900">
          Floor: <span className="font-bold">{floor}</span>
        </div>
        <div className="text-xs text-slate-600">
          Total:{" "}
          <span className="font-semibold">{totalBDT.toLocaleString()} BDT</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
            <tr>
              {[
                "Year-Month",
                "Factory",
                "Line",
                "Direct",
                "Indirect",
                "Total",
                "Created",
                "Actions",
              ].map((h) => (
                <th key={h} className="whitespace-nowrap px-4 py-3 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row._id} className="hover:bg-slate-50">
                <td className="whitespace-nowrap px-4 py-3">{row.yearMonth}</td>
                <td className="whitespace-nowrap px-4 py-3">{row.factory}</td>
                <td className="whitespace-nowrap px-4 py-3">{row.line}</td>
                <td className="whitespace-nowrap px-4 py-3">{row.salaryDirect}</td>
                <td className="whitespace-nowrap px-4 py-3">{row.salaryIndirect}</td>
                <td className="whitespace-nowrap px-4 py-3 font-semibold">
                  {row.salaryTotal}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                  {row.createdAt ? new Date(row.createdAt).toLocaleString() : ""}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => onEdit(row)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(row._id)}
                      className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

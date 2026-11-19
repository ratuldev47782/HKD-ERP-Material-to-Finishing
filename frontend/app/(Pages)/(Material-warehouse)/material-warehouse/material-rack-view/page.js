// frontend/app/(Pages)/(Material-warehouse)/material-warehouse/material-dashboard/page.js
"use client";

import {
  ArrowUpRight,
  Boxes,
  Loader2, MapPin,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis, YAxis,
} from "recharts";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

/* ============================================================
   TOKENS -- warm coffee-toned light palette (latte bg, espresso
   text, caramel/mocha accents instead of flat gray/white)
   ============================================================ */
const T = {
  bg: "#f4f4f5",
  panel: "#ffffff",
  panelAlt: "#fafafa",
  line: "#d4d4d8",
  amber: "#115e59",
  teal: "#115e59",
  sage: "#0f766e",
  brick: "#b91c1c",
  slateBlue: "#52525b",
  gray: "#71717a",
  text: "#18181b",
  muted: "#71717a",
};

const displayFont = `'Barlow Condensed', 'Oswald', sans-serif`;
const bodyFont = `'IBM Plex Sans', 'Inter', sans-serif`;
const monoFont = `'IBM Plex Mono', 'JetBrains Mono', monospace`;

const ACTION_META = {
  receive: { label: "Receive", color: T.sage },
  location_assignment: { label: "Location Assignment", color: T.amber },
  issue: { label: "Issue", color: T.brick },
  adjustment: { label: "Adjustment", color: T.slateBlue },
  inspection: { label: "Inspection", color: T.teal },
};

const fmt = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return v ?? "-";
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
};

const timeAgo = (iso) => {
  if (!iso) return "-";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

// Natural sort so rack codes like "G-X-8" come before "G-X-20" (not
// lexicographic string order), and mixed prefixes such as F-41, K-20,
// QA, AC ROOM sort predictably. Works purely on whatever `location`
// strings the API returns -- no hardcoded rack list needed.
const naturalCompare = (a, b) => {
  const ax = String(a).match(/(\d+|\D+)/g) || [];
  const bx = String(b).match(/(\d+|\D+)/g) || [];
  const len = Math.max(ax.length, bx.length);
  for (let i = 0; i < len; i++) {
    const av = ax[i] ?? "";
    const bv = bx[i] ?? "";
    const an = parseInt(av, 10);
    const bn = parseInt(bv, 10);
    if (!isNaN(an) && !isNaN(bn)) {
      if (an !== bn) return an - bn;
    } else if (av !== bv) {
      return av < bv ? -1 : 1;
    }
  }
  return 0;
};

/* ============================================================
   Shared bits
   ============================================================ */

function Panel({ eyebrow, title, right, children }) {
  return (
    <div
      style={{
        background: T.panel,
        border: `1px solid ${T.line}`,
        borderRadius: 4,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        // minWidth: 0 is the fix -- without it, a CSS Grid item's default
        // min-width is "auto" (i.e. the min-content width of whatever is
        // inside it). A wide inner chart (many supplier bars) would then
        // force this whole grid track wider, shrinking the sibling
        // columns. This lets the panel shrink to its grid track's actual
        // width and push the overflow into its own internal scrollbar
        // instead.
        minWidth: 0,
        height: "100%",
        boxShadow: "0 1px 2px rgba(58,42,26,0.04)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 10, flexShrink: 0 }}>
        <div>
          <div style={{ fontFamily: monoFont, fontSize: 9, letterSpacing: "0.13em", color: T.amber, textTransform: "uppercase", marginBottom: 3 }}>
            {eyebrow}
          </div>
          <div style={{ fontFamily: displayFont, fontSize: 16, fontWeight: 600, color: T.text }}>
            {title}
          </div>
        </div>
        {right}
      </div>
      <div style={{ flex: 1, minHeight: 0, minWidth: 0, overflow: "hidden" }}>{children}</div>
    </div>
  );
}

function CustomTooltip({ active, payload, label, unit }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{ background: T.panelAlt, border: `1px solid ${T.line}`, borderRadius: 3, padding: "7px 11px", fontFamily: monoFont, fontSize: 11, color: T.text, boxShadow: "0 2px 8px rgba(58,42,26,0.08)" }}>
      <div style={{ color: T.muted, marginBottom: 2 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || p.fill }}>
          {p.name}: {typeof p.value === "number" ? p.value.toLocaleString() : p.value}{unit || ""}
        </div>
      ))}
    </div>
  );
}

/* ============================================================
   Main page
   ============================================================ */

export default function MaterialDashboardPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  // Rack hover tooltip is rendered as a viewport-fixed element (position
  // computed from getBoundingClientRect on hover) instead of a CSS
  // :hover child, so it's never clipped by the rack panel's own
  // overflow-y:auto scroll container.
  const [hoveredRack, setHoveredRack] = useState(null); // { rack, x, y }

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(`${API_URL}/material-rack-view`, { credentials: "include" });
        if (!res.ok) throw new Error("Failed to load dashboard data");
        const json = await res.json();
        if (!cancelled) {
          setData(json);
          setError(""); // clear any stale error once a refresh succeeds
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    };

    load(); // initial fetch -- shows the loading spinner until this resolves
    const intervalId = setInterval(load, 5000); // silent auto-refresh every 5s

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, []);

  if (error && !data) {
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

  const { kpis, stockByWarehouse, stockBySupplier = [], topItems, rackOccupancy, recentActivity } = data;

  // Every rack -- no slicing, no hardcoded list. Data comes straight from
  // the API; we only apply a natural sort so racks appear in a sensible
  // serial order (F-41, F-42, F-43... / G-X-1, G-X-3, G-X-20...) instead
  // of whatever order the DB happened to return them in.
  const racks = [...rackOccupancy].sort((a, b) => naturalCompare(a.location, b.location));

  const handleRackEnter = (e, rack) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
    const x = Math.min(Math.max(rect.left + rect.width / 2, 130), vw - 130);
    setHoveredRack({ rack, x, y: rect.top });
  };
  const handleRackLeave = () => setHoveredRack(null);

  return (
    <div
      style={{
        background: T.bg, height: "100vh", width: "100%", overflow: "hidden",
        color: T.text, fontFamily: bodyFont, padding: 18, display: "flex", flexDirection: "column", gap: 12,
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        html, body { overflow: hidden; }
        .rack-cell { transition: transform 0.1s ease, box- 0.1s ease; position: relative; }
        .rack-cell:hover { transform: scale(1.12); box-: 0 0 0 1px ${T.amber}; z-index: 20; }
        .rack-scroll { height: 100%; overflow-y: auto; overflow-x: hidden; padding-right: 4px; }
        .rack-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
        .rack-scroll::-webkit-scrollbar-thumb { background: ${T.line}; border-radius: 3px; }
        .rack-tooltip-title {
          font-family: ${monoFont}; font-size: 9.5px; letter-spacing: 0.06em;
          color: ${T.amber}; text-transform: uppercase; margin-bottom: 6px;
          padding-bottom: 6px; border-bottom: 1px solid ${T.line};
        }
        .rack-tooltip-row {
          display: flex; justify-content: space-between; gap: 10px;
          font-family: ${bodyFont}; font-size: 11px; color: ${T.text}; padding: 2px 0;
        }
        .rack-tooltip-row span:last-child {
          font-family: ${monoFont}; font-size: 10px; color: ${T.muted}; white-space: nowrap; flex-shrink: 0;
        }
        .rack-tooltip-empty { font-family: ${bodyFont}; font-size: 10.5px; color: ${T.muted}; }
      `}</style>

      {/* ===== Header =====
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
        <div>
          <div style={{ fontFamily: monoFont, fontSize: 10, letterSpacing: "0.16em", color: T.muted, textTransform: "uppercase", marginBottom: 3 }}>
            HKD Outdoor Innovations · Material Warehouse
          </div>

        </div>
        <div style={{ fontFamily: monoFont, fontSize: 11, color: T.muted, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.sage, display: "inline-block" }} />
          Live
        </div>
      </div> */}

      {/* ===== Row 1: compact KPI + Top Items (moved up) ===== */}
      <div style={{ display: "flex", gap: 12, flexShrink: 0, height: 180 }}>
        <div
          style={{
            background: T.panel, border: `1px solid ${T.line}`, borderRadius: 4,
            padding: "12px 16px", width: 210, flexShrink: 0, position: "relative", overflow: "hidden",
            display: "flex", flexDirection: "column", justifyContent: "center", gap: 10,
            boxShadow: "0 1px 2px rgba(58,42,26,0.04)",
          }}
        >
          <div style={{ position: "absolute", top: 0, left: 0, width: 3, height: "100%", background: T.sage }} />
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Boxes size={13} color={T.sage} strokeWidth={2} />
            <span style={{ fontFamily: monoFont, fontSize: 9, letterSpacing: "0.1em", color: T.muted, textTransform: "uppercase" }}>
              Total Available
            </span>
          </div>
          <div style={{ display: "flex", gap: 18 }}>
            <div>
              <div style={{ fontFamily: displayFont, fontSize: 22, fontWeight: 600, color: T.text, lineHeight: 1 }}>
                {fmt(kpis.totalAvailableYds)}
              </div>
              <div style={{ fontFamily: monoFont, fontSize: 9, color: T.muted, marginTop: 3 }}>Yds</div>
            </div>
            <div>
              <div style={{ fontFamily: displayFont, fontSize: 22, fontWeight: 600, color: T.text, lineHeight: 1 }}>
                {fmt(kpis.totalAvailableRoll)}
              </div>
              <div style={{ fontFamily: monoFont, fontSize: 9, color: T.muted, marginTop: 3 }}>Roll</div>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0, minWidth: 0 }}>
          <Panel eyebrow="Top Items" title="By Available Yds">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topItems} layout="vertical" margin={{ left: 4, right: 10 }} barCategoryGap="22%">
                <CartesianGrid strokeDasharray="3 3" stroke={T.line} horizontal={false} />
                <XAxis type="number" tick={{ fill: T.muted, fontSize: 9, fontFamily: monoFont }} axisLine={false} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="item"
                  interval={0}
                  tickFormatter={(v) => (typeof v === "string" ? v.split(" / ")[0] : v)}
                  tick={{ fill: T.muted, fontSize: 9, fontFamily: monoFont }}
                  axisLine={false}
                  tickLine={false}
                  width={110}
                />
                <Tooltip content={<CustomTooltip unit=" yds" />} cursor={{ fill: "rgba(58,42,26,0.04)" }} />
                <Bar dataKey="yds" fill={T.amber} radius={[0, 3, 3, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </Panel>
        </div>
      </div>

      {/* ===== Row 2: Rack occupancy (full width, scrollable) ===== */}
      <div style={{ flex: 1.5, minHeight: 0 }}>
        <Panel
          eyebrow="Floor Plan"
          title={`Rack Occupancy (${racks.length} racks)`}
          right={
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: monoFont, fontSize: 9.5, color: T.muted }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}><i style={{ width: 7, height: 7, background: T.line, display: "inline-block", borderRadius: 1 }} /> empty</span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}><i style={{ width: 7, height: 7, background: T.amber, display: "inline-block", borderRadius: 1 }} /> full</span>
              <span>hover a rack for details</span>
            </div>
          }
        >
          {racks.length === 0 ? (
            <div style={{ color: T.muted, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
              No rack allocations yet.
            </div>
          ) : (
            <div className="rack-scroll">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(46px, 1fr))", gap: 6, alignContent: "start" }}>
                {racks.map((r) => {
                  const alpha = 0.12 + (r.fillPercent / 100) * 0.85;
                  return (
                    <div
                      key={r.location}
                      className="rack-cell"
                      onMouseEnter={(e) => handleRackEnter(e, r)}
                      onMouseLeave={handleRackLeave}
                      style={{
                        borderRadius: 3, cursor: "default", padding: "6px 4px",
                        background: `rgba(176,112,14,${alpha})`, border: `1px solid ${T.line}`,
                        display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                      }}
                    >
                      <MapPin size={10} color={alpha > 0.45 ? "#FFFFFF" : T.text} style={{ opacity: 0.85 }} />
                      <span style={{ fontFamily: monoFont, fontSize: 8.5, color: alpha > 0.45 ? "#FFFFFF" : T.text, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>
                        {r.location}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Panel>
      </div>

      {/* Rack hover tooltip -- rendered at the root level, position:fixed,
          so it always sits on top and is never clipped by .rack-scroll's
          overflow or the Panel's own overflow:hidden. */}
      {hoveredRack && (
        <div
          style={{
            position: "fixed",
            left: hoveredRack.x,
            top: hoveredRack.y - 8,
            transform: "translate(-50%, -100%)",
            background: T.panel,
            border: `1px solid ${T.line}`,
            borderRadius: 4,
            padding: "8px 10px",
            minWidth: 170,
            maxWidth: 240,
            zIndex: 1000,
            boxShadow: "0 6px 18px rgba(58,42,26,0.14)",
            pointerEvents: "none",
          }}
        >
          <div className="rack-tooltip-title">{hoveredRack.rack.location} · {hoveredRack.rack.fillPercent}% full</div>
          {(!hoveredRack.rack.items || hoveredRack.rack.items.length === 0) ? (
            <div className="rack-tooltip-empty">Nothing currently available here.</div>
          ) : (
            hoveredRack.rack.items.map((it) => (
              <div key={it.item} className="rack-tooltip-row">
                <span>{it.item}</span>
                <span>{it.roll} Roll / {fmt(it.yds)} Yds</span>
              </div>
            ))
          )}
        </div>
      )}

      {/* ===== Row 3: Warehouse bar / Supplier bar / Recent activity =====
          Fixed 3-column grid. Each column's width is locked to its
          fr-share of the row -- the Supplier panel's internal chart
          (which can be much wider than its column, one bar per supplier)
          scrolls horizontally *inside* its own panel via .rack-scroll
          with overflowX:auto, and never affects the other two columns'
          widths because every Panel now carries minWidth: 0. */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.5fr", gap: 12, flex: 1, minHeight: 0 }}>
        <Panel eyebrow="By Warehouse" title="Available (Yds)">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stockByWarehouse} barCategoryGap="34%">
              <CartesianGrid strokeDasharray="3 3" stroke={T.line} vertical={false} />
              <XAxis dataKey="warehouse" tick={{ fill: T.muted, fontSize: 10, fontFamily: monoFont }} axisLine={{ stroke: T.line }} tickLine={false} />
              <YAxis tick={{ fill: T.muted, fontSize: 9, fontFamily: monoFont }} axisLine={false} tickLine={false} width={40} />
              <Tooltip content={<CustomTooltip unit=" yds" />} cursor={{ fill: "rgba(58,42,26,0.04)" }} />
              <Bar dataKey="yds" fill={T.teal} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        {/* By Supplier -- shows every supplier from the API. The chart
            itself gets a fixed min-width (scaled to supplier count) inside
            a horizontally scrolling wrapper, so the panel stays exactly
            as wide as its grid column (1fr) while the user can scroll
            left/right through every supplier's bar without anything
            getting cut off or squished unreadable, and without pushing
            "By Warehouse" or "Recent Activity" out of shape. */}
        <Panel
          eyebrow="By Supplier"
          title="Available (Yds)"
          right={
            stockBySupplier.length > 0 ? (
              <span style={{ fontFamily: monoFont, fontSize: 9, color: T.muted }}>{stockBySupplier.length} suppliers</span>
            ) : null
          }
        >
          {stockBySupplier.length === 0 ? (
            <div style={{ color: T.muted, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
              No supplier data yet.
            </div>
          ) : (
            <div className="rack-scroll" style={{ overflowX: "auto", overflowY: "hidden" }}>
              <div style={{ height: "100%", minWidth: Math.max(stockBySupplier.length * 62, 100) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stockBySupplier} barCategoryGap="30%" margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={T.line} vertical={false} />
                    <XAxis
                      dataKey="supplier"
                      tick={{ fill: T.muted, fontSize: 9, fontFamily: monoFont }}
                      axisLine={{ stroke: T.line }}
                      tickLine={false}
                      interval={0}
                      tickFormatter={(v) => (typeof v === "string" && v.length > 8 ? `${v.slice(0, 8)}…` : v)}
                    />
                    <YAxis tick={{ fill: T.muted, fontSize: 9, fontFamily: monoFont }} axisLine={false} tickLine={false} width={40} />
                    <Tooltip content={<CustomTooltip unit=" yds" />} cursor={{ fill: "rgba(58,42,26,0.04)" }} />
                    <Bar dataKey="yds" fill={T.brick} radius={[3, 3, 0, 0]} barSize={22} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </Panel>

        <Panel
          eyebrow="Stock History"
          title="Recent Activity"
          right={<span style={{ display: "flex", alignItems: "center", gap: 4, fontFamily: monoFont, fontSize: 10, color: T.teal }}>latest 10 <ArrowUpRight size={11} /></span>}
        >
          {recentActivity.length === 0 ? (
            <div style={{ color: T.muted, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
              No activity yet.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
              {recentActivity.map((row, i) => {
                const meta = ACTION_META[row.action] || { label: row.action, color: T.gray };
                return (
                  <div
                    key={row.id}
                    style={{
                      display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "center",
                      padding: "6px 0", borderBottom: i < recentActivity.length - 1 ? `1px solid ${T.line}` : "none", minWidth: 0,
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                        <i style={{ width: 6, height: 6, borderRadius: "50%", background: meta.color, display: "inline-block", flexShrink: 0 }} />
                        <span style={{ fontSize: 11.5, fontWeight: 500, color: T.text, whiteSpace: "nowrap" }}>{meta.label}</span>
                        <span style={{ fontSize: 10.5, color: T.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          · {row.itemCodePdm || "-"} / {row.color || "-"}
                        </span>
                      </div>
                      <span style={{ fontFamily: monoFont, fontSize: 9.5, color: T.muted, paddingLeft: 12 }}>
                        {row.rollQty} Roll / {fmt(row.yds)} Yds{row.location ? ` · ${row.location}` : ""}
                      </span>
                    </div>
                    <span style={{ fontFamily: monoFont, fontSize: 9.5, color: T.muted, flexShrink: 0 }}>{timeAgo(row.createdAt)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
// /app/api/salary-reports/export/route.js
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import ExcelJS from "exceljs";

// Keep UI colors for consistency
const DIRECT_BAR = "#2563eb"; // blue-600
const INDIRECT_BAR = "#f97316"; // orange-500

function normalizeYM(v) {
  if (!v) return "";
  const s = String(v).trim();
  if (/^\d{4}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{4})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}`;
  return "";
}

function pick(row, key, currency) {
  if (!row) return null;
  if (currency === "USD") return row[`${key}USD`];
  return row[key];
}

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function moneyNumFmt(currency) {
  return currency === "USD"
    ? '"$"#,##0.00;[Red]-"$"#,##0.00'
    : '#,##0;[Red]-#,##0';
}

function styleTitleCell(cell) {
  cell.font = { bold: true, size: 16, color: { argb: "FF111827" } };
  cell.alignment = { vertical: "middle", horizontal: "left" };
}

function styleSectionHeaderRow(row) {
  row.height = 20;
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.alignment = { vertical: "middle", horizontal: "left" };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF111827" } };
}

function styleTableHeaderRow(row) {
  row.height = 18;
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.alignment = { vertical: "middle", horizontal: "center" };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
}

function styleTotalRow(row) {
  row.font = { bold: true };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E7FF" } };
}

function autoFitColumns(ws, maxWidth = 48) {
  ws.columns.forEach((col) => {
    let best = 10;
    col.eachCell({ includeEmpty: false }, (cell) => {
      const v = cell.value;
      const s =
        v === null || v === undefined
          ? ""
          : typeof v === "object" && v.richText
            ? v.richText.map((t) => t.text).join("")
            : String(v);
      best = Math.max(best, Math.min(maxWidth, s.length + 2));
    });
    col.width = Math.max(col.width || 10, best);
  });
}

/**
 * Build the main "Report" rows (raw table).
 * Returns:
 *  - headers: array of strings
 *  - rows: array of arrays (row values)
 *  - totalRowIndexes: array of 1-based row offsets inside the report table block (for styling)
 */
function buildReportTable({ view, payload, currency }) {
  if (view === "line") {
    const headers = ["Floor", "Line", "Salary (Direct)", "Salary (Indirect)", "Total"];
    const rows = [];
    const totalRowIndexes = [];

    const floors = Array.isArray(payload?.floors) ? payload.floors : [];

    for (const f of floors) {
      const floorName = f?.floor || "";
      const lineRows = Array.isArray(f?.rows) ? f.rows : [];

      for (const r of lineRows) {
        rows.push([
          floorName,
          r?.line ?? "",
          toNum(pick(r, "salaryDirect", currency)) ?? 0,
          toNum(pick(r, "salaryIndirect", currency)) ?? 0,
          toNum(pick(r, "salaryTotal", currency)) ?? 0,
        ]);
      }

      // Floor total row
      if (f?.floorTotals) {
        rows.push([
          floorName,
          "Total",
          toNum(pick(f.floorTotals, "salaryDirect", currency)) ?? 0,
          toNum(pick(f.floorTotals, "salaryIndirect", currency)) ?? 0,
          toNum(pick(f.floorTotals, "salaryTotal", currency)) ?? 0,
        ]);
        totalRowIndexes.push(rows.length); // mark this row (1-based inside rows)
      }
    }

    // Grand total row
    if (payload?.grandTotals) {
      rows.push([
        "Grand Total",
        "",
        toNum(pick(payload.grandTotals, "salaryDirect", currency)) ?? 0,
        toNum(pick(payload.grandTotals, "salaryIndirect", currency)) ?? 0,
        toNum(pick(payload.grandTotals, "salaryTotal", currency)) ?? 0,
      ]);
      totalRowIndexes.push(rows.length);
    }

    return { headers, rows, totalRowIndexes };
  }

  // floor / month / year
  const firstCol =
    view === "floor" ? "Floor" : view === "month" ? "Year-Month" : "Year";

  const headers = [firstCol, "Salary (Direct)", "Salary (Indirect)", "Total"];
  const rows = [];
  const totalRowIndexes = [];

  const raw = Array.isArray(payload?.rows) ? payload.rows : [];
  for (const r of raw) {
    rows.push([
      r.floor || normalizeYM(r.yearMonth) || r.year || "",
      toNum(pick(r, "salaryDirect", currency)) ?? 0,
      toNum(pick(r, "salaryIndirect", currency)) ?? 0,
      toNum(pick(r, "salaryTotal", currency)) ?? 0,
    ]);
  }

  if (payload?.grandTotals) {
    rows.push([
      "Grand Total",
      toNum(pick(payload.grandTotals, "salaryDirect", currency)) ?? 0,
      toNum(pick(payload.grandTotals, "salaryIndirect", currency)) ?? 0,
      toNum(pick(payload.grandTotals, "salaryTotal", currency)) ?? 0,
    ]);
    totalRowIndexes.push(rows.length);
  }

  return { headers, rows, totalRowIndexes };
}

/**
 * Build chart rows for the "Chart Data" section.
 * We ALWAYS output 4 columns: Name, Direct, Indirect, Total
 * - If chartMode = total: Direct/Indirect blank, Total filled
 * - If chartMode = split: Total blank, Direct/Indirect filled
 */
function buildChartTable({ view, payload, currency, chartMode }) {
  const headers = ["Name", "Salary (Direct)", "Salary (Indirect)", "Total"];
  const rows = [];

  if (view === "line") {
    // chart by floor+line label (can be many bars, but matches line data)
    const floors = Array.isArray(payload?.floors) ? payload.floors : [];
    for (const f of floors) {
      const floorName = f?.floor || "";
      const lineRows = Array.isArray(f?.rows) ? f.rows : [];
      for (const r of lineRows) {
        const label = `${floorName} L${r?.line ?? ""}`.trim();
        const direct = toNum(pick(r, "salaryDirect", currency)) ?? 0;
        const indirect = toNum(pick(r, "salaryIndirect", currency)) ?? 0;
        const total = toNum(pick(r, "salaryTotal", currency)) ?? 0;

        rows.push([
          label,
          chartMode === "split" ? direct : null,
          chartMode === "split" ? indirect : null,
          chartMode === "total" ? total : null,
        ]);
      }
    }
    return { headers, rows };
  }

  // floor / month / year
  const raw = Array.isArray(payload?.rows) ? payload.rows : [];
  for (const r of raw) {
    const label = r.floor || normalizeYM(r.yearMonth) || r.year || "";
    const direct = toNum(pick(r, "salaryDirect", currency)) ?? 0;
    const indirect = toNum(pick(r, "salaryIndirect", currency)) ?? 0;
    const total = toNum(pick(r, "salaryTotal", currency)) ?? 0;

    rows.push([
      label,
      chartMode === "split" ? direct : null,
      chartMode === "split" ? indirect : null,
      chartMode === "total" ? total : null,
    ]);
  }

  return { headers, rows };
}

async function renderChartPng({ labels, chartMode, currency, rowsTitle, series }) {
  try {
    const [{ ChartJSNodeCanvas }, chartJs] = await Promise.all([
      import("chartjs-node-canvas"),
      import("chart.js"),
    ]);

    const { registerables } = chartJs;

    const width = 900;
    const height = 420;

    const chartJSNodeCanvas = new ChartJSNodeCanvas({
      width,
      height,
      chartCallback: (ChartJS) => {
        ChartJS.register(...registerables);
      },
      backgroundColour: "white",
    });

    const datasets =
      chartMode === "total"
        ? [
            {
              label: "Total",
              data: series.total,
              backgroundColor: DIRECT_BAR,
            },
          ]
        : [
            {
              label: "Salary (Direct)",
              data: series.direct,
              backgroundColor: DIRECT_BAR,
            },
            {
              label: "Salary (Indirect)",
              data: series.indirect,
              backgroundColor: INDIRECT_BAR,
            },
          ];

    const fmt = (n) => {
      const x = Number(n);
      if (!Number.isFinite(x)) return "";
      if (currency === "USD") return `$${x.toFixed(2)}`;
      return `${Math.round(x)}`;
    };

    const configuration = {
      type: "bar",
      data: { labels, datasets },
      options: {
        responsive: false,
        plugins: {
          title: {
            display: true,
            text: rowsTitle || "Salary Chart",
            color: "#111827",
            font: { size: 14, weight: "bold" },
          },
          legend: {
            position: "bottom",
            labels: { color: "#111827" },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${fmt(ctx.parsed.y)}`,
            },
          },
        },
        scales: {
          x: {
            ticks: { color: "#111827", maxRotation: 45, minRotation: 0 },
            grid: { display: false },
          },
          y: {
            ticks: {
              color: "#111827",
              callback: (v) => (currency === "USD" ? `$${v}` : `${v}`),
            },
            grid: { color: "#E5E7EB" },
          },
        },
      },
    };

    return await chartJSNodeCanvas.renderToBuffer(configuration, "image/png");
  } catch (e) {
    // If rendering fails (env missing canvas deps), we still export the Excel without chart image
    console.warn("Chart render skipped:", e?.message || e);
    return null;
  }
}

export async function POST(req) {
  try {
    const body = await req.json();

    const view = body?.view || "line";
    const currency = body?.currency || "BDT";
    const factory = body?.factory || "";
    const chartMode = body?.chartMode || "total";
    const filters = body?.filters || {};

    // Build same params as your report API
    const params = new URLSearchParams();
    params.set("view", view);
    if (factory) params.set("factory", factory);

    if (view === "line" || view === "floor") {
      if (filters.yearMonth) params.set("yearMonth", filters.yearMonth);
      if (filters.floor) params.set("floor", filters.floor);
    }
    if (view === "month" || view === "year") {
      if (filters.startYM) params.set("startYM", filters.startYM);
      if (filters.endYM) params.set("endYM", filters.endYM);
    }

    // Forward auth/session headers to internal fetch
    const h = new Headers();
    const cookie = req.headers.get("cookie");
    if (cookie) h.set("cookie", cookie);

    const xUserId = req.headers.get("x-user-id");
    const xUserName = req.headers.get("x-user-name");
    const xUserRole = req.headers.get("x-user-role");
    if (xUserId) h.set("x-user-id", xUserId);
    if (xUserName) h.set("x-user-name", xUserName);
    if (xUserRole) h.set("x-user-role", xUserRole);

    const { origin } = new URL(req.url);
    const reportRes = await fetch(
      `${origin}/api/salary-reports?${params.toString()}`,
      {
        method: "GET",
        headers: h,
        cache: "no-store",
      }
    );

    const reportJson = await reportRes.json().catch(() => null);
    if (!reportRes.ok) {
      throw new Error(
        reportJson?.error ||
          reportJson?.message ||
          "Failed to fetch report for export"
      );
    }

    const payload = reportJson?.data || null;
    if (!payload) throw new Error("No report data returned for export");

    // Create workbook (ONE SHEET)
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Salary Reports";
    workbook.created = new Date();

    const ws = workbook.addWorksheet("Salary Report");

    // Layout vars
    let r = 1;

    // Title
    ws.mergeCells(`A${r}:E${r}`);
    ws.getCell(`A${r}`).value = "Salary Report";
    styleTitleCell(ws.getCell(`A${r}`));
    r++;

    ws.mergeCells(`A${r}:E${r}`);
    ws.getCell(`A${r}`).value = `View: ${view}   •   Factory: ${factory || "All"}   •   Currency: ${currency}   •   Chart: ${chartMode}`;
    ws.getCell(`A${r}`).font = { size: 11, color: { argb: "FF334155" } };
    ws.getCell(`A${r}`).alignment = { vertical: "middle", horizontal: "left" };
    r++;

    r++; // blank

    // Summary section
    ws.mergeCells(`A${r}:E${r}`);
    ws.getRow(r).values = ["Summary"];
    styleSectionHeaderRow(ws.getRow(r));
    r++;

    const summaryRows = [
      ["View", view],
      ["Factory", factory || ""],
      ["Currency", currency],
      ["Chart Mode", chartMode],
      ["Year-Month", filters.yearMonth || ""],
      ["Floor", filters.floor || ""],
      ["Start (YM)", filters.startYM || ""],
      ["End (YM)", filters.endYM || ""],
      ["Generated At", new Date().toISOString()],
    ];

    for (const [k, v] of summaryRows) {
      ws.getCell(`A${r}`).value = k;
      ws.getCell(`B${r}`).value = v;

      ws.getCell(`A${r}`).font = { bold: true, color: { argb: "FF0F172A" } };
      ws.getCell(`A${r}`).alignment = { vertical: "middle", horizontal: "left" };
      ws.getCell(`B${r}`).alignment = { vertical: "middle", horizontal: "left" };
      r++;
    }

    r++; // blank

    // Report section
    ws.mergeCells(`A${r}:E${r}`);
    ws.getRow(r).values = ["Report Data"];
    styleSectionHeaderRow(ws.getRow(r));
    r++;

    const reportStartRow = r;
    const report = buildReportTable({ view, payload, currency });

    // Write report header
    ws.getRow(r).values = report.headers;
    styleTableHeaderRow(ws.getRow(r));
    r++;

    // Write report rows
    for (const rowVals of report.rows) {
      ws.getRow(r).values = rowVals;
      r++;
    }

    // Number formatting for report money columns
    const reportMoneyFmt = moneyNumFmt(currency);
    if (view === "line") {
      // C,D,E are money
      ws.getColumn(3).numFmt = reportMoneyFmt;
      ws.getColumn(4).numFmt = reportMoneyFmt;
      ws.getColumn(5).numFmt = reportMoneyFmt;
    } else {
      // B,C,D are money
      ws.getColumn(2).numFmt = reportMoneyFmt;
      ws.getColumn(3).numFmt = reportMoneyFmt;
      ws.getColumn(4).numFmt = reportMoneyFmt;
    }

    // Style total rows inside report block
    for (const idx of report.totalRowIndexes) {
      const absoluteRow = reportStartRow + idx; // header row is reportStartRow
      styleTotalRow(ws.getRow(absoluteRow));
    }

    r++; // blank

    // Chart Data section (same sheet)
    ws.mergeCells(`A${r}:E${r}`);
    ws.getRow(r).values = ["Chart Data"];
    styleSectionHeaderRow(ws.getRow(r));
    r++;

    const chartStartRow = r;
    const chartTable = buildChartTable({ view, payload, currency, chartMode });

    ws.getRow(r).values = chartTable.headers;
    styleTableHeaderRow(ws.getRow(r));
    r++;

    for (const rowVals of chartTable.rows) {
      ws.getRow(r).values = rowVals;
      r++;
    }

    // Apply number formats to chart columns B,C,D
    ws.getColumn(2).numFmt = reportMoneyFmt;
    ws.getColumn(3).numFmt = reportMoneyFmt;
    ws.getColumn(4).numFmt = reportMoneyFmt;

    // Create chart image (optional, embedded in same sheet)
    // We'll chart from the chartTable rows (what user asked: summary→chart data together)
    const maxBars = 30; // keep image readable
    const chartRowsForImage = chartTable.rows.slice(0, maxBars);
    const labels = chartRowsForImage.map((x) => String(x[0] ?? ""));
    const series = {
      direct: chartRowsForImage.map((x) => Number(x[1] ?? 0)),
      indirect: chartRowsForImage.map((x) => Number(x[2] ?? 0)),
      total: chartRowsForImage.map((x) => Number(x[3] ?? 0)),
    };

    const chartTitle =
      view === "line"
        ? "Salary Chart (first 30 bars)"
        : "Salary Chart";

    const png = await renderChartPng({
      labels,
      chartMode,
      currency,
      rowsTitle: chartTitle,
      series,
    });

    if (png) {
      const imageId = workbook.addImage({ buffer: png, extension: "png" });

      // Put chart on the right side (starting around column G row 1)
      ws.addImage(imageId, {
        tl: { col: 6, row: 0 }, // G1 (0-based)
        ext: { width: 900, height: 420 },
      });

      // Make sure right-side columns exist / have some width
      for (let c = 6; c <= 15; c++) {
        ws.getColumn(c).width = Math.max(ws.getColumn(c).width || 12, 12);
      }
    }

    // Reasonable widths
    ws.getColumn(1).width = Math.max(ws.getColumn(1).width || 18, 18);
    ws.getColumn(2).width = Math.max(ws.getColumn(2).width || 18, 18);
    ws.getColumn(3).width = Math.max(ws.getColumn(3).width || 18, 18);
    ws.getColumn(4).width = Math.max(ws.getColumn(4).width || 18, 18);
    if (view === "line") ws.getColumn(5).width = Math.max(ws.getColumn(5).width || 18, 18);

    autoFitColumns(ws);

    // Freeze the report header row (so scrolling keeps the header visible)
    // Header row is reportStartRow
    ws.views = [{ state: "frozen", ySplit: reportStartRow }];

    const buffer = await workbook.xlsx.writeBuffer();

    const safeView = String(view || "report").toLowerCase();
    const yyyy_mm_dd = new Date().toISOString().slice(0, 10);
    const filename = `salary_${safeView}_${yyyy_mm_dd}.xlsx`;

    return new Response(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    return Response.json({ error: String(e?.message || e) }, { status: 500 });
  }
}

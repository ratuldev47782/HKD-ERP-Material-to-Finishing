"use client";

import { useState } from "react";

export default function ExportSalaryReportsExcelButton({
  request,
  headers,
  disabled,
}) {
  const [exporting, setExporting] = useState(false);

  async function onExport() {
    if (disabled || exporting) return;

    try {
      setExporting(true);

      const res = await fetch("/api/salary-reports/export", {
        method: "POST",
        credentials: "include", // ✅ important for session cookies
        headers: {
          "Content-Type": "application/json",
          ...(headers || {}),
        },
        body: JSON.stringify(request),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || j?.message || "Export failed");
      }

      const blob = await res.blob();

      const cd = res.headers.get("content-disposition") || "";
      const m = cd.match(/filename="([^"]+)"/);
      const filename = m?.[1] || "salary_report.xlsx";

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(String(e?.message || e));
    } finally {
      setExporting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onExport}
      disabled={disabled || exporting}
      className={[
        "inline-flex items-center justify-center rounded-xl border px-3 py-2 text-[12px] font-semibold transition",
        disabled || exporting
          ? "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
      ].join(" ")}
      title={disabled ? "No data to export" : "Export as Excel (.xlsx)"}
    >
      {exporting ? "Exporting..." : "Export Excel"}
    </button>
  );
}

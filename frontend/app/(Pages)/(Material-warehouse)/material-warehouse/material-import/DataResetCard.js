"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const CONFIRM_TEXT = "DELETE ALL DATA";

export default function DataResetCard() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [includeCutting, setIncludeCutting] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const close = () => { setOpen(false); setText(""); setError(""); };

  const handleDelete = async () => {
    setBusy(true); setError("");
    try {
      const res = await fetch(`${API_URL}/data-reset`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmText: text, includeCutting }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || "Failed to delete data");
      setDone(true);
      close();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-md border border-red-300  p-4 space-y-3">
      <div className="flex items-center gap-2 text-red-700 font-bold text-sm">
        <AlertTriangle size={16} /> Danger Zone
      </div>
      <p className="text-xs text-zinc-600">
        Deletes all Material Receive, Inspection, Stock/Rack and Stock History data.
        User accounts are not affected. This cannot be undone.
      </p>

      {done && (
        <div className="rounded-md border border-teal-700/30 bg-teal-800/10 text-teal-800 text-xs px-3 py-2">
          All warehouse data deleted.
        </div>
      )}

      {!open ? (
        <button
          type="button"
          onClick={() => { setOpen(true); setDone(false); }}
          className="inline-flex items-center gap-2 rounded-md border border-red-300 bg-white text-red-700 text-sm font-semibold px-4 py-2 hover:bg-red-50 transition-colors"
        >
          <Trash2 size={14} /> Delete All Data
        </button>
      ) : (
        <div className="space-y-2.5 rounded-md border border-red-300 bg-red-50/60 p-3">
          <label className="flex items-center gap-2 text-xs text-zinc-700 cursor-pointer">
            <input
              type="checkbox"
              checked={includeCutting}
              onChange={(e) => setIncludeCutting(e.target.checked)}
              className="h-4 w-4 accent-red-600"
            />
            Also delete Cutting Requisitions (recommended, since their issued qty comes from this stock)
          </label>

          <div className="text-xs text-zinc-600">
            Type <b className="text-red-700">{CONFIRM_TEXT}</b> to confirm:
          </div>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full rounded-md border border-red-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
          />

          {error && <div className="text-xs font-semibold text-red-700">{error}</div>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy || text !== CONFIRM_TEXT}
              className="inline-flex items-center gap-2 rounded-md bg-red-700 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 disabled:opacity-40 disabled:pointer-events-none"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              {busy ? "Deleting..." : "Delete Everything"}
            </button>
            <button
              type="button"
              onClick={close}
              disabled={busy}
              className="rounded-md border border-zinc-300 bg-white text-zinc-600 text-sm font-medium px-3 py-2 hover:border-teal-700 hover:text-teal-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
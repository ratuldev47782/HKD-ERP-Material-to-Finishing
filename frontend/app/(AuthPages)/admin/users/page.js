// frontend/app/(AuthPages)/admin/users/page.js

"use client";

import { Fragment, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/hooks/useAuth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

// Roles allowed on this page
const USER_MANAGER_ROLES = ["Developer", "ERP-Executive"];

// --- Dummy option lists for the dropdown fields. Replace with real data
// (e.g. fetched from the backend) whenever it's available. ---
const ROLE_OPTIONS = ["Developer", "ERP-Executive", "Manager", "Supervisor", "Operator", "Viewer"];
const DEPARTMENT_OPTIONS = ["Production", "Quality", "Merchandising", "HR", "IT", "Finance"];
const FLOOR_OPTIONS = ["1st Floor", "2nd Floor", "3rd Floor", "4th Floor", "5th Floor"];
const FACTORY_OPTIONS = ["Factory A", "Factory B", "Factory C"];

const fmt = (v) =>
  v && !Number.isNaN(new Date(v).getTime())
    ? new Date(v).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : "—";

// Converts a stored date value into the "YYYY-MM-DDTHH:mm" shape a
// <input type="datetime-local"> needs.
const toDatetimeLocal = (v) => {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function ManageUsersPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [users, setUsers] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  // holds the old_user_name of the row currently expanded for editing (or null)
  const [editingRow, setEditingRow] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [saving, setSaving] = useState(false);

  const canManageUsers = user && USER_MANAGER_ROLES.includes(user.role);

  useEffect(() => {
    if (!loading && !canManageUsers) {
      router.replace("/dashboard");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user]);

  useEffect(() => {
    if (!loading && canManageUsers) fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user]);

  async function fetchUsers() {
    setFetching(true);
    setError("");
    try {
      const res = await fetch(
        `${API_URL}/auth/users?requester_role=${encodeURIComponent(user.role)}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load users");
      setUsers(data.users);
    } catch (err) {
      setError(err.message);
    } finally {
      setFetching(false);
    }
  }

  function toggleEdit(u) {
    if (editingRow === u.user_name) {
      setEditingRow(null);
      setEditingUser(null);
      return;
    }
    setEditingRow(u.user_name);
    setEditingUser({
      old_user_name: u.user_name,
      user_name: u.user_name,
      email: u.email || "",
      password: u.password || "", // pre-filled with current password; edit to change it
      role: u.role || "",
      department: u.department || "",
      assigned_building: u.assigned_building || "",
      factory: u.factory || "",
      createdAt: toDatetimeLocal(u.createdAt),
    });
  }

  function updateField(name, value) {
    setEditingUser((prev) => ({ ...prev, [name]: value }));
  }

  async function saveEdit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...editingUser,
        requester_user_name: user.user_name,
        requester_role: user.role,
      };
      // Don't send an empty password — backend keeps the existing one.
      if (!payload.password) delete payload.password;

      const res = await fetch(`${API_URL}/auth/update`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Update failed");
      setEditingRow(null);
      setEditingUser(null);
      fetchUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading || !canManageUsers) return null;

  return (
    <section className="min-h-screen bg-zinc-100 px-4 py-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-zinc-800 mb-6">Manage Users</h1>

        {error && (
          <div className="mb-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {fetching ? (
          <p className="text-zinc-500">Loading users...</p>
        ) : (
          <div className="bg-white rounded-md  overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-300 bg-zinc-50 text-left text-zinc-500">
                <tr>
                  <th className="px-3 py-2.5">Name</th>
                  <th className="px-3 py-2.5">Email</th>
                  <th className="px-3 py-2.5">Role</th>
                  <th className="px-3 py-2.5">Department</th>
                  <th className="px-3 py-2.5">Floor</th>
                  <th className="px-3 py-2.5">Factory</th>
                  <th className="px-3 py-2.5">Joined</th>
                  <th className="px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <Fragment key={u.id}>
                    <tr className="border-t border-zinc-200 hover:bg-zinc-50">
                      <td className="px-4 py-2 flex items-center gap-2 whitespace-nowrap">
                        {u.profile_picture ? (
                          <div className="relative w-8 h-8 rounded-full overflow-hidden shrink-0">
                            <Image src={u.profile_picture} alt={u.user_name} fill className="object-cover" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-zinc-200 text-zinc-400 flex items-center justify-center text-xs font-semibold shrink-0">
                            {u.user_name?.[0]?.toUpperCase() || "?"}
                          </div>
                        )}
                        {u.user_name}
                      </td>
                      <td className="px-3 py-2.5">{u.email || "—"}</td>
                      <td className="px-3 py-2.5">{u.role}</td>
                      <td className="px-3 py-2.5">{u.department || "-"}</td>
                      <td className="px-3 py-2.5">{u.assigned_building}</td>
                      <td className="px-3 py-2.5">{u.factory}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-zinc-500">{fmt(u.createdAt)}</td>
                      <td className="px-4 py-2 text-right">
                        <button
                          onClick={() => toggleEdit(u)}
                          className="text-teal-800 hover:underline text-sm"
                        >
                          {editingRow === u.user_name ? "Close" : "Edit"}
                        </button>
                      </td>
                    </tr>

                    {editingRow === u.user_name && editingUser && (
                      <tr className="border-t border-zinc-200 bg-zinc-50/40">
                        <td colSpan={8} className="px-4 py-4">
                          <form onSubmit={saveEdit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div>
                              <label className="block text-xs font-medium text-zinc-600 mb-1">Name</label>
                              <input
                                type="text"
                                value={editingUser.user_name}
                                onChange={(e) => updateField("user_name", e.target.value)}
                                disabled={saving}
                                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/25"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-zinc-600 mb-1">Email</label>
                              <input
                                type="email"
                                value={editingUser.email}
                                onChange={(e) => updateField("email", e.target.value)}
                                disabled={saving}
                                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/25"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-zinc-600 mb-1">Password</label>
                              <input
                                type="text"
                                value={editingUser.password}
                                onChange={(e) => updateField("password", e.target.value)}
                                disabled={saving}
                                placeholder="No password set"
                                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/25"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-zinc-600 mb-1">Role</label>
                              <select
                                value={editingUser.role}
                                onChange={(e) => updateField("role", e.target.value)}
                                disabled={saving}
                                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/25"
                              >
                                <option value="">Select role</option>
                                {ROLE_OPTIONS.map((r) => (
                                  <option key={r} value={r}>{r}</option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-zinc-600 mb-1">Department</label>
                              <select
                                value={editingUser.department}
                                onChange={(e) => updateField("department", e.target.value)}
                                disabled={saving}
                                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/25"
                              >
                                <option value="">Select department</option>
                                {DEPARTMENT_OPTIONS.map((d) => (
                                  <option key={d} value={d}>{d}</option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-zinc-600 mb-1">Floor</label>
                              <select
                                value={editingUser.assigned_building}
                                onChange={(e) => updateField("assigned_building", e.target.value)}
                                disabled={saving}
                                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/25"
                              >
                                <option value="">Select floor</option>
                                {FLOOR_OPTIONS.map((f) => (
                                  <option key={f} value={f}>{f}</option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-zinc-600 mb-1">Factory</label>
                              <select
                                value={editingUser.factory}
                                onChange={(e) => updateField("factory", e.target.value)}
                                disabled={saving}
                                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/25"
                              >
                                <option value="">Select factory</option>
                                {FACTORY_OPTIONS.map((f) => (
                                  <option key={f} value={f}>{f}</option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-zinc-600 mb-1">Joined</label>
                              <input
                                type="datetime-local"
                                value={editingUser.createdAt}
                                onChange={(e) => updateField("createdAt", e.target.value)}
                                disabled={saving}
                                className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/25"
                              />
                            </div>

                            <div className="col-span-full flex gap-3 pt-1">
                              <button
                                type="submit"
                                disabled={saving}
                                className="bg-teal-800 hover:bg-teal-900 disabled:opacity-70 text-white font-semibold rounded-md px-4 py-2 text-sm flex items-center gap-2"
                              >
                                {saving ? (
                                  <>
                                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Saving...
                                  </>
                                ) : "Save Changes"}
                              </button>
                              <button
                                type="button"
                                onClick={() => { setEditingRow(null); setEditingUser(null); }}
                                disabled={saving}
                                className="border border-zinc-300 rounded-md px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
                              >
                                Cancel
                              </button>
                            </div>
                          </form>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
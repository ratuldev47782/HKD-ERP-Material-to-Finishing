// frontend/app/SideNavBarComponent/UserPanel.jsx
"use client";

import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import {
  X, User, Building2, Factory, Calendar, Clock, Hash,
  ShieldCheck, Pencil, KeyRound, LogOut, Check, Eye,
  EyeOff, Camera,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const FACTORIES = ["K-1", "K-2", "K-3"];
const BUILDINGS = ["A-2", "B-2", "A-3", "B-3", "A-4", "B-4", "A-5", "B-5"];

const inputCls =
  "w-full bg-zinc-50  border border-zinc-200  rounded-md px-3 py-2 text-[13px] text-zinc-800  placeholder:text-zinc-400 outline-none focus:border-zinc-400  focus:ring-2 focus:ring-zinc-200  transition-all";

function PasswordInput({ value, onChange, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={inputCls + " pr-9"}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600  transition-colors"
      >
        {show ? <EyeOff size={13} /> : <Eye size={13} />}
      </button>
    </div>
  );
}

export default function UserPanel({ open, onClose }) {
  const { user, logout, setAuth } = useAuth();
  const router = useRouter();
  const panelRef = useRef(null);

  const [view, setView] = useState("profile"); // "profile" | "edit" | "password"
  const [filePreview, setFilePreview] = useState(null);
  const [formData, setFormData] = useState({ user_name: "", role: "", assigned_building: "", factory: "" });
  const [isSaving, setIsSaving] = useState(false);

  const [passwordData, setPasswordData] = useState({ current_password: "", new_password: "", confirm_password: "" });
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // sync form when user changes
  useEffect(() => {
    if (user) {
      setFormData({ user_name: user.user_name || "", role: user.role || "", assigned_building: user.assigned_building || "", factory: user.factory || "" });
      setFilePreview(user.profile_picture || null);
    }
  }, [user]);

  // reset to profile view when closed
  useEffect(() => {
    if (!open) setTimeout(() => setView("profile"), 200);
  }, [open]);

  // close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose();
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose]);

  // close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    if (open) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!user || !open) return null;

  const initials = user.user_name?.slice(0, 2).toUpperCase();
  const createdDate = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" })
    : "N/A";
  const createdTime = user?.createdAt
    ? new Date(user.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
    : "N/A";

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { alert("শুধু JPG, PNG, বা WEBP image দিন।"); return; }

    const reader = new FileReader();
    reader.onloadend = () => setFilePreview(reader.result);
    reader.readAsDataURL(file);
  };

  async function handleSave() {
    setIsSaving(true);
    try {
      const res = await fetch(`${API_URL}/auth/update`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ old_user_name: user.user_name, ...formData, profile_picture: filePreview }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setAuth(data.user);
      setView("profile");
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSaving(false);
    }
  }

  const handlePasswordChange = async () => {
    setPasswordError(""); setPasswordSuccess("");
    if (!passwordData.current_password || !passwordData.new_password || !passwordData.confirm_password) { setPasswordError("সব fields পূরণ করুন"); return; }
    if (passwordData.new_password.length < 4) { setPasswordError("Password কমপক্ষে 4 character হতে হবে"); return; }
    if (passwordData.new_password !== passwordData.confirm_password) { setPasswordError("নতুন password মিলছে না"); return; }
    setIsChangingPassword(true);
    try {
      const res = await fetch(`${API_URL}/auth/change-password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_name: user.user_name, current_password: passwordData.current_password, new_password: passwordData.new_password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setPasswordSuccess("Password পরিবর্তন হয়েছে ✓");
      setPasswordData({ current_password: "", new_password: "", confirm_password: "" });
      setTimeout(() => { setView("profile"); setPasswordSuccess(""); }, 1500);
    } catch (err) {
      setPasswordError(err.message);
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleLogout = () => { logout(); onClose(); router.push("/login"); };

  const details = [
    { icon: Hash, label: "User ID", value: `#${user.id}` },
    { icon: User, label: "Username", value: user.user_name },
    { icon: ShieldCheck, label: "Role", value: user.role || "User" },
    { icon: Factory, label: "Factory", value: user.factory || "—" },
    { icon: Building2, label: "Building", value: user.assigned_building || "—" },
    { icon: Calendar, label: "Member since", value: createdDate },
    { icon: Clock, label: "Created at", value: createdTime },
  ];

  return (
    // Dropdown card anchored under the avatar button in the top navbar (h-14 = 56px)
    <div
      ref={panelRef}
      className="hidden md:flex fixed top-16 right-4 z-[50] w-80 max-h-[80vh]
        bg-white 
        border border-zinc-200 
        rounded-md  flex-col overflow-hidden
        animate-in fade-in slide-in-from-top-1 duration-150"
    >
      {/* ── HEADER ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200  flex-shrink-0">
        <div className="flex items-center gap-2">
          {view !== "profile" && (
            <button
              onClick={() => { setView("profile"); setPasswordError(""); setPasswordSuccess(""); }}
              className="h-6 w-6 rounded-md flex items-center justify-center text-zinc-400 hover:text-zinc-600  hover:bg-zinc-100  transition-all"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            </button>
          )}
          <span className="text-[13px] font-semibold text-zinc-800 ">
            {view === "profile" ? "Profile" : view === "edit" ? "Edit Profile" : "Change Password"}
          </span>
        </div>
        <button
          onClick={onClose}
          className="h-6 w-6 rounded-md flex items-center justify-center text-zinc-400 hover:text-zinc-600  hover:bg-zinc-100  transition-all"
        >
          <X size={13} />
        </button>
      </div>

      {/* ── CONTENT ── */}
      <div className="flex-1 overflow-y-auto">

        {/* ── PROFILE VIEW ── */}
        {view === "profile" && (
          <div>
            {/* avatar + name */}
            <div className="flex flex-col items-center py-6 px-4 border-b border-zinc-200 ">
              <div className="w-16 h-16 rounded-md overflow-hidden bg-zinc-100 ring-1 ring-zinc-300 mb-3">
                {filePreview
                  ? <img src={filePreview} alt="Profile" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-zinc-500  text-lg font-semibold">{initials}</div>
                }
              </div>
              <h3 className="text-[14px] font-semibold text-zinc-900 ">{user.user_name}</h3>
              <p className="text-[12px] text-zinc-500  mt-0.5">{user.role || "User"}</p>
              <div className="flex items-center gap-1.5 mt-2 flex-wrap justify-center">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-zinc-100  text-zinc-600 ">
                  <Factory size={9} />{user.factory || "No Factory"}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-zinc-100  text-zinc-600 ">
                  <Building2 size={9} />{user.assigned_building || "No Building"}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-teal-800/10  text-teal-800 ">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-700 " />Active
                </span>
              </div>
            </div>

            {/* details list */}
            <div className="divide-y divide-zinc-100 ">
              {details.map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="w-6 h-6 rounded-md bg-zinc-50  flex items-center justify-center flex-shrink-0">
                    <Icon size={11} className="text-zinc-400 " />
                  </div>
                  <span className="text-[11px] text-zinc-500  w-24 flex-shrink-0">{label}</span>
                  <span className="text-[12px] font-medium text-zinc-800  truncate">{value}</span>
                </div>
              ))}
            </div>

            {/* actions */}
            <div className="px-3 py-3 space-y-1 border-t border-zinc-200 ">
              <button
                onClick={() => setView("edit")}
                className="w-full flex items-center gap-2.5 h-8 px-3 rounded-md text-[12px] text-zinc-700 hover:bg-zinc-50 transition-all"
              >
                <Pencil size={13} />Edit profile
              </button>
              <button
                onClick={() => setView("password")}
                className="w-full flex items-center gap-2.5 h-8 px-3 rounded-md text-[12px] text-zinc-700 hover:bg-zinc-50 transition-all"
              >
                <KeyRound size={13} />Change password
              </button>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 h-8 px-3 rounded-md text-[12px] text-zinc-500  hover:bg-red-50  hover:text-red-700  transition-all"
              >
                <LogOut size={13} />Sign out
              </button>
            </div>
          </div>
        )}

        {/* ── EDIT VIEW ── */}
        {view === "edit" && (
          <div className="px-4 py-4 space-y-3">
            {/* avatar */}
            <div className="flex justify-center mb-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-md overflow-hidden bg-zinc-100  ring-1 ring-zinc-200 ">
                  {filePreview
                    ? <img src={filePreview} alt="Profile" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-zinc-500 text-lg font-semibold">{initials}</div>
                  }
                </div>
                <label className="absolute -bottom-1 -right-1 w-5 h-5 bg-teal-800  rounded-full flex items-center justify-center cursor-pointer  hover:scale-110 transition-transform">
                  <Camera size={10} className="text-white " />
                  <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                </label>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-zinc-500  mb-1.5">Username</label>
              <input value={formData.user_name} onChange={(e) => setFormData({ ...formData, user_name: e.target.value })} className={inputCls} placeholder="Username" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-zinc-500  mb-1.5">Role</label>
              <input value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })} className={inputCls} placeholder="Role" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-zinc-500  mb-1.5">Factory</label>
              <select value={formData.factory} onChange={(e) => setFormData({ ...formData, factory: e.target.value })} className={inputCls}>
                <option value="">Select factory</option>
                {FACTORIES.map((f) => <option key={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-zinc-500  mb-1.5">Building</label>
              <select value={formData.assigned_building} onChange={(e) => setFormData({ ...formData, assigned_building: e.target.value })} className={inputCls}>
                <option value="">Select building</option>
                {BUILDINGS.map((b) => <option key={b}>{b}</option>)}
              </select>
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={() => setView("profile")} className="flex-1 h-9 rounded-md text-[13px] font-medium text-zinc-500  bg-zinc-100  hover:bg-zinc-200  transition-all">
                Cancel
              </button>
              <button onClick={handleSave} disabled={isSaving} className="flex-1 h-9 rounded-md text-[13px] font-medium text-white bg-teal-800   hover:bg-teal-900  disabled:opacity-50 transition-all flex items-center justify-center gap-1.5">
                {isSaving
                  ? <div className="w-3.5 h-3.5 border border-white/40 border-t-white   rounded-full animate-spin" />
                  : <Check size={13} />
                }
                Save
              </button>
            </div>
          </div>
        )}

        {/* ── PASSWORD VIEW ── */}
        {view === "password" && (
          <div className="px-4 py-4 space-y-3">
            <div>
              <label className="block text-[11px] font-medium text-zinc-500  mb-1.5">Current password</label>
              <PasswordInput value={passwordData.current_password} onChange={(e) => setPasswordData({ ...passwordData, current_password: e.target.value })} placeholder="Enter current password" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-zinc-500  mb-1.5">New password</label>
              <PasswordInput value={passwordData.new_password} onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })} placeholder="Enter new password" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-zinc-500  mb-1.5">Confirm new password</label>
              <PasswordInput value={passwordData.confirm_password} onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })} placeholder="Confirm new password" />
            </div>

            {passwordError && (
              <p className="text-[12px] text-red-700  flex items-center gap-1.5">
                <X size={12} />{passwordError}
              </p>
            )}
            {passwordSuccess && (
              <p className="text-[12px] text-teal-800  flex items-center gap-1.5">
                <Check size={12} />{passwordSuccess}
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <button onClick={() => { setView("profile"); setPasswordError(""); setPasswordData({ current_password: "", new_password: "", confirm_password: "" }); }} className="flex-1 h-9 rounded-md text-[13px] font-medium text-zinc-500  bg-zinc-100  hover:bg-zinc-200  transition-all">
                Cancel
              </button>
              <button onClick={handlePasswordChange} disabled={isChangingPassword} className="flex-1 h-9 rounded-md text-[13px] font-medium text-white bg-teal-800   hover:bg-teal-900  disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                {isChangingPassword && <div className="w-3.5 h-3.5 border border-white/40 border-t-white   rounded-full animate-spin" />}
                Change
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
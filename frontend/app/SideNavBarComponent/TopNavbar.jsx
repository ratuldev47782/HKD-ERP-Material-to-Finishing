// frontend/app/SideNavBarComponent/TopNavbar.jsx

"use client";

import { useAuth } from "@/hooks/useAuth";
import {
  Home,
  LogIn,
  LogOut,
  Menu,
  X,
  ShieldUser,
  Palette,
  Settings,
  Warehouse,
  PackageSearch,
  MapPin,
  Boxes,
  Maximize,
  Minimize,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import UserPanel from "./UserPanel";

// Primary nav — lives in the top navbar now
const NAV_ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/admin/users", label: "Manage Users", icon: ShieldUser },
  
];

// Departments — mirrors DeptSidebar, used for the mobile drawer since the
// side navbar is desktop-only
const DEPARTMENTS = [
  { href: "/material-warehouse/material-receive", label: "Material Receive", icon: PackageSearch },
  { href: "/material-warehouse/location-assignment", label: "Location Assignment", icon: MapPin },
  { href: "/material-warehouse/material-stock", label: "Material Stock", icon: Boxes },
];

export default function TopNavbar() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Track fullscreen state so the icon/tooltip stays in sync,
  // e.g. if the user exits fullscreen with a remote/back button.
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const handleLogout = () => {
    setMobileMenuOpen(false);
    logout();
    router.push("/login");
  };

  const userName = user?.user_name || "";
  const isActive = (href) =>
    pathname === href || (href !== "/" && pathname?.startsWith(`${href}/`));

  return (
    <>
      {/* ── DESKTOP TOP NAVBAR ─────────────────────────────────────────── */}
      <header
        className="hidden md:flex fixed top-0 left-0 right-0 z-40 h-14 items-center justify-between px-4
        bg-white  
        border-b border-zinc-300 "
      >
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 flex-shrink-0">
            <Image
              src="/HKD_LOGO.png"
              alt="HKD"
              width={24}
              height={24}
              className="object-contain"
              priority
            />
            <span className="text-[14px] font-semibold text-zinc-800 ">
              HKD OUTDOOR INNOVATIONS LTD.
            </span>
          </Link>

          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2 h-8 px-3 rounded-md text-[13px] font-medium transition-all
                    ${
                      active
                        ? "bg-teal-800/10  text-zinc-900 "
                        : "text-zinc-600  hover:bg-zinc-50  hover:text-zinc-900 "
                    }`}
                >
                  <Icon size={15} strokeWidth={active ? 2 : 1.75} />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            className="h-8 w-8 rounded-md flex items-center justify-center text-zinc-500  hover:bg-zinc-50  transition-all"
          >
            {isFullscreen ? (
              <Minimize size={16} strokeWidth={1.75} />
            ) : (
              <Maximize size={16} strokeWidth={1.75} />
            )}
          </button>

          <div className="h-5 w-px bg-zinc-300  mx-1" />

          {user ? (
            <button
              onClick={() => setPanelOpen((p) => !p)}
              className={`flex items-center gap-2 h-8 pl-1 pr-2.5 rounded-md transition-all
                ${
                  panelOpen
                    ? "bg-teal-800/10 "
                    : "hover:bg-zinc-50 "
                }`}
            >
              <div className="h-6 w-6 rounded-full overflow-hidden bg-teal-100  flex items-center justify-center text-teal-700  text-[10px] font-bold flex-shrink-0 ring-1 ring-teal-700/30 ">
                {user?.profile_picture ? (
                  <img
                    src={user.profile_picture}
                    alt="Profile"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  userName?.charAt(0)?.toUpperCase() || "U"
                )}
              </div>
              <span className="text-[13px] font-medium text-zinc-800  max-w-[100px] truncate">
                {userName}
              </span>
            </button>
          ) : (
            <Link
              href="/login"
              className="flex items-center gap-2 h-8 px-3 rounded-md text-[13px] font-medium text-zinc-600  hover:bg-zinc-50  hover:text-zinc-900  transition-all"
            >
              <LogIn size={15} strokeWidth={1.75} />
              Login
            </Link>
          )}
        </div>
      </header>

      {/* ── USER PANEL (dropdown, anchored under avatar) ──────────────── */}
      <UserPanel open={panelOpen} onClose={() => setPanelOpen(false)} />

      {/* ── MOBILE TOP BAR ──────────────────────────────────────────── */}
      <header
        className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 flex items-center justify-between px-4
        bg-white  
        border-b border-zinc-300 "
      >
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/HKD_LOGO.png"
            alt="HKD"
            width={24}
            height={24}
            className="object-contain"
            priority
          />
          <span className="text-[14px] font-semibold text-zinc-800 ">
            HKD Outdoor
          </span>
        </Link>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            className="h-9 w-9 rounded-md flex items-center justify-center text-zinc-500  hover:bg-zinc-50  transition-all"
          >
            {isFullscreen ? (
              <Minimize size={17} strokeWidth={1.75} />
            ) : (
              <Maximize size={17} strokeWidth={1.75} />
            )}
          </button>
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="h-9 w-9 rounded-md flex items-center justify-center text-zinc-500  hover:bg-zinc-50  transition-all"
          >
            <Menu size={19} strokeWidth={1.75} />
          </button>
        </div>
      </header>

      {/* ── MOBILE BOTTOM NAV ───────────────────────────────────────── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40
        bg-white  
        border-t border-zinc-300 "
      >
        <div className="flex items-center justify-around px-2 py-1">
          {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center gap-1 px-3 py-2.5 min-w-0 flex-1 transition-all ${
                  active
                    ? "text-zinc-900 "
                    : "text-zinc-400 "
                }`}
              >
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-md transition-all ${active ? "bg-teal-800/10 " : ""}`}
                >
                  <Icon size={18} strokeWidth={active ? 2 : 1.75} />
                </div>
                <span className="text-[10px] font-medium leading-none truncate">
                  {label}
                </span>
              </Link>
            );
          })}

          {user ? (
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="flex flex-col items-center gap-1 px-3 py-2.5 min-w-0 flex-1 text-zinc-400  transition-all"
            >
              <div className="w-8 h-8 rounded-md flex items-center justify-center">
                <div className="h-6 w-6 rounded-full overflow-hidden bg-teal-100  flex items-center justify-center text-teal-700  text-[10px] font-bold ring-1 ring-teal-700/30 ">
                  {user?.profile_picture ? (
                    <img
                      src={user.profile_picture}
                      alt="Profile"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    userName?.charAt(0)?.toUpperCase() || "U"
                  )}
                </div>
              </div>
              <span className="text-[10px] font-medium leading-none">Me</span>
            </button>
          ) : (
            <Link
              href="/login"
              className="flex flex-col items-center gap-1 px-3 py-2.5 min-w-0 flex-1 text-zinc-400 "
            >
              <div className="w-8 h-8 rounded-md flex items-center justify-center">
                <LogIn size={18} strokeWidth={1.75} />
              </div>
              <span className="text-[10px] font-medium leading-none">
                Login
              </span>
            </Link>
          )}
        </div>
      </nav>

      {/* ── MOBILE DRAWER ───────────────────────────────────────────── */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-[60]">
          <div
            className="absolute inset-0 bg-black/40 "
            onClick={() => setMobileMenuOpen(false)}
          />

          <div
            className="absolute bottom-0 left-0 right-0
            bg-white 
            rounded-t-md  max-h-[80vh] overflow-y-auto"
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-9 h-1 bg-zinc-200  rounded-full" />
            </div>

            {/* User header */}
            {user && (
              <div className="flex items-center gap-3 px-5 py-3 mb-1">
                <div className="h-10 w-10 rounded-md overflow-hidden bg-teal-100  flex items-center justify-center text-teal-700  font-bold text-sm ring-1 ring-teal-700/30  flex-shrink-0">
                  {user?.profile_picture ? (
                    <img
                      src={user.profile_picture}
                      alt="Profile"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    userName?.charAt(0)?.toUpperCase() || "U"
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-zinc-900  truncate">
                    {userName || "User"}
                  </p>
                  <p className="text-[11px] text-zinc-500  truncate">
                    {user?.role || "Member"}
                  </p>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="h-8 w-8 rounded-md bg-zinc-100  flex items-center justify-center text-zinc-500  flex-shrink-0"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            <div className="h-px bg-black/5  mx-5 mb-2" />

            {/* Primary nav links */}
            <div className="px-3 space-y-0.5">
              {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
                const active = isActive(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 h-11 px-3 rounded-md text-[14px] font-medium transition-all
                      ${
                        active
                          ? "bg-teal-800/10  text-zinc-900 "
                          : "text-zinc-600  hover:bg-zinc-50  hover:text-zinc-900 "
                      }`}
                  >
                    <Icon size={17} strokeWidth={active ? 2 : 1.75} />
                    {label}
                  </Link>
                );
              })}
              {user && (
                <Link
                  href="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 h-11 px-3 rounded-md text-[14px] font-medium transition-all
                    ${
                      isActive("/dashboard")
                        ? "bg-teal-800/10  text-zinc-900 "
                        : "text-zinc-600  hover:bg-zinc-50  hover:text-zinc-900 "
                    }`}
                >
                  <Settings size={17} strokeWidth={1.75} />
                  Profile settings
                </Link>
              )}
            </div>

            <div className="h-px bg-black/5  mx-5 my-3" />

            {/* Departments (side navbar is desktop-only, so surface here on mobile) */}
            <p className="px-6 pb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400 ">
              Departments
            </p>
            <div className="px-3 space-y-0.5 pb-2">
              {DEPARTMENTS.map(({ href, icon: Icon, label }) => {
                const active = isActive(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 h-11 px-3 rounded-md text-[14px] font-medium transition-all
                      ${
                        active
                          ? "bg-teal-800/10  text-zinc-900 "
                          : "text-zinc-600  hover:bg-zinc-50  hover:text-zinc-900 "
                      }`}
                  >
                    <Icon size={17} strokeWidth={active ? 2 : 1.75} />
                    {label}
                  </Link>
                );
              })}
            </div>

            <div className="h-px bg-black/5  mx-5 my-3" />

            {/* Actions */}
            <div className="px-3 pb-8 space-y-0.5">
              <button
                onClick={toggleFullscreen}
                className="w-full flex items-center gap-3 h-11 px-3 rounded-md text-[14px] font-medium
                  text-zinc-600  hover:bg-zinc-50  hover:text-zinc-900  transition-all"
              >
                {isFullscreen ? (
                  <Minimize size={17} strokeWidth={1.75} />
                ) : (
                  <Maximize size={17} strokeWidth={1.75} />
                )}
                {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              </button>

              {user ? (
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 h-11 px-3 rounded-md text-[14px] font-medium text-red-700  hover:bg-red-50  transition-all"
                >
                  <LogOut size={17} strokeWidth={1.75} />
                  Sign out
                </button>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full flex items-center gap-3 h-11 px-3 rounded-md text-[14px] font-medium text-teal-800  hover:bg-teal-800/10  transition-all"
                >
                  <LogIn size={17} strokeWidth={1.75} />
                  Login
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
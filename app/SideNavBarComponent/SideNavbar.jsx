// app/SideNavBarComponent/SideNavbar.jsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/app/hooks/useAuth";
import {
  User,
  LogOut,
  LogIn,
  Home,
  FileInput,
  FileChartColumn, // ✅ new icon for rows
} from "lucide-react";

export default function SideNavbar() {
  const { auth, setAuth } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = () => {
    setAuth(null);
    router.push("/login");
  };

  // ✅ Safely read user info from auth (support both shapes)
  const user = auth?.user || auth || {};
  const userName = user?.user_name || "";
  const userRole = user?.role || "";

  // ✅ White / light FG theme (warehouse clean UI + safety amber highlight)
  const SIDEBAR_BG = "bg-gradient-to-b from-white via-slate-50 to-white";
  const SIDEBAR_BORDER = "border-r border-slate-200";

  const NAV_ACTIVE =
    "bg-amber-400 border-amber-300 text-slate-950 shadow-[0_0_12px_rgba(251,191,36,0.45)]";
  const NAV_INACTIVE =
    "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900";
  const LABEL_ACTIVE = "text-amber-700";
  const LABEL_INACTIVE = "text-slate-500 group-hover:text-slate-800";

  // ✅ active matcher (supports nested routes)
  const isActive = (href) =>
    pathname === href || (href !== "/" && pathname?.startsWith(`${href}/`));

  // ✅ clamp style (no Tailwind plugin needed)
  const clamp2 = {
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  };

  // ✅ compact UI
  const NAV_BTN = "h-8 w-8";
  const NAV_ICON_SIZE = 14;

  // ✅ UPDATED: allow wrapping + clamp to 2 lines (so "Salary Reports" becomes 2 lines)
  const NAV_LABEL_CLASS =
    "w-[52px] text-center text-[8px] font-medium leading-[9px] whitespace-normal break-words";

  const USER_AVATAR = "h-7 w-7";
  const USER_ICON_SIZE = 13;
  const USER_NAME_CLASS = "text-[8px] font-semibold text-slate-900 truncate";
  const USER_ROLE_CLASS = "text-[7px] text-slate-500 leading-[9px]";

  const AUTH_BTN = "h-8 w-8";
  const AUTH_ICON_SIZE = 14;

  // ✅ Your project routes
  const navItems = [
    { href: "/", label: "Home", icon: Home },
    { href: "/salary-entries", label: "Salary Entries", icon: FileInput },
    { href: "/salary-reports", label: "Salary Reports", icon: FileChartColumn },
  ];

  return (
    <aside
      className={`
        fixed inset-y-0 left-0 z-40
        h-full w-14
        ${SIDEBAR_BG}
        ${SIDEBAR_BORDER}
        flex flex-col
        py-3
      `}
    >
      <div className="flex-1 flex flex-col items-center justify-between gap-4">
        {/* TOP: Logo + Nav icons */}
        <div className="flex flex-col items-center gap-4">
          <Link href="/" aria-label="Home">
            <div className="flex items-center justify-center">
              <div className="h-9 w-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden shadow-sm">
                <Image
                  src="/HKD_LOGO.png"
                  alt="HKD Outdoor Innovations Ltd."
                  width={30}
                  height={30}
                  className="object-contain"
                  priority
                />
              </div>
            </div>
          </Link>

          {/* NAV ICONS + LABELS */}
          <div className="flex flex-col items-center gap-1 mt-1">
            {navItems.map(({ href, icon: Icon, label }) => {
              const active = isActive(href);

              return (
                <div key={href} className="relative group">
                  <Link
                    href={href}
                    className="flex flex-col items-center gap-[2px]"
                    title={label}
                    aria-label={label}
                  >
                    <div
                      className={`
                        flex items-center justify-center
                        ${NAV_BTN} rounded-xl border
                        transition-all
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70
                        ${active ? NAV_ACTIVE : NAV_INACTIVE}
                      `}
                    >
                      <Icon size={NAV_ICON_SIZE} />
                    </div>

                    {/* ✅ UPDATED: wrap labels (2 lines max) */}
                    <div
                      className={`
                        ${NAV_LABEL_CLASS}
                        ${active ? LABEL_ACTIVE : LABEL_INACTIVE}
                      `}
                      style={clamp2}
                    >
                      {label}
                    </div>
                  </Link>

                  {/* Tooltip */}
                  <div
                    className="
                      pointer-events-none
                      absolute left-12 top-1/2 -translate-y-1/2
                      opacity-0 scale-95
                      group-hover:opacity-100 group-hover:scale-100
                      transition-all duration-150
                    "
                  >
                    <div className="rounded-xl border border-slate-200 bg-white px-2 py-1 shadow-lg">
                      <div className="text-[10px] font-semibold text-slate-900 whitespace-nowrap">
                        {label}
                      </div>
                    </div>
                    <div className="absolute left-[-5px] top-1/2 -translate-y-1/2 h-2.5 w-2.5 rotate-45 border-l border-b border-slate-200 bg-white" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* BOTTOM: User info + auth icon */}
        <div className="flex flex-col items-center gap-2 pb-1 w-full">
          {auth && (
            <div className="relative group flex flex-col items-center">
              <div
                className={`${USER_AVATAR} rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-700`}
              >
                <User size={USER_ICON_SIZE} />
              </div>

              <div className="mt-1 w-[52px] text-center">
                <div className={USER_NAME_CLASS}>{userName || "User"}</div>
                <div className={USER_ROLE_CLASS} style={clamp2}>
                  {userRole || "Role"}
                </div>
              </div>
            </div>
          )}

          {/* Auth icon on right */}
          <div className="w-full flex justify-end pr-1">
            {auth ? (
              <button
                onClick={handleLogout}
                className={`
                  ${AUTH_BTN} rounded-xl border border-rose-200
                  bg-rose-50 text-rose-600
                  flex items-center justify-center
                  hover:bg-rose-100 hover:text-rose-700 hover:border-rose-300
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300/60
                  transition-all mr-1.5
                `}
                title="Logout"
                aria-label="Logout"
              >
                <LogOut size={AUTH_ICON_SIZE} />
              </button>
            ) : (
              <Link
                href="/login"
                className={`
                  ${AUTH_BTN} rounded-xl border border-sky-200
                  bg-sky-50 text-sky-600
                  flex items-center justify-center
                  hover:bg-sky-100 hover:text-sky-700 hover:border-sky-300
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/60
                  transition-all
                `}
                title="Login"
                aria-label="Login"
              >
                <LogIn size={AUTH_ICON_SIZE} />
              </Link>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}

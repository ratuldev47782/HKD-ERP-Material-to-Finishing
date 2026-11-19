"use client";

import { useEffect, useState } from "react";
import { useSidebar } from "@/app/provider/SidebarContext";
import {
  TrendingUp, Box, Wrench, Warehouse, PackageSearch, MapPin, Boxes,
  PanelLeft, PanelLeftClose, FolderClosed, ChevronRight, Scissors, ClipboardList, ClipboardCheck, LayoutDashboard, SquareDashedKanban, FileInput
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

// Every 30s, plus an immediate refetch on every route change (so marking a
// notification read on the Cutting Issue / Material Inspection page itself
// is reflected in the sidebar badge right away, instead of waiting for the
// next poll tick).
const NOTIFICATION_POLL_MS = 30000;

// Material Warehouse's pages are grouped into subfolders so the sidebar
// stays organized as more pages (Cutting Issue, etc.) get added later.
// Departments without "folders" can still use a flat "items" array.
const DEPARTMENTS = [
  {
    label: "Material Warehouse",
    icon: Warehouse,
    folders: [
      {
        label: "Dashboard",
        icon: FolderClosed,
        items: [
          { href: "/material-warehouse/dashboard", label: "Dashboard", icon: SquareDashedKanban },
          { href: "/material-warehouse/material-rack-view", label: "Material Rack View", icon: LayoutDashboard },
        ],
      },
      {
        label: "Receiving",
        icon: FolderClosed,
        items: [
          { href: "/material-warehouse/material-receive", label: "Material Receive", icon: PackageSearch },
          { href: "/material-warehouse/material-import", label: "Material Import", icon: FileInput },
          // notificationKey ties this item to the live unread count fetched
          // from GET /material-inspection/notifications below -- badge only
          // shows up on the item(s) that opt in with this key.
          { href: "/material-warehouse/material-inspection", label: "Material Inspection", icon: ClipboardCheck, notificationKey: "materialInspection" },
        ],
      },
      {
        label: "Stock",
        icon: FolderClosed,
        items: [
          { href: "/material-warehouse/material-stock", label: "Material Stock", icon: Boxes },
        ],
      },
      {
        label: "Cutting Issue",
        icon: FolderClosed,
        items: [
          // notificationKey ties this item to the live unread count fetched
          // from GET /cutting-issue/notifications below -- badge only shows
          // up on the item(s) that opt in with this key.
          { href: "/material-warehouse/cutting-issue", label: "Cutting Issue", icon: ClipboardList, notificationKey: "cuttingIssue" },
        ],
      },
    ],
  },
  {
    label: "Cutting",
    icon: Scissors,
    folders: [
      {
        label: "Requisition",
        icon: FolderClosed,
        items: [
          { href: "/cutting-requisition", label: "Cutting Requisition", icon: ClipboardList },
        ],
      },
    ],
  },
];

// Flattened view used when the sidebar is collapsed to icon-only mode —
// folder headers don't fit in a 52px rail, so every item shows as one
// flat icon list (folder grouping only matters once labels are visible).
const flattenItems = (dept) =>
  dept.items ? dept.items : dept.folders.flatMap((f) => f.items);

// Small red count pill, same visual language as the bell icon badge inside
// the Cutting Issue / Material Inspection pages themselves.
function NotifBadge({ count, className = "" }) {
  if (!count) return null;
  return (
    <span
      className={`inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-red-700 text-white text-[9px] font-bold ${className}`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

export default function DeptSidebar() {
  const { expanded, setExpanded } = useSidebar();
  const pathname = usePathname();

  // Open by default; key is `${deptLabel}::${folderLabel}`.
  const [openFolders, setOpenFolders] = useState(() => {
    const initial = {};
    DEPARTMENTS.forEach((dept) => {
      (dept.folders || []).forEach((folder) => {
        initial[`${dept.label}::${folder.label}`] = true;
      });
    });
    return initial;
  });

  const toggleFolder = (key) => setOpenFolders((prev) => ({ ...prev, [key]: !prev[key] }));

  const isActive = (href) =>
    pathname === href || pathname?.startsWith(`${href}/`);

  // Live unread counts, keyed by notificationKey ("cuttingIssue" and
  // "materialInspection" for now, but keyed so more pages can opt in later
  // without new state).
  const [unreadCounts, setUnreadCounts] = useState({});

  const fetchCuttingIssueUnread = async () => {
    try {
      const res = await fetch(`${API_URL}/cutting-issue/notifications`, { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      setUnreadCounts((prev) => ({ ...prev, cuttingIssue: data.unreadCount || 0 }));
    } catch {
      /* ignore -- sidebar badge just stays at its last known value */
    }
  };

  const fetchMaterialInspectionUnread = async () => {
    try {
      const res = await fetch(`${API_URL}/material-inspection/notifications`, { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      setUnreadCounts((prev) => ({ ...prev, materialInspection: data.unreadCount || 0 }));
    } catch {
      /* ignore -- sidebar badge just stays at its last known value */
    }
  };

  const fetchAllUnread = () => {
    fetchCuttingIssueUnread();
    fetchMaterialInspectionUnread();
  };

  useEffect(() => {
    fetchAllUnread();
    const interval = setInterval(fetchAllUnread, NOTIFICATION_POLL_MS);
    return () => clearInterval(interval);
  }, []);

  // Refetch on every route change -- catches the case where the user just
  // marked a notification read on the Cutting Issue / Material Inspection
  // page (or opened it, which also marks things read) and navigated
  // elsewhere; the badge should reflect that immediately rather than up to
  // 30s later.
  useEffect(() => {
    fetchAllUnread();
  }, [pathname]);

  const renderLink = ({ href, icon: Icon, label, notificationKey }, indent = false) => {
    const active = isActive(href);
    const unread = notificationKey ? unreadCounts[notificationKey] || 0 : 0;
    return (
      <Link
        key={href}
        href={href}
        title={!expanded ? `${label}${unread ? ` (${unread} unread)` : ""}` : undefined}
        className={`group relative flex items-center gap-3 h-8 rounded-md px-2 transition-all duration-150
          ${
            active
              ? "bg-black/[0.08]  text-zinc-900 "
              : "text-zinc-600  hover:bg-black/5  hover:text-zinc-900 "
          }
          ${expanded ? (indent ? "ml-4" : "") : "justify-center"}`}
      >
        <Icon size={15} strokeWidth={active ? 2 : 1.75} className="flex-shrink-0" />
        {expanded ? (
          <>
            <span className="text-[13px] font-medium truncate leading-none">{label}</span>
            {unread > 0 && <NotifBadge count={unread} className="ml-auto" />}
          </>
        ) : (
          // Collapsed icon-only rail: no room for a pill, so a small red dot
          // on the icon's corner signals "something's unread" instead.
          unread > 0 && (
            <span className="absolute top-0.5 right-0.5 h-2 w-2 rounded-full bg-red-700" />
          )
        )}
      </Link>
    );
  };

  const renderDepartmentIcon = (dept) => {
    const Icon = dept.icon;
    // Sum unread counts across every item in this department that opted
    // into a notificationKey, so the collapsed department icon still
    // signals "something needs attention" even though item-level links
    // aren't shown in collapsed mode.
    const deptUnread = flattenItems(dept).reduce(
      (sum, item) => sum + (item.notificationKey ? unreadCounts[item.notificationKey] || 0 : 0),
      0
    );
    return (
      <div
        key={dept.label}
        className="relative flex items-center justify-center h-8 w-8 rounded-md text-zinc-600 "
        title={`${dept.label}${deptUnread ? ` (${deptUnread} unread)` : ""}`}
      >
        <Icon size={18} strokeWidth={1.75} className="flex-shrink-0" />
        {deptUnread > 0 && (
          <span className="absolute top-0.5 right-0.5 h-2 w-2 rounded-full bg-red-700" />
        )}
      </div>
    );
  };

  return (
    // top-14 = sits directly below the 56px top navbar. Desktop-only —
    // departments are reachable on mobile via the drawer in TopNavbar.
    <aside
      className={`hidden md:flex fixed left-0 top-14 bottom-0 z-30 flex-col
        bg-white 
        border-r border-black/5 
        transition-all duration-200 ease-in-out
        ${expanded ? "w-52" : "w-[52px]"}`}
    >
      {/* TOP — Label + Toggle */}
      <div
        className={`flex items-center h-12 px-3 flex-shrink-0 ${expanded ? "justify-between" : "justify-center"}`}
      >
        {expanded && (
          <span className="text-[12px] font-semibold text-zinc-600  truncate uppercase tracking-wide">
            Departments
          </span>
        )}
        <button
          onClick={() => setExpanded((p) => !p)}
          className="h-7 w-7 rounded-md flex items-center justify-center text-zinc-400  hover:text-zinc-700  hover:bg-black/5  transition-all"
        >
          {expanded ? <PanelLeftClose size={15} /> : <PanelLeft size={15} />}
        </button>
      </div>

      {/* DEPARTMENT ITEMS */}
      <div className="flex-1 flex flex-col gap-0.5 px-2 py-1 overflow-hidden">
        {DEPARTMENTS.map((dept) => (
          <div key={dept.label} className="flex flex-col gap-0.5">
            {/* Collapsed: show only department icon */}
            {!expanded && renderDepartmentIcon(dept)}

            {/* Expanded: show full department with folders */}
            {expanded && (
              <>
                <div className="flex items-center gap-2 h-8 px-2 text-zinc-500 ">
                  <dept.icon size={14} strokeWidth={1.75} className="flex-shrink-0" />
                  <span className="text-[11px] font-semibold uppercase tracking-wide truncate">{dept.label}</span>
                </div>

                {/* Folders */}
                {dept.folders && dept.folders.map((folder) => {
                  const key = `${dept.label}::${folder.label}`;
                  const isOpen = openFolders[key];
                  const folderUnread = folder.items.reduce(
                    (sum, item) => sum + (item.notificationKey ? unreadCounts[item.notificationKey] || 0 : 0),
                    0
                  );
                  return (
                    <div key={key} className="flex flex-col gap-0.5">
                      <button
                        onClick={() => toggleFolder(key)}
                        className="flex items-center gap-1.5 h-7 px-2 ml-1 rounded-md text-zinc-500  hover:bg-black/5  hover:text-zinc-800  transition-all"
                      >
                        <ChevronRight size={12} strokeWidth={2} className={`flex-shrink-0 transition-transform duration-150 ${isOpen ? "rotate-90" : ""}`} />
                        <folder.icon size={13} strokeWidth={1.75} className="flex-shrink-0" />
                        <span className="text-[11px] font-medium truncate">{folder.label}</span>
                        {!isOpen && folderUnread > 0 && <NotifBadge count={folderUnread} className="ml-auto mr-1" />}
                      </button>
                      {isOpen && (
                        <div className="flex flex-col gap-0.5">
                          {folder.items.map((item) => renderLink(item, true))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Flat items if no folders */}
                {dept.items && dept.items.map((item) => renderLink(item))}
              </>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}
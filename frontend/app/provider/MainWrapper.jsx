// frontend/app/provider/MainWrapper.jsx
"use client";
import { useSidebar } from "./SidebarContext";

export default function MainWrapper({ children }) {
  const { expanded } = useSidebar();
  return (
    <main
      className={`flex-1 min-h-screen bg-zinc-100 text-zinc-900 transition-all duration-300
        pt-14 pb-16 md:pb-0
        ${expanded ? "md:ml-52" : "md:ml-13"}`}
    >
      {children}
    </main>
  );
}
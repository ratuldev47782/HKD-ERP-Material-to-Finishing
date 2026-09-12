"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import SignInOut from "./AuthComponents/SignInOut";
import { useAuth } from "@/app/hooks/useAuth";
import {
  ArrowRight,
  BarChart3,
  BadgeDollarSign,
  FilePenLine,
  Lock,
  ShieldCheck,
  Sparkles,
  Building2,
} from "lucide-react";

function ActionCard({ href, title, desc, Icon, disabled }) {
  const finalHref = disabled ? "/login" : href;

  return (
    <Link
      href={finalHref}
      aria-disabled={disabled}
      className={[
        "group relative overflow-hidden rounded-2xl border bg-white/70 p-4 shadow-sm backdrop-blur",
        "transition hover:-translate-y-0.5 hover:shadow-md",
        disabled ? "border-slate-200/70" : "border-slate-200/80",
      ].join(" ")}
    >
      <div className="absolute inset-0 opacity-0 transition group-hover:opacity-100 [background:radial-gradient(circle_at_25%_10%,rgba(15,23,42,0.08),transparent_55%)]" />

      <div className="relative flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-900/5 ring-1 ring-slate-900/5">
          <Icon className="h-5 w-5 text-slate-800" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="truncate text-sm font-semibold text-slate-900">
              {title}
            </h3>
            <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-700" />
          </div>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">{desc}</p>
        </div>
      </div>

      {disabled ? (
        <div className="relative mt-3 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
          <Lock className="h-3.5 w-3.5" />
          Login required
        </div>
      ) : (
        <div className="relative mt-3 inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
          <Sparkles className="h-3.5 w-3.5" />
          Quick access
        </div>
      )}
    </Link>
  );
}

export default function Home() {
  const { auth } = useAuth();
  const isAuthed = Boolean(auth);

  // ✅ Change these routes if your pages use different paths
  const actions = [
    {
      href: "/salary-entries",
      title: "Salary Entries",
      desc: "Create, edit, delete salary entries floor-wise and line-wise.",
      Icon: FilePenLine,
    },
    {
      href: "/salary-reports",
      title: "Salary Reports",
      desc: "View totals by Line / Floor / Month / Year with clean filters.",
      Icon: BarChart3,
    },
    
  ];

  return (
    <main className="min-h-screen bg-slate-50">
      {/* HERO */}
      <section className="relative isolate overflow-hidden">
        {/* Background image */}
        <div className="absolute inset-0">
          <Image
            src="/HDK%20Building%20Image.jpeg"
            alt="HKD Building"
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          {/* overlays */}
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-900/55 to-slate-30" />
          <div className="absolute inset-0 opacity-35 [background:radial-gradient(circle_at_15%_10%,rgba(255,255,255,0.20),transparent_55%),radial-gradient(circle_at_85%_15%,rgba(255,255,255,0.16),transparent_60%)]" />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-slate-50 to-transparent" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Top bar */}
          <header className="flex items-center justify-between gap-3 py-5">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/20 backdrop-blur">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/90 shadow-sm">
                  <Image
                    src="/HKD_LOGO.png"
                    alt="HKD Logo"
                    width={22}
                    height={22}
                    className="h-5 w-5"
                  />
                </div>
              </div>

              <div className="leading-tight">
                <div className="text-sm font-semibold text-white/90">
                  HKD Outdoor Innovations Ltd.
                </div>
                <div className="text-xs text-white/70">
                  Salary Entry & Report System
                </div>
              </div>
            </div>

            <SignInOut />
          </header>

          {/* Content */}
          <div className="grid gap-6 pb-10 pt-8 lg:grid-cols-12 lg:items-start">
            {/* Left: text */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="lg:col-span-7"
            >
              <div className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white/90 backdrop-blur">
                <Building2 className="h-4 w-4" />
                Centralized payroll insights
                <span className="text-white/40">•</span>
                Fast & secure
              </div>

              <h1 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Salary Entry & Reports
                <span className="block text-white/80 text-xl sm:text-2xl font-semibold mt-2">
                  floor-wise, line-wise, month-wise insights.
                </span>
              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/80">
                Enter salary data quickly, keep USD rates month-wise, and generate
                clean reports for operations. Everything in one place—simple,
                consistent and audit-friendly.
              </p>

              {/* highlights */}
              <div className="mt-5 flex flex-wrap gap-2">
                {[
                  
                  { icon: Sparkles, text: "Fast filtering" },
                  { icon: BarChart3, text: "Summary totals" },
                ].map((b) => (
                  <div
                    key={b.text}
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white/85 backdrop-blur"
                  >
                    <b.icon className="h-4 w-4" />
                    {b.text}
                  </div>
                ))}
              </div>

              {/* CTA */}
              <div className="mt-7 flex flex-col gap-2 sm:flex-row">
                <Link
                  href={isAuthed ? "/salary-entries" : "/login"}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-white/20 transition hover:bg-slate-50 active:scale-[0.99]"
                >
                  {isAuthed ? "Go to Salary Entries" : "Login to Continue"}
                  <ArrowRight className="h-4 w-4" />
                </Link>

                <Link
                  href={isAuthed ? "/salary-reports" : "/login"}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white/10 px-5 py-2.5 text-sm font-semibold text-white ring-1 ring-white/20 backdrop-blur transition hover:bg-white/15 active:scale-[0.99]"
                >
                  View Reports
                  <BarChart3 className="h-4 w-4" />
                </Link>
              </div>

              {isAuthed ? (
                <div className="mt-4 text-xs text-white/75">
                  Welcome,{" "}
                  <span className="font-semibold text-white">
                    {auth?.user_name}
                  </span>
                  . Choose a module from the right panel.
                </div>
              ) : (
                <div className="mt-4 text-xs text-white/75">
                  Login to access salary entries, USD rates, and reports.
                </div>
              )}
            </motion.div>

            {/* Right: quick actions */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.05 }}
              className="lg:col-span-5"
            >
              <div className="rounded-3xl border border-white/15 bg-white/10 p-4 shadow-sm backdrop-blur">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-white">
                      Quick Actions
                    </h2>
                    <p className="text-[11px] text-white/70">
                      Jump into what you need in one click.
                    </p>
                  </div>

                  
                </div>

                <div className="mt-4 grid gap-3">
                  {actions.map((a) => (
                    <ActionCard
                      key={a.title}
                      href={a.href}
                      title={a.title}
                      desc={a.desc}
                      Icon={a.Icon}
                      disabled={!isAuthed}
                    />
                  ))}
                </div>

                <div className="mt-4 rounded-2xl border border-white/15 bg-white/10 p-3 text-[11px] text-white/75">
                  Tip: Keep USD Rate updated monthly to ensure accurate USD
                  conversion in entries and reports.
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 text-xs text-slate-500 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} HKD Outdoor Innovations Ltd.</span>
          <span className="text-slate-400">
            Salary Entry & Report 
          </span>
        </div>
      </footer>
    </main>
  );
}

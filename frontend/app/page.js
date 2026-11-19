// frontend/app/page.js

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import {
  ArrowUpRight,
  MapPin,
  Factory,
  Boxes,
  ClipboardCheck,
  ShieldCheck,
} from "lucide-react";

// Numeric targets so the stat row can count up on load instead of
// just appearing — decimals/suffix control how each one is formatted.
const STAT_DEFS = [
  { target: 36, decimals: 0, suffix: "+", label: "Years Legacy" },
  { target: 10, decimals: 0, suffix: "K+", label: "Workforce" },
  { target: 4, decimals: 0, suffix: "", label: "Product Lines" },
  { target: 3, decimals: 0, suffix: "", label: "KEPZ Sectors" },
];

const pillars = [
  { icon: Boxes, label: "Waterproof Rainwear" },
  { icon: Factory, label: "Insulated Outerwear" },
  { icon: ClipboardCheck, label: "Sportswear & Fleece" },
  { icon: ShieldCheck, label: "Ski & Hunting Wear" },
];

const h1Lines = [
  { text: "Engineered for", delay: "0.15s" },
  { text: "Outdoor Apparel.", delay: "0.28s", emphasis: true },
  { text: "Powering", delay: "0.41s" },
  { text: "HKD Innovations.", delay: "0.54s" },
];

// Loose "thread" particles that drift up the screen ambiently —
// fixed seeded values so server/client render match (no Math.random
// directly in JSX).
const PARTICLES = [
  { left: "6%", size: 16, rot: 18, dur: 17, delay: 0 },
  { left: "14%", size: 10, rot: -12, dur: 21, delay: 3 },
  { left: "23%", size: 13, rot: 30, dur: 15, delay: 6 },
  { left: "34%", size: 9, rot: -22, dur: 24, delay: 1.5 },
  { left: "47%", size: 15, rot: 10, dur: 19, delay: 8 },
  { left: "58%", size: 11, rot: -30, dur: 16, delay: 4.5 },
  { left: "68%", size: 14, rot: 24, dur: 22, delay: 10 },
  { left: "77%", size: 10, rot: -16, dur: 18, delay: 2 },
  { left: "88%", size: 12, rot: 14, dur: 20, delay: 7 },
  { left: "94%", size: 9, rot: -8, dur: 25, delay: 12 },
];

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function useCountUp(defs, { duration = 1400, delay = 500 } = {}) {
  const [values, setValues] = useState(defs.map(() => 0));
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      setValues(defs.map((d) => d.target));
      return;
    }

    let raf;
    const start = performance.now() + delay;

    const tick = (now) => {
      const elapsed = now - start;
      if (elapsed < 0) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutCubic(progress);
      setValues(defs.map((d) => d.target * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [defs, duration, delay]);

  return values;
}

// Custom cursor: a small solid dot that tracks the mouse exactly, plus a
// larger ring that eases toward it (classic "lag" cursor feel). Hovering
// any link/button swaps it into a bigger "interactive" ring so the whole
// page cursor visibly changes design, not just the hero image.
function useCustomCursor() {
  const dotRef = useRef(null);
  const ringRef = useRef(null);
  const target = useRef({ x: -100, y: -100 });
  const ring = useRef({ x: -100, y: -100 });
  const [active, setActive] = useState(false);
  const [interactive, setInteractive] = useState(false);
  const [pressed, setPressed] = useState(false);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const isCoarsePointer = window.matchMedia?.("(pointer: coarse)").matches;
    if (prefersReducedMotion || isCoarsePointer) return; // leave native cursor on touch/reduced-motion

    const handleMove = (e) => {
      target.current = { x: e.clientX, y: e.clientY };
      setActive(true);
      if (dotRef.current) {
        dotRef.current.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -50%)`;
      }
      const el = e.target.closest?.("a, button, [role='button']");
      setInteractive(Boolean(el));
    };
    const handleLeave = () => setActive(false);
    const handleDown = () => setPressed(true);
    const handleUp = () => setPressed(false);

    window.addEventListener("mousemove", handleMove);
    document.documentElement.addEventListener("mouseleave", handleLeave);
    window.addEventListener("mousedown", handleDown);
    window.addEventListener("mouseup", handleUp);

    let raf;
    const tick = () => {
      ring.current.x += (target.current.x - ring.current.x) * 0.18;
      ring.current.y += (target.current.y - ring.current.y) * 0.18;
      if (ringRef.current) {
        ringRef.current.style.transform = `translate(${ring.current.x}px, ${ring.current.y}px) translate(-50%, -50%)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      document.documentElement.removeEventListener("mouseleave", handleLeave);
      window.removeEventListener("mousedown", handleDown);
      window.removeEventListener("mouseup", handleUp);
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { dotRef, ringRef, active, interactive, pressed };
}

export default function HomePage() {
  const { user } = useAuth();
  const counts = useCountUp(STAT_DEFS);
  const cursor = useCustomCursor();

  // magnetic pull for the primary CTA
  const ctaRef = useRef(null);
  const [magnet, setMagnet] = useState({ x: 0, y: -1 });
  const handleCtaMove = (e) => {
    const el = ctaRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const relX = e.clientX - rect.left - rect.width / 2;
    const relY = e.clientY - rect.top - rect.height / 2;
    setMagnet({ x: clamp(relX * 0.28, -9, 9), y: clamp(relY * 0.35, -7, 7) - 1 });
  };
  const resetMagnet = () => setMagnet({ x: 0, y: -1 });

  const particles = useMemo(() => PARTICLES, []);

  // ring sizing: bigger over links/buttons, slightly smaller while pressed
  const ringSize = cursor.interactive ? 46 : cursor.pressed ? 22 : 28;

  return (
    <>
      {/* Only what Tailwind genuinely can't express inline: the font
         import and the @keyframes definitions referenced below via
         Tailwind's animate-[...] arbitrary-value syntax. */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=DM+Sans:wght@300;400;500&display=swap');

        @keyframes hkd-rise {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes hkd-line-up {
          from { opacity: 0; transform: translateY(100%); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes hkd-clip-reveal {
          from { clip-path: inset(0 0 100% 0); }
          to   { clip-path: inset(0 0 0% 0); }
        }
        @keyframes hkd-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes hkd-glow-pulse {
          0%, 100% { opacity: 0.7; transform: scale(1); }
          50%      { opacity: 1;   transform: scale(1.08); }
        }
        @keyframes hkd-glow-pulse-2 {
          0%, 100% { opacity: 0.5; transform: scale(1) translate(0, 0); }
          50%      { opacity: 0.9; transform: scale(1.15) translate(10px, -10px); }
        }
        @keyframes hkd-pulse-ring {
          0%, 100% { box-: 0 0 0 3px rgba(17,94,89,0.22); }
          50%      { box-: 0 0 0 5px rgba(17,94,89,0.1); }
        }
        @keyframes hkd-bob {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-2px); }
        }
        @keyframes hkd-stitch-run {
          from { background-position-y: 0; }
          to   { background-position-y: -18px; }
        }
        @keyframes hkd-needle-shuttle {
          0%   { top: 4%; }
          48%  { top: 96%; }
          50%  { top: 96%; }
          98%  { top: 4%; }
          100% { top: 4%; }
        }
        @keyframes hkd-float-up {
          0%   { transform: translateY(0) rotate(var(--hkd-rot, 20deg)); opacity: 0; }
          10%  { opacity: 0.35; }
          90%  { opacity: 0.35; }
          100% { transform: translateY(-115vh) rotate(var(--hkd-rot, 20deg)); opacity: 0; }
        }
        @keyframes hkd-weave-pan {
          from { background-position: 0 0, 0 0; }
          to   { background-position: 44px 44px, -44px 44px; }
        }
        @keyframes hkd-icon-idle {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-3px); }
        }
        @keyframes hkd-blink {
          0%, 45% { opacity: 1; }
          50%, 95% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes hkd-breathe {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.06); }
        }
        @keyframes hkd-scan-sweep {
          0%   { left: -20%; opacity: 0; }
          6%   { opacity: 0.55; }
          42%  { left: 108%; opacity: 0.55; }
          50%  { opacity: 0; }
          100% { opacity: 0; left: 108%; }
        }
        @keyframes hkd-underline-grow {
          from { width: 0; }
          to   { width: 100%; }
        }
        /* Ambient auto zoom-in / zoom-out on the hero image — smooth,
           continuous "breathing" loop, always on. */
        @keyframes hkd-auto-zoom {
          0%, 100% { transform: scale(1.04); }
          50%      { transform: scale(1.13); }
        }

        /* Custom homepage cursor: hide the native cursor everywhere on
           this page — our own dot + ring stand in for it instead. */
        .hkd-cursor-zone, .hkd-cursor-zone * {
          cursor: none !important;
        }
      `}</style>

      <div className="hkd-cursor-zone relative grid h-dvh w-full grid-cols-1 grid-rows-[1fr_auto] overflow-hidden bg-zinc-100 text-zinc-900 [font-family:'DM_Sans',sans-serif]   md:h-screen md:grid-cols-2 md:grid-rows-1">

        {/* custom cursor: small solid dot, exact position, hides once
           the ring grows for interactive elements */}
        <div
          ref={cursor.dotRef}
          aria-hidden="true"
          className="pointer-events-none fixed left-0 top-0 z-[9999] rounded-full bg-teal-800 transition-[opacity,width,height] duration-150 ease-out "
          style={{
            width: cursor.interactive ? 0 : 6,
            height: cursor.interactive ? 0 : 6,
            opacity: cursor.active ? 1 : 0,
          }}
        />
        {/* custom cursor: larger ring that eases/lags behind the dot,
           swelling and changing color+icon over links/buttons */}
        <div
          ref={cursor.ringRef}
          aria-hidden="true"
          className="pointer-events-none fixed left-0 top-0 z-[9998] flex items-center justify-center rounded-full border transition-[width,height,border-color,background-color,opacity] duration-200 ease-out"
          style={{
            width: ringSize,
            height: ringSize,
            borderColor: cursor.interactive ? "#115e59" : "rgba(17,94,89,0.55)",
            backgroundColor: cursor.interactive ? "rgba(17,94,89,0.14)" : "transparent",
            opacity: cursor.active ? 1 : 0,
          }}
        >
          {cursor.interactive && (
            <ArrowUpRight
              size={15}
              strokeWidth={2}
              className="text-teal-800 [animation:hkd-fade-in_0.15s_ease_both]"
            />
          )}
        </div>

        {/* film-grain overlay — kept as an inline style since the encoded
           SVG data URI isn't safe to embed inside a Tailwind arbitrary value */}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-0 opacity-45"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E\")",
          }}
        />

        {/* ambient drifting thread particles across the whole page */}
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[1] overflow-hidden motion-reduce:hidden">
          {particles.map((p, i) => (
            <span
              key={i}
              className="absolute bottom-[-40px] rounded-full bg-teal-800 [animation-name:hkd-float-up] [animation-timing-function:linear] [animation-iteration-count:infinite]"
              style={{
                left: p.left,
                width: p.size,
                height: 2,
                "--hkd-rot": `${p.rot}deg`,
                animationDuration: `${p.dur}s`,
                animationDelay: `${p.delay}s`,
              }}
            />
          ))}
        </div>

        {/* signature: stitched-seam divider, desktop only */}
        <div
          aria-hidden="true"
          className="absolute left-1/2 top-0 z-[3] hidden h-full w-[3px] -translate-x-1/2 opacity-0 [animation:hkd-stitch-run_1.1s_linear_infinite,hkd-fade-in_0.6s_ease_0.9s_forwards] [background-image:repeating-linear-gradient(to_bottom,rgba(17,94,89,0.55)_0px,rgba(17,94,89,0.55)_9px,transparent_9px,transparent_18px)] [background-size:3px_18px] motion-reduce:hidden  md:block"
        />
        <div
          aria-hidden="true"
          className="absolute left-1/2 top-0 z-[4] hidden h-[9px] w-[9px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal-800 opacity-0 [animation:hkd-needle-shuttle_5.2s_cubic-bezier(0.65,0,0.35,1)_1.4s_infinite,hkd-fade-in_0.5s_ease_1.4s_forwards] motion-reduce:hidden   md:block"
        />

        {/* LEFT */}
        <div className="relative z-[2] flex flex-col justify-between overflow-hidden border-b border-[rgba(24,24,27,0.09)] p-6  md:border-b-0 md:px-10 md:pb-7 md:pt-9">

          {/* woven fabric-weave texture, slowly panning */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.05] [animation:hkd-weave-pan_9s_linear_infinite] motion-reduce:animate-none"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, rgba(24,24,27,0.6) 0, rgba(24,24,27,0.6) 1px, transparent 1px, transparent 12px), repeating-linear-gradient(-45deg, rgba(24,24,27,0.6) 0, rgba(24,24,27,0.6) 1px, transparent 1px, transparent 12px)",
              backgroundSize: "44px 44px, 44px 44px",
            }}
          />

          {/* ambient glow blobs */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-[100px] -left-[60px] h-[340px] w-[340px] rounded-full [animation:hkd-glow-pulse_6s_ease-in-out_infinite] [background:radial-gradient(circle,rgba(17,94,89,0.1)_0%,transparent_68%)] motion-reduce:animate-none"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-[40px] -top-[60px] h-[260px] w-[260px] rounded-full [animation:hkd-glow-pulse-2_8s_ease-in-out_infinite] [background:radial-gradient(circle,rgba(17,94,89,0.08)_0%,transparent_70%)] motion-reduce:animate-none"
          />

          <div
            className="relative flex items-center gap-[9px] opacity-0 [animation:hkd-rise_0.7s_cubic-bezier(0.22,1,0.36,1)_0.05s_forwards] motion-reduce:opacity-100 motion-reduce:[animation:none]"
          >
            <div className="[animation:hkd-breathe_4s_ease-in-out_infinite] motion-reduce:animate-none">
              <Image src="/HKD_LOGO.png" alt="StitchFlow" width={26} height={26} className="object-contain opacity-85" priority />
            </div>
            <span className="text-[12.5px] font-medium tracking-[0.04em] text-zinc-500 ">
              StitchFlow Garments ERP
            </span>
          </div>

          <div className="relative">
            <span
              className="mb-[1.1rem] inline-flex items-center gap-[5px] text-[10.5px] font-medium uppercase tracking-[0.13em] text-teal-800 opacity-0 [animation:hkd-rise_0.7s_cubic-bezier(0.22,1,0.36,1)_0.15s_forwards] motion-reduce:opacity-100 motion-reduce:[animation:none] "
            >
              <MapPin size={10} strokeWidth={2.5} className="[animation:hkd-bob_2.4s_ease-in-out_infinite] motion-reduce:animate-none" />
              KEPZ, Chattogram · Since 1990
            </span>

            <h1 className="mb-[1.1rem] [font-family:'Playfair_Display',serif] text-[clamp(2.1rem,5vw,3.4rem)] font-normal leading-[1.07] tracking-[-0.01em] text-zinc-900 ">
              {h1Lines.map((line) => (
                <span
                  key={line.text}
                  className="block overflow-hidden opacity-0 [animation:hkd-line-up_0.75s_cubic-bezier(0.22,1,0.36,1)_forwards] motion-reduce:opacity-100 motion-reduce:[animation:none]"
                  style={{ animationDelay: line.delay }}
                >
                  {line.emphasis ? (
                    <em className="relative italic text-teal-800 ">
                      {line.text}
                      <span
                        aria-hidden="true"
                        className="absolute -bottom-1 left-0 h-[2px] w-full [animation:hkd-underline-grow_0.6s_cubic-bezier(0.22,1,0.36,1)_1.1s_both] [background-image:repeating-linear-gradient(to_right,currentColor_0,currentColor_5px,transparent_5px,transparent_9px)] opacity-70 motion-reduce:hidden"
                      />
                    </em>
                  ) : (
                    line.text
                  )}
                </span>
              ))}
            </h1>

            <p
              className="mb-7 max-w-[360px] text-[13.5px] font-light leading-[1.75] text-zinc-500 opacity-0 [animation:hkd-rise_0.7s_cubic-bezier(0.22,1,0.36,1)_0.55s_forwards] motion-reduce:opacity-100 motion-reduce:[animation:none] "
            >
              Built for HKD Outdoor Innovations Ltd. — a venture of South
              Korea&apos;s HKD Group, manufacturing premium waterproof
              rainwear, insulated outerwear, sportswear and ski &amp; hunting
              apparel from its Karnaphuli EPZ campus.
            </p>

            <div
              className="flex items-center gap-5 opacity-0 [animation:hkd-rise_0.7s_cubic-bezier(0.22,1,0.36,1)_0.68s_forwards] motion-reduce:opacity-100 motion-reduce:[animation:none]"
            >
              <Link
                ref={ctaRef}
                href={user ? "/dashboard" : "/login"}
                onMouseMove={handleCtaMove}
                onMouseLeave={resetMagnet}
                className="group relative inline-flex items-center gap-[5px] overflow-hidden rounded-full bg-teal-800 px-5 py-[11px] text-[12.5px] font-medium tracking-[0.02em] text-white transition-colors duration-200 hover:bg-teal-900    "
                style={{
                  transform: `translate(${magnet.x}px, ${magnet.y}px)`,
                  transition: "transform 0.3s cubic-bezier(0.34,1.56,0.64,1), background-color 0.2s, box- 0.25s",
                }}
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-y-0 -left-[60%] w-2/5 -skew-x-[20deg] [background:linear-gradient(120deg,transparent,rgba(244,244,245,0.35),transparent)] transition-[left] duration-500 ease-out group-hover:left-[130%]"
                />
                {user ? "Open Dashboard" : "Get Started"}
                <ArrowUpRight size={13} strokeWidth={2} className="transition-transform duration-200 group-hover:translate-x-[2px] group-hover:-translate-y-[2px]" />
              </Link>
              <Link
                href="/dashboard"
                className="border-b border-transparent pb-[2px] text-[12.5px] text-zinc-500 transition-colors duration-200 hover:border-teal-700 hover:text-teal-800   "
              >
                See the Platform
              </Link>
            </div>
          </div>

          <div
            className="relative grid grid-cols-4 overflow-hidden border-t border-[rgba(24,24,27,0.08)] pt-[1.1rem] opacity-0 [animation:hkd-rise_0.7s_cubic-bezier(0.22,1,0.36,1)_0.68s_forwards] motion-reduce:opacity-100 motion-reduce:[animation:none] "
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute top-0 h-full w-[18%] [background:linear-gradient(100deg,transparent,rgba(17,94,89,0.18),transparent)] [animation:hkd-scan-sweep_6s_ease-in-out_2.4s_infinite] motion-reduce:hidden"
            />
            {STAT_DEFS.map((s, i) => (
              <div
                key={s.label}
                className="border-r border-[rgba(24,24,27,0.07)] px-[6px] text-center transition-transform duration-200 last:border-r-0 hover:-translate-y-[2px] "
              >
                <span className="mb-1 block [font-family:'Playfair_Display',serif] text-[1.35rem] font-semibold tabular-nums leading-none text-teal-800 ">
                  {counts[i].toFixed(s.decimals)}{s.suffix}
                </span>
                <span className="block text-[9.5px] font-medium uppercase tracking-[0.1em] text-zinc-500 ">
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT */}
        <div className="relative z-[2] flex max-h-[45vh] flex-col overflow-hidden md:max-h-none">
          <div
            style={{ perspective: "900px" }}
            className="relative min-h-0 flex-1 overflow-hidden [animation:hkd-clip-reveal_1.1s_cubic-bezier(0.65,0,0.35,1)_0.1s_both] motion-reduce:[animation:none] motion-reduce:[clip-path:none]"
          >
            {/* hero image: always slowly zooms in and out, smooth loop */}
            <div className="h-full w-full [animation:hkd-auto-zoom_9s_ease-in-out_infinite] motion-reduce:animate-none motion-reduce:[transform:scale(1.06)]">
              <Image
                src="/HKD_Building_image.jpeg"
                alt="Garment factory production floor running on StitchFlow ERP"
                fill
                sizes="50vw"
                className="object-cover object-center [filter:sepia(15%)_contrast(1.06)_brightness(0.94)] "
                priority
              />
            </div>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 [background:linear-gradient(to_bottom,transparent_55%,rgba(24,24,27,0.22)_100%)] "
            />
            <div
              className="absolute bottom-[14px] left-[14px] z-[2] flex items-center gap-2 rounded-[9px] border border-[rgba(24,24,27,0.09)] bg-[rgba(244,244,245,0.9)] px-[13px] py-[9px] opacity-0 [animation:hkd-rise_0.7s_cubic-bezier(0.22,1,0.36,1)_1.1s_forwards] motion-reduce:opacity-100 motion-reduce:[animation:none]  "
            >
              <div
                aria-hidden="true"
                className="h-[6px] w-[6px] flex-shrink-0 rounded-full bg-teal-800 [animation:hkd-pulse-ring_2.5s_ease_infinite] motion-reduce:animate-none"
              />
              <span className="text-[10.5px] font-medium tracking-[0.01em] text-zinc-900 ">
                Live Production · KEPZ, Chattogram
                <span aria-hidden="true" className="ml-[1px] [animation:hkd-blink_1.1s_step-end_infinite] motion-reduce:hidden">|</span>
              </span>
            </div>
          </div>

          <div className="grid flex-none grid-cols-2 border-t border-[rgba(24,24,27,0.08)] bg-zinc-50  ">
            {pillars.map(({ icon: Icon, label }, i) => (
              <div
                key={label}
                className="group relative flex items-center gap-[10px] border-b border-r border-[rgba(24,24,27,0.07)] p-4 opacity-0 transition-colors duration-150 [animation:hkd-rise_0.6s_cubic-bezier(0.22,1,0.36,1)_forwards] hover:bg-[rgba(17,94,89,0.07)] motion-reduce:opacity-100 motion-reduce:[animation:none] even:border-r-0 last:border-b-0 [&:nth-child(3)]:border-b-0  "
                style={{ animationDelay: `${1.15 + i * 0.1}s` }}
              >
                <span
                  aria-hidden="true"
                  className="absolute bottom-2 left-4 h-px w-0 [background-image:repeating-linear-gradient(to_right,#115e59_0,#115e59_4px,transparent_4px,transparent_7px)] transition-[width] duration-300 group-hover:w-[calc(100%-2.2rem)]"
                />
                <div className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-[7px] bg-[rgba(17,94,89,0.13)] transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:-rotate-[8deg] group-hover:scale-[1.08] group-hover:bg-[rgba(17,94,89,0.22)] ">
                  <span
                    className="flex items-center justify-center [animation:hkd-icon-idle_3s_ease-in-out_infinite] motion-reduce:animate-none"
                    style={{ animationDelay: `${i * 0.4}s` }}
                  >
                    <Icon size={14} strokeWidth={1.8} color="#115e59" />
                  </span>
                </div>
                <span className="text-[11px] font-medium leading-[1.3] text-zinc-900 ">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </>
  );
}
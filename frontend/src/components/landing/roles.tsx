"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, animate, motion, useReducedMotion } from "framer-motion";
import { Check, ClipboardList, GraduationCap, Mic, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

type Role = {
  title: string;
  tag: string;
  points: string[];
  Icon: React.ComponentType<{ className?: string }>;
  tone: string;
  muted: string;
  chip: string;
  Preview: React.FC;
};

const ROLES: Role[] = [
  {
    title: "Organizers and mentors",
    tag: "Know where every task stands.",
    points: [
      "See allocated, pending and finished work at a glance.",
      "Assign, reassign and move deadlines by voice.",
      "Know who is stuck before the weekly call.",
    ],
    Icon: ClipboardList,
    tone: "bg-neem text-paper border-neem-deep shadow-[8px_8px_0_#11332a]",
    muted: "text-sage",
    chip: "bg-haldi text-neem",
    Preview: OrganizerPreview,
  },
  {
    title: "Interns and fellows",
    tag: "Update in twenty seconds.",
    points: [
      "Hear today's tasks in the morning.",
      "Give your update by speaking for twenty seconds.",
      "Raise a blocker without waiting for a meeting.",
    ],
    Icon: Mic,
    tone: "bg-saffron text-neem border-neem shadow-[8px_8px_0_#173f30]",
    muted: "text-neem/75",
    chip: "bg-neem text-paper",
    Preview: InternPreview,
  },
  {
    title: "Program admins",
    tag: "A whole batch in one place.",
    points: [
      "Attendance, weekly reports and mentor feedback.",
      "End-of-internship evaluations for the whole batch.",
      "Reports ready to share with sponsors.",
    ],
    Icon: GraduationCap,
    tone: "bg-tulsi text-neem border-neem shadow-[8px_8px_0_#173f30]",
    muted: "text-neem/75",
    chip: "bg-neem text-paper",
    Preview: AdminPreview,
  },
];

const EASE = [0.4, 0, 0.2, 1] as const;

/**
 * "Built for the people who run intern batches" — a spotlight bento. The panel you hover, focus or
 * tap grows and shows what that role gets, with a small live preview; the others shrink back.
 */
export function Roles() {
  const [active, setActive] = useState(0);
  const reduce = useReducedMotion() ?? false;

  return (
    <div className="flex flex-col gap-4 lg:h-[35rem] lg:flex-row lg:gap-5">
      {ROLES.map((r, i) => {
        const on = i === active;
        return (
          <motion.article
            key={r.title}
            initial={reduce ? false : { opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            animate={{ flexGrow: on ? 2.4 : 1 }}
            transition={{ flexGrow: { duration: reduce ? 0 : 0.55, ease: EASE }, default: { duration: 0.5, delay: i * 0.1 } }}
            onMouseEnter={() => setActive(i)}
            onPointerMove={(e) => {
              const b = e.currentTarget.getBoundingClientRect();
              e.currentTarget.style.setProperty("--x", `${e.clientX - b.left}px`);
              e.currentTarget.style.setProperty("--y", `${e.clientY - b.top}px`);
            }}
            className={cn(
              "group relative flex min-w-0 flex-col overflow-hidden rounded-[2rem] border-2 p-6 sm:p-8 lg:basis-0",
              r.tone,
            )}
          >
            {/* cursor spotlight */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              style={{
                background: "radial-gradient(420px circle at var(--x, 50%) var(--y, 50%), #fce7b233, transparent 65%)",
              }}
            />

            <button
              type="button"
              onClick={() => setActive(i)}
              onFocus={() => setActive(i)}
              aria-expanded={on}
              aria-controls={`role-${i}`}
              className="relative flex w-full items-start justify-between gap-4 rounded-xl text-left"
            >
              <span>
                <span className={cn("grid size-12 place-items-center rounded-2xl", r.chip)}>
                  <r.Icon className="size-6" />
                </span>
                <span className="display mt-5 block text-[clamp(1.5rem,2.4vw,2.1rem)] leading-[1.05]">{r.title}</span>
                <span className={cn("mt-2 block text-lg", r.muted)}>{r.tag}</span>
              </span>
              <span className="display-narrow shrink-0 text-4xl opacity-35">0{i + 1}</span>
            </button>

            <div id={`role-${i}`} className="relative flex min-h-0 flex-1 flex-col">
              <AnimatePresence mode="wait" initial={false}>
                {on ? (
                  <motion.div
                    key="open"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8, transition: { duration: 0.15 } }}
                    transition={{ duration: 0.4, delay: reduce ? 0 : 0.2, ease: EASE }}
                    className="flex flex-1 flex-col"
                  >
                    <ul className="mt-6 space-y-2.5">
                      {r.points.map((p) => (
                        <li key={p} className="flex gap-3 text-[1.05rem] leading-snug">
                          <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full", r.chip)}>
                            <Check className="size-3.5" strokeWidth={3} />
                          </span>
                          {p}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-auto pt-6">
                      <r.Preview />
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="closed"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, transition: { duration: 0.1 } }}
                    transition={{ duration: 0.3, delay: 0.25 }}
                    className="mt-auto hidden pt-6 lg:block"
                  >
                    <span className="grid size-12 place-items-center rounded-full border-2 border-current opacity-60 transition-transform duration-300 group-hover:rotate-90">
                      <Plus className="size-5" />
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.article>
        );
      })}
    </div>
  );
}

/* ───────────────────────── Live previews ───────────────────────── */

function useCountUp(to: number, duration = 1.2) {
  const reduce = useReducedMotion();
  const [n, setN] = useState(reduce ? to : 0);
  useEffect(() => {
    if (reduce) return;
    const a = animate(0, to, { duration, ease: "easeOut", delay: 0.3, onUpdate: (v) => setN(Math.round(v)) });
    return () => a.stop();
  }, [to, duration, reduce]);
  return n;
}

function OrganizerPreview() {
  const done = useCountUp(17);
  const pending = useCountUp(7);
  const stats: [string, number, string][] = [
    ["Done", done, "bg-tulsi"],
    ["Pending", pending, "bg-haldi"],
    ["Blocked", 2, "bg-kumkum"],
  ];
  return (
    <div className="rounded-2xl bg-neem-deep/70 p-4 ring-1 ring-paper/10">
      <div className="grid grid-cols-3 gap-3">
        {stats.map(([k, v, c]) => (
          <div key={k}>
            <p className="text-sm font-semibold text-sage">{k}</p>
            <p className="display text-3xl tabular-nums">{v}</p>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-paper/10">
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: Math.min(1, v / 26 + 0.05) }}
                transition={{ duration: 0.6 }}
                className={cn("h-full origin-left rounded-full", c)}
              />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 flex items-center gap-2 text-sm font-semibold">
        <span className="size-2 rounded-full bg-kumkum" />
        Arjun is stuck on design files · 3 days
      </p>
    </div>
  );
}

function InternPreview() {
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-paper p-4 text-neem ring-2 ring-neem">
      <span className="relative grid size-14 shrink-0 place-items-center rounded-full bg-neem text-paper">
        <span className="mic-ring absolute inset-0 rounded-full bg-neem/40" />
        <Mic className="relative size-6" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold leading-tight">Login page · due 5 pm</p>
        <div data-wave="on" className="mt-2 flex h-6 items-center gap-1">
          {Array.from({ length: 22 }).map((_, i) => (
            <span
              key={i}
              className="wave-bar h-full flex-1 rounded-full bg-saffron"
              style={{ animationDelay: `${(i % 6) * 0.09}s` }}
            />
          ))}
        </div>
      </div>
      <span className="display text-xl tabular-nums">0:20</span>
    </div>
  );
}

function AdminPreview() {
  const days: [string, number][] = [
    ["Mon", 0.9],
    ["Tue", 0.68],
    ["Wed", 0.97],
    ["Thu", 0.52],
    ["Fri", 0.82],
  ];
  const onTime = useCountUp(86);
  return (
    <div className="rounded-2xl bg-paper p-4 text-neem ring-2 ring-neem">
      <div className="flex items-baseline justify-between">
        <p className="font-semibold">Batch attendance</p>
        <p className="text-sm font-semibold text-moss">
          <span className="display text-xl text-neem tabular-nums">{onTime}%</span> on time
        </p>
      </div>
      <div className="mt-3 flex h-20 items-end gap-2.5">
        {days.map(([d, v], i) => (
          <div key={d} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex h-16 w-full max-w-9 items-end">
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${v * 100}%` }}
                transition={{ duration: 0.6, delay: 0.25 + i * 0.07, ease: EASE }}
                className="w-full rounded-md bg-neem"
              />
            </div>
            <span className="text-xs font-semibold text-moss">{d}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-tulsi px-3 py-1 text-sm font-semibold">
        <Check className="size-3.5" strokeWidth={3} />
        Weekly report ready to share
      </p>
    </div>
  );
}

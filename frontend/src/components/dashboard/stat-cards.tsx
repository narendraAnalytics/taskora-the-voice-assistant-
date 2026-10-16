"use client";

import { useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import type { Intern } from "@/lib/demo-data";
import { CountUp, PaperCard } from "@/components/dashboard/motion";
import { cn } from "@/lib/utils";

/*
 * The four batch tiles. Each one has its own small animated picture of what it counts:
 * a bobbing stack of faces, a trend line drawing upward, a ring filling to a tick, and a
 * pulsing alert with the names that need attention. Tiles tilt toward the cursor and carry
 * a soft spotlight that follows it.
 */

function Tile({ className, children }: { className: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  const onMove = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el || e.pointerType !== "mouse") return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty("--sx", `${x * 100}%`);
    el.style.setProperty("--sy", `${y * 100}%`);
    if (!reduce) {
      el.style.transform = `perspective(700px) rotateX(${((0.5 - y) * 9).toFixed(2)}deg) rotateY(${((x - 0.5) * 11).toFixed(2)}deg) translateY(-4px)`;
    }
  };
  const reset = () => {
    if (ref.current) ref.current.style.transform = "";
  };

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={reset}
      className={cn(
        "group relative flex h-full min-h-[13.5rem] flex-col justify-between overflow-hidden rounded-[2rem] p-5 transition-[transform,box-shadow] duration-300 ease-out will-change-transform hover:shadow-[0_14px_30px_-12px_#173f3066]",
        className,
      )}
    >
      {/* Cursor spotlight */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: "radial-gradient(14rem circle at var(--sx,50%) var(--sy,50%), #fce7b240, transparent 70%)" }}
      />
      {/* Printed halftone corner */}
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-8 -left-8 size-32 rounded-full bg-[radial-gradient(currentColor_1.3px,transparent_1.5px)] opacity-15 [background-size:9px_9px]"
      />
      {children}
    </div>
  );
}

function Caption({ value, label, sub }: { value: number; label: string; sub: string }) {
  return (
    <div className="relative">
      <p className="font-hand text-6xl font-bold leading-none tabular-nums">
        <CountUp value={value} />
      </p>
      <p className="mt-1 text-base font-bold">{label}</p>
      <p className="text-sm opacity-75">{sub}</p>
    </div>
  );
}

/* 1 · Interns — a stack of faces that pop in and bob gently. */
function Faces({ interns }: { interns: Intern[] }) {
  const reduce = useReducedMotion();
  const shown = interns.slice(0, 4);
  const extra = interns.length - shown.length;
  const tones = ["bg-saffron text-neem", "bg-haldi text-neem", "bg-tulsi text-neem", "bg-paper text-neem"];
  return (
    <div className="relative flex -space-x-3 self-end" aria-hidden>
      {shown.map((p, k) => (
        <motion.span
          key={p.id}
          className={cn("grid size-11 place-items-center rounded-full text-sm font-bold ring-[3px] ring-neem", tones[k % tones.length])}
          initial={reduce ? false : { scale: 0, y: 14 }}
          animate={reduce ? { scale: 1 } : { scale: 1, y: [0, -5, 0] }}
          transition={{
            scale: { type: "spring", stiffness: 380, damping: 14, delay: 0.5 + k * 0.1 },
            y: { duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: 1 + k * 0.3 },
          }}
        >
          {p.name
            .split(" ")
            .map((w) => w[0])
            .slice(0, 2)
            .join("")}
        </motion.span>
      ))}
      {extra > 0 && (
        <motion.span
          className="grid size-11 place-items-center rounded-full bg-neem-soft text-sm font-bold text-paper ring-[3px] ring-neem transition-transform group-hover:scale-110"
          initial={reduce ? false : { scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 380, damping: 14, delay: 0.95 }}
        >
          +{extra}
        </motion.span>
      )}
    </div>
  );
}

/* 2 · On track — a trend line that draws itself, with a live dot at the tip. */
function Trend({ share }: { share: number }) {
  const reduce = useReducedMotion();
  const end = 46 - share * 38; // higher share → higher line end
  const d = `M4 44 C 22 40, 30 30, 46 32 S 70 18, 84 22 S 108 ${end + 6}, 116 ${end}`;
  return (
    <svg viewBox="0 0 120 50" className="relative h-14 w-32 self-end overflow-visible" aria-hidden>
      <defs>
        <linearGradient id="trend-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#173f30" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#173f30" stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path
        d={`${d} L116 50 L4 50 Z`}
        fill="url(#trend-fill)"
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.3, duration: 0.6 }}
      />
      <motion.path
        d={d}
        fill="none"
        stroke="#173f30"
        strokeWidth="3.5"
        strokeLinecap="round"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ delay: 0.5, duration: 1.1, ease: [0.65, 0, 0.35, 1] }}
      />
      <motion.circle
        cx="116"
        cy={end}
        r="4.5"
        fill="#173f30"
        initial={reduce ? false : { scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 1.5, type: "spring", stiffness: 400, damping: 12 }}
      />
      {!reduce && (
        <motion.circle
          cx="116"
          cy={end}
          r="4.5"
          fill="none"
          stroke="#173f30"
          strokeWidth="2"
          animate={{ r: [4.5, 13], opacity: [0.7, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, delay: 1.7, ease: "easeOut" }}
        />
      )}
    </svg>
  );
}

/* 3 · Done — a ring that fills to the done share, then a tick draws in the middle. */
function Ring({ share }: { share: number }) {
  const reduce = useReducedMotion();
  const C = 2 * Math.PI * 22;
  return (
    <div className="relative self-end" aria-hidden>
      <svg viewBox="0 0 56 56" className="size-16 -rotate-90 transition-transform duration-500 group-hover:rotate-[-60deg]">
        <circle cx="28" cy="28" r="22" fill="none" stroke="#173f30" strokeOpacity="0.15" strokeWidth="6" />
        <motion.circle
          cx="28"
          cy="28"
          r="22"
          fill="none"
          stroke="#173f30"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={C}
          initial={reduce ? false : { strokeDashoffset: C }}
          animate={{ strokeDashoffset: C * (1 - share) }}
          transition={{ delay: 0.5, duration: 1.2, ease: [0.2, 0.8, 0.2, 1] }}
        />
      </svg>
      <svg viewBox="0 0 56 56" className="absolute inset-0 size-16">
        <motion.path
          d="M19 29 L25.5 35 L37 22"
          fill="none"
          stroke="#173f30"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ delay: 1.6, duration: 0.45, ease: "easeOut" }}
        />
      </svg>
      <span className="absolute -right-1 -top-2 rounded-full bg-neem px-1.5 text-xs font-bold text-paper">
        {Math.round(share * 100)}%
      </span>
    </div>
  );
}

/* 4 · Behind — a radar pulse around an alert that shakes now and then, plus who it is. */
function Alert({ names }: { names: string[] }) {
  const reduce = useReducedMotion();
  return (
    <div className="relative flex items-start justify-between gap-2" aria-hidden>
      <div className="flex flex-wrap gap-1.5">
        {names.slice(0, 2).map((n, k) => (
          <motion.span
            key={n}
            className="rounded-full bg-paper px-2.5 py-0.5 text-xs font-bold text-kumkum"
            initial={reduce ? false : { opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1 + k * 0.15, type: "spring", stiffness: 260, damping: 18 }}
          >
            {n}
          </motion.span>
        ))}
      </div>
      <div className="relative grid size-12 shrink-0 place-items-center">
        {!reduce &&
          [0, 0.9].map((d) => (
            <motion.span
              key={d}
              className="absolute inset-0 rounded-full border-2 border-paper/70"
              animate={{ scale: [0.6, 1.5], opacity: [0.8, 0] }}
              transition={{ duration: 1.8, repeat: Infinity, delay: d, ease: "easeOut" }}
            />
          ))}
        <motion.span
          className="grid size-10 place-items-center rounded-full bg-paper text-kumkum"
          animate={reduce ? undefined : { rotate: [0, -14, 12, -8, 6, 0, 0, 0, 0, 0] }}
          transition={{ duration: 2.6, repeat: Infinity, delay: 1.2 }}
        >
          <AlertTriangle className="size-5" />
        </motion.span>
      </div>
    </div>
  );
}

export function StatCards({ interns }: { interns: Intern[] }) {
  const total = interns.length || 1;
  const done = interns.filter((i) => i.status === "done").length;
  const onTrack = interns.filter((i) => i.status === "progress" || i.status === "done").length;
  const behind = interns.filter((i) => i.status === "blocked" || i.status === "overdue");

  return (
    <div className="grid grid-cols-2 gap-5 lg:col-span-5">
      <PaperCard i={1} tilt={-3}>
        <Tile className="bg-neem text-paper">
          <Faces interns={interns} />
          <Caption value={interns.length} label="Interns" sub="in this batch" />
        </Tile>
      </PaperCard>

      <PaperCard i={2} tilt={3}>
        <Tile className="bg-tulsi text-neem">
          <Trend share={onTrack / total} />
          <Caption value={onTrack} label="On track" sub="moving or done" />
        </Tile>
      </PaperCard>

      <PaperCard i={3} tilt={-3}>
        <Tile className="bg-haldi text-neem">
          <Ring share={done / total} />
          <Caption value={done} label="Done" sub="tasks finished" />
        </Tile>
      </PaperCard>

      <PaperCard i={4} tilt={3}>
        <Tile className="bg-kumkum text-paper">
          <Alert names={behind.map((b) => b.name.split(" ")[0])} />
          <Caption value={behind.length} label="Behind" sub="blocked or overdue" />
        </Tile>
      </PaperCard>
    </div>
  );
}

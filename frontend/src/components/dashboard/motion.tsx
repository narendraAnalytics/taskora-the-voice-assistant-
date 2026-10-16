"use client";

import { useEffect, useRef, useState } from "react";
import { animate, motion, useInView, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/*
 * Vox-style "paper on a desk" motion kit for the dashboard: cards drop in like cut paper being
 * placed (slight rotation that settles), numbers count up, tape holds notes down, and a marker
 * scribble draws itself under headings. Everything turns static with reduced motion.
 */

const SETTLE = { type: "spring", stiffness: 140, damping: 16, mass: 0.9 } as const;

/** A card that drops in with a tilt and settles flat. `i` staggers siblings. */
export function PaperCard({
  i = 0,
  tilt = -2,
  className,
  children,
  as = "div",
}: {
  i?: number;
  tilt?: number;
  className?: string;
  children: React.ReactNode;
  as?: "div" | "section";
}) {
  const reduce = useReducedMotion();
  const Tag = as === "section" ? motion.section : motion.div;
  return (
    <Tag
      className={className}
      initial={reduce ? false : { opacity: 0, y: 36, rotate: tilt, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, rotate: 0, scale: 1 }}
      transition={{ ...SETTLE, delay: 0.08 + i * 0.09 }}
    >
      {children}
    </Tag>
  );
}

/** Number that counts up when it scrolls into view (and re-animates when the value changes). */
export function CountUp({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const from = useRef(0);
  const [shown, setShown] = useState(reduce ? value : 0);

  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      setShown(value);
      return;
    }
    const c = animate(from.current, value, {
      duration: 1.1,
      ease: [0.2, 0.8, 0.2, 1],
      onUpdate: (v) => setShown(Math.round(v)),
    });
    from.current = value;
    return () => c.stop();
  }, [inView, value, reduce]);

  return (
    <span ref={ref} className={className}>
      {shown}
    </span>
  );
}

/** A strip of translucent tape, like the cut-outs in a Vox collage. */
export function Tape({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute z-10 h-6 w-20 rotate-[-6deg] bg-haldi/70 shadow-[0_1px_0_#173f3015] [clip-path:polygon(3%_0,97%_4%,100%_50%,96%_100%,2%_96%,0_50%)]",
        className,
      )}
    />
  );
}

/** Hand-drawn marker underline that draws itself in. */
export function Scribble({ className, delay = 0.5 }: { className?: string; delay?: number }) {
  const reduce = useReducedMotion();
  return (
    <svg aria-hidden viewBox="0 0 300 24" preserveAspectRatio="none" className={cn("pointer-events-none", className)}>
      <motion.path
        d="M4 16 C 60 6, 120 20, 180 11 S 270 8, 296 14"
        fill="none"
        stroke="currentColor"
        strokeWidth="7"
        strokeLinecap="round"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.9, delay, ease: [0.65, 0, 0.35, 1] }}
      />
    </svg>
  );
}

/** Progress bar that fills from zero once visible. */
export function GrowBar({ value, className, barClassName }: { value: number; className?: string; barClassName?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduce = useReducedMotion();
  return (
    <div ref={ref} className={cn("overflow-hidden rounded-full bg-neem/10", className)}>
      <motion.div
        className={cn("h-full rounded-full", barClassName)}
        initial={reduce ? false : { width: 0 }}
        animate={{ width: inView || reduce ? `${value}%` : 0 }}
        transition={{ duration: 1, ease: [0.2, 0.8, 0.2, 1] }}
      />
    </div>
  );
}

/** Mouse-follow tilt for tiles (desktop pointers only). */
export function Tilt({ className, children }: { className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const onMove = (e: React.PointerEvent) => {
    if (reduce || e.pointerType !== "mouse" || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    ref.current.style.transform = `perspective(700px) rotateX(${(-y * 8).toFixed(2)}deg) rotateY(${(x * 10).toFixed(2)}deg) translateY(-3px)`;
  };
  const reset = () => {
    if (ref.current) ref.current.style.transform = "";
  };
  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={reset}
      className={cn("transition-transform duration-300 ease-out will-change-transform", className)}
    >
      {children}
    </div>
  );
}

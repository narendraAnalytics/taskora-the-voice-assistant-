"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

type Mode = "idle" | "listening" | "speaking" | "thinking";

/**
 * Jarvis-style orb: a gooey blob that breathes when idle, swells and ripples while listening,
 * and pulses in bursts while Taskora speaks. Pure SVG + framer-motion.
 */
export function VoiceOrb({ mode, className }: { mode: Mode; className?: string }) {
  const reduce = useReducedMotion();
  const live = mode !== "idle";
  const fast = mode === "listening" ? 1.1 : mode === "speaking" ? 0.7 : 4;

  const blob = (r: number, delay: number, fill: string, opacity: number) => (
    <motion.circle
      cx="100"
      cy="100"
      r={r}
      fill={fill}
      opacity={opacity}
      animate={
        reduce
          ? undefined
          : {
              r: [r, r * (live ? 1.18 : 1.06), r * 0.94, r],
              cx: [100, 100 + (live ? 9 : 4), 100 - (live ? 7 : 3), 100],
              cy: [100, 100 - (live ? 8 : 3), 100 + (live ? 6 : 2), 100],
            }
      }
      transition={{ duration: fast * (1 + delay), repeat: Infinity, ease: "easeInOut", delay }}
    />
  );

  return (
    <div className={cn("relative grid place-items-center", className)} aria-hidden>
      {/* Expanding rings while listening */}
      {mode === "listening" &&
        !reduce &&
        [0, 0.6, 1.2].map((d) => (
          <motion.span
            key={d}
            className="absolute inset-[18%] rounded-full ring-2 ring-haldi/60"
            initial={{ scale: 0.8, opacity: 0.8 }}
            animate={{ scale: 1.6, opacity: 0 }}
            transition={{ duration: 1.8, repeat: Infinity, delay: d, ease: "easeOut" }}
          />
        ))}
      <svg viewBox="0 0 200 200" className="size-full overflow-visible">
        <defs>
          <filter id="orb-goo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="b" />
            <feColorMatrix in="b" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -9" />
          </filter>
          <radialGradient id="orb-core" cx="38%" cy="32%" r="70%">
            <stop offset="0%" stopColor="#fce7b2" />
            <stop offset="45%" stopColor="#f2b33d" />
            <stop offset="100%" stopColor="#e8622a" />
          </radialGradient>
        </defs>
        <g filter="url(#orb-goo)">
          {blob(54, 0, "url(#orb-core)", 1)}
          {blob(30, 0.4, "#e8622a", 0.95)}
          {blob(26, 0.9, "#f2b33d", 0.95)}
          {blob(22, 1.3, "#7dbe8f", mode === "speaking" ? 0.9 : 0.55)}
        </g>
        {/* Glint */}
        <ellipse cx="80" cy="74" rx="14" ry="8" fill="#fce7b2" opacity="0.7" transform="rotate(-25 80 74)" />
      </svg>
    </div>
  );
}

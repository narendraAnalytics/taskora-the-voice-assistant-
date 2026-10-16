"use client";

import { useState, type AnchorHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/*
 * Gooey / liquid CTA. One shared SVG filter (blur + alpha threshold) merges
 * overlapping circles into a single blob:
 *  - hover: droplets squeeze out of the pill, scatter and fall back in, while
 *    a second colour of liquid rises up inside it with a wobbly surface
 *  - click: a ripple of liquid spreads from the pointer
 * Text and ring sit outside the filtered layers so they stay crisp.
 */

type Variant = "primary" | "outline";

const THEME: Record<Variant, { base: string; fill: string; ripple: string; text: string; ring: string }> = {
  primary: {
    base: "bg-haldi",
    fill: "bg-saffron",
    ripple: "bg-[#f6c25c]",
    text: "text-neem",
    ring: "",
  },
  outline: {
    base: "bg-paper",
    fill: "bg-neem",
    ripple: "bg-neem-soft",
    text: "text-neem group-hover/liquid:text-paper group-focus-visible/liquid:text-paper",
    ring: "ring-2 ring-neem",
  },
};

// [left %, x scatter px, y scatter px, size px, delay ms]
const DROPS: [number, number, number, number, number][] = [
  [8, -16, -34, 20, 0],
  [26, -6, 38, 24, 60],
  [44, 10, -42, 28, 20],
  [62, 8, 40, 22, 100],
  [80, 18, -36, 26, 40],
  [94, 26, 20, 18, 80],
];

const WAVES = [0, 20, 40, 60, 80, 100];

export function LiquidGooDefs() {
  return (
    <svg aria-hidden width="0" height="0" className="absolute">
      <defs>
        <filter id="taskora-goo" x="-20%" y="-60%" width="140%" height="220%" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceGraphic" stdDeviation="7" result="blur" />
          <feColorMatrix
            in="blur"
            mode="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9"
          />
        </filter>
      </defs>
    </svg>
  );
}

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: Variant };

export function LiquidButton({ variant = "primary", className, children, onPointerDown, ...rest }: Props) {
  const t = THEME[variant];
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);

  return (
    <a
      {...rest}
      onPointerDown={(e) => {
        onPointerDown?.(e);
        const r = e.currentTarget.getBoundingClientRect();
        const id = performance.now();
        setRipples((list) => [...list, { id, x: e.clientX - r.left, y: e.clientY - r.top }]);
      }}
      className={cn(
        "group/liquid relative inline-flex select-none items-center justify-center rounded-full px-7 py-3.5 text-lg font-semibold transition-transform duration-300 [transition-timing-function:cubic-bezier(.3,1.6,.5,1)] hover:scale-[1.04] active:scale-95",
        className,
      )}
    >
      {/* Body + scattering droplets */}
      <span aria-hidden className="liquid-body pointer-events-none absolute inset-0" style={{ filter: "url(#taskora-goo)" }}>
        <span className={cn("absolute inset-0 rounded-full", t.base)} />
        {DROPS.map(([left, x, y, size, delay], i) => (
          <span
            key={i}
            className={cn("liquid-drop absolute top-1/2 rounded-full", t.base)}
            style={
              {
                left: `${left}%`,
                width: size,
                height: size,
                marginTop: -size / 2,
                marginLeft: -size / 2,
                "--x": `${x}px`,
                "--y": `${y}px`,
                "--d": `${delay}ms`,
              } as React.CSSProperties
            }
          />
        ))}
      </span>

      {/* Rising liquid + click ripples, clipped to the pill */}
      <span aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden rounded-full", t.ring)}>
        <span className="liquid-fill absolute inset-x-0 top-full h-[calc(100%+24px)]" style={{ filter: "url(#taskora-goo)" }}>
          <span className={cn("absolute inset-x-0 top-3 bottom-0", t.fill)} />
          {WAVES.map((left, i) => (
            <span
              key={left}
              className={cn("liquid-wave absolute top-0 size-6 rounded-full", t.fill)}
              style={{ left: `calc(${left}% - 12px)`, animationDelay: `${i * -0.35}s` }}
            />
          ))}
        </span>
        {ripples.map((r) => (
          <span
            key={r.id}
            className={cn("liquid-ripple absolute size-8 rounded-full", t.ripple)}
            style={{ left: r.x - 16, top: r.y - 16 }}
            onAnimationEnd={() => setRipples((list) => list.filter((x) => x.id !== r.id))}
          />
        ))}
      </span>

      <span className={cn("relative z-10 transition-colors duration-300", t.text)}>{children}</span>
    </a>
  );
}

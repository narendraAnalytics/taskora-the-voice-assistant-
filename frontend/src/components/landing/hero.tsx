"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { pilotMailto } from "@/lib/site";

// Cream and leaf tones that sit naturally on the jasmine in the office footage.
const PETAL_COLORS = ["#fdf0cc", "#fce7b2", "#fdf0cc", "#7dbe8f", "#f2b33d"];
const MAX_PETALS = 140;

type Petal = {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  dx: number;
  dy: number;
  rot: number;
  dur: number;
  delay: number;
  breeze?: boolean;
};

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Hero: the Remotion intro plays once, then the office footage fades in behind the copy and
 * CTAs. Mouse movement adds depth, hovering "Join the pilot" kicks up a breeze of petals and
 * clicking it (or pressing Enter) showers petals.
 */
export function Hero() {
  const sceneRef = useRef<HTMLElement>(null);
  const introRef = useRef<HTMLVideoElement>(null);
  const officeRef = useRef<HTMLVideoElement>(null);
  const readyRef = useRef(false);
  const petalId = useRef(0);
  const [ready, setReady] = useState(false);
  const [petals, setPetals] = useState<Petal[]>([]);
  const [breeze, setBreeze] = useState(false);

  const reveal = useCallback(() => {
    if (readyRef.current) return;
    readyRef.current = true;
    setReady(true);
    if (!prefersReducedMotion()) officeRef.current?.play().catch(() => {});
  }, []);

  /* Reveal when the intro ends, or straight away if it cannot or should not play. */
  useEffect(() => {
    const intro = introRef.current;
    if (!intro) return;
    if (prefersReducedMotion()) {
      reveal();
      return;
    }
    intro.play().catch(reveal);
    const watchdog = window.setTimeout(() => {
      if (intro.paused && intro.currentTime === 0) reveal();
    }, 4000);
    return () => window.clearTimeout(watchdog);
  }, [reveal]);

  /* Mouse: smoothed into CSS variables so nothing re-renders per frame. */
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || prefersReducedMotion()) return;
    const target = { x: 0, y: 0, px: 0, py: 0 };
    const cur = { x: 0, y: 0, px: 0, py: 0 };
    let raf = 0;
    let running = false;

    const tick = () => {
      cur.x += (target.x - cur.x) * 0.07;
      cur.y += (target.y - cur.y) * 0.07;
      cur.px += (target.px - cur.px) * 0.18;
      cur.py += (target.py - cur.py) * 0.18;
      scene.style.setProperty("--mx", cur.x.toFixed(4));
      scene.style.setProperty("--my", cur.y.toFixed(4));
      scene.style.setProperty("--cx", `${cur.px.toFixed(1)}px`);
      scene.style.setProperty("--cy", `${cur.py.toFixed(1)}px`);
      raf = requestAnimationFrame(tick);
    };
    const start = () => {
      if (!running) {
        running = true;
        raf = requestAnimationFrame(tick);
      }
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    const onMove = (e: PointerEvent) => {
      const r = scene.getBoundingClientRect();
      target.x = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - 0.5) * 2));
      target.y = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height - 0.5) * 2));
      target.px = e.clientX - r.left;
      target.py = e.clientY - r.top;
      scene.dataset.hover = "on";
    };
    const onLeave = () => {
      target.x = 0;
      target.y = 0;
      scene.dataset.hover = "off";
    };

    const io = new IntersectionObserver(([entry]) => (entry.isIntersecting ? start() : stop()), {
      threshold: 0.2,
    });
    io.observe(scene);
    scene.addEventListener("pointermove", onMove);
    scene.addEventListener("pointerleave", onLeave);
    return () => {
      stop();
      io.disconnect();
      scene.removeEventListener("pointermove", onMove);
      scene.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  const addPetals = useCallback((fresh: Petal[], lifetimeMs: number) => {
    const ids = new Set(fresh.map((p) => p.id));
    setPetals((prev) => [...prev, ...fresh].slice(-MAX_PETALS));
    window.setTimeout(() => setPetals((prev) => prev.filter((p) => !ids.has(p.id))), lifetimeMs);
  }, []);

  const makePetal = useCallback(
    (x: number, y: number, dx: number, dy: number, delay: number, breezy = false): Petal => ({
      id: ++petalId.current,
      x,
      y,
      size: breezy ? rand(9, 17) : rand(12, 26),
      color: PETAL_COLORS[Math.floor(Math.random() * PETAL_COLORS.length)],
      dx,
      dy,
      rot: rand(-540, 540),
      dur: breezy ? rand(2.2, 3.4) : rand(2.8, 4.8),
      delay,
      breeze: breezy,
    }),
    [],
  );

  /* Shower: petals drift down from above across the whole hero. */
  const celebrate = useCallback(() => {
    if (prefersReducedMotion()) return;
    const scene = sceneRef.current;
    if (!scene) return;
    const { width, height } = scene.getBoundingClientRect();
    addPetals(
      Array.from({ length: 46 }, () =>
        makePetal(rand(0, width), rand(-60, -10), rand(-150, 150), height * 0.95 + rand(-30, 40), rand(0, 1.3)),
      ),
      7000,
    );
  }, [addPetals, makePetal]);

  /* Breeze: while "Join the pilot" is hovered, petals stream across from the left. */
  useEffect(() => {
    if (!breeze || !ready || prefersReducedMotion()) return;
    const scene = sceneRef.current;
    if (!scene) return;
    const id = window.setInterval(() => {
      const { width, height } = scene.getBoundingClientRect();
      addPetals(
        Array.from({ length: 2 }, () =>
          makePetal(rand(-20, width * 0.3), rand(height * 0.15, height * 0.8), rand(width * 0.4, width * 0.8), rand(30, 160), 0, true),
        ),
        3800,
      );
    }, 240);
    return () => window.clearInterval(id);
  }, [breeze, ready, addPetals, makePetal]);

  /* Enter showers petals once the office scene is showing. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || !readyRef.current) return;
      const t = e.target as HTMLElement | null;
      if (t && t.closest("a, button, input, textarea, select, [contenteditable]")) return;
      celebrate();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [celebrate]);

  const onJoin = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    celebrate();
    window.setTimeout(
      () => {
        window.location.href = pilotMailto;
      },
      prefersReducedMotion() ? 0 : 1400,
    );
  };

  return (
    <header
      ref={sceneRef}
      data-hover="off"
      className="relative isolate min-h-[max(100svh,720px)] overflow-hidden bg-paper text-neem lg:aspect-video lg:max-h-[100svh] lg:min-h-[600px]"
    >
      <h1 className="sr-only">Taskora: your interns speak, the board updates.</h1>

      {/* Intro: plays once, nothing over it */}
      <video
        ref={introRef}
        className="absolute inset-0 size-full object-cover motion-reduce:hidden"
        autoPlay
        muted
        playsInline
        preload="auto"
        poster="/hero-poster.jpg"
        aria-hidden
        onEnded={reveal}
        onError={reveal}
      >
        <source src="/hero-vertical.mp4" type="video/mp4" media="(max-aspect-ratio: 1/1)" />
        <source src="/hero.mp4" type="video/mp4" />
      </video>

      {/* Office scene, revealed when the intro ends */}
      <div
        inert={!ready}
        className={cn(
          "absolute inset-0 bg-paper transition-opacity duration-700",
          ready ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        {/* Footage: slightly oversized so it can drift with the mouse */}
        <div className="absolute inset-x-0 bottom-0 top-[47%] overflow-hidden lg:inset-0">
          <video
            ref={officeRef}
            className="absolute inset-0 size-full scale-[1.02] object-cover object-[74%_50%] will-change-transform lg:object-center"
            style={{
              transform:
                "translate3d(calc(var(--mx,0) * -10px), calc(var(--my,0) * -6px), 0) scale(1.02)",
            }}
            muted
            loop
            playsInline
            preload="auto"
            poster="/hero-office-poster.jpg"
            aria-hidden
          >
            <source src="/hero-office.mp4" type="video/mp4" />
          </video>
          {/* Softens the seam between paper and footage on phones */}
          <div className="absolute inset-x-0 top-0 h-1/4 bg-gradient-to-b from-paper to-transparent lg:hidden" />
        </div>

        {/* Warm wash behind the copy, so the headline stays readable without a box */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 hidden bg-[radial-gradient(ellipse_70%_90%_at_8%_50%,#fce7b2f2_0%,#fce7b2c0_40%,transparent_72%)] lg:block"
        />

        {/* Cursor glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 hidden size-[22rem] rounded-full bg-[radial-gradient(circle,#f2b33d55,transparent_65%)] opacity-0 mix-blend-soft-light transition-opacity duration-500 [@media(hover:hover)]:block [[data-hover=on]_&]:opacity-100"
          style={{ transform: "translate3d(calc(var(--cx,-999px) - 50%), calc(var(--cy,-999px) - 50%), 0)" }}
        />

        {/* Copy */}
        <div className="relative z-20 mx-auto flex min-h-[max(100svh,720px)] w-full lg:h-full lg:min-h-0 max-w-[1200px] flex-col justify-start px-4 pt-28 sm:px-6 lg:justify-center lg:px-8 lg:pt-20">
          <div className="max-w-[34rem]">
            <h2 className="display-wide text-[clamp(2.1rem,4.6vw,3.8rem)] leading-[1.02]">
              Meet Taskora, your team&apos;s voice coordinator.
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-neem/85 sm:text-xl">
              Interns give a 20-second update by speaking. Organizers ask who&apos;s behind and hear the
              answer. Nothing changes until someone confirms it.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href={pilotMailto}
                onClick={onJoin}
                onMouseEnter={() => setBreeze(true)}
                onMouseLeave={() => setBreeze(false)}
                onFocus={() => setBreeze(true)}
                onBlur={() => setBreeze(false)}
                className="rounded-full bg-haldi px-7 py-3.5 text-lg font-semibold text-neem shadow-[0_5px_0_#173f30] transition-transform hover:-translate-y-0.5 hover:bg-[#f6c25c] active:translate-y-1 active:shadow-[0_1px_0_#173f30]"
              >
                Join the pilot
              </a>
              <a
                href="#commands"
                className="rounded-full bg-paper/60 px-7 py-3.5 text-lg font-semibold text-neem ring-2 ring-neem hover:bg-neem hover:text-paper"
              >
                See what you can say
              </a>
            </div>
          </div>
        </div>

        {/* Petals */}
        <div aria-hidden className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
          {petals.map((p) => (
            <span
              key={p.id}
              className={cn("petal", p.breeze && "petal-breeze")}
              style={
                {
                  left: p.x,
                  top: p.y,
                  width: p.size,
                  height: p.size,
                  background: p.color,
                  boxShadow: "inset 0 0 0 2px #173f3055, 0 2px 6px #173f3033",
                  "--dx": `${p.dx}px`,
                  "--dy": `${p.dy}px`,
                  "--rot": `${p.rot}deg`,
                  "--dur": `${p.dur}s`,
                  animationDelay: `${p.delay}s`,
                  animationFillMode: "both",
                } as React.CSSProperties
              }
            />
          ))}
        </div>
      </div>
    </header>
  );
}

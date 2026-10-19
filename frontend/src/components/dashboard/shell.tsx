"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { motion, useReducedMotion } from "framer-motion";
import { Logo } from "@/components/landing/logo";
import { Scribble } from "@/components/dashboard/motion";

// Paper grain (SVG turbulence) — multiplied over the page at low opacity, like the hero intro.
const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .09  0 0 0 0 .25  0 0 0 0 .19  0 0 0 .55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

/** Dashboard frame: no site navbar or avatar — the logo takes you back to the landing hero. */
export function Shell({
  name,
  role,
  title,
  subtitle,
  action,
  children,
}: {
  action?: React.ReactNode;
  name: string;
  role: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  const router = useRouter();
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const hour = now?.getHours() ?? 9;
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const words = `${greet}, ${name}`.split(" ");

  return (
    <div className="relative min-h-svh overflow-x-clip bg-paper text-neem">
      {/* Drifting colour washes */}
      <div aria-hidden className="pointer-events-none fixed inset-0">
        <div className="absolute -right-40 -top-40 size-[42rem] rounded-full bg-haldi/40 blur-3xl motion-safe:animate-[aurora_18s_ease-in-out_infinite]" />
        <div className="absolute -left-40 top-1/3 size-[34rem] rounded-full bg-tulsi/30 blur-3xl motion-safe:animate-[aurora_22s_ease-in-out_-6s_infinite]" />
        <div className="absolute bottom-[-12rem] right-1/4 size-[30rem] rounded-full bg-saffron/20 blur-3xl motion-safe:animate-[aurora_26s_ease-in-out_-12s_infinite]" />
        {/* Halftone dots fading out, Vox-collage style */}
        <div className="absolute inset-x-0 top-0 h-[36rem] bg-[radial-gradient(#173f3022_1.4px,transparent_1.6px)] [background-size:14px_14px] [mask-image:linear-gradient(to_bottom,black,transparent)]" />
        <div className="absolute inset-0 opacity-[0.18] mix-blend-multiply" style={{ backgroundImage: GRAIN }} />
      </div>

      <div className="relative mx-auto w-full max-w-[1280px] px-4 pb-16 pt-5 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between">
          <Link href="/" aria-label="Back to the Taskora home page" className="rounded-xl transition-transform hover:-rotate-2 hover:scale-105 focus-visible:outline-saffron">
            <Logo tone="neem" />
          </Link>
          <div className="flex items-center gap-2.5">
            {now && (
              <span className="font-note hidden rounded-full bg-paper-deep/80 px-3.5 py-1 text-sm font-bold ring-1 ring-neem/15 sm:inline">
                {now.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })} ·{" "}
                {now.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
              </span>
            )}
            <span className="rounded-full bg-neem px-3 py-1 text-sm font-semibold capitalize text-paper">{role}</span>
            {role === "intern" && (
              <button
                type="button"
                onClick={async () => {
                  await authClient.signOut();
                  router.push("/");
                  router.refresh();
                }}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold ring-1 ring-neem/30 hover:bg-haldi/60 focus-visible:outline-2 focus-visible:outline-saffron"
              >
                <LogOut className="size-4" aria-hidden />
                Sign out
              </button>
            )}
          </div>
        </header>

        <div className="mt-8 flex flex-wrap items-end justify-between gap-5 sm:mt-10">
          <div className="relative">
            <motion.p
              className="font-note text-lg text-moss"
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              {subtitle}
            </motion.p>
            <h1 className="font-hand relative mt-1 text-[clamp(2.8rem,6vw,4.6rem)] font-bold leading-[1]">
              {words.map((w, i) => (
                <motion.span
                  key={`${w}-${i}`}
                  className="mr-[0.22em] inline-block bg-gradient-to-r from-neem via-neem-soft to-saffron bg-clip-text text-transparent last:mr-0"
                  initial={reduce ? false : { opacity: 0, y: "0.6em", rotate: -6 }}
                  animate={{ opacity: 1, y: 0, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 220, damping: 14, delay: 0.1 + i * 0.08 }}
                >
                  {w}
                </motion.span>
              ))}
              <Scribble className="absolute -bottom-3 right-0 h-4 w-[45%] text-saffron/80" delay={0.1 + words.length * 0.08} />
            </h1>
            {/* Doodle sparkle */}
            <motion.svg
              aria-hidden
              viewBox="0 0 40 40"
              className="absolute -right-10 -top-2 size-9 text-saffron"
              initial={reduce ? false : { scale: 0, rotate: -90 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 12, delay: 0.9 }}
            >
              <path
                d="M20 3 L23 16 L37 20 L23 24 L20 37 L17 24 L3 20 L17 16 Z"
                fill="currentColor"
                className="origin-center motion-safe:animate-[spin_9s_linear_infinite]"
              />
            </motion.svg>
            <p className="sr-only">{title}</p>
          </div>
          <motion.div
            initial={reduce ? false : { opacity: 0, scale: 0.8, rotate: 4 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 13, delay: 0.5 }}
          >
            {action}
          </motion.div>
        </div>

        <main className="mt-8">{children}</main>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { ArrowUp, Mail } from "lucide-react";
import { Logo } from "@/components/landing/logo";
import { PILOT_EMAIL, pilotMailto } from "@/lib/site";

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "How it works", href: "#how" },
      { label: "What you can say", href: "#commands" },
      { label: "Pricing", href: "/pricing" },
    ],
  },
  {
    title: "Who it's for",
    links: [
      { label: "Organizers and mentors", href: "#roles" },
      { label: "Interns and fellows", href: "#roles" },
      { label: "Program admins", href: "#roles" },
    ],
  },
  {
    title: "Pilot",
    links: [
      { label: "Join the pilot", href: pilotMailto },
      { label: PILOT_EMAIL, href: `mailto:${PILOT_EMAIL}` },
    ],
  },
];

const WORD = "taskora".split("");

/**
 * Big footer: brand + live "pilot open" status, link columns, a bottom bar with the time in India
 * and back-to-top, then an oversized gradient wordmark that rises letter by letter and bleeds off
 * the bottom edge. Letters hop when hovered.
 */
export function SiteFooter() {
  const reduce = useReducedMotion() ?? false;
  const ist = useIndiaTime();
  const wordRef = useRef<HTMLDivElement>(null);
  // observe the container: the letters start clipped below it, so they never "intersect" themselves
  const wordIn = useInView(wordRef, { once: true, amount: 0.3 });

  return (
    <footer data-nav="dark" className="relative overflow-hidden bg-neem text-sage">
      <div className="mx-auto w-full max-w-[1200px] px-4 pt-16 sm:px-6 lg:px-8 lg:pt-20">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1.3fr)_repeat(3,minmax(0,1fr))] lg:gap-10">
          <div>
            <Logo />
            <p className="mt-4 max-w-[26rem] text-lg">
              A voice assistant for internship programs and small teams, made in India.
            </p>
            <a
              href={pilotMailto}
              className="mt-6 inline-flex items-center gap-2.5 rounded-full bg-paper/8 py-2 pl-3 pr-4 text-sm font-semibold text-paper ring-1 ring-paper/15 transition-colors hover:bg-paper/15"
            >
              <span className="relative flex size-2.5">
                <span className="absolute inset-0 animate-ping rounded-full bg-tulsi opacity-70 motion-reduce:animate-none" />
                <span className="relative size-2.5 rounded-full bg-tulsi" />
              </span>
              Pilot open · 3 programs this term
            </a>
          </div>

          {COLUMNS.map((col, ci) => (
            <motion.nav
              key={col.title}
              aria-label={col.title}
              initial={reduce ? false : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.6 }}
              transition={{ duration: 0.5, delay: 0.1 + ci * 0.08 }}
            >
              <p className="text-sm font-semibold text-haldi">{col.title}</p>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      className="group relative inline-flex items-center gap-2 text-paper/85 transition-colors hover:text-paper"
                    >
                      {l.href.startsWith("mailto:") && l.label.includes("@") && <Mail className="size-4 text-sage" />}
                      <span className="relative">
                        {l.label}
                        <span className="absolute -bottom-0.5 left-0 h-px w-full origin-left scale-x-0 bg-saffron transition-transform duration-300 group-hover:scale-x-100" />
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </motion.nav>
          ))}
        </div>

        <div className="mt-16 flex flex-wrap items-center justify-between gap-4 border-t border-paper/10 pt-6 text-sm">
          <span>&copy; 2026 Taskora · Speech by Sarvam AI</span>
          <span className="tabular-nums" suppressHydrationWarning>
            {ist ? `It's ${ist} in India` : " "}
          </span>
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" })}
            className="group inline-flex items-center gap-2 rounded-full py-1.5 pl-4 pr-1.5 font-semibold text-paper ring-1 ring-paper/20 transition-colors hover:bg-paper/10"
          >
            Back to top
            <span className="grid size-7 place-items-center rounded-full bg-haldi text-neem transition-transform group-hover:-translate-y-0.5">
              <ArrowUp className="size-4" strokeWidth={2.6} />
            </span>
          </button>
        </div>
      </div>

      {/* Oversized wordmark, bleeding off the bottom edge */}
      <div ref={wordRef} aria-hidden className="mt-8 select-none overflow-hidden px-2 sm:px-4">
        <div className="display-wide flex translate-y-[14%] justify-center text-[clamp(4.5rem,21.5vw,21rem)] leading-[0.8] lowercase">
          {WORD.map((ch, i) => (
            <span key={i} className="-mt-[0.18em] inline-block overflow-hidden pb-[0.04em] pt-[0.18em]">
              <motion.span
                className="inline-block cursor-default bg-clip-text text-transparent"
                style={{
                  backgroundImage: "linear-gradient(100deg, #f2b33d 0%, #e8622a 40%, #7dbe8f 80%, #c9d8b8 100%)",
                  backgroundSize: `${WORD.length * 100}% 100%`,
                  backgroundPosition: `${(i / (WORD.length - 1)) * 100}% 0`,
                  WebkitBackgroundClip: "text",
                }}
                initial={reduce ? false : { y: "105%" }}
                animate={wordIn || reduce ? { y: "0%" } : { y: "105%" }}
                transition={{ duration: 0.9, delay: i * 0.06, ease: [0.2, 0.8, 0.2, 1] }}
                whileHover={reduce ? undefined : { y: "-12%", transition: { type: "spring", stiffness: 400, damping: 12 } }}
              >
                {ch}
              </motion.span>
            </span>
          ))}
        </div>
      </div>
    </footer>
  );
}

/** The current time in India, refreshed every 30 seconds (client only, so no hydration mismatch). */
function useIndiaTime() {
  const [time, setTime] = useState<string | null>(null);
  useEffect(() => {
    const fmt = new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    const tick = () => setTime(fmt.format(new Date()).toLowerCase());
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);
  return time;
}

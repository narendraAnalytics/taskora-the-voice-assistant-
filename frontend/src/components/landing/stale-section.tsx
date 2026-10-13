"use client";

import { useEffect, useRef, useState } from "react";
import {
  animate,
  motion,
  useInView,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { cn } from "@/lib/utils";

const HEADLINE = "Status goes stale because typing updates is a chore.".split(" ");
const STALE_WORD = 2;
const PINGS = [
  "Any update?",
  "Where are you on this?",
  "Is it done?",
  "Did you see my message?",
  "Still on it?",
  "Hello??",
];

type Tone = "paper" | "haldi" | "kumkum" | "neem";

const PROBLEMS: { title: string; body: string; tone: Tone; Visual: React.FC<{ active: boolean }> }[] = [
  {
    title: "Organizers chase updates",
    body: "Hours go into calls and chats asking the same question: where are you on this?",
    tone: "paper",
    Visual: ChaseVisual,
  },
  {
    title: "Boards drift out of date",
    body: "Interns forget to move their cards, so the board still shows last week.",
    tone: "haldi",
    Visual: DriftVisual,
  },
  {
    title: "Blockers surface days late",
    body: "A stuck intern waits for the next meeting instead of saying so today.",
    tone: "kumkum",
    Visual: BlockedVisual,
  },
  {
    title: "Talking is easier than typing",
    body: "Twenty seconds of speaking beats five minutes of typing.",
    tone: "neem",
    Visual: TalkVisual,
  },
];

const TONE: Record<Tone, string> = {
  paper: "bg-paper-deep text-neem border-neem shadow-[8px_8px_0_#173f30]",
  haldi: "bg-haldi text-neem border-neem shadow-[8px_8px_0_#173f30]",
  kumkum: "bg-kumkum text-paper border-neem shadow-[8px_8px_0_#173f30]",
  neem: "bg-neem text-paper border-neem-deep shadow-[8px_8px_0_#11332a]",
};

/**
 * "Status goes stale" — scroll-told: a scrubbed marquee of the pings everyone is tired of, a sticky
 * headline whose words light up while "stale" wilts, a freshness meter that drains, and the four
 * problems as cards that stack over each other.
 */
export function StaleSection() {
  const reduce = useReducedMotion() ?? false;
  const sectionRef = useRef<HTMLElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: read } = useScroll({ target: sectionRef, offset: ["start 0.7", "end end"] });
  const { scrollYProgress: stack } = useScroll({ target: stackRef, offset: ["start 0.25", "end end"] });

  return (
    <section ref={sectionRef} className="relative bg-paper pb-20 pt-16 lg:pb-28 lg:pt-20">
      <Marquee reduce={reduce} />

      <div className="mx-auto mt-14 grid w-full max-w-[1200px] gap-12 px-4 sm:px-6 lg:mt-20 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-16 lg:px-8">
        {/* Sticky headline + freshness meter */}
        <div className="lg:sticky lg:top-28 lg:self-start">
          <h2 className="display max-w-[13ch] text-[clamp(2.4rem,5.2vw,4.4rem)] leading-[1.02] text-neem">
            {HEADLINE.map((w, i) => (
              <RevealWord key={i} word={w} i={i} n={HEADLINE.length} progress={read} reduce={reduce} />
            ))}
          </h2>
          <Freshness progress={stack} reduce={reduce} />
        </div>

        {/* Stacking problem cards */}
        <div ref={stackRef} className="relative">
          {PROBLEMS.map((p, i) => (
            <StackCard key={p.title} i={i} n={PROBLEMS.length} progress={stack} reduce={reduce} {...p} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Headline ───────────────────────── */

function RevealWord({
  word,
  i,
  n,
  progress,
  reduce,
}: {
  word: string;
  i: number;
  n: number;
  progress: MotionValue<number>;
  reduce: boolean;
}) {
  const start = (i / n) * 0.42;
  const opacity = useTransform(progress, [start, start + 0.06], [0.14, 1]);
  const y = useTransform(progress, [start, start + 0.06], ["0.25em", "0em"]);
  const stale = i === STALE_WORD;

  return (
    <motion.span
      className={cn("mr-[0.22em] inline-block", stale && "text-kumkum")}
      style={reduce ? undefined : { opacity, y }}
    >
      {stale ? <Wilt word={word} progress={progress} reduce={reduce} /> : word}
    </motion.span>
  );
}

/** Letters of "stale." droop and tip over as you scroll, like a wilting flower. */
function Wilt({ word, progress, reduce }: { word: string; progress: MotionValue<number>; reduce: boolean }) {
  return (
    <span aria-label={word} className="inline-block">
      {word.split("").map((ch, i) => (
        <WiltLetter key={i} ch={ch} i={i} progress={progress} reduce={reduce} />
      ))}
    </span>
  );
}

const DROOP = [7, -5, 10, -8, 13, 0];

function WiltLetter({ ch, i, progress, reduce }: { ch: string; i: number; progress: MotionValue<number>; reduce: boolean }) {
  const rotate = useTransform(progress, [0.3, 0.95], [0, DROOP[i] ?? 0]);
  const y = useTransform(progress, [0.3, 0.95], ["0em", `${0.04 + i * 0.035}em`]);
  return (
    <motion.span aria-hidden className="inline-block origin-bottom" style={reduce ? undefined : { rotate, y }}>
      {ch}
    </motion.span>
  );
}

/* ───────────────────────── Freshness meter ───────────────────────── */

function Freshness({ progress, reduce }: { progress: MotionValue<number>; reduce: boolean }) {
  const [days, setDays] = useState(reduce ? 9 : 0);
  const scaleX = useTransform(progress, [0, 0.95], [1, 0.06]);
  const backgroundColor = useTransform(progress, [0, 0.45, 0.95], ["#7dbe8f", "#f2b33d", "#b23a48"]);
  useMotionValueEvent(progress, "change", (v) => {
    if (!reduce) setDays(Math.min(9, Math.max(0, Math.round((v / 0.95) * 9))));
  });
  const label = days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;

  return (
    <div className="mt-10 max-w-[24rem] rounded-2xl border-2 border-neem bg-paper-deep/60 p-5">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-moss">Board last updated</span>
        <span className={cn("display text-2xl tabular-nums", days >= 5 ? "text-kumkum" : "text-neem")}>{label}</span>
      </div>
      <div className="mt-3 h-3 overflow-hidden rounded-full bg-neem/10">
        <motion.div
          className="h-full origin-left rounded-full"
          style={reduce ? { backgroundColor: "#b23a48", scaleX: 0.06 } : { scaleX, backgroundColor }}
        />
      </div>
    </div>
  );
}

/* ───────────────────────── Marquee ───────────────────────── */

function Marquee({ reduce }: { reduce: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const x1 = useTransform(scrollYProgress, [0, 1], ["0%", "-30%"]);
  const x2 = useTransform(scrollYProgress, [0, 1], ["-30%", "0%"]);
  const row = [...PINGS, ...PINGS, ...PINGS];

  return (
    <div ref={ref} aria-hidden className="select-none overflow-x-clip">
      <motion.div className="flex w-max items-center gap-8 whitespace-nowrap" style={reduce ? undefined : { x: x1 }}>
        {row.map((p, i) => (
          <span key={i} className="flex items-center gap-8">
            <span
              className="display-narrow text-[clamp(3rem,8vw,6.5rem)] text-transparent"
              style={{ WebkitTextStroke: "2px #173f30" }}
            >
              {p}
            </span>
            <span className="size-4 rotate-45 rounded-[3px] bg-saffron" />
          </span>
        ))}
      </motion.div>
      <motion.div className="mt-4 flex w-max gap-3" style={reduce ? undefined : { x: x2 }}>
        {row.map((p, i) => (
          <span
            key={i}
            className={cn(
              "rounded-full rounded-bl-md px-5 py-2 text-lg font-semibold",
              i % 3 === 1 ? "bg-haldi text-neem" : i % 3 === 2 ? "bg-kumkum text-paper" : "bg-neem text-paper",
            )}
          >
            {p}
          </span>
        ))}
      </motion.div>
    </div>
  );
}

/* ───────────────────────── Stacking cards ───────────────────────── */

function StackCard({
  i,
  n,
  progress,
  reduce,
  title,
  body,
  tone,
  Visual,
}: {
  i: number;
  n: number;
  progress: MotionValue<number>;
  reduce: boolean;
  title: string;
  body: string;
  tone: Tone;
  Visual: React.FC<{ active: boolean }>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const active = useInView(ref, { amount: 0.55, once: true });
  const start = i / n;
  const behind = n - 1 - i;
  const scale = useTransform(progress, [start, 1], [1, 1 - behind * 0.045]);
  const shade = useTransform(progress, [start, 1], [0, behind * 0.1]);
  const last = i === n - 1;

  return (
    <div
      ref={ref}
      className={cn("sticky", !last && "mb-[14vh]")}
      style={{ top: `calc(6.5rem + ${i * 1.4}rem)` }}
    >
      <motion.article
        className={cn(
          "relative flex min-h-[25rem] flex-col overflow-hidden rounded-[2rem] border-2 p-6 sm:min-h-[27rem] sm:p-9",
          TONE[tone],
        )}
        style={reduce ? undefined : { scale, transformOrigin: "50% 0%" }}
      >
        <div className="flex items-start justify-between gap-6">
          <div>
            <h3 className="display text-[clamp(1.6rem,3vw,2.2rem)] leading-[1.05]">{title}</h3>
            <p className={cn("mt-2 max-w-[30ch] text-lg", tone === "paper" || tone === "haldi" ? "text-neem/75" : "text-paper/80")}>
              {body}
            </p>
          </div>
          <span className="display-narrow shrink-0 text-5xl opacity-40 sm:text-6xl">0{i + 1}</span>
        </div>
        <div className="mt-auto pt-8">
          <Visual active={active || reduce} />
        </div>
        {!reduce && <motion.div aria-hidden className="pointer-events-none absolute inset-0 bg-neem-deep" style={{ opacity: shade }} />}
      </motion.article>
    </div>
  );
}

/* ───────────────────────── Card visuals ───────────────────────── */

function useCount(active: boolean, to: number, duration: number) {
  const reduce = useReducedMotion();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!active) return;
    if (reduce) {
      setN(to);
      return;
    }
    const c = animate(0, to, { duration, ease: "easeOut", onUpdate: (v) => setN(Math.round(v)) });
    return () => c.stop();
  }, [active, to, duration, reduce]);
  return n;
}

const pop = { type: "spring", stiffness: 260, damping: 20 } as const;

function ChaseVisual({ active }: { active: boolean }) {
  const unread = useCount(active, 14, 2.4);
  const msgs = ["Any update on the login page?", "Where are you on this?", "Hello??"];
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="flex flex-col items-start gap-1.5">
        <span className="display grid size-16 place-items-center rounded-full bg-kumkum text-2xl tabular-nums text-paper ring-4 ring-paper">
          {unread}
        </span>
        <span className="text-sm font-semibold text-neem/70">follow-ups today</span>
      </div>
      <div className="flex flex-col items-end gap-2">
        {msgs.map((m, i) => (
          <motion.span
            key={m}
            initial={{ opacity: 0, y: 18, scale: 0.9 }}
            animate={active ? { opacity: 1, y: 0, scale: 1 } : undefined}
            transition={{ ...pop, delay: 0.2 + i * 0.5 }}
            className="rounded-2xl rounded-br-md bg-neem px-4 py-2 font-semibold text-paper"
          >
            {m}
          </motion.span>
        ))}
      </div>
    </div>
  );
}

function DriftVisual({ active }: { active: boolean }) {
  const days = useCount(active, 7, 3);
  const cols = ["To do", "In progress", "Done"];
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {cols.map((c, ci) => (
        <div key={c} className="min-h-[8.5rem] rounded-2xl bg-neem/90 p-2.5">
          <p className="px-1 text-sm font-semibold text-paper/80">{c}</p>
          {ci === 1 && (
            <motion.div
              animate={active ? { rotate: -4, opacity: 0.75, y: 6 } : undefined}
              transition={{ duration: 3, ease: "easeInOut" }}
              className="mt-2 rounded-xl border-2 border-neem bg-paper p-2.5 text-neem"
            >
              <p className="text-sm font-bold leading-tight">Login page</p>
              <p className="mt-1.5 text-xs font-semibold text-kumkum tabular-nums">
                Updated {days === 0 ? "today" : `${days} days ago`}
              </p>
            </motion.div>
          )}
          {ci === 2 && <div className="mt-2 rounded-xl border-2 border-dashed border-paper/30 p-5" />}
        </div>
      ))}
    </div>
  );
}

function BlockedVisual({ active }: { active: boolean }) {
  const week = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  return (
    <div className="relative pt-12">
      <motion.div
        initial={{ left: "10%" }}
        animate={active ? { left: "70%" } : undefined}
        transition={{ duration: 2.2, ease: [0.6, 0, 0.3, 1], delay: 0.3 }}
        className="absolute top-0 -translate-x-1/2"
      >
        <span className="whitespace-nowrap rounded-full bg-paper px-3 py-1 text-sm font-bold text-kumkum">Raised</span>
      </motion.div>
      <div className="relative grid grid-cols-5 gap-2">
        <motion.div
          initial={{ scaleX: 0 }}
          animate={active ? { scaleX: 1 } : undefined}
          transition={{ duration: 2.2, ease: [0.6, 0, 0.3, 1], delay: 0.3 }}
          className="absolute left-[10%] right-[30%] top-1/2 h-1 origin-left -translate-y-1/2 border-t-4 border-dotted border-paper"
        />
        {week.map((d, i) => (
          <div
            key={d}
            className={cn(
              "relative z-10 grid h-14 place-items-center rounded-xl text-base font-bold",
              i === 0 ? "bg-paper text-kumkum" : i === 3 ? "bg-haldi text-neem" : "bg-paper/15 text-paper",
            )}
          >
            {i === 0 ? "Stuck" : d}
          </div>
        ))}
      </div>
      <motion.p
        initial={{ opacity: 0 }}
        animate={active ? { opacity: 1 } : undefined}
        transition={{ delay: 2.6 }}
        className="mt-3 text-right font-semibold text-paper/85"
      >
        3 days lost waiting for the weekly call
      </motion.p>
    </div>
  );
}

function TalkVisual({ active }: { active: boolean }) {
  return (
    <div className="space-y-4">
      <div>
        <div className="flex justify-between text-sm font-semibold text-paper/75">
          <span>Typing an update</span>
          <span>5 min</span>
        </div>
        <div className="mt-1.5 h-4 overflow-hidden rounded-full bg-paper/12">
          <motion.div
            initial={{ scaleX: 0 }}
            animate={active ? { scaleX: 1 } : undefined}
            transition={{ duration: 6, ease: "linear", delay: 0.2 }}
            className="h-full origin-left rounded-full bg-paper/40"
          />
        </div>
      </div>
      <div>
        <div className="flex justify-between text-sm font-semibold text-tulsi">
          <span>Speaking it</span>
          <span>20 sec</span>
        </div>
        <div className="mt-1.5 flex h-10 items-center gap-1 rounded-full bg-paper/12 px-3" data-wave={active ? "on" : "off"}>
          {Array.from({ length: 28 }).map((_, i) => (
            <span
              key={i}
              className="wave-bar h-full flex-1 rounded-full bg-tulsi"
              style={{ animationDelay: `${(i % 7) * 0.09}s`, animationDuration: `${0.7 + (i % 5) * 0.12}s` }}
            />
          ))}
        </div>
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={active ? { opacity: 1, y: 0 } : undefined}
          transition={{ delay: 1.1 }}
          className="mt-2 font-semibold text-tulsi"
        >
          Done before the typing bar moves.
        </motion.p>
      </div>
    </div>
  );
}

"use client";

import { useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { Check, Mic, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { title: "Speak", body: "Hold the mic and talk the way you would to a teammate." },
  { title: "Transcribe", body: "Sarvam Saaras v3 turns your spoken English into text." },
  {
    title: "Understand",
    body: "Taskora works out the action, the person, the task and the date. If a name is unclear, it asks.",
  },
  { title: "Confirm", body: "Reassignments and bulk changes show a card first. Questions go straight to the answer." },
  {
    title: "Update and reply",
    body: "The board changes for the whole team, and the answer is spoken back with Sarvam Bulbul v3.",
  },
];
const N = STEPS.length;
const UTTERANCE = "Login page is done. I'm blocked on the API key.".split(" ");

/**
 * "How a spoken update reaches the board" — a pinned showcase. The section sticks to the screen
 * while one real update travels through the five steps on a demo panel, scrubbed by scroll.
 */
export function HowItWorks() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const [step, setStep] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", (v) => setStep(Math.min(N - 1, Math.floor(v * N))));
  const rail = useTransform(scrollYProgress, [0, 1], [0, 1]);

  const goTo = (i: number) => {
    const el = ref.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const travel = el.offsetHeight - window.innerHeight;
    window.scrollTo({ top: top + ((i + 0.15) / N) * travel, behavior: "smooth" });
  };

  return (
    <section id="how" ref={ref} className="relative bg-paper" style={{ height: `${100 + N * 75}svh` }}>
      <div className="sticky top-0 flex h-svh items-center overflow-x-clip">
        <div className="mx-auto grid h-full w-full max-w-[1200px] grid-rows-[auto_minmax(0,1fr)] gap-5 px-4 pb-6 pt-20 sm:px-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:grid-rows-1 lg:items-center lg:gap-16 lg:px-8 lg:py-16">
          {/* Copy + step rail */}
          <div>
            <h2 className="display max-w-[18ch] text-[clamp(1.7rem,3.6vw,3.1rem)] text-neem">
              How a spoken update reaches the board
            </h2>

            {/* Phones: segmented progress + the active step */}
            <div className="mt-4 lg:hidden">
              <div className="flex gap-1.5">
                {STEPS.map((s, i) => (
                  <button
                    key={s.title}
                    type="button"
                    aria-label={`Step ${i + 1}: ${s.title}`}
                    onClick={() => goTo(i)}
                    className={cn("h-1.5 flex-1 rounded-full transition-colors", i <= step ? "bg-saffron" : "bg-neem/15")}
                  />
                ))}
              </div>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={step}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25 }}
                  className="mt-3"
                >
                  <p className="display text-xl text-neem">
                    <span className="mr-2 text-saffron">0{step + 1}</span>
                    {STEPS[step].title}
                  </p>
                  <p className="mt-1 text-[0.98rem] leading-snug text-moss">{STEPS[step].body}</p>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Desktop: vertical rail */}
            <ol className="relative mt-10 hidden space-y-1 lg:block">
              <span aria-hidden className="absolute bottom-6 left-[1.35rem] top-6 w-0.5 rounded-full bg-neem/12" />
              <motion.span
                aria-hidden
                className="absolute bottom-6 left-[1.35rem] top-6 w-0.5 origin-top rounded-full bg-saffron"
                style={{ scaleY: rail }}
              />
              {STEPS.map((s, i) => {
                const on = i === step;
                return (
                  <li key={s.title}>
                    <button
                      type="button"
                      onClick={() => goTo(i)}
                      aria-current={on ? "step" : undefined}
                      className="group relative flex w-full gap-4 rounded-2xl py-2.5 pr-3 text-left"
                    >
                      <span
                        className={cn(
                          "display relative z-10 grid size-11 shrink-0 place-items-center rounded-full text-lg transition-all duration-300",
                          on
                            ? "scale-110 bg-saffron text-neem shadow-[0_4px_0_#173f30]"
                            : i < step
                              ? "bg-neem text-paper"
                              : "bg-paper-deep text-neem/60 ring-2 ring-neem/15",
                        )}
                      >
                        {i < step ? <Check className="size-5" strokeWidth={3} /> : i + 1}
                      </span>
                      <span className="pt-1.5">
                        <span
                          className={cn(
                            "display block text-xl transition-colors",
                            on ? "text-neem" : "text-neem/45 group-hover:text-neem/70",
                          )}
                        >
                          {s.title}
                        </span>
                        <motion.span
                          initial={false}
                          animate={{ height: on ? "auto" : 0, opacity: on ? 1 : 0 }}
                          transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
                          className="block overflow-hidden"
                        >
                          <span className="block max-w-[34ch] pt-1 text-moss">{s.body}</span>
                        </motion.span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>

          {/* Demo panel */}
          <Stage step={step} progress={scrollYProgress} />
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Demo panel ───────────────────────── */

function Stage({ step, progress }: { step: number; progress: MotionValue<number> }) {
  const Scenes = [SpeakScene, TranscribeScene, UnderstandScene, ConfirmScene, UpdateScene];
  const Scene = Scenes[step];
  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-[2rem] border-2 border-neem-deep bg-neem text-paper shadow-[10px_10px_0_#11332a] lg:h-[34rem]">
      {/* soft haldi glow that drifts with the step */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute size-[28rem] rounded-full bg-[radial-gradient(circle,#f2b33d33,transparent_65%)]"
        animate={{ x: `${-20 + step * 18}%`, y: `${step % 2 ? 10 : -25}%` }}
        transition={{ duration: 1, ease: [0.4, 0, 0.2, 1] }}
      />
      <div className="relative flex items-center justify-between border-b border-paper/10 px-5 py-3.5 sm:px-7">
        <span className="flex items-center gap-2 text-sm font-semibold text-sage">
          <span className="size-2.5 rounded-full bg-tulsi" />
          Priya, intern · 6:05 pm
        </span>
        <span className="flex gap-1.5">
          {STEPS.map((s, i) => (
            <span
              key={s.title}
              className={cn("h-1.5 rounded-full transition-all duration-500", i === step ? "w-6 bg-haldi" : "w-1.5 bg-paper/25")}
            />
          ))}
        </span>
      </div>
      <div className="relative min-h-0 flex-1">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 28, scale: 0.97, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -22, scale: 0.98, filter: "blur(6px)" }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            className="absolute inset-0 flex flex-col justify-center p-5 sm:p-8"
          >
            <Scene progress={progress} i={step} />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/** 0 → 1 while the reader scrolls through one step. */
function useStepProgress(progress: MotionValue<number>, i: number) {
  return useTransform(progress, [i / N, (i + 0.85) / N], [0, 1], { clamp: true });
}

type SceneProps = { progress: MotionValue<number>; i: number };

const Tag: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold", className)}>
    {children}
  </span>
);

function SpeakScene({ progress, i }: SceneProps) {
  const local = useStepProgress(progress, i);
  const seconds = useTransform(local, [0, 1], [0, 20]);
  const [secs, setSecs] = useState(0);
  useMotionValueEvent(seconds, "change", (v) => setSecs(Math.round(v)));
  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative grid size-32 place-items-center sm:size-36">
        <span className="mic-ring absolute inset-0 rounded-full bg-saffron/40" />
        <span className="mic-ring absolute inset-0 rounded-full bg-saffron/30 [animation-delay:0.7s]" />
        <span className="relative grid size-24 place-items-center rounded-full bg-saffron text-neem shadow-[0_6px_0_#11332a] sm:size-28">
          <Mic className="size-10" strokeWidth={2.4} />
        </span>
      </div>
      <div data-wave="on" className="mt-7 flex h-12 w-full max-w-[22rem] items-center gap-1">
        {Array.from({ length: 30 }).map((_, i) => (
          <span
            key={i}
            className="wave-bar h-full flex-1 rounded-full bg-haldi"
            style={{ animationDelay: `${(i % 9) * 0.08}s`, animationDuration: `${0.6 + (i % 4) * 0.15}s` }}
          />
        ))}
      </div>
      <p className="mt-5 font-semibold text-sage">
        Listening… <span className="tabular-nums text-paper">0:{String(secs).padStart(2, "0")}</span> / 0:20
      </p>
    </div>
  );
}

function TranscribeScene({ progress, i }: SceneProps) {
  const local = useStepProgress(progress, i);
  const doneOpacity = useTransform(local, [0.8, 0.95], [0, 1]);
  return (
    <div>
      <Tag className="bg-paper/10 text-sage">Sarvam Saaras v3 · English</Tag>
      <p className="display mt-5 text-[clamp(1.6rem,3.4vw,2.6rem)] leading-[1.15]">
        <span className="text-haldi">“</span>
        {UTTERANCE.map((w, i) => (
          <ScrubWord key={i} word={w} i={i} local={local} />
        ))}
        <span className="text-haldi">”</span>
      </p>
      <motion.p style={{ opacity: doneOpacity }} className="mt-6 font-semibold text-tulsi">
        <Check className="mr-1.5 inline size-4" strokeWidth={3} />
        Transcribed in 0.8 seconds
      </motion.p>
    </div>
  );
}

function ScrubWord({ word, i, local }: { word: string; i: number; local: MotionValue<number> }) {
  const start = (i / UTTERANCE.length) * 0.75;
  const opacity = useTransform(local, [start, start + 0.08], [0.15, 1]);
  const y = useTransform(local, [start, start + 0.08], [10, 0]);
  return (
    <motion.span className="mr-[0.25em] inline-block" style={{ opacity, y }}>
      {word}
    </motion.span>
  );
}

const MARKS: Record<number, { cls: string; label?: string }> = {
  0: { cls: "bg-haldi text-neem", label: "Task" },
  1: { cls: "bg-haldi text-neem" },
  3: { cls: "bg-tulsi text-neem", label: "Status" },
  5: { cls: "bg-kumkum text-paper", label: "Blocker" },
  6: { cls: "bg-kumkum text-paper" },
  7: { cls: "bg-kumkum text-paper" },
  8: { cls: "bg-kumkum text-paper" },
  9: { cls: "bg-kumkum text-paper" },
};

const INTENT: [string, string][] = [
  ["Action", "Mark done"],
  ["Task", "Login page"],
  ["Who", "Priya"],
  ["Blocker", "API key"],
];

function UnderstandScene({ progress, i: step }: SceneProps) {
  const local = useStepProgress(progress, step);
  const [shown, setShown] = useState(0);
  useMotionValueEvent(local, "change", (v) => setShown(Math.round(v * (INTENT.length + 1))));
  return (
    <div>
      <p className="text-[clamp(1.15rem,2.2vw,1.5rem)] font-semibold leading-[2.1]">
        {UTTERANCE.map((w, i) => {
          const m = MARKS[i];
          return (
            <span key={i} className="relative mr-[0.3em] inline-block">
              {m && (
                <motion.span
                  aria-hidden
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 0.15 + i * 0.06, duration: 0.35 }}
                  className={cn("absolute -inset-x-1 inset-y-0.5 -z-0 origin-left rounded-md", m.cls.split(" ")[0])}
                />
              )}
              <span className={cn("relative", m && m.cls.split(" ")[1])}>{w}</span>
              {m?.label && (
                <motion.span
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + i * 0.05 }}
                  className="absolute -top-5 left-0 whitespace-nowrap text-xs font-bold text-sage"
                >
                  {m.label}
                </motion.span>
              )}
            </span>
          );
        })}
      </p>
      <div className="mt-6 grid grid-cols-2 gap-2.5 sm:gap-3">
        {INTENT.map(([k, v], i) => (
          <motion.div
            key={k}
            initial={false}
            animate={i < Math.max(1, shown) ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0.15, y: 8, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }}
            className="rounded-2xl bg-paper/8 px-4 py-3 ring-1 ring-paper/15"
          >
            <p className="text-xs font-bold text-sage">{k}</p>
            <p className="display text-lg sm:text-xl">{v}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function ConfirmScene({ progress, i }: SceneProps) {
  const local = useStepProgress(progress, i);
  const [pressed, setPressed] = useState(false);
  useMotionValueEvent(local, "change", (v) => setPressed(v > 0.5));
  const cursorX = useTransform(local, [0, 0.45, 0.75], [290, 64, 200]);
  const cursorY = useTransform(local, [0, 0.45, 0.75], [90, 14, 64]);
  return (
    <div className="mx-auto w-full max-w-[26rem]">
      <div className="relative rounded-[1.5rem] border-2 border-neem-deep bg-paper p-5 text-neem shadow-[8px_8px_0_#11332a] sm:p-6">
        <p className="text-sm font-bold text-moss">Check before I change anything</p>
        <p className="display mt-2 text-xl leading-snug sm:text-2xl">
          Mark <span className="rounded-md bg-haldi px-1.5">Login page</span> as Done and flag a blocker on the{" "}
          <span className="rounded-md bg-kumkum px-1.5 text-paper">API key</span>?
        </p>
        <div className="relative mt-5 flex gap-3">
          <motion.span
            animate={pressed ? { scale: [1, 0.92, 1] } : { scale: 1 }}
            transition={{ duration: 0.3 }}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-6 py-2.5 font-semibold transition-colors",
              pressed ? "bg-tulsi text-neem" : "bg-haldi text-neem shadow-[0_4px_0_#173f30]",
            )}
          >
            {pressed && <Check className="size-4" strokeWidth={3} />}
            {pressed ? "Confirmed" : "Confirm"}
          </motion.span>
          <span className="rounded-full px-5 py-2.5 font-semibold ring-2 ring-neem/30">Edit</span>
          {/* a pointer that walks to the button and taps it */}
          <motion.span
            aria-hidden
            className="pointer-events-none absolute left-0 top-0 size-7 rounded-full border-[3px] border-neem bg-saffron/80"
            style={{ x: cursorX, y: cursorY }}
            animate={pressed ? { scale: [1, 0.7, 1] } : undefined}
          />
        </div>
      </div>
      <p className="mt-5 text-center text-sm font-semibold text-sage">
        Read-only questions skip this card. Changes never do.
      </p>
    </div>
  );
}

function UpdateScene({ progress, i }: SceneProps) {
  const local = useStepProgress(progress, i);
  const [landed, setLanded] = useState(false);
  useMotionValueEvent(local, "change", (v) => setLanded(v > 0.35));
  const cols = ["In progress", "Done"];
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        {cols.map((c, ci) => (
          <div key={c} className="min-h-[7.5rem] rounded-2xl bg-neem-deep/80 p-3 ring-1 ring-paper/10">
            <p className={cn("text-sm font-bold", ci === 1 ? "text-tulsi" : "text-haldi")}>{c}</p>
            <div className="mt-2 space-y-2">
              {ci === 0 && (
                <div className="rounded-xl bg-neem-soft p-2.5 ring-1 ring-tulsi/40">
                  <p className="font-semibold leading-tight">API testing</p>
                  <Tag className={cn("mt-1.5 px-2 py-0 text-xs", landed ? "bg-kumkum text-paper" : "bg-paper/10 text-sage")}>
                    {landed ? "Blocked: API key" : "In progress"}
                  </Tag>
                </div>
              )}
              {(ci === 0) === !landed && (
                <motion.div
                  layoutId="moving-card"
                  transition={{ type: "spring", stiffness: 220, damping: 24 }}
                  className="rounded-xl border-2 border-neem bg-paper p-2.5 text-neem"
                >
                  <p className={cn("font-semibold leading-tight", landed && "line-through decoration-2")}>Login page</p>
                  <Tag className={cn("mt-1.5 px-2 py-0 text-xs", landed ? "bg-tulsi" : "bg-haldi")}>
                    {landed ? "Done" : "In progress"}
                  </Tag>
                </motion.div>
              )}
            </div>
          </div>
        ))}
      </div>
      <motion.div
        initial={false}
        animate={landed ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 }}
        transition={{ delay: landed ? 0.45 : 0, duration: 0.35 }}
        className="flex items-start gap-3 rounded-2xl bg-paper/8 p-4 ring-1 ring-paper/15"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-haldi text-neem">
          <Volume2 className="size-5" strokeWidth={2.4} />
        </span>
        <div>
          <p className="font-semibold leading-snug">
            “Done. Login page is marked done, and I&apos;ve told Ravi you need the API key.”
          </p>
          <p className="mt-1 text-sm text-sage">Spoken back with Sarvam Bulbul v3</p>
        </div>
      </motion.div>
    </div>
  );
}

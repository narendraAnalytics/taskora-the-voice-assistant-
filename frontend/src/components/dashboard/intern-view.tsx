"use client";

import { useState } from "react";
import { Check, Mic, Square } from "lucide-react";
import { MY_TASKS, STATUS_LABEL, type Status } from "@/lib/demo-data";
import { useSpeech } from "@/lib/use-speech";
import { StatusChip } from "@/components/dashboard/status-chip";
import { Shell } from "@/components/dashboard/shell";
import { motion, useReducedMotion } from "framer-motion";
import { PaperCard, Tape } from "@/components/dashboard/motion";
import { cn } from "@/lib/utils";

const MAX = 20;

const CONFETTI = ["#f2b33d", "#e8622a", "#7dbe8f", "#fce7b2", "#b23a48"];

/** A one-shot burst of paper bits from the "Send update" button. */
function Confetti() {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0">
      {Array.from({ length: 18 }).map((_, k) => {
        const angle = (k / 18) * Math.PI * 2;
        const dist = 60 + (k % 4) * 18;
        return (
          <motion.span
            key={k}
            className="absolute left-1/2 top-1/2 h-2.5 w-1.5 rounded-[1px]"
            style={{ backgroundColor: CONFETTI[k % CONFETTI.length] }}
            initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
            animate={{ x: Math.cos(angle) * dist, y: Math.sin(angle) * dist + 30, rotate: 360 + k * 40, opacity: 0 }}
            transition={{ duration: 1.1, ease: [0.15, 0.7, 0.3, 1] }}
          />
        );
      })}
    </span>
  );
}
const card = "rounded-[2rem] bg-paper-deep/70 p-5 ring-1 ring-neem/10 backdrop-blur-sm sm:p-6";

/** Split a spoken update into done / next / blocked using simple cue words (Gemini does this later). */
function summarise(text: string) {
  const parts = text.split(/(?<=[.!?])\s+|\band\b|,/i).map((p) => p.trim()).filter(Boolean);
  const pick = (re: RegExp) => parts.filter((p) => re.test(p));
  return {
    done: pick(/\b(done|finished|completed|shipped|fixed)\b/i),
    next: pick(/\b(next|will|going to|tomorrow|plan)\b/i),
    blocked: pick(/\b(blocked|stuck|waiting|can't|cannot|need help)\b/i),
  };
}

export function InternView({ name }: { name: string }) {
  const [tasks, setTasks] = useState(MY_TASKS);
  const reduce = useReducedMotion();
  const [update, setUpdate] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [draft, setDraft] = useState("");

  const { supported, listening, transcript, seconds, start, stop } = useSpeech((t) => {
    setUpdate(t);
    setSent(false);
  }, MAX);

  const text = update ?? "";
  const sum = text ? summarise(text) : null;
  const ring = Math.min(seconds / MAX, 1);
  const done = tasks.filter((t) => t.status === "done").length;

  const setStatus = (id: string, status: Status) =>
    setTasks((l) => l.map((t) => (t.id === id ? { ...t, status, progress: status === "done" ? 100 : t.progress } : t)));

  return (
    <Shell name={name} role="intern" title="Intern workspace" subtitle="Give your 20-second standup. Taskora does the rest.">
      <div className="grid gap-5 lg:grid-cols-12">
        <PaperCard as="section" i={0} tilt={-1.5} className="relative overflow-hidden rounded-[2rem] bg-neem p-6 text-paper sm:p-8 lg:col-span-7">
          <div aria-hidden className="pointer-events-none absolute -left-20 -top-20 size-72 rounded-full bg-saffron/30 blur-3xl" />
          <h2 className="font-hand relative text-4xl font-bold leading-none text-haldi">Today&apos;s standup</h2>
          <p className="font-note relative mt-1.5 text-base text-sage">Say what you finished, what&apos;s next, and what is blocking you.</p>

          <div className="relative mt-8 flex flex-col items-center">
            <div className="relative grid size-44 place-items-center">
              <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden>
                <circle cx="50" cy="50" r="46" fill="none" stroke="#24543f" strokeWidth="5" />
                <circle
                  cx="50"
                  cy="50"
                  r="46"
                  fill="none"
                  stroke="#f2b33d"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 46}
                  strokeDashoffset={2 * Math.PI * 46 * (1 - ring)}
                  className="transition-[stroke-dashoffset] duration-300"
                />
              </svg>
              <button
                type="button"
                onClick={listening ? stop : start}
                disabled={!supported}
                aria-label={listening ? "Stop recording" : "Start your standup"}
                className={cn(
                  "relative grid size-32 place-items-center rounded-full text-neem shadow-[0_6px_0_#11332a] transition-transform active:translate-y-1 active:shadow-none disabled:opacity-40",
                  listening ? "bg-kumkum text-paper" : "bg-saffron hover:scale-105",
                )}
              >
                {listening && <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-kumkum/50" />}
                {listening ? <Square className="relative size-9 fill-current" aria-hidden /> : <Mic className="relative size-12" aria-hidden />}
              </button>
            </div>
            <p className="font-hand mt-3 text-3xl font-bold tabular-nums text-haldi">
              {listening ? `${MAX - seconds}s left` : "Tap and talk"}
            </p>
            {!supported && <p className="mt-1 text-sm text-sage">Voice needs Chrome or Edge. You can type below instead.</p>}
          </div>

          {(listening || text) && (
            <p className="font-note relative mt-6 rounded-2xl bg-neem-soft p-4 text-lg leading-snug">
              “{listening ? transcript || "Listening…" : text}”
            </p>
          )}

          {!supported && !text && (
            <form
              className="relative mt-5 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (draft.trim()) setUpdate(draft.trim());
              }}
            >
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                aria-label="Type your standup"
                placeholder="Login page is done, next is tests…"
                className="h-12 flex-1 rounded-full bg-neem-soft px-5 text-paper placeholder:text-sage focus:outline-none focus-visible:ring-2 focus-visible:ring-haldi"
              />
              <button type="submit" className="rounded-full bg-haldi px-5 font-bold text-neem">
                Use
              </button>
            </form>
          )}

          {sum && !listening && (
            <div className="relative mt-5 space-y-3">
              {(
                [
                  ["Done", sum.done, "bg-tulsi text-neem"],
                  ["Next", sum.next, "bg-haldi text-neem"],
                  ["Blocked", sum.blocked, "bg-kumkum text-paper"],
                ] as const
              ).map(([label, items, tone]) =>
                items.length ? (
                  <div key={label} className="flex items-start gap-2.5">
                    <span className={cn("mt-0.5 rounded-full px-2.5 py-0.5 text-xs font-bold", tone)}>{label}</span>
                    <p className="text-[0.98rem] leading-snug">{items.join(". ")}</p>
                  </div>
                ) : null,
              )}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  disabled={sent}
                  onClick={() => setSent(true)}
                  className="relative inline-flex items-center gap-2 rounded-full bg-saffron px-5 py-2.5 font-bold text-neem transition-[background-color,transform] hover:-translate-y-0.5 hover:bg-[#ef7740] active:scale-95 disabled:bg-tulsi"
                >
                  {sent && !reduce && <Confetti />}
                  {sent ? (
                    <>
                      <Check className="size-4" aria-hidden /> Sent to your organizer
                    </>
                  ) : (
                    "Send update"
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUpdate(null);
                    setSent(false);
                  }}
                  className="rounded-full px-5 py-2.5 font-bold ring-2 ring-paper/60 hover:bg-neem-soft"
                >
                  Record again
                </button>
              </div>
            </div>
          )}
        </PaperCard>

        <div className="flex flex-col gap-5 lg:col-span-5">
          <PaperCard as="section" i={1} tilt={2} className={card}>
            <div className="flex items-baseline justify-between">
              <h2 className="font-hand text-4xl font-bold leading-none">My tasks</h2>
              <span className="font-note text-sm text-moss">
                {done} of {tasks.length} done
              </span>
            </div>
            <ul className="mt-4 space-y-3">
              {tasks.map((t) => (
                <motion.li
                  key={t.id}
                  initial={reduce ? false : { opacity: 0, y: 14, rotate: -1.5 }}
                  animate={{ opacity: 1, y: 0, rotate: 0 }}
                  whileHover={reduce ? undefined : { y: -3 }}
                  transition={{ type: "spring", stiffness: 220, damping: 18, delay: 0.45 + tasks.indexOf(t) * 0.08 }}
                  className={cn("rounded-2xl bg-paper p-4 shadow-[0_3px_0_#173f3014] transition-opacity", t.status === "done" && "opacity-75")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold leading-snug">{t.title}</p>
                    <StatusChip status={t.status} />
                  </div>
                  <p className="mt-1 text-xs text-moss">Due {t.due}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label={`Set status for ${t.title}`}>
                    {(["todo", "progress", "blocked", "done"] as Status[]).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setStatus(t.id, s)}
                        aria-pressed={t.status === s}
                        className={cn(
                          "rounded-full px-3 py-1 text-xs font-bold ring-1 ring-neem/25 transition-colors",
                          t.status === s ? "bg-neem text-paper ring-neem" : "hover:bg-paper-deep",
                        )}
                      >
                        {STATUS_LABEL[s]}
                      </button>
                    ))}
                  </div>
                </motion.li>
              ))}
            </ul>
          </PaperCard>

          <PaperCard as="section" i={2} tilt={-2.5} className="relative rounded-[2rem] bg-haldi p-5 sm:p-6"><Tape className="-top-3 left-10" />
            <h2 className="font-hand text-4xl font-bold leading-none">Your streak</h2>
            <div className="mt-4 flex gap-2" aria-label="Standups this week">
              {["M", "T", "W", "T", "F"].map((d, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                  <motion.span
                    className={cn("grid size-10 place-items-center rounded-full text-sm font-bold", i < 3 ? "bg-neem text-paper" : "bg-neem/15")}
                    initial={reduce ? false : { scale: 0, rotate: -40 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 320, damping: 12, delay: 0.7 + i * 0.1 }}
                  >
                    {i < 3 ? <Check className="size-4" aria-hidden /> : null}
                  </motion.span>
                  <span className="text-xs font-semibold">{d}</span>
                </div>
              ))}
            </div>
            <p className="font-note mt-4 text-base">Three days in a row. Keep it going!</p>
          </PaperCard>
        </div>
      </div>
    </Shell>
  );
}

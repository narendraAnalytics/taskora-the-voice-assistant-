"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, animate, motion, useInView, useReducedMotion } from "framer-motion";
import { BellRing, Mic, Pause, Play, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "haldi" | "tulsi" | "kumkum" | "paper";
type Command = { says: string; does: string; result: [string, Tone][] };
type Group = { id: string; label: string; auto?: boolean; commands: Command[] };

const GROUPS: Group[] = [
  {
    id: "organizer",
    label: "Organizer",
    commands: [
      {
        says: "What's pending today?",
        does: "Reads pending tasks grouped by intern, overdue first.",
        result: [
          ["Ravi · 2 overdue", "kumkum"],
          ["Priya · 1 pending", "haldi"],
          ["Sneha · all done", "tulsi"],
        ],
      },
      {
        says: "Move Ravi's API task to Priya.",
        does: "Reassigns after you confirm, keeps the history and tells both of them.",
        result: [
          ["Confirm card shown", "haldi"],
          ["Reassigned to Priya", "tulsi"],
          ["Ravi and Priya told", "paper"],
        ],
      },
      {
        says: "Push all of Sneha's tasks by two days.",
        does: "Shows every date that will change and applies them on confirm.",
        result: [
          ["3 dates will change", "haldi"],
          ["Confirmed", "tulsi"],
          ["Sneha told", "paper"],
        ],
      },
      {
        says: "Who is blocked?",
        does: "Lists blockers with who raised them and since when.",
        result: [
          ["Priya · API key · 1 day", "kumkum"],
          ["Arjun · design files · 3 days", "kumkum"],
        ],
      },
      {
        says: "Who hasn't updated today?",
        does: "Names them and offers to send a reminder.",
        result: [
          ["Ravi", "paper"],
          ["Arjun", "paper"],
          ["Send a reminder?", "haldi"],
        ],
      },
    ],
  },
  {
    id: "intern",
    label: "Intern",
    commands: [
      {
        says: "What are my tasks today?",
        does: "Reads today's tasks and deadlines aloud.",
        result: [
          ["Login page · due today", "haldi"],
          ["API tests · due Friday", "paper"],
        ],
      },
      {
        says: "Login page is done, the API is halfway, and I'm waiting on design.",
        does: "Marks one task done, updates another, logs a blocker and alerts your organizer.",
        result: [
          ["Login page · Done", "tulsi"],
          ["API · 50%", "haldi"],
          ["Blocked: design", "kumkum"],
        ],
      },
      {
        says: "I'm stuck on the payment webhook.",
        does: "Logs a blocker on the right task so it shows up in today's summary.",
        result: [
          ["Blocker logged", "kumkum"],
          ["In the 6 pm summary", "haldi"],
        ],
      },
    ],
  },
  {
    id: "automatic",
    label: "Every evening",
    auto: true,
    commands: [
      {
        says: "6 pm summary",
        does: "Organizers get what's done, pending and blocked, and who didn't update.",
        result: [
          ["12 done", "tulsi"],
          ["5 pending", "haldi"],
          ["2 blocked", "kumkum"],
        ],
      },
      {
        says: "Overdue nudge",
        does: "Interns with late tasks get a friendly reminder the next morning.",
        result: [["3 reminders · 9 am", "haldi"]],
      },
      {
        says: "Weekly report",
        does: "Program admins get progress per intern, ready to share with sponsors.",
        result: [
          ["18 interns", "paper"],
          ["86% on time", "tulsi"],
        ],
      },
    ],
  },
];

const TONE: Record<Tone, string> = {
  haldi: "bg-haldi text-neem",
  tulsi: "bg-tulsi text-neem",
  kumkum: "bg-kumkum text-paper",
  paper: "bg-paper text-neem",
};

/** Seconds each command stays on screen while the demo plays itself. */
const DWELL = 6;

/**
 * "Say it the way you'd say it to a teammate" — a self-playing voice console. Each command is
 * typed out as if spoken, Taskora's response and results stream in, then it moves on. Hover,
 * focus or the pause button stops it; clicking a command plays that one.
 */
export function Commands() {
  const reduce = useReducedMotion() ?? false;
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, { amount: 0.4 });
  const [g, setG] = useState(0);
  const [c, setC] = useState(0);
  const [hold, setHold] = useState(false);
  const [paused, setPaused] = useState(false);
  const group = GROUPS[g];
  const cmd = group.commands[c];
  const playing = !reduce && !paused && !hold && inView;

  const next = () => {
    if (c + 1 < group.commands.length) setC(c + 1);
    else {
      setG((g + 1) % GROUPS.length);
      setC(0);
    }
  };

  return (
    <div
      ref={rootRef}
      className="grid gap-6 [grid-template-areas:'tabs'_'console'_'list'] lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:grid-rows-[auto_1fr] lg:gap-x-12 lg:[grid-template-areas:'tabs_console'_'list_console']"
      onMouseEnter={() => setHold(true)}
      onMouseLeave={() => setHold(false)}
      onFocus={() => setHold(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setHold(false);
      }}
    >
      {/* Tabs (phones: tabs → console → list; desktop: tabs and list left, console right) */}
      <div className="[grid-area:tabs]">
        <div role="tablist" aria-label="Who is speaking" className="inline-flex rounded-full bg-paper/8 p-1.5 ring-1 ring-paper/15">
          {GROUPS.map((x, i) => (
            <button
              key={x.id}
              role="tab"
              id={`tab-${x.id}`}
              aria-selected={i === g}
              aria-controls="commands-panel"
              onClick={() => {
                setG(i);
                setC(0);
              }}
              className={cn(
                "relative rounded-full px-4 py-2 text-base font-semibold transition-colors sm:px-5",
                i === g ? "text-neem" : "text-paper/80 hover:text-paper",
              )}
            >
              {i === g && (
                <motion.span
                  layoutId="tab-pill"
                  className="absolute inset-0 rounded-full bg-haldi"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              <span className="relative">{x.label}</span>
            </button>
          ))}
        </div>
      </div>

      <ul
        id="commands-panel"
        role="tabpanel"
        aria-labelledby={`tab-${group.id}`}
        className="space-y-2 [grid-area:list] lg:self-start"
      >
          {group.commands.map((x, i) => {
            const on = i === c;
            return (
              <motion.li
                key={`${group.id}-${x.says}`}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05, duration: 0.3 }}
              >
                <button
                  type="button"
                  onClick={() => setC(i)}
                  aria-pressed={on}
                  className={cn(
                    "relative w-full overflow-hidden rounded-2xl px-5 py-4 text-left transition-colors",
                    on ? "bg-paper/10 ring-1 ring-paper/20" : "hover:bg-paper/5",
                  )}
                >
                  <span className={cn("display block text-xl leading-snug sm:text-2xl", on ? "text-paper" : "text-paper/55")}>
                    {group.auto ? x.says : `“${x.says}”`}
                  </span>
                  {on && (
                    <span aria-hidden className="absolute inset-x-5 bottom-0 h-0.5 overflow-hidden rounded-full bg-paper/10">
                      <span
                        key={`${g}-${c}`}
                        className="block h-full origin-left bg-haldi"
                        style={{
                          animation: reduce ? "none" : `cmd-progress ${DWELL}s linear forwards`,
                          animationPlayState: playing ? "running" : "paused",
                          transform: reduce ? "scaleX(1)" : undefined,
                        }}
                        onAnimationEnd={next}
                      />
                    </span>
                  )}
                </button>
              </motion.li>
            );
          })}
      </ul>

      {/* Console */}
      <div className="[grid-area:console]">
        <Console key={`${g}-${c}`} cmd={cmd} auto={!!group.auto} reduce={reduce} paused={paused} onPause={() => setPaused((p) => !p)} />
      </div>
    </div>
  );
}

function Console({
  cmd,
  auto,
  reduce,
  paused,
  onPause,
}: {
  cmd: Command;
  auto: boolean;
  reduce: boolean;
  paused: boolean;
  onPause: () => void;
}) {
  const [chars, setChars] = useState(reduce || auto ? cmd.says.length : 0);
  const typed = chars >= cmd.says.length;

  useEffect(() => {
    if (reduce || auto) return;
    const a = animate(0, cmd.says.length, {
      duration: Math.min(2.2, cmd.says.length * 0.035),
      ease: "linear",
      delay: 0.3,
      onUpdate: (v) => setChars(Math.round(v)),
    });
    return () => a.stop();
  }, [cmd.says, reduce, auto]);

  return (
    <div className="relative flex min-h-[25rem] flex-col overflow-hidden rounded-[2rem] bg-neem-deep p-6 ring-1 ring-paper/15 shadow-[10px_10px_0_#0d2a21] sm:p-8">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2.5 text-sm font-semibold text-sage">
          <span className={cn("grid size-8 place-items-center rounded-full", auto ? "bg-tulsi text-neem" : "bg-saffron text-neem")}>
            {auto ? <BellRing className="size-4" /> : <Mic className="size-4" />}
          </span>
          {auto ? "Sent automatically" : "You said"}
        </span>
        <button
          type="button"
          onClick={onPause}
          aria-label={paused ? "Play the demo" : "Pause the demo"}
          className="grid size-9 place-items-center rounded-full text-sage ring-1 ring-paper/20 hover:bg-paper/10 hover:text-paper"
        >
          {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
        </button>
      </div>

      {/* what was said, typed out as it is heard */}
      <p className="display mt-6 min-h-[5.5rem] text-[clamp(1.6rem,3vw,2.4rem)] leading-[1.12] text-paper">
        {auto ? cmd.says : <>“{cmd.says.slice(0, chars)}{typed && "”"}</>}
        {!typed && <span className="typing-caret" />}
      </p>
      {!auto && (
        <div data-wave={typed ? "off" : "on"} className="mt-3 flex h-6 w-40 items-center gap-1">
          {Array.from({ length: 16 }).map((_, i) => (
            <span
              key={i}
              className="wave-bar h-full flex-1 rounded-full bg-haldi/80"
              style={{ animationDelay: `${(i % 6) * 0.08}s` }}
            />
          ))}
        </div>
      )}

      {/* Taskora's reply */}
      <AnimatePresence>
        {typed && (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: reduce || auto ? 0 : 0.25 }}
            className="mt-auto pt-8"
          >
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-haldi text-neem">
                <Volume2 className="size-4" strokeWidth={2.4} />
              </span>
              <p className="pt-1 text-lg text-paper/90">{cmd.does}</p>
            </div>
            <div className="mt-5 flex flex-wrap gap-2 pl-12">
              {cmd.result.map(([label, tone], i) => (
                <motion.span
                  key={label}
                  initial={{ opacity: 0, scale: 0.85, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 320, damping: 22, delay: (reduce ? 0 : 0.55) + i * 0.15 }}
                  className={cn("rounded-full px-3.5 py-1.5 text-sm font-semibold", TONE[tone])}
                >
                  {label}
                </motion.span>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

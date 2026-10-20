"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, Check, ClipboardList, GraduationCap, Languages, MessageSquarePlus, MessagesSquare, School, Send, Sparkles } from "lucide-react";
import { getMyMessages, postTaskUpdate } from "@/app/me/actions";
import { agoText, fmtDue, UPDATE_STATUSES, type MessageView, type TaskView, type UpdateStatus } from "@/lib/task-types";
import { STATUS_LABEL } from "@/lib/demo-data";
import { StatusChip } from "@/components/dashboard/status-chip";
import { Shell } from "@/components/dashboard/shell";
import { motion, useReducedMotion } from "framer-motion";
import { PaperCard, Tape } from "@/components/dashboard/motion";
import { cn } from "@/lib/utils";

const MAX = 400;

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

export type InternProfile = {
  position: string | null;
  college: string | null;
  degree: string | null;
  studyYear: string | null;
  months: number | null;
  startDate: string | null;
  language: string | null;
  skills: string[];
};

const fmtDate = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/** The intern's own details, from the invite their organizer filled in. */
function Placement({ p }: { p: InternProfile }) {
  const study = [p.degree, p.studyYear].filter(Boolean).join(" · ");
  const when = [p.months ? `${p.months} month${p.months > 1 ? "s" : ""}` : "", p.startDate ? `from ${fmtDate(p.startDate)}` : ""].filter(Boolean).join(" · ");
  const rows: [typeof Sparkles, string][] = [];
  if (p.position) rows.push([Sparkles, p.position]);
  if (p.college) rows.push([School, p.college]);
  if (study) rows.push([GraduationCap, study]);
  if (when) rows.push([CalendarDays, when]);
  if (p.language) rows.push([Languages, `Standups in ${p.language}`]);
  if (!rows.length && !p.skills.length) return null;
  return (
    <PaperCard as="section" i={1} tilt={2} className={card}>
      <h2 className="font-hand text-4xl font-bold leading-none">Your placement</h2>
      <ul className="mt-4 space-y-2.5">
        {rows.map(([Icon, text], k) => (
          <li key={k} className="flex items-start gap-2.5">
            <Icon className="mt-0.5 size-4 shrink-0 text-moss" aria-hidden />
            <span className={cn(k === 0 && "font-bold")}>{text}</span>
          </li>
        ))}
      </ul>
      {p.skills.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5" aria-label="Skills">
          {p.skills.map((sk) => (
            <span key={sk} className="rounded-full bg-tulsi px-2.5 py-1 text-xs font-bold">
              {sk}
            </span>
          ))}
        </div>
      )}
    </PaperCard>
  );
}

/** How each status looks as a choice button (palette only: no white, black or blue). */
const STATUS_TONE: Record<UpdateStatus, string> = {
  todo: "bg-sage text-neem",
  progress: "bg-haldi text-neem",
  blocked: "bg-kumkum text-paper",
  done: "bg-tulsi text-neem",
};

/** Starter sentences that fill the box and set the status, for interns who do not know what to write. */
const QUICK: { label: string; text: string; status: UpdateStatus }[] = [
  { label: "Started", text: "I've started working on this.", status: "progress" },
  { label: "Blocked", text: "I'm blocked: ", status: "blocked" },
  { label: "Finished", text: "I've finished this and it's ready for review.", status: "done" },
];

/**
 * The status that is pre-selected when an intern opens a task. Only the intern changes a status, so nothing is
 * guessed from their words: a task still to do (or overdue) starts at "In progress", the others keep their status.
 */
const choiceFor = (t: TaskView): UpdateStatus => (t.status === "todo" || t.status === "overdue" ? "progress" : t.status);

type Sent = { id: number; task: string; status: UpdateStatus; text: string };

/** `tasks` are this intern's own, loaded on the server from their own invite. */
export function InternView({ name, profile, tasks: firstTasks = [], messages: firstMessages = [] }: { name: string; profile?: InternProfile | null; tasks?: TaskView[]; messages?: MessageView[] }) {
  const reduce = useReducedMotion();
  const [messages, setMessages] = useState(firstMessages);
  // Messages the organizer sends while this page is open appear without a reload.
  useEffect(() => {
    const load = async () => {
      if (document.visibilityState !== "visible") return;
      const next = await getMyMessages().catch(() => null);
      if (next) setMessages((cur) => (JSON.stringify(cur) === JSON.stringify(next) ? cur : next));
    };
    const t = window.setInterval(load, 15_000);
    document.addEventListener("visibilitychange", load);
    return () => {
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", load);
    };
  }, []);
  const [tasks, setTasks] = useState(firstTasks);
  const open = tasks.filter((t) => t.status !== "done");
  const [taskId, setTaskId] = useState<string | null>((open[0] ?? tasks[0])?.id ?? null);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<UpdateStatus>(() => ((open[0] ?? tasks[0]) ? choiceFor(open[0] ?? tasks[0]) : "progress"));
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<Sent[]>([]);
  const composer = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  const task = tasks.find((t) => t.id === taskId) ?? null;
  const done = tasks.filter((t) => t.status === "done").length;

  const pickTask = (t: TaskView, focus = false) => {
    setTaskId(t.id);
    setStatus(choiceFor(t));
    setSent(false);
    setError("");
    if (focus) {
      composer.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
      window.setTimeout(() => box.current?.focus({ preventScroll: true }), 350);
    }
  };

  const onText = (v: string) => {
    setText(v.slice(0, MAX));
    setSent(false);
  };

  const quick = (q: (typeof QUICK)[number]) => {
    setText(q.text);
    setStatus(q.status);
    setSent(false);
    window.setTimeout(() => {
      const el = box.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }, 0);
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task || sending) return;
    if (text.trim().length < 2) return setError("Write a few words about the task.");
    setError("");
    setSending(true);
    const r = await postTaskUpdate({ taskId: task.id, text: text.trim(), status }).catch(() => ({ ok: false as const, error: "Could not send. Check your connection and try again." }));
    setSending(false);
    if (!r.ok) return setError(r.error);
    setTasks((l) => l.map((t) => (t.id === r.task.id ? r.task : t)));
    setHistory((h) => [{ id: Date.now(), task: task.title, status, text: text.trim() }, ...h].slice(0, 4));
    setText("");
    setStatus(choiceFor(r.task));
    setSent(true);
  };

  return (
    <Shell name={name} role="intern" title="Intern workspace" subtitle="Tell your organizer how your tasks are going.">
      <div className="grid gap-5 lg:grid-cols-12">
        <PaperCard as="section" i={0} tilt={-1.5} className="relative overflow-hidden rounded-[2rem] bg-neem p-6 text-paper sm:p-8 lg:col-span-7">
          <div aria-hidden className="pointer-events-none absolute -left-20 -top-20 size-72 rounded-full bg-saffron/30 blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute -bottom-24 -right-16 size-64 rounded-full bg-tulsi/20 blur-3xl" />
          <div ref={composer} className="relative scroll-mt-24">
            <div className="flex items-center gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-haldi text-neem">
                <MessageSquarePlus className="size-5" aria-hidden />
              </span>
              <h2 className="font-hand text-4xl font-bold leading-none text-haldi">Tell your organizer</h2>
            </div>
            <p className="font-note mt-2 text-base text-sage">Started a task? Hit a blocker? Write it here and your organizer sees it right away.</p>

            {tasks.length === 0 ? (
              <div className="mt-6 rounded-2xl bg-neem-soft px-5 py-8 text-center">
                <ClipboardList className="mx-auto size-8 text-haldi" aria-hidden />
                <p className="font-note mt-3 text-lg">No tasks to update yet.</p>
                <p className="mt-1 text-sm text-sage">When your organizer gives you a task, you can write your updates here.</p>
              </div>
            ) : (
              <form onSubmit={send} className="mt-6 space-y-5">
                {/* 1. Which task */}
                <fieldset>
                  <legend className="mb-2 text-sm font-bold text-sage">1. Which task?</legend>
                  <div className="flex flex-wrap gap-2">
                    {tasks.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => pickTask(t)}
                        aria-pressed={t.id === taskId}
                        className={cn(
                          "max-w-full rounded-2xl px-4 py-2 text-left transition-[background-color,color,transform] active:scale-95",
                          t.id === taskId ? "bg-haldi text-neem" : "bg-neem-soft text-paper hover:bg-neem-soft/70",
                        )}
                      >
                        <span className="block truncate text-sm font-bold">{t.title}</span>
                        <span className={cn("block text-xs", t.id === taskId ? "text-neem/80" : "text-sage")}>Due {fmtDue(t.dueDate)}</span>
                      </button>
                    ))}
                  </div>
                </fieldset>

                {/* 2. The message */}
                <div>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <label htmlFor="update-text" className="text-sm font-bold text-sage">
                      2. What&apos;s the update?
                    </label>
                    <div className="flex gap-1.5" aria-label="Quick starters">
                      {QUICK.map((q) => (
                        <button
                          key={q.label}
                          type="button"
                          onClick={() => quick(q)}
                          className="rounded-full bg-neem-soft px-3 py-1 text-xs font-bold text-paper transition-[background-color,color,transform] hover:-translate-y-0.5 hover:bg-haldi hover:text-neem active:scale-95"
                        >
                          {q.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="relative">
                    <textarea
                      id="update-text"
                      ref={box}
                      value={text}
                      onChange={(e) => onText(e.target.value)}
                      rows={4}
                      maxLength={MAX}
                      placeholder={task ? `e.g. I started on "${task.title}" and the first page is done. I need the logo file to continue.` : "Write your update…"}
                      className="font-note w-full resize-none rounded-2xl bg-neem-soft p-4 pb-8 text-[1.05rem] leading-snug text-paper placeholder:text-sage/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-haldi"
                    />
                    <span aria-hidden className={cn("pointer-events-none absolute bottom-2.5 right-4 text-xs tabular-nums", text.length > MAX - 40 ? "text-haldi" : "text-sage")}>
                      {text.length}/{MAX}
                    </span>
                  </div>
                </div>

                {/* 3. Status */}
                <fieldset>
                  <legend className="mb-2 flex items-center gap-2 text-sm font-bold text-sage">
                    3. Where is it now?
                    <span className="rounded-full bg-neem-soft px-2 py-0.5 text-xs font-semibold text-haldi">You choose this</span>
                  </legend>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Task status">
                    {UPDATE_STATUSES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        role="radio"
                        aria-checked={status === s}
                        onClick={() => setStatus(s)}
                        className={cn(
                          "rounded-full px-3 py-2 text-sm font-bold transition-[box-shadow,opacity,transform] active:scale-95",
                          STATUS_TONE[s],
                          status === s ? "scale-[1.04] opacity-100 ring-2 ring-paper ring-offset-2 ring-offset-neem" : "opacity-55 hover:opacity-90",
                        )}
                      >
                        {STATUS_LABEL[s]}
                      </button>
                    ))}
                  </div>
                </fieldset>

                {error && (
                  <p role="alert" className="rounded-xl bg-kumkum px-4 py-2.5 text-sm font-semibold text-paper">
                    {error}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    disabled={sending || !text.trim()}
                    className="relative inline-flex items-center gap-2 rounded-full bg-saffron px-6 py-3 text-lg font-bold text-neem shadow-[0_4px_0_#11332a] transition-[transform,box-shadow] hover:-translate-y-0.5 active:translate-y-1 active:shadow-none disabled:opacity-50 disabled:hover:translate-y-0"
                  >
                    {sent && !reduce && <Confetti />}
                    {sending ? "Sending…" : "Send to organizer"}
                    <Send className="size-5" aria-hidden />
                  </button>
                  {sent && (
                    <motion.p role="status" initial={reduce ? false : { opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="inline-flex items-center gap-1.5 font-semibold text-tulsi">
                      <Check className="size-5" aria-hidden /> Sent. Your organizer can see it now.
                    </motion.p>
                  )}
                </div>
              </form>
            )}

            {history.length > 0 && (
              <div className="mt-7">
                <h3 className="font-note text-lg font-bold text-haldi">Sent just now</h3>
                <ul className="mt-2 space-y-2">
                  {history.map((h) => (
                    <motion.li key={h.id} initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-neem-soft p-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-bold">{h.task}</span>
                        <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold", STATUS_TONE[h.status])}>{STATUS_LABEL[h.status]}</span>
                      </div>
                      <p className="font-note mt-1 text-[0.98rem] leading-snug text-sage">“{h.text}”</p>
                    </motion.li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </PaperCard>

        <div className="flex flex-col gap-5 lg:col-span-5">
          <PaperCard as="section" i={1} tilt={1.5} className="relative rounded-[2rem] bg-haldi p-5 sm:p-6">
            <Tape className="-top-3 right-10" />
            <div className="flex items-center gap-2.5">
              <MessagesSquare className="size-6" aria-hidden />
              <h2 className="font-hand text-4xl font-bold leading-none">From your organizer</h2>
            </div>
            {messages.length === 0 ? (
              <p className="font-note mt-3 rounded-2xl bg-paper px-4 py-5 text-center text-moss">No messages yet. When your organizer writes to you, it shows up here.</p>
            ) : (
              <ul className="mt-4 max-h-96 space-y-3 overflow-y-auto pr-1" aria-live="polite">
                {messages.slice(0, 10).map((m, n) => (
                  <motion.li key={m.id} initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-paper p-3.5 shadow-[0_3px_0_#173f3014]">
                    {m.taskTitle && <p className="truncate text-xs font-bold text-moss">About: {m.taskTitle}</p>}
                    <p className="font-note mt-0.5 whitespace-pre-line text-[1.02rem] leading-snug">{m.text}</p>
                    <p suppressHydrationWarning className="mt-1.5 text-xs text-moss">
                      {n === 0 ? "Newest · " : ""}
                      {agoText(m.createdAt)}
                    </p>
                  </motion.li>
                ))}
              </ul>
            )}
          </PaperCard>
          {profile && <Placement p={profile} />}
          <PaperCard as="section" i={2} tilt={-2} className={card}>
            <div className="flex items-baseline justify-between">
              <h2 className="font-hand text-4xl font-bold leading-none">My tasks</h2>
              {tasks.length > 0 && (
                <span className="font-note text-sm text-moss">
                  {done} of {tasks.length} done
                </span>
              )}
            </div>
            {tasks.length === 0 && (
              <div className="mt-4 flex flex-col items-center rounded-2xl bg-paper px-4 py-7 text-center">
                <span className="grid size-12 place-items-center rounded-full bg-haldi ring-2 ring-neem/25">
                  <ClipboardList className="size-6" aria-hidden />
                </span>
                <p className="font-note mt-3 text-lg">No tasks yet.</p>
                <p className="mt-1 text-sm text-moss">When your organizer gives you a task, it will show up here.</p>
              </div>
            )}
            <ul className="mt-4 space-y-3">
              {tasks.map((t, n) => (
                <motion.li
                  key={t.id}
                  initial={reduce ? false : { opacity: 0, y: 14, rotate: -1.5 }}
                  animate={{ opacity: 1, y: 0, rotate: 0 }}
                  whileHover={reduce ? undefined : { y: -3 }}
                  transition={{ type: "spring", stiffness: 220, damping: 18, delay: 0.45 + n * 0.08 }}
                  className={cn("rounded-2xl bg-paper p-4 shadow-[0_3px_0_#173f3014] transition-opacity", t.status === "done" && "opacity-75")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold leading-snug">{t.title}</p>
                    <StatusChip status={t.status} />
                  </div>
                  <p className="mt-1 text-xs font-semibold text-moss">Due {fmtDue(t.dueDate)}</p>
                  {t.note && <p className="font-note mt-2 rounded-xl bg-paper-deep/70 px-3 py-2 text-sm leading-snug">“{t.note}”</p>}
                  <button
                    type="button"
                    onClick={() => pickTask(t, true)}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-bold ring-2 ring-neem transition-colors hover:bg-haldi"
                  >
                    <MessageSquarePlus className="size-4" aria-hidden /> Write an update
                  </button>
                </motion.li>
              ))}
            </ul>
          </PaperCard>

          <PaperCard as="section" i={3} tilt={2} className="relative rounded-[2rem] bg-haldi p-5 sm:p-6"><Tape className="-top-3 left-10" />
            <h2 className="font-hand text-4xl font-bold leading-none">Your streak</h2>
            <div className="mt-4 flex gap-2" aria-label="Updates this week">
              {["M", "T", "W", "T", "F"].map((d, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                  <motion.span
                    className="grid size-10 place-items-center rounded-full bg-neem/15 text-sm font-bold"
                    initial={reduce ? false : { scale: 0, rotate: -40 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 320, damping: 12, delay: 0.7 + i * 0.1 }}
                  >
                  </motion.span>
                  <span className="text-xs font-semibold">{d}</span>
                </div>
              ))}
            </div>
            <p className="font-note mt-4 text-base">Send your first update to start your streak.</p>
          </PaperCard>
        </div>
      </div>
    </Shell>
  );
}

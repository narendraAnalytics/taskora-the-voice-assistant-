"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";

type Status = "todo" | "progress" | "blocked" | "done" | "overdue";

type Task = {
  id: string;
  title: string;
  who: string;
  status: Status;
  note: string;
};

type Scene = {
  id: string;
  label: string;
  speaker: string;
  language: string;
  said: string;
  /** Romanised text for browser speech, since the transcript can mix scripts */
  reply: string;
  confirm?: {
    title: string;
    rows: [string, string][];
    action: string;
    cancel: string;
  };
  after: string;
  before: Task[];
  applied: Task[];
};

const SCENES: Scene[] = [
  {
    id: "behind",
    label: "Who's behind?",
    speaker: "Anjali, organizer",
    language: "English",
    said: "Who hasn't updated today?",
    reply:
      "Ravi and Sneha. Ravi's API task is two days overdue. Should I remind them?",
    confirm: {
      title: "Send reminders",
      rows: [
        ["To", "Ravi Kumar, Sneha Rao"],
        ["By", "Email, now"],
      ],
      action: "Send reminders",
      cancel: "Not now",
    },
    after: "Reminders sent to Ravi and Sneha.",
    before: [
      { id: "api", title: "API integration", who: "Ravi Kumar", status: "overdue", note: "2 days late" },
      { id: "copy", title: "Onboarding copy", who: "Sneha Rao", status: "progress", note: "No update today" },
      { id: "login", title: "Login page", who: "Priya N", status: "done", note: "Yesterday" },
    ],
    applied: [
      { id: "api", title: "API integration", who: "Ravi Kumar", status: "overdue", note: "Reminder sent" },
      { id: "copy", title: "Onboarding copy", who: "Sneha Rao", status: "progress", note: "Reminder sent" },
      { id: "login", title: "Login page", who: "Priya N", status: "done", note: "Yesterday" },
    ],
  },
  {
    id: "standup",
    label: "Intern standup",
    speaker: "Priya, intern",
    language: "Telugu + English",
    said: "Login page done, API 50 percent, design కోసం waiting.",
    reply:
      "Got it, Priya. Login page is done, the API is at fifty percent, and I've told Anjali you're waiting on design.",
    after: "Three tasks updated. Anjali can see the blocker.",
    before: [
      { id: "login", title: "Login page", who: "Priya N", status: "progress", note: "80%" },
      { id: "api", title: "Signup API", who: "Priya N", status: "progress", note: "20%" },
      { id: "design", title: "Dashboard screens", who: "Priya N", status: "todo", note: "Due Friday" },
    ],
    applied: [
      { id: "login", title: "Login page", who: "Priya N", status: "done", note: "Just now" },
      { id: "api", title: "Signup API", who: "Priya N", status: "progress", note: "50%" },
      { id: "design", title: "Dashboard screens", who: "Priya N", status: "blocked", note: "Waiting on design" },
    ],
  },
  {
    id: "assign",
    label: "Assign a task",
    speaker: "Anjali, organizer",
    language: "Telugu + English",
    said: "Ravi కి login page task assign చెయ్యి, deadline Thursday.",
    reply:
      "Two people are called Ravi. Assign the login page to Ravi Kumar, due Thursday?",
    confirm: {
      title: "Assign task",
      rows: [
        ["Task", "Login page"],
        ["To", "Ravi Kumar (not Ravi Teja)"],
        ["Due", "Thursday"],
      ],
      action: "Assign",
      cancel: "Cancel",
    },
    after: "Assigned. Ravi Kumar has an email with the details.",
    before: [
      { id: "api", title: "API integration", who: "Ravi Kumar", status: "progress", note: "60%" },
      { id: "tests", title: "Payment tests", who: "Ravi Teja", status: "todo", note: "Due Monday" },
    ],
    applied: [
      { id: "login", title: "Login page", who: "Ravi Kumar", status: "todo", note: "Due Thursday" },
      { id: "api", title: "API integration", who: "Ravi Kumar", status: "progress", note: "60%" },
      { id: "tests", title: "Payment tests", who: "Ravi Teja", status: "todo", note: "Due Monday" },
    ],
  },
];

const STATUS_STYLE: Record<Status, { label: string; className: string }> = {
  todo: { label: "To do", className: "bg-sage/20 text-sage" },
  progress: { label: "In progress", className: "bg-haldi/20 text-haldi" },
  blocked: { label: "Blocked", className: "bg-kumkum text-paper" },
  done: { label: "Done", className: "bg-tulsi text-neem" },
  overdue: { label: "Overdue", className: "bg-saffron/25 text-[#ffb08a]" },
};

type Phase = "idle" | "listening" | "thinking" | "replying" | "confirm" | "done";

const BARS = Array.from({ length: 32 }, (_, i) => {
  // Deterministic, speech-like envelope
  const h = 0.35 + 0.65 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.45));
  return { h, delay: (i % 7) * 0.09 + (i % 3) * 0.05 };
});

export function VoiceDemo() {
  const [sceneIndex, setSceneIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [saidCount, setSaidCount] = useState(0);
  const [replyCount, setReplyCount] = useState(0);
  const [applied, setApplied] = useState(false);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [sound, setSound] = useState(true);
  const runRef = useRef(0);

  const scene = SCENES[sceneIndex];
  const saidWords = scene.said.split(" ");
  const replyWords = scene.reply.split(" ");
  const running = phase === "listening" || phase === "thinking" || phase === "replying";

  useEffect(() => {
    return () => {
      runRef.current++;
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  function speak(text: string) {
    if (!sound || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-IN";
    const voice = synth.getVoices().find((v) => v.lang === "en-IN");
    if (voice) u.voice = voice;
    u.rate = 1.02;
    synth.speak(u);
  }

  function stop() {
    runRef.current++;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }

  function reset() {
    stop();
    setPhase("idle");
    setSaidCount(0);
    setReplyCount(0);
    setApplied(false);
    setOutcome(null);
  }

  async function play() {
    reset();
    const id = runRef.current;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const alive = () => runRef.current === id;
    const wait = (ms: number) =>
      new Promise<void>((r) => setTimeout(r, reduced ? Math.min(ms, 120) : ms));

    setPhase("listening");
    for (let i = 1; i <= saidWords.length; i++) {
      await wait(reduced ? 0 : 230);
      if (!alive()) return;
      setSaidCount(i);
    }
    await wait(500);
    if (!alive()) return;

    setPhase("thinking");
    await wait(850);
    if (!alive()) return;

    setPhase("replying");
    speak(scene.reply);
    for (let i = 1; i <= replyWords.length; i++) {
      await wait(reduced ? 0 : 95);
      if (!alive()) return;
      setReplyCount(i);
    }
    await wait(350);
    if (!alive()) return;

    if (scene.confirm) {
      setPhase("confirm");
    } else {
      setApplied(true);
      setOutcome(scene.after);
      setPhase("done");
    }
  }

  function confirm() {
    setApplied(true);
    setOutcome(scene.after);
    setPhase("done");
    speak(scene.after);
  }

  function cancel() {
    setOutcome("Okay, nothing changed.");
    setPhase("done");
    speak("Okay, nothing changed.");
  }

  function pickScene(i: number) {
    reset();
    setSceneIndex(i);
  }

  const board = applied ? scene.applied : scene.before;
  const beforeById = new Map(scene.before.map((t) => [t.id, t]));
  const changed = (t: Task) => {
    if (!applied) return false;
    const prev = beforeById.get(t.id);
    return !prev || prev.status !== t.status || prev.note !== t.note;
  };

  const micLabel =
    phase === "listening"
      ? "Listening"
      : phase === "thinking"
        ? "Understanding"
        : phase === "replying"
          ? "Taskora is replying"
          : phase === "idle"
            ? "Press the mic to play"
            : "Play again";

  return (
    <div className="relative w-full rounded-[28px] bg-neem-soft p-4 text-paper shadow-[0_30px_80px_-30px_#0b2219] ring-1 ring-paper/10 sm:p-6">
      {/* Scene picker */}
      <div className="flex items-start justify-between gap-3">
        <div role="tablist" aria-label="Sample conversations" className="flex flex-wrap gap-1.5">
          {SCENES.map((s, i) => (
            <button
              key={s.id}
              role="tab"
              aria-selected={i === sceneIndex}
              onClick={() => pickScene(i)}
              className={cn(
                "rounded-full px-3 py-1 text-sm font-medium transition-colors",
                i === sceneIndex
                  ? "bg-paper text-neem"
                  : "bg-neem/60 text-sage hover:bg-neem hover:text-paper",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => {
            if (sound) stop();
            setSound((v) => !v);
          }}
          aria-pressed={sound}
          aria-label={sound ? "Turn spoken replies off" : "Turn spoken replies on"}
          className="grid size-8 shrink-0 place-items-center rounded-full bg-neem/60 text-sage hover:text-paper"
        >
          {sound ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
        </button>
      </div>

      {/* Conversation */}
      <div aria-live="polite" className="mt-5 min-h-[11.5rem] space-y-4">
        <div>
          <p className="text-sm text-sage">
            {scene.speaker}
            <span className="ml-2 rounded-full bg-paper/10 px-2 py-0.5 text-xs text-paper/80">
              {scene.language}
            </span>
          </p>
          <p
            className={cn(
              "display mt-1.5 text-[1.45rem] leading-snug text-paper sm:text-[1.65rem]",
              phase === "listening" && "typing-caret",
              phase === "idle" && "text-paper/35",
            )}
          >
            {phase === "idle"
              ? `“${scene.said}”`
              : `“${saidWords.slice(0, saidCount).join(" ")}${saidCount === saidWords.length ? "”" : ""}`}
          </p>
        </div>

        {(phase === "thinking" || replyCount > 0) && (
          <div className="border-l-2 border-haldi pl-3.5">
            <p className="text-sm text-haldi">Taskora</p>
            <p className={cn("mt-1 text-[1.05rem] leading-relaxed", phase === "replying" && "typing-caret")}>
              {phase === "thinking" ? (
                <span className="text-sage">Matching names and tasks…</span>
              ) : (
                replyWords.slice(0, replyCount).join(" ")
              )}
            </p>
          </div>
        )}
      </div>

      {/* Confirm card */}
      {phase === "confirm" && scene.confirm && (
        <div className="mt-4 rounded-2xl bg-paper p-4 text-neem animate-in fade-in slide-in-from-bottom-2 duration-300">
          <p className="display text-lg">{scene.confirm.title}</p>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            {scene.confirm.rows.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-moss">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 flex gap-2">
            <button
              onClick={confirm}
              className="rounded-full bg-neem px-4 py-1.5 text-sm font-semibold text-paper hover:bg-neem-soft"
            >
              {scene.confirm.action}
            </button>
            <button
              onClick={cancel}
              className="rounded-full px-4 py-1.5 text-sm font-semibold text-neem ring-1 ring-neem/25 hover:bg-paper-deep"
            >
              {scene.confirm.cancel}
            </button>
          </div>
        </div>
      )}

      {outcome && (
        <p className="mt-4 rounded-2xl bg-tulsi/15 px-4 py-2.5 text-sm text-paper animate-in fade-in duration-300">
          {outcome}
        </p>
      )}

      {/* Mic + waveform */}
      <div className="mt-6 flex items-center gap-4">
        <div className="relative">
          {phase === "listening" && (
            <span aria-hidden className="mic-ring absolute inset-0 rounded-full bg-saffron" />
          )}
          <button
            onClick={running ? reset : play}
            aria-label={running ? "Stop sample conversation" : "Play sample conversation"}
            className="relative grid size-16 place-items-center rounded-full bg-saffron text-neem shadow-[0_10px_30px_-8px_#e8622a] transition-transform hover:scale-105 active:scale-95 sm:size-[4.5rem]"
          >
            {running ? <Square className="size-6 fill-current" /> : <Mic className="size-7" strokeWidth={2.4} />}
          </button>
        </div>
        <div className="min-w-0 flex-1">
          <div
            aria-hidden
            data-wave={phase === "listening" || phase === "replying" ? "on" : "off"}
            className="flex h-10 items-center gap-[3px]"
          >
            {BARS.map((b, i) => (
              <span
                key={i}
                className={cn(
                  "wave-bar block w-[3px] flex-1 rounded-full",
                  phase === "replying"
                    ? "bg-haldi"
                    : phase === "listening"
                      ? "bg-saffron"
                      : "bg-paper/25",
                )}
                style={{ height: `${b.h * 100}%`, animationDelay: `${b.delay}s` }}
              />
            ))}
          </div>
          <p className="mt-1 text-sm text-sage">{micLabel}</p>
        </div>
      </div>

      {/* Mini board */}
      <div className="mt-6 rounded-2xl bg-neem p-3 sm:p-4">
        <p className="px-1 text-sm text-sage">Team board</p>
        <ul className="mt-2 space-y-1.5">
          {board.map((t) => {
            const s = STATUS_STYLE[t.status];
            return (
              <li
                key={t.id}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2 transition-colors duration-500",
                  changed(t) ? "bg-haldi/15" : "bg-neem-soft/50",
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.95rem] font-medium leading-tight">{t.title}</p>
                  <p className="truncate text-xs text-sage">
                    {t.who}, {t.note}
                  </p>
                </div>
                <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold", s.className)}>
                  {s.label}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <p className="mt-3 px-1 text-xs text-sage/80">
        Sample conversation. In the app, speech runs on Sarvam Saaras v3 and replies on Bulbul v3.
      </p>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Mic, Minimize2, Send, Square, Volume2 } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Tape } from "@/components/dashboard/motion";
import { TalkingFace } from "@/components/dashboard/talking-face";
import type { SpeechMode } from "@/lib/use-speech";

export type CallMsg = { from: "you" | "taskora"; text: string };
export type CallConfirm = { task: string; fromName: string; toName: string };

const STATUS: Record<SpeechMode, string> = {
  idle: "Ready",
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
};


const BLOBS = [
  { cls: "left-[-10%] top-[-15%] size-[38rem] bg-saffron/30", x: [0, 90, -30, 0], y: [0, 50, 110, 0], d: 19 },
  { cls: "right-[-12%] top-[10%] size-[34rem] bg-tulsi/25", x: [0, -80, 20, 0], y: [0, 90, -40, 0], d: 23 },
  { cls: "bottom-[-20%] left-[25%] size-[40rem] bg-haldi/20", x: [0, 70, -60, 0], y: [0, -70, 30, 0], d: 27 },
  { cls: "bottom-[5%] right-[-8%] size-[22rem] bg-kumkum/20", x: [0, -50, 40, 0], y: [0, -60, 20, 0], d: 21 },
];
// Marigold petals drifting upward: [left %, size px, seconds, delay s]
const PETALS = [
  [6, 10, 16, 0], [14, 7, 21, 4], [23, 12, 18, 9], [33, 8, 24, 2], [42, 11, 19, 12], [51, 7, 22, 6],
  [60, 13, 17, 1], [69, 8, 25, 10], [77, 10, 20, 5], [85, 7, 23, 13], [92, 12, 18, 8], [97, 9, 26, 3],
] as const;

/** Living background: drifting colour washes, ripples from behind the face, rising petals. */
function Backdrop({ mode }: { mode: SpeechMode }) {
  const reduce = useReducedMotion();
  const lively = mode === "listening" || mode === "speaking";
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,#24543f_0%,#173f30_65%)]" />
      {BLOBS.map((b, i) => (
        <motion.div
          key={i}
          className={cn("absolute rounded-full blur-3xl", b.cls)}
          animate={reduce ? undefined : { x: b.x, y: b.y, scale: [1, 1.12, 0.95, 1] }}
          transition={{ duration: b.d, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
      {/* ripples that spread from behind the face; faster while someone is talking */}
      {!reduce &&
        [0, 1, 2, 3].map((i) => (
          <motion.span
            key={i}
            className={cn(
              "absolute left-1/2 top-[40%] size-[24rem] -translate-x-1/2 -translate-y-1/2 rounded-full ring-2",
              mode === "speaking" ? "ring-tulsi/40" : "ring-haldi/30",
            )}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: [0.8, 2.6], opacity: [0, lively ? 0.6 : 0.25, 0] }}
            transition={{ duration: lively ? 4 : 8, repeat: Infinity, delay: i * (lively ? 1 : 2), ease: "easeOut" }}
          />
        ))}
      {/* petals */}
      {!reduce &&
        PETALS.map(([left, size, dur, delay], i) => (
          <motion.span
            key={i}
            className={cn("absolute bottom-[-4%] rounded-[60%_40%_60%_40%] opacity-0", i % 3 === 0 ? "bg-haldi" : i % 3 === 1 ? "bg-saffron" : "bg-tulsi")}
            style={{ left: left + "%", width: size, height: size * 1.4 }}
            animate={{ y: ["0vh", "-110vh"], x: [0, i % 2 ? 40 : -40, 0], rotate: [0, i % 2 ? 220 : -220], opacity: [0, 0.55, 0.55, 0] }}
            transition={{ duration: dur, repeat: Infinity, delay, ease: "linear" }}
          />
        ))}
      {/* halftone dots, fading out toward the bottom */}
      <div
        className="absolute inset-0 opacity-[0.12] [background-image:radial-gradient(#fce7b2_1.2px,transparent_1.2px)] [background-size:22px_22px] [mask-image:linear-gradient(to_bottom,#173f30,transparent_70%)]"
      />
    </div>
  );
}

/** Bars that dance with the live audio level (mic while listening, voice while speaking). */
function LevelBars({ mode, levelRef }: { mode: SpeechMode; levelRef: RefObject<number> }) {
  const reduce = useReducedMotion();
  const bars = useRef<(HTMLSpanElement | null)[]>([]);
  const modeRef = useRef(mode);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    if (reduce) return;
    let raf = 0;
    const frame = (now: number) => {
      const live = modeRef.current === "listening" || modeRef.current === "speaking";
      const level = live ? levelRef.current ?? 0 : 0;
      bars.current.forEach((el, i) => {
        if (!el) return;
        const wave = 0.5 + 0.5 * Math.sin(now / 130 + i * 0.7);
        const h = 0.1 + (live ? level * (0.35 + 0.65 * wave) : 0.04 * wave);
        el.style.transform = `scaleY(${Math.min(h, 1).toFixed(3)})`;
      });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [reduce, levelRef]);

  return (
    <div aria-hidden className="flex h-10 items-center justify-center gap-1.5">
      {Array.from({ length: 28 }).map((_, i) => (
        <span
          key={i}
          ref={(el) => {
            bars.current[i] = el;
          }}
          className={cn(
            "h-full w-1.5 origin-center rounded-full transition-colors duration-300",
            mode === "speaking" ? "bg-tulsi" : "bg-haldi",
          )}
          style={{ transform: "scaleY(0.1)" }}
        />
      ))}
    </div>
  );
}

/**
 * Full-screen "call" with Taskora: a big face in the middle, live captions under it, the whole
 * conversation on the side (desktop), and one large mic button. Esc or the close button leaves.
 */
export function CallScreen(props: {
  mode: SpeechMode;
  levelRef: RefObject<number>;
  supported: boolean;
  listening: boolean;
  seconds: number;
  transcript: string;
  error: string | null;
  notice: string | null;
  log: CallMsg[];
  confirm: CallConfirm | null;
  suggestions: string[];
  muted: boolean;
  onToggleMute: () => void;
  onMic: () => void;
  onSend: (text: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  onClose: () => void;
}) {
  const { mode, levelRef, supported, listening, seconds, transcript, error, notice, log, confirm, suggestions, muted } = props;
  const reduce = useReducedMotion();
  const [draft, setDraft] = useState("");
  const closeBtn = useRef<HTMLButtonElement>(null);
  const history = useRef<HTMLDivElement>(null);
  const { onClose } = props;

  useEffect(() => {
    closeBtn.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  useEffect(() => {
    history.current?.scrollTo({ top: history.current.scrollHeight, behavior: "smooth" });
  }, [log, confirm]);

  const lastReply = [...log].reverse().find((m) => m.from === "taskora")?.text ?? "";
  const lastYou = [...log].reverse().find((m) => m.from === "you")?.text ?? "";
  const youCaption = listening ? transcript || "Go ahead, I'm listening…" : mode === "thinking" ? "…" : lastYou;

  // Portal to <body>: the dashboard cards are tilted/animated, and a transformed ancestor would
  // turn "fixed" into "relative to that card".
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Talk to Taskora"
      className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-neem text-paper"
    >
      <Backdrop mode={mode} />

      {/* top bar */}
      <header className="relative flex items-center justify-between gap-3 px-4 pt-4 sm:px-8 sm:pt-6">
        <div className="flex items-center gap-3">
          <h2 className="font-hand text-3xl font-bold leading-none text-haldi sm:text-4xl">Taskora</h2>
          <span
            role="status"
            className="flex items-center gap-2 rounded-full bg-neem-soft px-3 py-1 text-sm font-semibold"
          >
            <span
              aria-hidden
              className={cn(
                "size-2.5 rounded-full",
                mode === "idle" ? "bg-sage" : mode === "listening" ? "animate-pulse bg-saffron" : mode === "thinking" ? "animate-pulse bg-haldi" : "bg-tulsi",
              )}
            />
            {STATUS[mode]}
            {listening && <span className="tabular-nums text-sage">{seconds}s</span>}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={props.onToggleMute}
            aria-pressed={muted}
            aria-label={muted ? "Turn spoken replies on" : "Mute spoken replies"}
            className={cn(
              "grid size-11 place-items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-saffron",
              muted ? "bg-neem-soft text-sage" : "bg-haldi text-neem",
            )}
          >
            <Volume2 className="size-5" aria-hidden />
          </button>
          <button
            ref={closeBtn}
            type="button"
            onClick={onClose}
            aria-label="Leave full screen"
            className="grid size-11 place-items-center rounded-full bg-neem-soft transition-colors hover:bg-haldi hover:text-neem focus-visible:outline-2 focus-visible:outline-saffron"
          >
            <Minimize2 className="size-5" aria-hidden />
          </button>
        </div>
      </header>

      {/* stage + conversation */}
      <div className="relative grid min-h-0 flex-1 gap-4 px-4 pb-2 pt-2 sm:px-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-8">
        <section className="flex min-h-0 flex-col items-center justify-center gap-3 overflow-y-auto text-center">
          <button
            type="button"
            onClick={props.onMic}
            disabled={!supported}
            aria-label={listening ? "Stop listening" : "Talk to Taskora"}
            className="aspect-square w-[min(44svh,22rem)] shrink-0 rounded-full transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:cursor-default"
          >
            <TalkingFace mode={mode} levelRef={levelRef} className="size-full" />
          </button>
          <LevelBars mode={mode} levelRef={levelRef} />

          <div aria-live="polite" className="w-full max-w-2xl space-y-2">
            {youCaption && (
              <p className="font-note text-lg text-haldi sm:text-xl">
                <span className="sr-only">You: </span>
                {youCaption}
              </p>
            )}
            <p className="font-hand text-2xl font-bold leading-snug text-paper sm:text-3xl">
              <span className="sr-only">Taskora: </span>
              {lastReply}
            </p>
            {(error ?? notice) && (
              <p role="alert" className="font-note mx-auto w-fit rounded-full bg-kumkum px-4 py-1.5 text-sm text-paper">
                {error ?? notice}
              </p>
            )}
          </div>

          {confirm && (
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 20, rotate: -3 }}
              animate={{ opacity: 1, y: 0, rotate: 0 }}
              transition={{ type: "spring", stiffness: 220, damping: 15 }}
              className="relative w-full max-w-md rounded-2xl bg-paper p-4 text-left text-neem"
            >
              <Tape className="-top-3 left-6" />
              <p className="text-sm font-bold">Confirm change</p>
              <p className="mt-1 text-[0.98rem]">
                Move <b>{confirm.task}</b> from <b>{confirm.fromName}</b> to <b>{confirm.toName}</b>.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={props.onConfirm}
                  className="rounded-full bg-saffron px-4 py-2 text-sm font-bold text-neem hover:bg-[#ef7740]"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={props.onCancel}
                  className="rounded-full px-4 py-2 text-sm font-bold ring-2 ring-neem hover:bg-paper-deep"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          )}
        </section>

        {/* conversation history (desktop) */}
        <aside className="hidden min-h-0 flex-col rounded-[2rem] bg-neem-soft/60 p-5 lg:flex" aria-label="Conversation">
          <h3 className="font-note text-lg font-bold text-haldi">Conversation</h3>
          <div ref={history} className="mt-3 flex-1 space-y-3 overflow-y-auto pr-1">
            {log.map((m, i) => (
              <p
                key={i}
                className={cn(
                  "max-w-[90%] rounded-2xl px-4 py-2.5 text-[0.98rem] leading-snug",
                  m.from === "you" ? "ml-auto rounded-br-md bg-haldi text-neem" : "rounded-bl-md bg-neem text-paper",
                )}
              >
                {m.text}
              </p>
            ))}
          </div>
        </aside>
      </div>

      {/* controls */}
      <footer className="relative space-y-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 sm:px-8">
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] sm:flex-wrap sm:justify-center">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => props.onSend(s)}
              className="shrink-0 rounded-full bg-neem-soft px-3.5 py-1.5 text-sm font-semibold transition-[background-color,color,transform] hover:-translate-y-0.5 hover:bg-haldi hover:text-neem active:scale-95"
            >
              {s}
            </button>
          ))}
        </div>
        <form
          className="mx-auto flex max-w-2xl items-center gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!draft.trim()) return;
            props.onSend(draft.trim());
            setDraft("");
          }}
        >
          <div className="relative flex-1">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={supported ? "Or type a question" : "Type a question (voice needs a newer browser)"}
              aria-label="Type a question for Taskora"
              className="h-12 w-full rounded-full bg-neem-soft px-5 pr-12 text-paper placeholder:text-sage focus:outline-none focus-visible:ring-2 focus-visible:ring-haldi"
            />
            <button
              type="submit"
              aria-label="Send"
              className="absolute right-1.5 top-1.5 grid size-9 place-items-center rounded-full bg-haldi text-neem"
            >
              <Send className="size-4" aria-hidden />
            </button>
          </div>
          <button
            type="button"
            onClick={props.onMic}
            disabled={!supported}
            aria-label={listening ? "Stop listening" : "Start talking"}
            className={cn(
              "relative grid size-16 shrink-0 place-items-center rounded-full text-neem shadow-[0_5px_0_#11332a] transition-transform active:translate-y-1 active:shadow-none disabled:opacity-40",
              listening ? "bg-kumkum text-paper" : "bg-saffron hover:scale-105",
            )}
          >
            {listening && <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-kumkum/50" />}
            {listening ? <Square className="relative size-6 fill-current" aria-hidden /> : <Mic className="relative size-7" aria-hidden />}
          </button>
        </form>
      </footer>
    </div>,
    document.body,
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize2, Mic, Send, Square, Volume2 } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Tape } from "@/components/dashboard/motion";
import { TalkingFace } from "@/components/dashboard/talking-face";
import { CallScreen } from "@/components/dashboard/call-screen";
import { useSpeech } from "@/lib/use-speech";
import { respond, SUGGESTIONS, type Reply } from "@/lib/jarvis";
import type { Intern } from "@/lib/demo-data";

type Msg = { from: "you" | "taskora"; text: string };
type Pending = Extract<Reply, { kind: "clarify" }>;
type Confirm = Extract<Reply, { kind: "confirm" }>;

// After an answer Taskora keeps the conversation going; "no thanks" ends it politely.
const FOLLOW_UPS = [
  "Anything else you'd like to know?",
  "Would you like to know anything more?",
  "Want me to check on anyone else?",
];
const CLOSING =
  /^s*(no|nope|nah|nothing|nothing else|that'?s all|that is all|no,? thank(s| you)( so much)?|thank(s| you)( so much| very much)?|bye|goodbye|i'?m (good|done|fine)|all good|okay,? thank(s| you))W*$/i;

/** The Jarvis panel: hold a conversation about the batch by voice (or type). */
export function Jarvis({
  name,
  interns,
  onReassign,
}: {
  name: string;
  interns: Intern[];
  onReassign: (fromId: string, toId: string) => void;
}) {
  const welcome = `Welcome, ${name}! I'm Taskora, and I'll guide you through your batch. Ask me who's behind, how someone is doing, or to move a task, and I'll take care of the rest.`;
  const [log, setLog] = useState<Msg[]>([{ from: "taskora", text: welcome }]);
  const greeted = useRef(false);
  const followUp = useRef(0);
  const confirmRef = useRef<Confirm | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [draft, setDraft] = useState("");
  const [muted, setMuted] = useState(false);
  const [full, setFull] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const internsRef = useRef(interns);
  const mutedRef = useRef(muted);
  useEffect(() => {
    confirmRef.current = confirm;
    internsRef.current = interns;
    mutedRef.current = muted;
  }, [interns, muted, confirm]);

  const internNames = interns.flatMap((i) => [i.name, i.name.split(" ")[0]]);
  const speechRef = useRef<{ speak: (t: string) => void }>({ speak: () => {} });

  const say = useCallback((text: string) => {
    setLog((l) => [...l, { from: "taskora", text }]);
    if (!mutedRef.current) speechRef.current.speak(text);
  }, []);

  const handle = useCallback(
    (text: string) => {
      setLog((l) => [...l, { from: "you", text }]);
      const hadConfirm = confirmRef.current !== null;
      setConfirm(null);
      if (!pending && CLOSING.test(text)) {
        say(
          hadConfirm
            ? "Okay, nothing changed. I'm here whenever you need me, just tap me and ask."
            : "No problem! I'm here whenever you need me, just tap me and ask.",
        );
        return;
      }
      const r = respond(internsRef.current, text, pending ?? undefined);
      setPending(r.kind === "clarify" ? r : null);
      if (r.kind === "confirm") setConfirm(r);
      const next = FOLLOW_UPS[followUp.current++ % FOLLOW_UPS.length];
      say(r.kind === "answer" ? `${r.text} ${next}` : r.text);
    },
    [pending, say],
  );

  const { supported, listening, processing, speaking, mode, transcript, seconds, error, levelRef, start, stop, speak, stopPlayback } =
    useSpeech(handle, 15, internNames);
  const reduce = useReducedMotion();
  useEffect(() => {
    speechRef.current = { speak };
  }, [speak]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [log, transcript, confirm]);

  const from = confirm && interns.find((i) => i.id === confirm.fromId);
  const to = confirm && interns.find((i) => i.id === confirm.toId);
  // The first time full view opens, Taskora greets you out loud. The click is the user gesture that
  // lets the browser play audio; later opens stay quiet.
  const openFull = () => {
    setFull(true);
    if (!greeted.current) {
      greeted.current = true;
      if (!mutedRef.current) speak(welcome);
    }
  };
  const toggleMute = () => {
    setMuted((m) => !m);
    stopPlayback();
  };
  const toggleMic = () => void (listening ? stop() : start());
  const confirmYes = () => {
    if (!confirm || !from || !to) return;
    onReassign(confirm.fromId, confirm.toId);
    setConfirm(null);
    say(`Done. ${from.task} now belongs to ${to.name}.`);
  };
  const confirmNo = () => {
    setConfirm(null);
    say("Okay, nothing changed.");
  };

  return (
    <section
      aria-label="Taskora voice assistant"
      className="relative flex min-h-[26rem] flex-col overflow-hidden rounded-[2rem] bg-neem p-5 text-paper sm:p-7"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-saffron/30 blur-3xl"
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={listening ? stop : start}
            disabled={!supported}
            aria-label={listening ? "Stop listening" : "Talk to Taskora"}
            className="size-28 shrink-0 rounded-full transition-transform hover:scale-105 active:scale-95 disabled:cursor-default sm:size-36"
          >
            <TalkingFace mode={mode} levelRef={levelRef} className="size-full" />
          </button>
          <div>
            <h2 className="font-hand text-4xl font-bold leading-none text-haldi">Ask Taskora</h2>
            <p className="font-note mt-1.5 text-base text-sage">
              {error ?? (listening ? "Listening… go ahead." : processing ? "Thinking…" : speaking ? "Speaking…" : "Talk to it like Jarvis. It knows your whole batch.")}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={openFull}
          aria-label="Open full screen"
          className="grid size-10 place-items-center rounded-full bg-neem-soft text-paper transition-colors hover:bg-haldi hover:text-neem"
        >
          <Maximize2 className="size-5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={toggleMute}
          aria-pressed={muted}
          aria-label={muted ? "Turn spoken replies on" : "Mute spoken replies"}
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-full transition-colors",
            muted ? "bg-neem-soft text-sage" : "bg-haldi text-neem",
          )}
        >
          <Volume2 className="size-5" aria-hidden />
        </button>
        </div>
      </div>

      <div
        ref={scroller}
        aria-live="polite"
        className="relative mt-5 flex-1 space-y-3 overflow-y-auto pr-1 [max-height:15rem] sm:[max-height:17rem]"
      >
        {log.map((m, i) => (
          <motion.p
            key={i}
            initial={reduce ? false : { opacity: 0, y: 12, scale: 0.94, x: m.from === "you" ? 16 : -16 }}
            animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 22 }}
            style={{ transformOrigin: m.from === "you" ? "bottom right" : "bottom left" }}
            className={cn(
              "max-w-[88%] rounded-2xl px-4 py-2.5 text-[0.98rem] leading-snug",
              m.from === "you" ? "ml-auto rounded-br-md bg-haldi text-neem" : "rounded-bl-md bg-neem-soft text-paper",
            )}
          >
            {m.text}
          </motion.p>
        ))}
        {listening && (
          <p className="ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-haldi/70 px-4 py-2.5 text-neem">
            {transcript || "Listening…"}
          </p>
        )}
        {confirm && from && to && (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 20, rotate: -3 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 15 }}
            className="relative rounded-2xl bg-paper p-4 text-neem"
          >
            <Tape className="-top-3 left-6" />
            <p className="text-sm font-bold">Confirm change</p>
            <p className="mt-1 text-[0.98rem]">
              Move <b>{from.task}</b> from <b>{from.name}</b> to <b>{to.name}</b>.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  onReassign(confirm.fromId, confirm.toId);
                  setConfirm(null);
                  say(`Done. ${from.task} now belongs to ${to.name}.`);
                }}
                className="rounded-full bg-saffron px-4 py-2 text-sm font-bold text-neem hover:bg-[#ef7740]"
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirm(null);
                  say("Okay, nothing changed.");
                }}
                className="rounded-full px-4 py-2 text-sm font-bold ring-2 ring-neem hover:bg-paper-deep"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </div>

      <div className="relative mt-4 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => handle(s)}
            className="rounded-full bg-neem-soft px-3.5 py-1.5 text-sm font-semibold text-paper transition-[background-color,color,transform] hover:-translate-y-0.5 hover:-rotate-1 hover:bg-haldi hover:text-neem active:scale-95"
          >
            {s}
          </button>
        ))}
      </div>

      <form
        className="relative mt-4 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.trim()) return;
          handle(draft.trim());
          setDraft("");
        }}
      >
        <button
          type="button"
          onClick={listening ? stop : start}
          disabled={!supported}
          aria-label={listening ? "Stop listening" : "Start talking"}
          className={cn(
            "relative grid size-14 shrink-0 place-items-center rounded-full text-neem transition-transform active:scale-95 disabled:opacity-40",
            listening ? "bg-kumkum text-paper" : "bg-saffron hover:scale-105",
          )}
        >
          {listening && <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-kumkum/60" />}
          {listening ? <Square className="relative size-5 fill-current" aria-hidden /> : <Mic className="relative size-6" aria-hidden />}
        </button>
        <div className="relative flex-1">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={supported ? (listening ? `Listening… ${seconds}s` : "Tap the mic or type a question") : "Type a question (voice needs a newer browser)"}
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
      </form>
      {full && (
        <CallScreen
          mode={mode}
          levelRef={levelRef}
          supported={supported}
          listening={listening}
          seconds={seconds}
          transcript={transcript}
          error={error}
          log={log}
          confirm={confirm && from && to ? { task: from.task, fromName: from.name, toName: to.name } : null}
          suggestions={SUGGESTIONS}
          muted={muted}
          onToggleMute={toggleMute}
          onMic={toggleMic}
          onSend={handle}
          onConfirm={confirmYes}
          onCancel={confirmNo}
          onClose={() => setFull(false)}
        />
      )}
      {listening && (
        <div aria-hidden className="relative mt-3 flex h-6 items-end justify-center gap-1">
          {Array.from({ length: 24 }).map((_, i) => (
            <span
              key={i}
              className="w-1 origin-bottom rounded-full bg-haldi"
              style={{ height: "100%", animation: `wave ${0.7 + (i % 5) * 0.15}s ease-in-out ${i * -0.07}s infinite` }}
            />
          ))}
        </div>
      )}
    </section>
  );
}

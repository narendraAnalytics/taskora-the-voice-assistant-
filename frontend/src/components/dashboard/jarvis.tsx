"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Eraser, Maximize2, Mic, Send, Square, Volume2 } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Tape } from "@/components/dashboard/motion";
import { TalkingFace, type FaceMood } from "@/components/dashboard/talking-face";
import { CallScreen, STATUS, ThinkingDots, UndoPill } from "@/components/dashboard/call-screen";
import { useSpeech } from "@/lib/use-speech";
import { closingKind, goodbye, greeting, isNo, isRepeat, isWait, isYes, respond, SUGGESTIONS, type Ctx, type Reply } from "@/lib/jarvis";
import type { Intern } from "@/lib/demo-data";
import { looksLikeEmailRequest, looksLikeNewTask, useTaskFlow, type TaskCard } from "@/components/dashboard/use-task-flow";

type Msg = { from: "you" | "taskora"; text: string };
type Pending = Extract<Reply, { kind: "clarify" }>;
type Confirm = Extract<Reply, { kind: "confirm" }>;
/** What happens after Taskora finishes speaking: open the mic (hands-free) or not. */
type After = "question" | "listen" | "none";

// Generic follow-ups, used on every other answer that has no specific next step to offer.
const FOLLOW_UPS = ["Anything else you'd like to know?", "What else can I check for you?", "Anything else?"];
const NO_PROBLEM = "No problem. What else can I help with?";
const FRESH = "Fresh start! Ask me about your interns and their tasks, or tell me to give someone a task.";
const sleep = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

/**
 * The Jarvis panel: hold a conversation about the batch by voice (or type).
 *
 * In full view the talk is hands-free: when Taskora finishes a reply the mic opens by itself
 * (soft chime), and closes quietly if nobody speaks. Tapping the face while it talks interrupts.
 */
export function Jarvis({
  name,
  interns,
  onReassign,
  onTaskChange,
}: {
  name: string;
  interns: Intern[];
  onReassign: (fromId: string, toId: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  /** Called after Taskora saves a task, so the board reloads. */
  onTaskChange: () => void;
}) {
  const welcome = `Welcome, ${name}! I'm Taskora, and I'll guide you through your batch. Ask me how many interns you have, what their tasks are, or tell me to give someone a task, and I'll take care of the rest.`;
  const [log, setLog] = useState<Msg[]>([{ from: "taskora", text: welcome }]);
  const greeted = useRef(false);
  const followUp = useRef(0);
  const farewells = useRef(0);
  const [mood, setMood] = useState<FaceMood>("neutral");
  const [ended, setEnded] = useState(false);
  const [napping, setNapping] = useState(false); // hands-free mic opened, nobody spoke
  const [chips, setChips] = useState<string[]>(SUGGESTIONS);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [draft, setDraft] = useState("");
  const [muted, setMuted] = useState(false);
  const [full, setFull] = useState(false);
  const [handsFree, setHandsFree] = useState(true);
  const scroller = useRef<HTMLDivElement>(null);

  // Refs for everything the async conversation loop reads, so it never sees stale state.
  const internsRef = useRef(interns);
  const mutedRef = useRef(muted);
  const confirmRef = useRef<Confirm | null>(null);
  const pendingRef = useRef<Pending | null>(null);
  const convo = useRef<Ctx>({});
  const fullRef = useRef(false);
  const handsFreeRef = useRef(true);
  const holdRef = useRef(false); // "wait" / "hold on": don't reopen the mic until tapped
  const endedRef = useRef(false);
  const last = useRef<{ shown: string; spoken: string[] } | null>(null);
  useEffect(() => {
    internsRef.current = interns;
    mutedRef.current = muted;
    handsFreeRef.current = handsFree;
  }, [interns, muted, handsFree]);
  const setConfirmBoth = (c: Confirm | null) => {
    confirmRef.current = c;
    setConfirm(c);
  };

  const internNames = interns.flatMap((i) => [i.name, i.name.split(" ")[0]]);
  const speechRef = useRef<{
    speak: (parts: string[]) => Promise<boolean>;
    unlock: () => void;
    start: (opts?: { noSpeechMs?: number }) => Promise<void>;
    chime: () => void;
    busy: () => boolean;
  }>({ speak: async () => true, unlock: () => {}, start: async () => {}, chime: () => {}, busy: () => false });

  /** Reopen the mic after Taskora has spoken, when hands-free applies. */
  const listenAgain = useCallback(async (question: boolean) => {
    const allowed = () => fullRef.current && handsFreeRef.current && !holdRef.current && !endedRef.current && !speechRef.current.busy();
    if (!allowed()) return;
    await sleep(250); // let the last syllable clear the speakers before the mic opens
    if (!allowed()) return;
    speechRef.current.chime();
    void speechRef.current.start({ noSpeechMs: question ? 7000 : 5000 });
  }, []);

  /** Show a reply, speak it (parts are cached and played in order), then maybe listen again. */
  const reply = useCallback(
    async (shown: string, spoken: string[] = [shown], after: After = "none") => {
      setLog((l) => [...l, { from: "taskora", text: shown }]);
      last.current = { shown, spoken };
      let ok = true;
      if (mutedRef.current) await sleep(1200); // give a moment to read
      else ok = await speechRef.current.speak(spoken);
      if (ok && after !== "none") void listenAgain(after === "question");
    },
    [listenAgain],
  );

  const confirmYes = useCallback(async () => {
    const c = confirmRef.current;
    const from = c && internsRef.current.find((i) => i.id === c.fromId);
    const to = c && internsRef.current.find((i) => i.id === c.toId);
    if (!c || !from || !to) return;
    setConfirmBoth(null);
    const task = from.task;
    const r = await onReassign(c.fromId, c.toId).catch(() => ({ ok: false as const, error: "I couldn't move it just now." }));
    if (!r.ok) return void reply(`${r.error} Anything else?`, [r.error, "Anything else?"], "question");
    convo.current = { lastId: to.id };
    const done = `Done. ${task} now belongs to ${to.name}.`;
    void reply(`${done} Anything else?`, [done, "Anything else?"], "question");
  }, [onReassign, reply]);

  const confirmNo = useCallback(() => {
    setConfirmBoth(null);
    void reply("Okay, nothing changed. Anything else?", ["Okay, nothing changed.", "Anything else?"], "question");
  }, [reply]);

  // "Give Ravi the login page by Friday": the task conversation (who, what, by when, save, email).
  const [taskCard, setTaskCard] = useState<TaskCard | null>(null);
  const flow = useTaskFlow({ internsRef, say: reply, setCard: setTaskCard, setChips, onChange: onTaskChange });

  const handle = useCallback(
    (text: string) => {
      speechRef.current.unlock();
      holdRef.current = false;
      endedRef.current = false;
      setEnded(false);
      setNapping(false);
      setMood("neutral");
      setLog((l) => [...l, { from: "you", text }]);
      // "Email him" about a task that already exists (also right after "Want me to email Ravi?").
      const emailOrRoute = () => {
        if (looksLikeEmailRequest(text)) void flow.tryEmail(text, convo.current.lastId);
        else route(text);
      };
      if (!confirmRef.current && (flow.active() || looksLikeNewTask(text))) {
        void flow.tryHandle(text).then((handled) => {
          if (!handled) emailOrRoute();
        });
        return;
      }
      if (!confirmRef.current) return emailOrRoute();
      route(text);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [flow],
  );

  const route = useCallback(
    (text: string) => {
      // An open confirm card can be answered by voice.
      if (confirmRef.current && isYes(text)) return confirmYes();
      if (confirmRef.current && isNo(text)) return confirmNo();
      const hadConfirm = confirmRef.current !== null;
      setConfirmBoth(null);

      if (isWait(text)) {
        holdRef.current = true;
        return void reply("Sure, take your time. Tap me when you're ready.");
      }
      if (isRepeat(text) && last.current) return void reply(last.current.shown, last.current.spoken, "question");

      const offer = convo.current.offer;
      if (!pendingRef.current && offer?.run && isNo(text)) {
        convo.current = { lastId: convo.current.lastId };
        return void reply(NO_PROBLEM, [NO_PROBLEM], "question");
      }

      const closing = pendingRef.current ? null : closingKind(text);
      if (closing) {
        const bye = goodbye(closing, farewells.current++);
        endedRef.current = true;
        setEnded(true);
        setMood("happy");
        setChips(SUGGESTIONS);
        convo.current = {};
        return void reply(hadConfirm ? `Okay, nothing changed. ${bye}` : bye);
      }

      const r = respond(internsRef.current, text, pendingRef.current ?? undefined, convo.current);
      pendingRef.current = r.kind === "clarify" ? r : null;
      convo.current = {
        lastId: (r.kind === "answer" && r.about) || (r.kind === "confirm" && r.fromId) || convo.current.lastId,
        offer: r.kind === "answer" ? r.offer : undefined,
      };
      if (r.kind === "confirm") {
        setConfirmBoth(r);
        return void reply(r.text, [r.text], "question");
      }
      if (r.kind === "clarify") {
        setChips(r.options.map((o) => o.name));
        return void reply(r.text, [r.text], "question");
      }
      if (r.startTask) {
        // "Sure. What is the task for Ravi?": the next sentence belongs to the task conversation.
        flow.start(r.startTask.internId);
        setChips([]);
        return void reply(r.text, [r.text], "question");
      }
      setChips([...new Set(r.chips ?? SUGGESTIONS)]);
      const n = followUp.current++;
      const follow = r.offer?.ask ?? (n % 2 === 0 ? FOLLOW_UPS[(n / 2) % FOLLOW_UPS.length] : null);
      const shown = follow ? `${r.text}${r.text.includes("\n") ? "\n" : " "}${follow}` : r.text;
      void reply(shown, [...[r.speak ?? r.text].flat(), ...(follow ? [follow] : [])], follow ? "question" : "listen");
    },
    [confirmNo, confirmYes, flow, reply],
  );

  const { supported, listening, processing, speaking, mode, transcript, seconds, error, notice, levelRef, start, stop, cancel, speak, prefetch, chime, stopPlayback, unlockAudio, releaseMic } =
    useSpeech(handle, 15, internNames, { keepMicMs: full ? 15000 : 0, onNoSpeech: () => setNapping(true) });
  const reduce = useReducedMotion();
  const busyRef = useRef(false);
  useEffect(() => {
    busyRef.current = listening || processing;
  }, [listening, processing]);
  useEffect(() => {
    speechRef.current = { speak, unlock: unlockAudio, start, chime, busy: () => busyRef.current };
  }, [speak, unlockAudio, start, chime]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [log, transcript, confirm, processing]);

  // The happy face lingers a few seconds after a greeting or goodbye has been spoken.
  useEffect(() => {
    if (mood !== "happy" || speaking) return;
    const t = window.setTimeout(() => setMood("neutral"), 4000);
    return () => window.clearTimeout(t);
  }, [mood, speaking]);

  const from = confirm && interns.find((i) => i.id === confirm.fromId);
  const to = confirm && interns.find((i) => i.id === confirm.toId);
  // One card for both kinds of confirmation: a new task, or moving an existing one.
  const card: TaskCard | null =
    taskCard ??
    (confirm && from && to
      ? {
          heading: "Confirm change",
          parts: [{ text: "Move " }, { text: from.task, bold: true }, { text: " from " }, { text: from.name, bold: true }, { text: " to " }, { text: to.name, bold: true }, { text: "." }],
        }
      : null);
  const cardYes = () => void (taskCard ? flow.yes() : confirmYes());
  const cardNo = () => (taskCard ? flow.no() : confirmNo());
  // The first time full view opens, Taskora greets you out loud and then listens. The click is the
  // user gesture that lets the browser play audio; later opens stay quiet.
  const openFull = () => {
    unlockAudio();
    fullRef.current = true;
    setFull(true);
    if (greeted.current) return;
    greeted.current = true;
    // Time of day comes from the viewer's clock, so it is only worked out here (not during SSR).
    const hello = greeting(name, internsRef.current);
    setLog((l) => (l.length === 1 && l[0].text === welcome ? [{ from: "taskora", text: hello }] : [...l, { from: "taskora", text: hello }]));
    last.current = { shown: hello, spoken: [hello] };
    setMood("happy");
    if (!mutedRef.current)
      void speak([hello]).then((ok) => {
        if (ok) void listenAgain(true);
      });
    // Warm the cache with phrases that come up in most conversations.
    window.setTimeout(() => prefetch([...FOLLOW_UPS, NO_PROBLEM, "Anything else?", goodbye("thanks", farewells.current)]), 2500);
  };
  const closeFull = () => {
    fullRef.current = false;
    setFull(false);
    if (listening) cancel();
    releaseMic();
  };
  const toggleMute = () => {
    setMuted((m) => !m);
    stopPlayback();
  };
  /** Tap: interrupt Taskora and listen, or stop listening. */
  const toggleMic = () => {
    holdRef.current = false;
    endedRef.current = false;
    setEnded(false);
    setNapping(false);
    void (listening ? stop() : start());
  };
  /** Clear the chat and what Taskora remembers about it; Undo brings the messages back for a few seconds. */
  const cleared = useRef<{ log: Msg[]; chips: string[] } | null>(null);
  const [undoable, setUndoable] = useState(false);
  useEffect(() => {
    if (!undoable) return;
    const t = window.setTimeout(() => setUndoable(false), 6000);
    return () => window.clearTimeout(t);
  }, [undoable]);
  const clearChat = () => {
    stopPlayback();
    if (listening) cancel();
    cleared.current = { log, chips };
    setLog([{ from: "taskora", text: FRESH }]);
    setChips(SUGGESTIONS);
    setConfirmBoth(null);
    flow.cancel();
    pendingRef.current = null;
    convo.current = {};
    last.current = null;
    holdRef.current = false;
    endedRef.current = false;
    setEnded(false);
    setNapping(false);
    setMood("neutral");
    setUndoable(true);
  };
  const undoClear = () => {
    if (cleared.current) {
      setLog(cleared.current.log);
      setChips(cleared.current.chips);
    }
    cleared.current = null;
    setUndoable(false);
  };
  const canClear = log.length > 1 || confirm !== null || taskCard !== null;
  const toggleHandsFree = () => {
    setHandsFree((h) => !h);
    if (listening && handsFree) cancel();
  };
  const hint = error ?? notice ?? (ended || napping ? "Tap my face whenever you need me." : "Talk to it like Jarvis. It knows your whole batch.");

  return (
    <section
      aria-label="Taskora voice assistant"
      className="relative flex min-h-[26rem] flex-col overflow-hidden rounded-[2rem] bg-neem p-5 text-paper sm:p-7"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className={cn("absolute -right-24 -top-24 size-80 rounded-full bg-saffron/30 blur-3xl", !full && "motion-safe:animate-[aurora_18s_ease-in-out_infinite]")} />
        <div className={cn("absolute -bottom-32 -left-20 size-72 rounded-full bg-tulsi/20 blur-3xl", !full && "motion-safe:animate-[aurora_24s_ease-in-out_infinite_reverse]")} />
        <div className="absolute inset-0 opacity-[0.08] [background-image:radial-gradient(#fce7b2_1px,transparent_1px)] [background-size:18px_18px] [mask-image:linear-gradient(to_bottom,#173f30,transparent_60%)]" />
      </div>
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex items-center gap-4 sm:gap-6">
          <button
            type="button"
            onClick={toggleMic}
            disabled={!supported}
            aria-label={listening ? "Stop listening" : "Talk to Taskora"}
            className="size-28 shrink-0 rounded-full p-2 transition-transform hover:scale-105 active:scale-95 disabled:cursor-default sm:size-36"
          >
            {/* paused while the full view is open: only one face animates at a time */}
            <TalkingFace mode={mode} mood={mood} levelRef={levelRef} paused={full} className="size-full" />
          </button>
          <div>
            <h2 className="font-hand text-4xl font-bold leading-none text-haldi">Ask Taskora</h2>
            <span role="status" className="mt-2 inline-flex items-center gap-2 rounded-full bg-neem-soft px-3 py-1 text-sm font-semibold">
              <span
                aria-hidden
                className={cn(
                  "size-2.5 rounded-full",
                  mode === "idle" ? "bg-tulsi" : mode === "listening" ? "animate-pulse bg-saffron" : mode === "thinking" ? "animate-pulse bg-haldi" : "bg-tulsi",
                )}
              />
              {STATUS[mode]}
              {listening && <span className="tabular-nums text-sage">{seconds}s</span>}
            </span>
            <p className="font-note mt-1.5 text-base text-sage">{hint}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {canClear && (
            <button
              type="button"
              onClick={clearChat}
              aria-label="Clear chat"
              className="grid size-10 place-items-center rounded-full bg-neem-soft text-paper transition-colors hover:bg-haldi hover:text-neem"
            >
              <Eraser className="size-5" aria-hidden />
            </button>
          )}
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
              "max-w-[88%] whitespace-pre-line rounded-2xl px-4 py-2.5 text-[0.98rem] leading-snug",
              m.from === "you" ? "ml-auto rounded-br-md bg-haldi text-neem" : "rounded-bl-md bg-neem-soft text-paper",
            )}
          >
            {m.text}
          </motion.p>
        ))}
        {undoable && <UndoPill onUndo={undoClear} />}
        {listening && (
          <p className="ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-haldi/70 px-4 py-2.5 text-neem">
            {transcript || "Listening…"}
          </p>
        )}
        {processing && (
          <p className="w-fit rounded-2xl rounded-bl-md bg-neem-soft px-4 py-3.5">
            <ThinkingDots />
          </p>
        )}
        {card && (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 20, rotate: -3 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 15 }}
            className="relative rounded-2xl bg-paper p-4 text-neem"
          >
            <Tape className="-top-3 left-6" />
            <p className="text-sm font-bold">{card.heading}</p>
            <p className="mt-1 text-[0.98rem]">
              {card.parts.map((p, k) => (p.bold ? <b key={k}>{p.text}</b> : <span key={k}>{p.text}</span>))}
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={cardYes}
                className="rounded-full bg-saffron px-4 py-2 text-sm font-bold text-neem hover:bg-[#ef7740]"
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={cardNo}
                className="rounded-full px-4 py-2 text-sm font-bold ring-2 ring-neem hover:bg-paper-deep"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </div>

      <div className="relative mt-4 flex flex-wrap gap-2">
        {chips.map((s) => (
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
          onClick={toggleMic}
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
          mood={mood}
          ended={ended || napping}
          levelRef={levelRef}
          supported={supported}
          listening={listening}
          seconds={seconds}
          transcript={transcript}
          error={error}
          notice={notice}
          log={log}
          confirm={card}
          suggestions={chips}
          muted={muted}
          handsFree={handsFree}
          onToggleHandsFree={toggleHandsFree}
          canClear={canClear}
          undoable={undoable}
          onClear={clearChat}
          onUndo={undoClear}
          onToggleMute={toggleMute}
          onMic={toggleMic}
          onSend={handle}
          onConfirm={cardYes}
          onCancel={cardNo}
          onClose={closeFull}
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

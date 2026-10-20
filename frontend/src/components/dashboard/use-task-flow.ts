"use client";

import { useCallback, useRef, type RefObject } from "react";
import { useAuth } from "@clerk/nextjs";
import { assignTask, emailTask, sendMessage } from "@/app/dashboard/task-actions";
import type { Intern } from "@/lib/demo-data";
import { findNames, isNo, isYes, matchInterns, words } from "@/lib/jarvis";
import { fmtDue, PAST_DATE_ERROR, spokenDate, todayIST } from "@/lib/task-types";
import { findDate, parseTaskLocally } from "@/lib/local-intent";
import { extractTaskIntent, type TaskIntent } from "@/lib/voice/api";

/** How long to wait for the language service before reading the sentence locally. */
const INTENT_TIMEOUT_MS = 6000;

/** What the confirm card shows. `parts` are joined as-is; bold ones are the names and dates. */
export type TaskCard = { heading: string; parts: { text: string; bold?: boolean }[] };
type After = "question" | "listen" | "none";
type Stage = "collect" | "which" | "confirm" | "emailask" | "taskask";
type Draft = {
  stage: Stage;
  personText?: string;
  internId?: string;
  title?: string;
  due?: string;
  email?: boolean;
  candidates?: string[];
  taskId?: string;
};

const CANCEL = /^(cancel|never mind|nevermind|forget it|forget that|drop it|stop)$/;
/** Sounds like handing out new work (not a question, not moving an existing task). */
const GIVES_WORK = /\b(assign|assigned|allocate|allocated|allot|allotted|give|set|add|create|new task)\b/;
const NOT_NEW =
  /\b(reassign|move|hand over|shift)\b|['’]s (task|work)\b|^(how|what|who|which|when|why|is|are|does|do|any|anything|show|list|brief|did|have|has|was|were)\b|^(tell|give|can you tell|please tell) me\b|\btasks? (is |are |was |were )?(allocated|assigned)\b|\b(allocated|assigned) (tasks?|work)\b/;
export const looksLikeNewTask = (text: string) => {
  const t = text.toLowerCase();
  return GIVES_WORK.test(t) && !NOT_NEW.test(t);
};

/** "email him", "mail Ravi the task", "send the task to Anjali by email". */
const EMAIL_WORDS = /\be-?mail\b|\bmail\b|\bsend\b.*\b(task|it|him|her|them|details)\b/;
export const looksLikeEmailRequest = (text: string) => EMAIL_WORDS.test(text.toLowerCase().replace(/[’']/g, ""));

/** "tell Ravi to finish the login page", "send Anjali a message", "message him that the demo is at 5". */
const MESSAGE_WORDS = /\b(tell|message|msg|ping|notify|remind)\b|\b(send|drop|leave|write)\b.*\b(message|note|msg)\b|\blet\b.*\bknow\b|\bsend\b.*\bthat\b/;
const NOT_MESSAGE = /\btell me\b|^(how|what|who|which|when|why|is|are|does|do|show|read)\b|\bsend\b.*\btask\b/;
export const looksLikeMessageRequest = (text: string) => {
  const t = text.toLowerCase().replace(/[’']/g, "");
  return MESSAGE_WORDS.test(t) && !NOT_MESSAGE.test(t);
};

type Channel = "app" | "email" | "both";
type MsgDraft = { stage: "who" | "which" | "text" | "channel"; internId?: string; text?: string; candidates?: string[] };

/** The message part of the sentence: after "that / saying / :", else "to <do something>" after the name. */
function messageText(original: string, who?: Intern): string {
  const saying = original.match(/(?:\bsaying\b|\bthat\b|:)\s*(.+)$/i);
  if (saying) return saying[1].trim();
  let rest = "";
  if (who) {
    const lower = original.toLowerCase();
    const alias = [who.name.toLowerCase(), ...who.aliases].filter((a) => lower.includes(a)).sort((a, b) => b.length - a.length)[0];
    if (alias) rest = original.slice(lower.indexOf(alias) + alias.length);
  }
  if (!rest) rest = original.replace(/^.*?\b(him|her|them)\b/i, "");
  rest = rest.replace(/^[\s,:-]+/, "").trim();
  // "... and send a message" is the request itself, not the message.
  rest = rest.replace(/^((and|then|also|please)\s+)*(send|give|drop|leave|write)\s+((him|her|them)\s+)?((a|an|the)\s+)?(message|note|msg)\b[\s,:.-]*/i, "").trim();
  if (/^(a |an |the )?(message|note|msg)\b/i.test(rest) || /^(about|regarding)\b/i.test(rest)) return "";
  if (/^to\s+/i.test(rest)) return `Please ${rest.slice(3).trim()}`;
  return rest;
}

/** A message said as a command ("Tell him the deadline was 27th") loses the command part. */
function cleanBody(text: string, who?: Intern): string {
  const t = text.trim();
  if (/^(tell|ask|message|ping|notify|remind|send)\b/i.test(t)) return messageText(t, who) || t;
  return t;
}

/** "Please prepare the landing page." becomes the task title "Prepare the landing page". */
function taskTitleFrom(text: string): string | null {
  const m = text.match(/^Please\s+(.{4,120}?)[.!]?$/);
  return m ? m[1].charAt(0).toUpperCase() + m[1].slice(1) : null;
}

const channelFrom = (text: string): Channel | null => {
  const t = words(text);
  if (/\bboth\b/.test(t)) return "both";
  if (/\be ?mail\b|\bmail\b/.test(t)) return "email";
  if (/\b(message|messages|app|page|dashboard|workspace|chat|here|msg)\b/.test(t)) return "app";
  return null;
};

/** Full name, e.g. "Ravi Teja", for every intern. */
const shortName = (i: Intern, _all?: Intern[]) => i.name;

/**
 * The "give someone a task" conversation. Slots are filled across turns (who, what, by when), then one
 * spoken yes saves it, and a second yes emails the intern. The language model only extracts the slots
 * (backend `/voice/intent`); names are matched against the real batch here, and the server action
 * re-checks ownership and the deadline before anything is written.
 */
export function useTaskFlow({
  internsRef,
  say,
  setCard,
  setChips,
  onChange,
  remember,
}: {
  internsRef: RefObject<Intern[]>;
  say: (shown: string, spoken?: string[], after?: After) => void | Promise<void>;
  setCard: (c: TaskCard | null) => void;
  setChips: (c: string[]) => void;
  onChange: () => void;
  /** Tell the avatar who we are talking about now, so "him" / "her" mean this intern. */
  remember?: (internId: string) => void;
}) {
  const { getToken } = useAuth();
  const draft = useRef<Draft | null>(null);

  const cancel = useCallback(() => {
    draft.current = null;
    setCard(null);
  }, [setCard]);

  const sendEmail = useCallback(
    async (taskId: string, who: string, prefix = "") => {
      const r = await emailTask(taskId).catch(() => ({ ok: false as const, error: "I couldn't send the email just now." }));
      const text = r.ok ? `${prefix}Email sent to ${who}. Anything else?` : `${prefix}${r.error} Anything else?`;
      draft.current = null;
      void say(text, [text], "question");
    },
    [say],
  );

  /** Ask for the next missing piece, or show the confirm card when everything is there. */
  const askNext = useCallback(
    (d: Draft, lead = "") => {
      const all = internsRef.current ?? [];
      const who = all.find((i) => i.id === d.internId);
      const ask = (q: string, chips: string[] = []) => {
        draft.current = d;
        setCard(null);
        setChips(chips);
        void say(`${lead}${q}`, [`${lead}${q}`], "question");
      };
      if (who) remember?.(who.id);
      if (!who) return ask("Who should I give it to?", all.slice(0, 4).map((i) => i.name));
      if (!d.title) return ask(`What is the task for ${shortName(who, all)}?`);
      if (!d.due) return ask("By when?", ["Today", "Tomorrow", "Friday"]);

      d.stage = "confirm";
      draft.current = d;
      setChips(["Yes", "No"]);
      setCard({
        heading: "Confirm task",
        parts: [
          { text: "Give " },
          { text: d.title, bold: true },
          { text: " to " },
          { text: who.name, bold: true },
          { text: ", due " },
          { text: fmtDue(d.due), bold: true },
          ...(d.email ? [{ text: ", and email them." }] : [{ text: "." }]),
        ],
      });
      const q = `Give "${d.title}" to ${shortName(who, all)}, due ${spokenDate(d.due)}${d.email ? ", and email them" : ""}. Shall I save it?`;
      void say(`${lead}${q}`, [`${lead}${q}`], "question");
    },
    [internsRef, say, setCard, setChips],
  );

  const yes = useCallback(async () => {
    const d = draft.current;
    if (!d || d.stage !== "confirm" || !d.internId || !d.title || !d.due) return;
    setCard(null);
    const all = internsRef.current ?? [];
    const who = all.find((i) => i.id === d.internId);
    const name = who ? shortName(who, all) : "them";
    const r = await assignTask({ inviteId: d.internId, title: d.title, due: d.due }).catch(() => ({ ok: false as const, error: "I couldn't save that just now." }));
    if (!r.ok) {
      if (r.error === PAST_DATE_ERROR) return askNext({ ...d, stage: "collect", due: undefined }, `${PAST_DATE_ERROR} `);
      draft.current = null;
      return void say(`${r.error} Anything else?`, [`${r.error} Anything else?`], "question");
    }
    onChange();
    const done = `Assigned "${d.title}" to ${name}, due ${spokenDate(d.due)}.`;
    if (d.email) {
      if (who?.joined) return void sendEmail(r.task.id, name, `${done} `);
      draft.current = null;
      const text = `${done} ${name} hasn't joined yet, so I can't email it. It will show on their page once they sign in. Anything else?`;
      return void say(text, [text], "question");
    }
    if (who?.joined) {
      draft.current = { stage: "emailask", taskId: r.task.id, internId: d.internId };
      setChips(["Yes", "No"]);
      const text = `${done} Want me to email ${name}?`;
      return void say(text, [text], "question");
    }
    draft.current = null;
    const text = `${done} ${name} hasn't joined yet, so it will show on their page once they sign in. Anything else?`;
    void say(text, [text], "question");
  }, [askNext, internsRef, onChange, say, sendEmail, setCard, setChips]);

  const no = useCallback(() => {
    cancel();
    void say("Okay, I haven't assigned anything. Anything else?", undefined, "question");
  }, [cancel, say]);

  /** Begin the conversation from outside (the "Allocate a task" chip or an offer). */
  const start = useCallback(
    (internId?: string) => {
      const d: Draft = { stage: "collect", internId };
      draft.current = d;
      setCard(null);
    },
    [setCard],
  );

  /**
   * "Email him": mail an intern the task they already have. Who: a name in the sentence, else the person we
   * were just talking about (`lastId`, so "he/him" works after "How is Ravi doing?").
   */
  const tryEmail = useCallback(
    async (text: string, lastId?: string): Promise<boolean> => {
      const all = internsRef.current ?? [];
      const t = text.toLowerCase().replace(/[’']/g, "");
      const named = findNames(all, t);
      const exact = named.filter((x) => t.includes(x.i.name.toLowerCase()));
      const pool = (exact.length ? exact : named).map((x) => x.i);
      const reply = (s: string, after: After = "question") => void say(s, [s], after);

      let who: Intern | undefined;
      if (pool.length > 1) {
        const q = `Which one should I email: ${pool.map((p) => p.name).join(" or ")}? Say it again with the full name.`;
        setChips(pool.map((p) => `Email ${p.name}`));
        reply(q);
        return true;
      }
      who = pool[0] ?? all.find((i) => i.id === lastId);
      if (!who) {
        reply("Who should I email? Say their name.");
        return true;
      }
      remember?.(who.id);
      const name = shortName(who, all);
      if (!who.taskId) {
        reply(`${name} has no task allocated yet, so there is nothing to email. Want to allocate one?`);
        return true;
      }
      if (!who.joined) {
        reply(`${name} hasn't joined yet, so I can't email the task. It will show on their page once they sign in. Anything else?`);
        return true;
      }
      void sendEmail(who.taskId, name);
      return true;
    },
    [internsRef, say, sendEmail, setChips],
  );

  /** Returns true when the sentence was part of a task conversation (and has been answered). */
  const tryHandle = useCallback(
    async (text: string): Promise<boolean> => {
      const d = draft.current;
      const t = words(text);
      const all = internsRef.current ?? [];

      if (d?.stage === "confirm") {
        if (isYes(text)) return void yes(), true;
        if (isNo(text) || CANCEL.test(t)) return void no(), true;
        void say("Say yes to save it, or no to cancel.", undefined, "question");
        return true;
      }
      if (d?.stage === "taskask") {
        if (isYes(text)) {
          askNext({ stage: "collect", internId: d.internId, title: d.title });
          return true;
        }
        draft.current = null;
        if (isNo(text) || CANCEL.test(t)) {
          void say("Okay, it stays a message only. Anything else?", undefined, "question");
          return true;
        }
        return false;
      }
      if (d?.stage === "emailask") {
        if (isYes(text) && d.taskId) {
          const who = all.find((i) => i.id === d.internId);
          void sendEmail(d.taskId, who ? shortName(who, all) : "them");
          return true;
        }
        draft.current = null;
        if (isNo(text)) {
          void say("Okay, I won't email it. Anything else?", undefined, "question");
          return true;
        }
        return false; // they moved on to something else
      }
      if (d && (isNo(text) || CANCEL.test(t))) {
        cancel();
        void say("Okay, I've dropped that task. Anything else?", undefined, "question");
        return true;
      }
      if (d?.stage === "which") {
        const cands = all.filter((i) => d.candidates?.includes(i.id));
        const hit = cands.filter((c) => t.includes(c.name.toLowerCase()) || c.name.toLowerCase().split(" ").slice(1).some((w) => t.split(" ").includes(w)));
        if (hit.length !== 1) {
          const q = `Sorry, which one: ${cands.map((c) => c.name).join(" or ")}?`;
          setChips(cands.map((c) => c.name));
          void say(q, [q], "question");
          return true;
        }
        askNext({ ...d, stage: "collect", internId: hit[0].id, candidates: undefined });
        return true;
      }

      if (!d && !looksLikeNewTask(text)) return false;
      // Just "allocate a task": no need to ask the language model, only open the conversation.
      if (!d && /^(please )?(allocate|assign|give|add|create|new)( a| the| new)? tasks?$/.test(t)) {
        askNext({ stage: "collect" }, "Sure. ");
        return true;
      }

      const now = new Date();
      const today = todayIST(now);
      const names = [...new Set(all.map((i) => i.name))];
      /** Offline reading of the sentence, used when the language service is slow or down. */
      const local = (): TaskIntent | null => {
        if (!d) return parseTaskLocally(text, names, today);
        // Mid-conversation the sentence answers the question we just asked (who, what, or by when).
        const who = d.internId ? null : (names.find((n) => text.toLowerCase().includes(n.toLowerCase())) ?? null);
        const date = findDate(text, today);
        const title = d.internId && !d.title && !date ? text.trim().replace(/[.!?]+$/, "") : null;
        return { action: "assign_task", person: who ?? d.personText ?? null, title: title ?? d.title ?? null, due: date?.due ?? d.due ?? null, send_email: d.email ?? null };
      };
      let out: TaskIntent | null;
      try {
        out = await Promise.race([
          extractTaskIntent(text, await getToken(), {
            today,
            weekday: now.toLocaleDateString("en-IN", { weekday: "long", timeZone: "Asia/Kolkata" }),
            interns: names,
            draft: d ? { person: d.personText ?? null, title: d.title ?? null, due: d.due ?? null, send_email: d.email ?? null } : null,
          }),
          // A slow language service should not leave the organizer waiting: fall back after a few seconds.
          new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error("timeout")), INTENT_TIMEOUT_MS)),
        ]);
      } catch {
        out = local();
        console.info("[taskora] intent: language service unavailable, read the sentence locally", out);
      }
      if (!out) {
        cancel();
        void say("I couldn't reach the language service just now. Please try again in a moment.", undefined, "question");
        return true;
      }

      if (out.action !== "assign_task") {
        if (d) cancel();
        // "Allocate a task" with nothing else: open the conversation instead of guessing.
        if (!d && /\btasks?\b/.test(t)) {
          askNext({ stage: "collect" }, "Sure. ");
          return true;
        }
        return false;
      }

      const next: Draft = { ...(d ?? { stage: "collect" as Stage }), stage: "collect" };
      if (out.person && out.person.toLowerCase() !== next.personText?.toLowerCase()) {
        next.personText = out.person;
        next.internId = undefined;
      }
      if (out.title) next.title = out.title;
      if (out.due) next.due = out.due;
      if (out.send_email) next.email = true;

      if (next.personText && !next.internId) {
        const found = matchInterns(all, next.personText);
        if (found.length === 1) next.internId = found[0].id;
        else if (found.length > 1) {
          next.stage = "which";
          next.candidates = found.map((f) => f.id);
          draft.current = next;
          setCard(null);
          setChips(found.map((f) => f.name));
          const q = `Which one: ${found.map((f) => f.name).join(" or ")}?`;
          void say(q, [q], "question");
          return true;
        } else {
          const miss = next.personText;
          next.personText = undefined;
          askNext(next, `I couldn't find ${miss} on your batch. `);
          return true;
        }
      }
      askNext(next);
      return true;
    },
    [askNext, cancel, getToken, internsRef, no, say, sendEmail, setCard, setChips, yes],
  );

  /**
   * "Tell Ravi …": a message to an intern. Fills who and what across turns, then always asks whether to send
   * it as a message on their page or as an email (or both) before anything is sent.
   */
  const msg = useRef<MsgDraft | null>(null);

  const askMessage = useCallback(
    (d: MsgDraft, lead = "") => {
      const all = internsRef.current ?? [];
      const who = all.find((i) => i.id === d.internId);
      const ask = (q: string, chips: string[] = []) => {
        msg.current = d;
        setChips(chips);
        void say(`${lead}${q}`, [`${lead}${q}`], "question");
      };
      if (!who) {
        d.stage = "who";
        return ask("Who should I message?", all.slice(0, 4).map((i) => i.name));
      }
      remember?.(who.id);
      if (!d.text) {
        d.stage = "text";
        // An intern who has a task gets a one-tap suggestion, so a short "tell him about the task" is easy.
        const idea = who.taskId ? [`Your task “${who.task}” is on your board. Please check it.`] : [];
        return ask(`What should I say to ${shortName(who, all)}?`, idea);
      }
      d.stage = "channel";
      const shown = `Send "${d.text}" to ${shortName(who, all)} as a message on their page, or as an email?`;
      const spoken = d.text.length > 90 ? `Your message to ${shortName(who, all)} is ready. Should I send it as a message on their page, or as an email?` : shown;
      msg.current = d;
      setChips(["Message", "Email", "Both", "Cancel"]);
      void say(`${lead}${shown}`, [`${lead}${spoken}`], "question");
    },
    [internsRef, say, setChips],
  );

  const deliver = useCallback(
    async (d: MsgDraft, channel: Channel) => {
      const all = internsRef.current ?? [];
      const who = all.find((i) => i.id === d.internId);
      if (!who || !d.text) return;
      const name = shortName(who, all);
      if (channel !== "app" && !who.joined) {
        return askMessage(d, `${name} hasn't joined yet, so I can't email. `);
      }
      msg.current = null;
      const r = await sendMessage({ inviteId: who.id, taskId: null, text: d.text, channel }).catch(() => ({ ok: false as const, error: "I couldn't send that just now." }));
      const text = r.ok
        ? `${channel === "email" ? `Email sent to ${name}.` : channel === "both" ? `Sent to ${name} as a message and an email.` : `Message sent to ${name}. They will see it on their page.`} Anything else?`
        : `${r.error} Anything else?`;
      const title = r.ok && channel !== "email" ? taskTitleFrom(d.text) : null;
      if (r.ok) onChange();
      if (title) {
        // An instruction ("tell Ravi to prepare X"): offer to put it on the board too, so it shows as his task.
        draft.current = { stage: "taskask", internId: who.id, title };
        setChips(["Yes", "No"]);
        const ask = `${text.replace(" Anything else?", "")} It is not on the board yet. Want me to add "${title}" as a task for ${name}?`;
        return void say(ask, [ask], "question");
      }
      void say(text, [text], "question");
    },
    [askMessage, internsRef, onChange, say],
  );

  const messageActive = useCallback(() => msg.current !== null, []);

  /** "Task allocated to Ravi Teja." said as a statement: begin giving that intern a task (asks what and by when). */
  const tryAllocateStatement = useCallback(
    (text: string): boolean => {
      const t = words(text);
      const m = t.match(/^((a|the|new) )*tasks? ((is|was|has been|have been) )?(given|allocated|assigned|allotted) to (.+)$/);
      if (!m) return false;
      const all = internsRef.current ?? [];
      const named = findNames(all, m[6]);
      const exact = named.filter((x) => m[6].includes(x.i.name.toLowerCase()));
      const pool = exact.length ? exact : named;
      if (pool.length !== 1) return false;
      askNext({ stage: "collect", internId: pool[0].i.id }, "Sure. ");
      return true;
    },
    [askNext, internsRef],
  );

  const tryMessage = useCallback(
    async (text: string, lastId?: string): Promise<boolean> => {
      const all = internsRef.current ?? [];
      const t = words(text);
      const d = msg.current;

      if (d) {
        if (isNo(text) || CANCEL.test(t)) {
          msg.current = null;
          setChips([]);
          void say("Okay, I haven't sent anything. Anything else?", undefined, "question");
          return true;
        }
        if (d.stage === "who" || d.stage === "which") {
          const found = d.stage === "which" ? all.filter((i) => d.candidates?.includes(i.id) && t.includes(i.name.toLowerCase())) : findNames(all, text).map((x) => x.i);
          const exact = found.filter((i) => t.includes(i.name.toLowerCase()));
          const pool = exact.length ? exact : found;
          if (pool.length === 1) askMessage({ ...d, internId: pool[0].id, candidates: undefined });
          else if (pool.length > 1) {
            msg.current = { ...d, stage: "which", candidates: pool.map((p) => p.id) };
            setChips(pool.map((p) => p.name));
            const q = `Which one: ${pool.map((p) => p.name).join(" or ")}?`;
            void say(q, [q], "question");
          } else askMessage(d, "I couldn't find that name. ");
          return true;
        }
        if (d.stage === "text") {
          // A stray "." or a single letter from the microphone is not a message.
          if (!/[\p{L}\p{N}]{2,}/u.test(text)) return void askMessage(d, "I didn't catch that. "), true;
          askMessage({ ...d, text: cleanBody(text, all.find((i) => i.id === d.internId)).slice(0, 500) });
          return true;
        }
        // channel
        const ch = channelFrom(text);
        if (!ch) {
          void say("Say message, email, or both.", undefined, "question");
          return true;
        }
        void deliver(d, ch);
        return true;
      }

      // A new request. Find who, then what to say.
      const named = findNames(all, text);
      const exact = named.filter((x) => text.toLowerCase().includes(x.i.name.toLowerCase()));
      const pool = (exact.length ? exact : named).map((x) => x.i);
      if (pool.length > 1) {
        msg.current = { stage: "which", candidates: pool.map((p) => p.id), text: messageText(text) || undefined };
        setChips(pool.map((p) => p.name));
        const q = `Which one: ${pool.map((p) => p.name).join(" or ")}?`;
        void say(q, [q], "question");
        return true;
      }
      const who = pool[0] ?? all.find((i) => i.id === lastId && /\b(him|her|them)\b/.test(t));
      askMessage({ stage: "who", internId: who?.id, text: messageText(text, who) || undefined });
      return true;
    },
    [askMessage, deliver, internsRef, say, setChips],
  );

  const cancelMessage = useCallback(() => {
    msg.current = null;
  }, []);

  return { tryHandle, tryEmail, tryMessage, tryAllocateStatement, messageActive, cancelMessage, start, yes, no, cancel, active: () => draft.current !== null };
}

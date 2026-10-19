"use client";

import { useCallback, useRef, type RefObject } from "react";
import { useAuth } from "@clerk/nextjs";
import { assignTask, emailTask } from "@/app/dashboard/task-actions";
import type { Intern } from "@/lib/demo-data";
import { findNames, isNo, isYes, matchInterns, words } from "@/lib/jarvis";
import { fmtDue, PAST_DATE_ERROR, spokenDate, todayIST } from "@/lib/task-types";
import { extractTaskIntent } from "@/lib/voice/api";

/** What the confirm card shows. `parts` are joined as-is; bold ones are the names and dates. */
export type TaskCard = { heading: string; parts: { text: string; bold?: boolean }[] };
type After = "question" | "listen" | "none";
type Stage = "collect" | "which" | "confirm" | "emailask";
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
const GIVES_WORK = /\b(assign|allocate|allot|give|set|add|create|new task)\b/;
const NOT_NEW = /\b(reassign|move|hand over|shift)\b|['’]s (task|work)\b|^(how|what|who|which|when|why|is|are|does|do)\b/;
export const looksLikeNewTask = (text: string) => {
  const t = text.toLowerCase();
  return GIVES_WORK.test(t) && !NOT_NEW.test(t);
};

/** "email him", "mail Ravi the task", "send the task to Anjali by email". */
const EMAIL_WORDS = /\be-?mail\b|\bmail\b|\bsend\b.*\b(task|it|him|her|them|details)\b/;
export const looksLikeEmailRequest = (text: string) => EMAIL_WORDS.test(text.toLowerCase().replace(/[’']/g, ""));

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
}: {
  internsRef: RefObject<Intern[]>;
  say: (shown: string, spoken?: string[], after?: After) => void | Promise<void>;
  setCard: (c: TaskCard | null) => void;
  setChips: (c: string[]) => void;
  onChange: () => void;
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
      let out;
      try {
        out = await extractTaskIntent(text, await getToken(), {
          today: todayIST(now),
          weekday: now.toLocaleDateString("en-IN", { weekday: "long", timeZone: "Asia/Kolkata" }),
          interns: [...new Set(all.map((i) => i.name))],
          draft: d ? { person: d.personText ?? null, title: d.title ?? null, due: d.due ?? null, send_email: d.email ?? null } : null,
        });
      } catch {
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

  return { tryHandle, tryEmail, start, yes, no, cancel, active: () => draft.current !== null };
}

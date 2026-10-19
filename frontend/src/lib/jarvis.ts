import { STATUS_LABEL, type Intern } from "./demo-data";

/*
 * Rule-based stand-in for the Sarvam intent step. Same contract the real one will have:
 * read-only questions answer straight away, reassignments return a confirm card, and an
 * ambiguous name returns a clarifying question — never a guess.
 *
 * It also keeps a little conversation state (`Ctx`) so talk can flow back and forth:
 * - `lastId`: who we were just talking about, so "how is she doing?" / "move her task to Kiran" work;
 * - `offer`: the next step Taskora just suggested; "yes" / "sure" / "go ahead" runs it.
 * Answers carry a short spoken version (`speak`; the screen shows the full `text`), the offer to
 * ask out loud, and `chips` with likely next questions.
 */

/** A suggested next step. `run` is replayed through `respond` on "yes"; no `run` = "who?" */
export type Offer = { ask: string; run?: string };
export type Ctx = { lastId?: string; offer?: Offer };

type Clarify = { kind: "clarify"; text: string; options: Intern[]; then: { type: "reassign"; fromId: string } | { type: "reassign-target"; fromId: string } | { type: "lookup" } };
type Answer = { kind: "answer"; text: string; speak?: string | string[]; offer?: Offer; chips?: string[]; about?: string };
type Confirm = { kind: "confirm"; text: string; fromId: string; toId: string };
export type Reply = Answer | Clarify | Confirm;

export const SUGGESTIONS = ["Brief me on everyone", "Who's behind?", "How many interns do I have?", "What's due today?", "Reassign Anjali's task to Kiran"];

const first = (s: string) => s.split(" ")[0];
const words = (text: string) =>
  text.toLowerCase().replace(/[’']/g, "").replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();

/** Interns whose name or aliases contain the spoken name as a whole word. */
export function matchInterns(interns: Intern[], spoken: string): Intern[] {
  const q = spoken.trim().toLowerCase();
  if (!q) return [];
  const exact = interns.filter((i) => i.aliases.includes(q) && i.name.toLowerCase() === q);
  if (exact.length) return exact;
  return interns.filter((i) => i.name.toLowerCase().split(" ").includes(q) || i.name.toLowerCase() === q || i.aliases.includes(q));
}

function findNames(interns: Intern[], text: string) {
  const t = text.toLowerCase();
  return interns
    .map((i) => ({ i, at: Math.min(...[i.name.toLowerCase(), ...i.aliases].map((a) => (t.includes(a) ? t.indexOf(a) : 1e9))) }))
    .filter((x) => x.at < 1e9)
    .sort((a, b) => a.at - b.at);
}

/** First name, unless another intern shares it ("Ravi Teja" vs "Ravi K"). */
const short = (i: Intern, all: Intern[]) => (all.filter((x) => first(x.name) === first(i.name)).length > 1 ? i.name : first(i.name));
const howIs = (i: Intern, all: Intern[]) => `How is ${short(i, all)} doing?`;

const isBehind = (i: Intern) => i.status === "overdue" || i.status === "blocked";
/** Someone with room for more work: finished first, then the least busy. */
const freeIntern = (interns: Intern[], not: string) =>
  interns.filter((i) => i.id !== not && i.status === "done")[0] ??
  interns.filter((i) => i.id !== not && i.status === "progress" && i.progress >= 75)[0];

/** Replace he/she/they with the person we were just talking about. */
function resolvePronouns(t: string, interns: Intern[], ctx: Ctx) {
  const who = ctx.lastId && interns.find((i) => i.id === ctx.lastId);
  if (!who) return t;
  const name = who.name.toLowerCase();
  return t
    .replace(/\b(his|her|their)\b(?= (task|work|job|update|status))/g, `${name}'s`)
    .replace(/\b(he|she|they|him|her|them)\b/g, name);
}

const YES_WORDS = new Set("yes yeah yep yup sure ok okay go ahead please do it that sounds good great absolutely of course why not right confirm".split(" "));
const YES_KEY = /\b(yes|yeah|yep|yup|sure|ok|okay|go ahead|please|do it|absolutely|of course|confirm|sounds good)\b/;
/** "yes", "sure, go ahead", "yes please do it" */
export function isYes(text: string) {
  const t = words(text);
  return !!t && YES_KEY.test(t) && t.split(" ").every((w) => YES_WORDS.has(w));
}
/** A plain "no" to an offer ("no", "not now", "no need") — no thanks/bye in it. */
export function isNo(text: string) {
  return /^(no|nope|nah|not now|no need|not really|no no|cancel|dont)$/.test(words(text));
}

export function respond(
  interns: Intern[],
  text: string,
  pending?: { options: Intern[]; then: Clarify["then"] },
  ctx: Ctx = {},
): Reply {
  // "Yes" to whatever Taskora just offered.
  if (ctx.offer && isYes(text)) {
    if (!ctx.offer.run) return { kind: "answer", text: "Sure. Who should I check on?", chips: interns.slice(0, 3).map((i) => howIs(i, interns)) };
    return respond(interns, ctx.offer.run, undefined, { lastId: ctx.lastId });
  }

  const t = resolvePronouns(text.toLowerCase().replace(/[?.!]/g, ""), interns, ctx);

  // Answer to an earlier "which one?" question.
  if (pending) {
    const pick = pending.options.find((o) => t.includes(o.name.toLowerCase()) || o.aliases.some((a) => a !== first(o.name).toLowerCase() && t.includes(a)));
    if (!pick) return { kind: "clarify", text: `Sorry, which one: ${pending.options.map((o) => o.name).join(" or ")}?`, options: pending.options, then: pending.then };
    if (pending.then.type === "lookup") return describe(interns, pick);
    return { kind: "answer", text: `Okay, ${pick.name}. Say the reassignment again with their full name.`, about: pick.id };
  }

  if (/(reassign|give|move|hand over|assign|shift)/.test(t) && /\bto\b/.test(t)) {
    const [fromPart, toPart] = [t.split(/\bto\b/)[0], t.split(/\bto\b/).slice(1).join(" to ")];
    const from = findNames(interns, fromPart);
    const to = findNames(interns, toPart);
    const pickOne = (list: ReturnType<typeof findNames>, spoken: string): { one?: Intern; many?: Intern[] } => {
      const exact = list.filter((x) => spoken.includes(x.i.name.toLowerCase()));
      if (exact.length === 1) return { one: exact[0].i };
      const many = (exact.length ? exact : list).map((x) => x.i);
      return many.length === 1 ? { one: many[0] } : { many };
    };
    const f = pickOne(from, fromPart);
    const g = pickOne(to, toPart);
    if (f.many) return { kind: "clarify", text: `Which one: ${f.many.map((m) => m.name).join(" or ")}?`, options: f.many, then: { type: "reassign", fromId: "" } };
    if (g.many) return { kind: "clarify", text: `Which one: ${g.many.map((m) => m.name).join(" or ")}?`, options: g.many, then: { type: "reassign-target", fromId: f.one?.id ?? "" } };
    if (f.one && g.one) {
      if (f.one.id === g.one.id) return { kind: "answer", text: `${f.one.name} already has that task.`, about: f.one.id };
      return {
        kind: "confirm",
        text: `Move "${f.one.task}" from ${f.one.name} to ${g.one.name}?`,
        fromId: f.one.id,
        toId: g.one.id,
      };
    }
    return { kind: "answer", text: "I didn't catch who to move it from and to. Try: reassign Priya's task to Kiran." };
  }

  if (/(behind|late|overdue|stuck|blocked|slipping|pending|delayed)/.test(t) || /who.*(not done|not finished|havent finished|haven't finished)/.test(t)) return behind(interns);

  const named = findNames(interns, t);
  // Team-wide questions (only when no one is named, so "is Priya done?" stays about Priya).
  if (!named.length) {
    const team = teamQuestion(interns, t);
    if (team) return team;
  }
  if (named.length) {
    const exact = named.filter((x) => t.includes(x.i.name.toLowerCase()));
    const set = exact.length ? exact : named;
    if (set.length > 1) {
      return { kind: "clarify", text: `Which one: ${set.map((x) => x.i.name).join(" or ")}?`, options: set.map((x) => x.i), then: { type: "lookup" } };
    }
    return describe(interns, set[0].i);
  }

  if (/(status|summary|how are we|how is the team|progress|today|overview|everyone|update)/.test(t)) return teamStatus(interns);

  return {
    kind: "answer",
    text: "Sorry, I didn't catch that. You can ask who's behind, how someone is doing, or to move a task.",
    chips: SUGGESTIONS,
  };
}

const DAYS: Record<string, string> = { Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday" };
/** "due today", "due Friday", "was due 2 days ago" */
function dueText(i: Intern) {
  if (/ago$/i.test(i.due)) return `was due ${i.due}`;
  return `due ${DAYS[i.due] ?? i.due.toLowerCase()}`;
}
const listNames = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}` : (xs[0] ?? ""));

/** One spoken sentence per person, phrased by status. */
function personLine(i: Intern, all: Intern[]) {
  const n = short(i, all);
  switch (i.status) {
    case "done":
      return `${n} has finished ${i.task}.`;
    case "todo":
      return `${n} hasn't started ${i.task} yet.`;
    case "blocked":
      return `${n} is blocked on ${i.task} at ${i.progress} percent.`;
    case "overdue":
      return `${n} is overdue on ${i.task}, ${i.progress} percent done.`;
    default:
      return `${n} is working on ${i.task}, ${i.progress} percent done.`;
  }
}
/** Screen line per person: everything we know. */
const detailLine = (i: Intern) =>
  `${i.name}: ${i.task}, ${STATUS_LABEL[i.status].toLowerCase()}, ${i.progress}%, ${dueText(i)}. Last update ${i.updatedAt}: ${i.update}`;
/** Spoken sentences grouped two at a time, so the first clip is short and starts quickly. */
const pairs = (xs: string[]) => xs.reduce<string[]>((acc, s, k) => (k % 2 ? [...acc.slice(0, -1), `${acc.at(-1)} ${s}`] : [...acc, s]), []);

/** Questions about the whole team: size, names, a full briefing, status lists, deadlines, tasks. */
function teamQuestion(interns: Intern[], t: string): Reply | null {
  const n = interns.length;
  const names = interns.map((i) => i.name);
  const late = interns.filter(isBehind);
  const nextOffer = (): Offer | undefined => (late.length ? { ask: "Want me to go through who's behind?", run: "who's behind" } : undefined);

  // A full briefing on everyone, first to last.
  if (/(brief|rundown|run me through|walk me through|everyone|every one|all (the )?details|each (intern|person|one|member)|full (report|details|picture|update)|tell me (about|everything about) (the|my) (team|batch|interns)|details of (all|everyone|the team|my team)|who is doing what|whos doing what|what is everyone)/.test(t)) {
    const lines = interns.map((i) => personLine(i, interns));
    return {
      kind: "answer",
      text: [`Here's your batch of ${n}:`, ...interns.map(detailLine)].join("\n"),
      speak: [`Here's your batch of ${n}.`, ...pairs(lines)],
      offer: nextOffer(),
      chips: ["Who's behind?", "What's due today?", "Team status"],
    };
  }

  // How many people, and who they are.
  if (/(how many|team size|number of|headcount|count)/.test(t) || /(who (is|are) (in )?(my|the|our) (team|batch|interns|group)|names|list (my|the|all|our)|who are (my|the|our)|my (team|interns|members)$|team members|who all)/.test(t)) {
    return {
      kind: "answer",
      text: `You have ${n} interns: ${listNames(names)}.`,
      speak: `You have ${n} interns: ${listNames(interns.map((i) => short(i, interns)))}.`,
      offer: { ask: "Want a quick rundown of what each of them is doing?", run: "brief me on everyone" },
      chips: ["Brief me on everyone", "Who's done?", "Who's behind?"],
    };
  }

  // Status lists.
  const group = (
    [
      ["done", /(done|finished|completed|complete)/, "has finished", "have finished", "Nobody has finished yet."],
      ["todo", /(not started|ha(s|ve) ?n.?t (started|begun)|yet to start|to do|todo|not begun)/, "hasn't started", "haven't started", "Everyone has started."],
      ["progress", /(in progress|still working|working right now|currently working|who is working|whos working)$/, "is in progress", "are in progress", "Nobody is in progress right now."],
    ] as const
  ).find(([, re]) => re.test(t));
  if (group && /\b(who|whos|which|anyone|anybody|how many|list)\b/.test(t)) {
    const [status, , one, many, none] = group;
    const xs = interns.filter((i) => i.status === status);
    if (!xs.length) return { kind: "answer", text: none, chips: ["Brief me on everyone", "Team status"] };
    const count = `${xs.length} of ${n} ${xs.length === 1 ? one : many}.`;
    return {
      kind: "answer",
      text: `${count} ${xs.map((i) => `${i.name}: ${i.task}, ${i.progress}%, ${dueText(i)}`).join(". ")}.`,
      speak: [count, ...pairs(xs.map((i) => personLine(i, interns)))],
      offer: nextOffer(),
      chips: [...xs.slice(0, 2).map((i) => howIs(i, interns)), "Brief me on everyone"],
    };
  }

  // Deadlines.
  if (/(due|deadline|deadlines)/.test(t)) {
    const today = /today/.test(t);
    const xs = today ? interns.filter((i) => /^today$/i.test(i.due) || /ago$/i.test(i.due)) : interns.filter((i) => i.status !== "done");
    if (!xs.length) return { kind: "answer", text: today ? "Nothing is due today." : "Every task is done.", chips: ["Brief me on everyone"] };
    const said = xs.map((i) => `${short(i, interns)}'s ${i.task} ${/^was/.test(dueText(i)) ? "" : "is "}${dueText(i)}`);
    return {
      kind: "answer",
      text: `${today ? "Due today or already late" : "Open deadlines"}: ${xs.map((i) => `${i.name}: ${i.task}, ${dueText(i)}`).join(". ")}.`,
      speak: `${today ? "Due today or already late" : "Here are the open deadlines"}: ${listNames(said)}.`,
      offer: nextOffer(),
      chips: ["Who's behind?", "Brief me on everyone"],
    };
  }

  // Who is working on a task ("who has the login page?").
  const byTask = interns.find((i) => t.includes(i.task.toLowerCase())) ??
    (/(working on|who has|who owns|whos on|who is on|assigned|handling|doing the|in charge of)/.test(t)
      ? interns.find((i) => t.includes(i.task.toLowerCase().split(" ")[0]))
      : undefined);
  if (byTask) return describe(interns, byTask);

  // Overall progress.
  if (/(overall|average|total) progress|how far (along|are we)|percent(age)? (done|complete)/.test(t)) {
    const avg = Math.round(interns.reduce((s, i) => s + i.progress, 0) / n);
    const done = interns.filter((i) => i.status === "done").length;
    return {
      kind: "answer",
      text: `Overall the batch is ${avg}% through its tasks. ${done} of ${n} tasks ${done === 1 ? "is" : "are"} done.`,
      speak: `Overall, the batch is ${avg} percent through its tasks, and ${done} of ${n} ${done === 1 ? "is" : "are"} done.`,
      offer: nextOffer(),
      chips: ["Brief me on everyone", "Who's behind?"],
    };
  }
  return null;
}

function behind(interns: Intern[]): Reply {
  const late = interns.filter(isBehind);
  if (!late.length) {
    return { kind: "answer", text: "Nobody is behind. Everyone is on track.", chips: ["Team status", ...interns.slice(0, 2).map((i) => howIs(i, interns))] };
  }
  const count = late.length === 1 ? "One person is" : `${late.length} people are`;
  const list = late.map((i) => `${i.name} is ${STATUS_LABEL[i.status].toLowerCase()}`);
  const spokenList = list.length > 1 ? `${list.slice(0, -1).join(", ")} and ${list.at(-1)}` : list[0];
  // Suggest the most useful next step: move an overdue task to someone with room, else details.
  const overdue = late.find((i) => i.status === "overdue");
  const free = overdue && freeIntern(interns, overdue.id);
  const focus = overdue ?? late[0];
  const offer: Offer = free
    ? { ask: `Should I move ${short(overdue, interns)}'s task to ${short(free, interns)}?`, run: `reassign ${overdue.name}'s task to ${free.name}` }
    : { ask: `Want the details on ${short(focus, interns)}?`, run: `how is ${focus.name} doing` };
  return {
    kind: "answer",
    text: `${count} behind. ${late.map((i) => `${i.name} is ${STATUS_LABEL[i.status].toLowerCase()} on ${i.task}`).join(". ")}.`,
    speak: `${count} behind. ${spokenList}.`,
    offer,
    about: late.length === 1 ? late[0].id : undefined,
    chips: [...late.slice(0, 2).map((i) => howIs(i, interns)), "Team status"],
  };
}

function describe(interns: Intern[], i: Intern): Reply {
  const free = isBehind(i) ? freeIntern(interns, i.id) : undefined;
  const others = interns.filter((x) => x.id !== i.id && isBehind(x));
  const offer: Offer | undefined = free
    ? { ask: `Want me to move ${i.status === "blocked" ? "it" : "their task"} to ${short(free, interns)}?`, run: `reassign ${i.name}'s task to ${free.name}` }
    : others.length
      ? { ask: `Should I check on ${short(others[0], interns)} too?`, run: `how is ${others[0].name} doing` }
      : { ask: "Should I check on anyone else?" };
  return {
    kind: "answer",
    text: `${i.name} is ${STATUS_LABEL[i.status].toLowerCase()} on ${i.task}, ${i.progress} percent, ${dueText(i)}. Last update ${i.updatedAt}: ${i.update}`,
    speak: `${personLine(i, interns).slice(0, -1)}${i.status === "done" ? "" : `, ${dueText(i)}`}. Latest update: ${i.update}`,
    offer,
    about: i.id,
    chips: [...others.slice(0, 2).map((x) => howIs(x, interns)), "Who's behind?", "Team status"].slice(0, 3),
  };
}

function teamStatus(interns: Intern[]): Reply {
  const c = (s: string) => interns.filter((i) => i.status === s).length;
  const parts = (
    [
      ["done", "done"],
      ["progress", "in progress"],
      ["todo", "not started"],
      ["blocked", "blocked"],
      ["overdue", "overdue"],
    ] as const
  )
    .filter(([s]) => c(s) > 0)
    .map(([s, label]) => `${c(s)} ${label}`);
  const spoken = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}` : parts[0];
  const late = interns.filter(isBehind).length;
  return {
    kind: "answer",
    text: `${interns.length} interns. ${parts.join(", ")}.`,
    speak: `You have ${interns.length} interns: ${spoken}.`,
    offer: late ? { ask: "Want to hear who's behind?", run: "who's behind" } : undefined,
    chips: ["Who's behind?", ...[...new Set([...interns.filter(isBehind), ...interns])].slice(0, 2).map((i) => howIs(i, interns))],
  };
}

/*
 * Wrap-up detection: "no thanks", "No, thank you.", "okay bye", "that's all for now"…
 * Every word must be a wrap-up word and at least one must signal an ending, so
 * "thanks, who's behind?" still gets answered.
 */
const WRAP_WORDS = new Set(
  "no nope nah not nothing else thats that is its it all for now thank thanks thankyou you so much very a lot bye goodbye ok okay im i am good done fine great perfect cool alright sure see ya later taskora".split(" "),
);
const ENDINGS = /\b(no|nope|nah|nothing|thank|thanks|thankyou|bye|goodbye|done|all)\b|\bthats it\b|\bim (good|fine|done)\b/;

export type Closing = "thanks" | "bye" | "no";

export function closingKind(text: string): Closing | null {
  const t = words(text);
  if (!t || !ENDINGS.test(t) || !t.split(" ").every((w) => WRAP_WORDS.has(w))) return null;
  if (/\bthank/.test(t)) return "thanks";
  if (/\b(bye|goodbye)\b/.test(t)) return "bye";
  return "no";
}

const GOODBYES: Record<Closing, string[]> = {
  thanks: [
    "You're welcome! It was great talking with you. Connect with me again whenever you need, I'm always here.",
    "Happy to help! Have a productive day, and call me anytime you need an update.",
  ],
  bye: [
    "Bye for now! Your batch is in good hands. Connect again whenever you need me.",
    "Take care! I'll keep an eye on things. Just tap me when you need me.",
  ],
  no: [
    "Alright! Thanks for checking in. Connect with me again whenever you need, I'm always here.",
    "Perfect. I'll be right here whenever you need me. Have a great day!",
  ],
};

export function goodbye(kind: Closing, turn: number) {
  const list = GOODBYES[kind];
  return list[turn % list.length];
}

/** "Repeat that", "say it again", "come again?" */
export const isRepeat = (text: string) => /\b(repeat|say (that|it) again|come again|pardon|what did you say|one more time)\b/.test(words(text));
/** "Wait", "hold on", "one second", "stop" — short pauses, not questions. */
export const isWait = (text: string) =>
  /^(please )?(stop|wait|hold on|hang on|pause|one (sec|second|minute|moment)|give me a (sec|second|minute|moment)|just a (sec|second|minute|moment)|be quiet|quiet)( please)?$/.test(words(text));

/** Time-aware greeting for the first spoken welcome, with the team at a glance. */
export function greeting(name: string, interns: Intern[] = [], hour = new Date().getHours()) {
  const part = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const late = interns.filter(isBehind).length;
  const glance = interns.length
    ? ` You have ${interns.length} interns, and ${late ? `${late} ${late === 1 ? "needs" : "need"} your attention` : "everyone is on track"}.`
    : "";
  return `${part}, ${name}! I'm Taskora, your batch coordinator.${glance} Ask me anything about your team. What would you like to know?`;
}

import { INTERNS, STATUS_LABEL, type Intern } from "./demo-data";

/*
 * Rule-based stand-in for the Gemini intent step. Same contract the real one will have:
 * read-only questions answer straight away, reassignments return a confirm card, and an
 * ambiguous name returns a clarifying question — never a guess.
 */

export type Reply =
  | { kind: "answer"; text: string }
  | { kind: "clarify"; text: string; options: Intern[]; then: { type: "reassign"; fromId: string } | { type: "reassign-target"; fromId: string } | { type: "lookup" } }
  | { kind: "confirm"; text: string; fromId: string; toId: string };

const first = (s: string) => s.split(" ")[0];

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

export function respond(interns: Intern[], text: string, pending?: { options: Intern[]; then: Extract<Reply, { kind: "clarify" }>["then"]; targetId?: string }): Reply {
  const t = text.toLowerCase().replace(/[?.!]/g, "");

  // Answer to an earlier "which one?" question.
  if (pending) {
    const pick = pending.options.find((o) => t.includes(o.name.toLowerCase()) || o.aliases.some((a) => a !== first(o.name).toLowerCase() && t.includes(a)));
    if (!pick) return { kind: "clarify", text: `Sorry, which one: ${pending.options.map((o) => o.name).join(" or ")}?`, options: pending.options, then: pending.then };
    if (pending.then.type === "lookup") return describe(pick);
    return { kind: "answer", text: `Okay, ${pick.name}. Say the reassignment again with their full name.` };
  }

  if (/(reassign|give|move|hand over|assign)/.test(t) && /\bto\b/.test(t)) {
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
      if (f.one.id === g.one.id) return { kind: "answer", text: `${f.one.name} already has that task.` };
      return {
        kind: "confirm",
        text: `Move "${f.one.task}" from ${f.one.name} to ${g.one.name}?`,
        fromId: f.one.id,
        toId: g.one.id,
      };
    }
    return { kind: "answer", text: "I didn't catch who to move it from and to. Try: reassign Priya's task to Kiran." };
  }

  if (/(behind|late|overdue|stuck|blocked|slipping)/.test(t) || /who.*(not|haven)/.test(t)) {
    const behind = interns.filter((i) => i.status === "overdue" || i.status === "blocked");
    if (!behind.length) return { kind: "answer", text: "Nobody is behind. Everyone is on track." };
    return {
      kind: "answer",
      text: `${behind.length} ${behind.length === 1 ? "person is" : "people are"} behind. ${behind
        .map((i) => `${i.name} is ${STATUS_LABEL[i.status].toLowerCase()} on ${i.task}`)
        .join(". ")}.`,
    };
  }

  const named = findNames(interns, t);
  if (named.length) {
    const exact = named.filter((x) => t.includes(x.i.name.toLowerCase()));
    const set = exact.length ? exact : named;
    if (set.length > 1) {
      return { kind: "clarify", text: `Which one: ${set.map((x) => x.i.name).join(" or ")}?`, options: set.map((x) => x.i), then: { type: "lookup" } };
    }
    return describe(set[0].i);
  }

  if (/(status|summary|how are we|how is the team|progress|today)/.test(t)) {
    const c = (s: string) => interns.filter((i) => i.status === s).length;
    return {
      kind: "answer",
      text: `${interns.length} interns. ${c("done")} done, ${c("progress")} in progress, ${c("todo")} not started, ${c("blocked")} blocked, ${c("overdue")} overdue.`,
    };
  }

  return { kind: "answer", text: 'Try "who\'s behind?", "how is Priya doing?" or "reassign Anjali\'s task to Kiran".' };
}

function describe(i: Intern): Reply {
  return {
    kind: "answer",
    text: `${i.name} is ${STATUS_LABEL[i.status].toLowerCase()} on ${i.task}, ${i.progress} percent. Last update ${i.updatedAt}: ${i.update}`,
  };
}

export const SUGGESTIONS = ["Who's behind?", "How is Priya doing?", "Reassign Anjali's task to Kiran", "Team status"];
export { INTERNS };

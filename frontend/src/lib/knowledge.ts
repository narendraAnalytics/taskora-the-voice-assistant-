import type { Reply } from "./jarvis";
import { PLANS, planById, type Plan, type PlanId } from "./plans";
import { spokenDate, todayIST } from "./task-types";

/** What the avatar knows about the organizer's plan. `plan` is null when nothing has been paid for. */
export type PlanInfo = { plan: PlanId | null; limit: number; used: number; expiresAt: string | null };

type Answer = Extract<Reply, { kind: "answer" }>;
const say = (text: string, chips: string[], speak?: string | string[]): Answer => ({ kind: "answer", text, speak, chips });

const rupees = (p: Plan) => `${p.price}${p.id === "starter" ? "" : p.id === "program" ? " per batch, per month" : " per month"}`;
const intern = (n: number) => `${n} ${n === 1 ? "intern" : "interns"}`;
const nextPlan = (id: PlanId | null) => (id ? PLANS[PLANS.findIndex((p) => p.id === id) + 1] : PLANS[0]);

/** What each plan includes besides the intern limit, as a phrase that reads well in a sentence. */
const PERKS: Record<PlanId, string> = {
  starter: "voice tasks, standups and the team board",
  team: "6 pm summaries for organizers, email reminders and GitHub sync for tech interns",
  program: "attendance by voice, evaluations and certificates, and weekly reports for sponsors",
};
const extras = (p: Plan) => PERKS[p.id];

function planStatus(info: PlanInfo): Answer {
  const p = info.plan ? planById(info.plan) : undefined;
  if (!p) {
    const s = PLANS[0];
    return say(
      `You don't have a plan yet, and interns can't be added without one. The ${s.name} plan is ${s.price} and covers ${intern(s.members)}. Use “Choose a plan” in the top bar, or open the pricing page.`,
      ["Compare plans", "How do I pay?"],
    );
  }
  const left = Math.max(0, info.limit - info.used);
  const until = info.expiresAt ? spokenDate(todayIST(new Date(info.expiresAt))) : "";
  const up = nextPlan(p.id);
  const full = left === 0 && up ? ` You're full. ${up.name} adds room for up to ${intern(up.members)}.` : "";
  return say(
    `You're on the ${p.name} plan (${rupees(p)}). ${info.used} of ${info.limit} interns used, ${left} ${left === 1 ? "seat" : "seats"} left.${until ? ` It's active until ${until}.` : ""}${full}`,
    up ? ["Why upgrade?", "Compare plans"] : ["Compare plans", "What can you do?"],
  );
}

function benefits(info: PlanInfo, t: string): Answer {
  const named = PLANS.find((p) => new RegExp(`\\b${p.id}\\b`).test(t));
  const target = named ?? nextPlan(info.plan);
  if (!target) {
    return say("You're already on the biggest plan, Program, with room for 100 interns. If you need more than that, talk to the Taskora team.", ["My plan", "What can you do?"]);
  }
  const cur = info.plan ? planById(info.plan) : undefined;
  const lead = cur
    ? target.members > cur.members
      ? `Upgrading from ${cur.name} to ${target.name} takes you from ${intern(cur.members)} to ${intern(target.members)}.`
      : `${target.name} is ${target.id === cur.id ? "your current plan" : "a smaller plan than yours"}: ${intern(target.members)}.`
    : `${target.name} is ${rupees(target)}: ${intern(target.members)}.`;
  const more = extras(target);
  const text = `${lead} You also get ${more}. Price: ${rupees(target)}.${target.id === "team" ? " Team and Program features beyond the intern limit are rolling out." : ""}`;
  return say(text, ["Compare plans", "How do I pay?"], [lead, `You also get ${more}. It costs ${rupees(target)}.`]);
}

function compare(info: PlanInfo): Answer {
  const lines = PLANS.map((p) => `${p.name}${info.plan === p.id ? " (yours)" : ""}: ${rupees(p)}, up to ${intern(p.members)}. ${extras(p)}.`);
  return say(
    ["There is no free plan. Here are the three:", ...lines].join("\n"),
    ["Why upgrade?", "How do I pay?"],
    ["There is no free plan. Here are the three.", ...PLANS.map((p) => `${p.name} is ${rupees(p)} for up to ${intern(p.members)}.`)],
  );
}

type Entry = { test: RegExp; answer: (info: PlanInfo, t: string) => Answer };

const ENTRIES: Entry[] = [
  {
    test: /\b(my|current|present)\b.*\b(plan|subscription|package)\b|\bwhat plan\b|\bwhich plan\b|\bplan (details|status|info|information)\b|\b(am i|are we) (on|paying|subscribed)\b|\b(plan|subscription) (expire|expiry|valid|renew)|\bwhen does (my|the) plan\b|\bhow many (more )?interns can (i|we)\b|\bseats? (left|remaining|available)\b|\binterns? limit\b|\bplan limit/,
    answer: (info) => planStatus(info),
  },
  {
    test: /\b(compare|pricing|prices?|how much|cost|all plans|available plans|plans do you|what plans|show (me )?(the )?plans|plans and)\b/,
    answer: (info) => compare(info),
  },
  {
    test: /\bupgrad|\bbenefits?\b|\badvantages?\b|\bwhy (take|buy|get|choose|pay|need).*\bplan|\bworth\b.*\b(plan|paying)|\bwhat (do|will) (i|we) get\b|\b(team|program|starter) plan\b/,
    answer: (info, t) => benefits(info, t),
  },
  {
    test: /\b(pay|payment|payments|razorpay|upi|invoice|receipt|refund|billing|subscribe)\b/,
    answer: () =>
      say(
        "Payments go through Razorpay, with UPI, cards and net banking. Use “Choose a plan” in the top bar, pick a plan and pay. It starts right away and lasts 30 days, and paying for the same plan again extends it. Invoices and refunds aren't automated yet, so ask the Taskora team for those.",
        ["Compare plans", "My plan"],
        ["Payments go through Razorpay, with UPI, cards and net banking.", "Use Choose a plan in the top bar, pick a plan and pay. It starts right away and lasts 30 days.", "Invoices and refunds aren't automated yet, so ask the Taskora team."],
      ),
  },
  {
    test: /\bwhat can you do\b|\bwhat all can you\b|\bhow (do|can|to) i use (you|this|taskora)\b|\bwhat (are|is) your (features|capabilities|skills)\b|^help( me)?$|\bguide me\b|\bwhat do you know\b|\bshow me what you can\b/,
    answer: () =>
      say(
        [
          "Here is what I can do:",
          "• Tell you who has which task, its status, deadline and latest update",
          "• Say who's behind, who's done, what's due today",
          "• Give a task by voice: “Give Ravi Teja the landing page by Friday”",
          "• Move a task to someone else",
          "• Message an intern on their page, or email them (I always ask which)",
          "• Read out what interns wrote in their updates",
          "• Explain your plan and what upgrading gets you",
        ].join("\n"),
        ["Allocate a task", "Who's behind?", "My plan"],
        ["I can tell you who has which task and where it stands, and who's behind.", "I can give a task by voice, move it to someone else, and message or email an intern. I always ask which.", "I can read out what interns wrote, and explain your plan and what upgrading gets you."],
      ),
  },
  {
    test: /\bwhat is taskora\b|\bwho are you\b|\babout taskora\b|\bwhat are you\b|\bintroduce yourself\b|\btell me about yourself\b/,
    answer: () =>
      say(
        "I'm Taskora, a voice coordinator for internship programs and small teams. Interns write quick updates, you ask me things like “who's behind?”, and I keep the board, the messages and the deadlines in one place.",
        ["What can you do?", "My plan"],
      ),
  },
  {
    test: /\bhow (do|can|to|should)\b.*\b(give|assign|allocate|add|create|set)\b.*\btasks?\b|\bhow (do|can|to)\b.*\btasks?\b.*\b(give|assign|allocate)\b/,
    answer: () =>
      say(
        "Just say it: “Give Ravi Teja the landing page by Friday.” I'll ask for anything missing, show a confirm card, and save it when you say yes. Then I can email it to them if you like.",
        ["Allocate a task", "How do I message an intern?"],
      ),
  },
  {
    test: /\bhow (do|can|to|should)\b.*\b(message|messages|reply|write to|talk to|notify)\b/,
    answer: () =>
      say(
        "Say “Tell Ravi Teja to finish the login page.” I'll ask whether to send it as a message on their page or as an email, then send it. You can also press Reply under an update in the Standups card. A message shows on the intern's own page within seconds.",
        ["Allocate a task", "What do interns see?"],
      ),
  },
  {
    test: /\bhow (do|can|to|should)\b.*\be-?mail\b|\bcan (i|you) e-?mail\b/,
    answer: () =>
      say(
        "Say “Email Ravi Teja the task” to mail an existing task, or “Tell Ravi Teja …” and choose email to send your own words. Email only works for interns who have joined. A message on their page works for everyone.",
        ["How do I message an intern?", "My plan"],
      ),
  },
  {
    test: /\bhow (do|can|to|should)\b.*\b(add|invite|onboard|enrol|enroll)\b.*\b(interns?|members?|people|team)\b|\bhow (do|can) i get interns\b/,
    answer: (info) =>
      say(
        `Press “Add interns” at the top of the dashboard, fill in their details, and they get an email link to sign in. ${!info.plan ? "You need a plan first, so use “Choose a plan” in the top bar." : info.limit - info.used > 0 ? `You have room for ${info.limit - info.used} more on your plan.` : "Your plan is full, so upgrade it first to add more."}`,
        ["My plan", "Allocate a task"],
      ),
  },
  {
    test: /\bhow (do|can|to|should)\b.*\b(reassign|move|transfer|hand over)\b/,
    answer: () => say("Say “Move Anjali's task to Priya.” I'll show a confirm card and move it when you say yes.", ["Who's behind?", "Allocate a task"]),
  },
  {
    test: /\bhow (do|can|to|should)\b.*\b(remove|delete|complete|finish|end)\b.*\binterns?\b/,
    answer: () =>
      say(
        "Open “Add interns” and find them in the list. The pencil edits their details, “Mark completed” ends their access (you can reopen it), and the bin removes them for good.",
        ["My plan", "What can you do?"],
      ),
  },
  {
    test: /\bwhat (do|does|can) (the )?interns?\b.*\b(see|do|get)\b|\bhow do interns\b|\bwhat is the intern (page|view)\b/,
    answer: () =>
      say(
        "Interns sign in with an email link. They see only their own tasks, write updates with a status you can see right away, and read your messages on their page. They can't touch anyone else's work.",
        ["How do I message an intern?", "What can you do?"],
      ),
  },
  {
    test: /\bwhat (is|are) (a |an )?(standups?|updates?)\b|\bhow do (standups?|updates?) work\b/,
    answer: () =>
      say(
        "A standup is a short note from an intern about one task: what they did, if they're blocked, and the status they pick. You see it in the Standups card, and I can read the latest out loud.",
        ["Any updates?", "What can you do?"],
      ),
  },
  {
    test: /\b(which|what) languages?\b|\bdo you (speak|understand)\b|\bsupport.*\b(telugu|hindi)\b/,
    answer: () =>
      say(
        "I understand English, Telugu, Hindi and mixed speech. For now my replies are in English. You can set each intern's standup language when you add them.",
        ["What can you do?", "My plan"],
      ),
  },
  {
    test: /\bprivacy\b|\b(is|are) (my|the) (voice|audio|data)\b.*\b(safe|secure|stored|saved|private)\b|\baudio\b.*\b(stored|deleted|kept|saved)\b|\bdata (safe|secure)\b|\bwho (can )?see (my|the) (data|audio)\b/,
    answer: () =>
      say(
        "Your data is yours. Interns can only change their own tasks, and every task change is logged. Transcripts are kept so your history makes sense, and audio is deleted after 30 days.",
        ["What can you do?", "My plan"],
      ),
  },
  {
    test: /\bwhat should i (say|ask)\b|\bwhat can i (say|ask)\b|\bexamples?\b|\bgive me (some )?(ideas|tips)\b|\btips\b/,
    answer: () =>
      say(
        ["Try these:", "• “Who's behind?”", "• “What are their tasks?”", "• “Give Anjali the report by Friday”", "• “Tell Ravi Teja to finish the login page”", "• “Any updates?”", "• “What's my plan?”"].join("\n"),
        ["Who's behind?", "What are their tasks?", "My plan"],
        ["Try asking who's behind, what their tasks are, or any updates. You can say give Anjali the report by Friday, or tell Ravi Teja to finish the login page. Or ask what your plan is."],
      ),
  },
];

/** A canned answer for plan and how-to questions, or null when this is not one (the intern/task engine takes over). */
export function knowledgeReply(text: string, info: PlanInfo = { plan: null, limit: 0, used: 0, expiresAt: null }): Reply | null {
  const t = text.toLowerCase().replace(/[’']/g, "").replace(/[?.!,]/g, " ").replace(/\s+/g, " ").trim();
  if (!t) return null;
  return ENTRIES.find((e) => e.test.test(t))?.answer(info, t) ?? null;
}

export const isKnowledgeQuestion = (text: string) => knowledgeReply(text) !== null;

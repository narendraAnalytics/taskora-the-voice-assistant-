import type { TaskIntent } from "./voice/api";

/**
 * A small offline reader for "give someone a task" sentences, used when the language service (`/voice/intent`) is slow
 * or down, so the organizer can still hand out work by voice. It understands the common shapes:
 *   "Give Ravi Teja the landing page by Friday", "Assign the report to Anjali Sharma by the 27th",
 *   "Allocate a task to Meera Nair: API docs, due tomorrow", "... and email him".
 * Anything it is unsure about is left empty, and the task conversation simply asks for it.
 */

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const MON = MONTHS.map((m) => m.slice(0, 3));

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fromIso = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const monthIndex = (w: string) => {
  const i = MON.indexOf(w.slice(0, 3));
  return i >= 0 && (MONTHS[i].startsWith(w) || w.length >= 3) ? i : -1;
};

/** A deadline phrase anywhere in the sentence, as YYYY-MM-DD (never in the past), and the words it used. */
export function findDate(text: string, today: string): { due: string; phrase: string } | null {
  const t = text.toLowerCase();
  const now = fromIso(today);
  const lead = String.raw`(?:\b(?:by|before|on|due|for|until|till)\s+)?(?:the\s+)?`;
  const tries: [RegExp, (m: RegExpMatchArray) => Date | null][] = [
    [new RegExp(lead + String.raw`\bday after tomorrow\b`), () => addDays(now, 2)],
    [new RegExp(lead + String.raw`\btomorrow\b`), () => addDays(now, 1)],
    [new RegExp(lead + String.raw`\b(?:today|tonight|end of (?:the )?day|eod)\b`), () => now],
    [new RegExp(lead + String.raw`\bnext week\b`), () => addDays(now, 7)],
    [
      new RegExp(lead + String.raw`\b(?:(this|next)\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b`),
      (m) => {
        let diff = (WEEKDAYS.indexOf(m[2]) - now.getDay() + 7) % 7;
        // "Friday" and "next Friday" both mean the coming one; said on that very day, it is a week out.
        if (diff === 0) diff = 7;
        return addDays(now, diff);
      },
    ],
    [
      // "27th October", "27 oct", "the 27th of October"
      new RegExp(lead + String.raw`\b(\d{1,2})(?:st|nd|rd|th)?(?:\s+of)?\s+([a-z]{3,9})\b`),
      (m) => {
        const mi = monthIndex(m[2]);
        if (mi < 0) return null;
        let d = new Date(now.getFullYear(), mi, Number(m[1]));
        if (d < now) d = new Date(now.getFullYear() + 1, mi, Number(m[1]));
        return d;
      },
    ],
    [
      // "October 27", "oct 27th"
      new RegExp(lead + String.raw`\b([a-z]{3,9})\s+(\d{1,2})(?:st|nd|rd|th)?\b`),
      (m) => {
        const mi = monthIndex(m[1]);
        if (mi < 0) return null;
        let d = new Date(now.getFullYear(), mi, Number(m[2]));
        if (d < now) d = new Date(now.getFullYear() + 1, mi, Number(m[2]));
        return d;
      },
    ],
    [
      // "by the 27th", "on 27": the next 27th
      new RegExp(String.raw`\b(?:by|before|on|due|until|till)\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\b`),
      (m) => {
        const day = Number(m[1]);
        if (day < 1 || day > 31) return null;
        let d = new Date(now.getFullYear(), now.getMonth(), day);
        if (d < now) d = new Date(now.getFullYear(), now.getMonth() + 1, day);
        return d;
      },
    ],
  ];
  for (const [re, make] of tries) {
    const m = t.match(re);
    if (!m) continue;
    const d = make(m);
    if (d && !Number.isNaN(d.getTime())) return { due: iso(d), phrase: m[0] };
  }
  return null;
}

const FILLER = new Set(
  "please can you could would kindly give assign allocate allot set add create new task tasks a an the to for of on with him her them and also then work job".split(" "),
);

const ACRONYMS = new Set("api ui ux db sql qa seo html css js ts pdf ppt crm erp ml ai aws gcp ios cms kpi".split(" "));

/** Read who / what / by when out of a sentence. Returns null when it does not look like handing out work. */
export function parseTaskLocally(text: string, internNames: string[], today: string): TaskIntent | null {
  const lower = text.toLowerCase().replace(/[’']/g, "'");
  if (!/\b(give|assign|allocate|allot|set|add|create)\b/.test(lower)) return null;

  // Who: a full name first, else a first name that only one intern has.
  const full = internNames.find((n) => lower.includes(n.toLowerCase()));
  const firsts = internNames.map((n) => n.split(" ")[0].toLowerCase());
  const first = full ? undefined : internNames.find((n, k) => new RegExp(`\\b${firsts[k]}\\b`).test(lower) && firsts.filter((f) => f === firsts[k]).length === 1);
  const person = full ?? first ?? null;

  const date = findDate(lower, today);
  const sendEmail = /\b(e-?mail|mail)\b/.test(lower);

  let rest = lower;
  if (date) rest = rest.replace(date.phrase, " ");
  if (person) rest = rest.replace(new RegExp(`\\b${(full ?? person.split(" ")[0]).toLowerCase()}('s)?\\b`), " ");
  rest = rest
    .replace(/\b(and|then)?\s*(e-?mail|mail|send)\s+(it|him|her|them)?(\s+(the )?(details|task))?\b/g, " ")
    .replace(/[^a-z0-9\s-]/g, " ");
  // Parts of any intern's name ("Kumar" when two interns are Kumars) are never part of the task title.
  const nameParts = new Set(internNames.flatMap((n) => n.toLowerCase().split(/\s+/)));
  const kept = rest.split(/\s+/).filter((w) => w && !FILLER.has(w) && !nameParts.has(w.replace(/'s$/, "")));
  // Leading "due" left over from "due Friday" is not part of the title.
  while (kept.length && /^(due|by|before)$/.test(kept[kept.length - 1])) kept.pop();
  const words = kept
    .map((w) => (ACRONYMS.has(w) ? w.toUpperCase() : w))
    .join(" ")
    .trim();
  const title = words.length >= 3 ? words.charAt(0).toUpperCase() + words.slice(1) : null;

  return { action: "assign_task", person, title, due: date?.due ?? null, send_email: sendEmail || null };
}

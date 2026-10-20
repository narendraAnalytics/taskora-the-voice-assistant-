import type { Intern } from "./demo-data";

/**
 * Speech-to-text often gets a name almost right: "Meera Naya" for Meera Nair, "Ravi Tea" or "Raviteja" for Ravi Teja,
 * "Anjali Sarma" for Anjali Sharma. Before anything else reads the sentence, near-misses of a full intern name are
 * rewritten to the real name, so every flow (questions, tasks, messages) sees "Ravi Teja". Exact names are left alone,
 * and a near-miss that is equally close to two interns is left alone too (the normal "which one?" question handles it).
 */

/** A rough sound-alike key: Indian names are spelled many ways (Sharma/Sarma, Meera/Mira, Teja/Tejha). */
export function soundKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z]/g, "")
    .replace(/ph/g, "f")
    .replace(/([bcdgkpst])h/g, "$1") // bh, ch, dh, kh, sh, th → b, c, d, k, s, t
    .replace(/ee|ie|ey|y$/g, "i")
    .replace(/oo|ou/g, "u")
    .replace(/w/g, "v")
    .replace(/z/g, "j")
    .replace(/(.)\1+/g, "$1"); // double letters
}

/** Edit distance (insert, delete, replace), small strings only. */
export function distance(a: string, b: string): number {
  if (a === b) return 0;
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cur = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
  }
  return row[b.length];
}

/** How far off a heard name may be: about one letter in four, at least one. */
const allowed = (key: string) => Math.max(1, Math.round(key.length * 0.25));

type Span = { start: number; end: number; text: string };

export function correctNames(text: string, interns: Intern[]): string {
  if (!interns.length || !text) return text;
  const tokens: Span[] = [...text.matchAll(/[A-Za-z]+/g)].map((m) => ({ start: m.index!, end: m.index! + m[0].length, text: m[0] }));
  const lower = text.toLowerCase();
  const fixes: { start: number; end: number; name: string; d: number }[] = [];

  for (const intern of interns) {
    const parts = intern.name.split(/\s+/).filter(Boolean);
    if (parts.length < 2) continue; // a one-word name is matched exactly elsewhere; fuzzing it hits ordinary words
    if (lower.includes(intern.name.toLowerCase())) continue; // already said right
    const target = soundKey(intern.name);
    // Windows of the same number of words ("Ravi Tea") and one word fewer ("Raviteja" said as one word).
    for (const size of [parts.length, parts.length - 1, parts.length + 1]) {
      if (size < 1) continue;
      for (let i = 0; i + size <= tokens.length; i++) {
        const win = tokens.slice(i, i + size);
        // The first word must sound like the first name, so "the task" never becomes a name.
        if (distance(soundKey(win[0].text).slice(0, soundKey(parts[0]).length), soundKey(parts[0])) > 1) continue;
        const d = distance(soundKey(win.map((w) => w.text).join("")), target);
        if (d <= allowed(target)) fixes.push({ start: win[0].start, end: win[size - 1].end, name: intern.name, d });
      }
    }
  }
  if (!fixes.length) return text;

  // Best match per place; skip places that two interns match equally well.
  fixes.sort((a, b) => a.start - b.start || a.d - b.d);
  const chosen: typeof fixes = [];
  for (const f of fixes) {
    const overlapping = chosen.find((c) => f.start < c.end && c.start < f.end);
    if (!overlapping) {
      const rivals = fixes.filter((g) => g.start === f.start && g.end === f.end && g.d === f.d && g.name !== f.name);
      if (!rivals.length) chosen.push(f);
    }
  }
  let out = text;
  for (const f of chosen.sort((a, b) => b.start - a.start)) out = out.slice(0, f.start) + f.name + out.slice(f.end);
  return out;
}

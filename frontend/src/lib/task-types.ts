import type { Status } from "@/lib/demo-data";

/** A task as the pages see it. `status` already includes "overdue" (past due and not done). */
export type TaskView = {
  id: string;
  inviteId: string;
  title: string;
  /** YYYY-MM-DD, or null when no deadline was set. */
  dueDate: string | null;
  status: Status;
  progress: number;
  emailed: boolean;
  createdAt: string;
  /** The intern's latest note on this task (filled on the intern page). */
  note?: string | null;
};

export type TaskResult = { ok: true; task: TaskView } | { ok: false; error: string };

/** Today's date in India as YYYY-MM-DD (the app's one clock). */
export const todayIST = (now = new Date()) => now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

/** "Fri, 24 Oct" (adds the year when it is not this year). */
export function fmtDue(d: string | null) {
  if (!d) return "No deadline";
  const date = new Date(`${d}T00:00:00+05:30`);
  const sameYear = d.slice(0, 4) === todayIST().slice(0, 4);
  return date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }), timeZone: "Asia/Kolkata" });
}

/** "Friday 23 October", for speaking and for the confirm card. */
export function spokenDate(d: string) {
  return new Date(`${d}T00:00:00+05:30`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" });
}

/** Shown when a deadline in the past is rejected, so the avatar can ask "By when?" again. */
export const PAST_DATE_ERROR = "That date has already passed.";

/** An intern's update on a task, as the organizer's Standups feed shows it. */
export type StandupView = {
  id: string;
  taskId: string;
  inviteId: string;
  internName: string;
  taskTitle: string;
  /** The task's status after the update (never "overdue": that is computed). */
  status: "todo" | "progress" | "blocked" | "done";
  text: string;
  createdAt: string;
};

export const UPDATE_STATUSES = ["todo", "progress", "blocked", "done"] as const;
export type UpdateStatus = (typeof UPDATE_STATUSES)[number];

/** "just now", "5 min ago", "2 h ago", "3 days ago". */
export function agoText(iso: string, now = Date.now()) {
  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 1440) return `${Math.round(mins / 60)} h ago`;
  const d = Math.round(mins / 1440);
  return `${d} day${d > 1 ? "s" : ""} ago`;
}

/** A message from the organizer to an intern. `taskTitle` is null for a general message. */
export type MessageView = {
  id: string;
  inviteId: string;
  taskId: string | null;
  taskTitle: string | null;
  text: string;
  createdAt: string;
};

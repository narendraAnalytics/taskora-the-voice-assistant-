// Shared types and labels. The sample intern batch is gone: the organizer board is built from real invites.

export type Status = "todo" | "progress" | "blocked" | "done" | "overdue";

/** One thing an intern wrote about a task (newest first on `Intern.updates`). */
export type InternUpdate = { task: string; text: string; status: "todo" | "progress" | "blocked" | "done"; at: string };

export type Intern = {
  id: string;
  name: string;
  aliases: string[];
  task: string;
  status: Status;
  progress: number;
  due: string;
  update: string;
  updatedAt: string;
  /** ISO time of the intern's latest sign-in, for the organizer board. */
  lastSignInAt?: string | null;
  /** The task shown on the board (the real `tasks` row) and how many more this intern has. */
  taskId?: string;
  /** YYYY-MM-DD, null when the task has no deadline. */
  dueDate?: string | null;
  more?: number;
  /** What this intern has written to the organizer, newest first. */
  updates?: InternUpdate[];
  /** Whether the intern has joined (can be emailed). */
  joined?: boolean;
};

export const STATUS_LABEL: Record<Status, string> = {
  todo: "To do",
  progress: "In progress",
  blocked: "Blocked",
  done: "Done",
  overdue: "Overdue",
};

/** An intern's own task. There is no task table in Neon yet, so the intern page starts empty. */
export type MyTask = { id: string; title: string; status: Status; due: string; progress: number };

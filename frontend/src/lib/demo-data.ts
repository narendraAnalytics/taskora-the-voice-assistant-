// Shared types and labels. The sample intern batch is gone: the organizer board is built from real invites.

export type Status = "todo" | "progress" | "blocked" | "done" | "overdue";

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

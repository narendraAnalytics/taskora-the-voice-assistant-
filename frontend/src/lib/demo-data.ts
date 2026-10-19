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
};

export const STATUS_LABEL: Record<Status, string> = {
  todo: "To do",
  progress: "In progress",
  blocked: "Blocked",
  done: "Done",
  overdue: "Overdue",
};

export const MY_TASKS: { id: string; title: string; status: Status; due: string; progress: number }[] = [
  { id: "t1", title: "Build the standup recorder", status: "progress", due: "Today", progress: 60 },
  { id: "t2", title: "Write test cases for login", status: "todo", due: "Thu", progress: 0 },
  { id: "t3", title: "Fix mobile nav spacing", status: "done", due: "Mon", progress: 100 },
];

// Sample batch used until the task tables exist in Neon. Replace with real queries later.

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

export const INTERNS: Intern[] = [
  {
    id: "i1",
    name: "Ravi Teja",
    aliases: ["ravi", "ravi teja"],
    task: "Login page",
    status: "blocked",
    progress: 70,
    due: "Today",
    update: "Login page is done. I'm blocked on the API key.",
    updatedAt: "9:12 am",
  },
  {
    id: "i2",
    name: "Ravi K",
    aliases: ["ravi", "ravi k"],
    task: "Attendance report",
    status: "progress",
    progress: 45,
    due: "Fri",
    update: "Started the attendance report, charts are next.",
    updatedAt: "10:05 am",
  },
  {
    id: "i3",
    name: "Priya Sharma",
    aliases: ["priya"],
    task: "Onboarding emails",
    status: "done",
    progress: 100,
    due: "Wed",
    update: "Onboarding emails are shipped and tested.",
    updatedAt: "8:40 am",
  },
  {
    id: "i4",
    name: "Anjali Rao",
    aliases: ["anjali"],
    task: "Landing page copy",
    status: "overdue",
    progress: 30,
    due: "2 days ago",
    update: "No update since Monday.",
    updatedAt: "Mon",
  },
  {
    id: "i5",
    name: "Kiran Babu",
    aliases: ["kiran"],
    task: "Database schema",
    status: "progress",
    progress: 80,
    due: "Thu",
    update: "Schema is reviewed, writing the migration now.",
    updatedAt: "11:30 am",
  },
  {
    id: "i6",
    name: "Sneha Reddy",
    aliases: ["sneha"],
    task: "Voice demo script",
    status: "todo",
    progress: 0,
    due: "Fri",
    update: "Will start after the standup.",
    updatedAt: "Yesterday",
  },
];

export const MY_TASKS: { id: string; title: string; status: Status; due: string; progress: number }[] = [
  { id: "t1", title: "Build the standup recorder", status: "progress", due: "Today", progress: 60 },
  { id: "t2", title: "Write test cases for login", status: "todo", due: "Thu", progress: 0 },
  { id: "t3", title: "Fix mobile nav spacing", status: "done", due: "Mon", progress: 100 },
];

import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { internInvites, standups, tasks, type TaskRow } from "@/db/schema";
import { todayIST, type StandupView, type TaskView } from "@/lib/task-types";

export function toView(r: TaskRow): TaskView {
  const late = r.status !== "done" && r.dueDate !== null && r.dueDate < todayIST();
  return {
    id: r.id,
    inviteId: r.inviteId,
    title: r.title,
    dueDate: r.dueDate,
    status: late ? "overdue" : r.status,
    progress: r.progress,
    emailed: r.emailSentAt !== null,
    createdAt: r.createdAt.toISOString(),
  };
}

export async function listTasksForOrganizer(organizerId: string): Promise<TaskView[]> {
  const rows = await db.select().from(tasks).where(eq(tasks.organizerId, organizerId)).orderBy(desc(tasks.createdAt));
  return rows.map(toView);
}

/** An intern's own tasks, nearest deadline first (no deadline last). Callers pass their own invite id only. */
export async function listTasksForInvite(inviteId: string): Promise<TaskView[]> {
  const rows = await db.select().from(tasks).where(eq(tasks.inviteId, inviteId)).orderBy(desc(tasks.createdAt));
  const notes = await db.select({ taskId: standups.taskId, body: standups.body }).from(standups).where(eq(standups.inviteId, inviteId)).orderBy(desc(standups.createdAt));
  const latest = new Map<string, string>();
  for (const n of notes) if (!latest.has(n.taskId)) latest.set(n.taskId, n.body);
  const views = rows.map((r) => ({ ...toView(r), note: latest.get(r.id) ?? null }));
  return views.sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
}

/** The organizer's newest intern updates, with who and which task. */
export async function listStandups(organizerId: string, limit = 30): Promise<StandupView[]> {
  const rows = await db
    .select({
      id: standups.id,
      taskId: standups.taskId,
      inviteId: standups.inviteId,
      name: internInvites.name,
      email: internInvites.email,
      taskTitle: tasks.title,
      status: standups.status,
      body: standups.body,
      createdAt: standups.createdAt,
    })
    .from(standups)
    .innerJoin(internInvites, eq(internInvites.id, standups.inviteId))
    .innerJoin(tasks, eq(tasks.id, standups.taskId))
    .where(eq(standups.organizerId, organizerId))
    .orderBy(desc(standups.createdAt))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    taskId: r.taskId,
    inviteId: r.inviteId,
    internName: r.name ?? r.email,
    taskTitle: r.taskTitle,
    status: r.status,
    text: r.body,
    createdAt: r.createdAt.toISOString(),
  }));
}

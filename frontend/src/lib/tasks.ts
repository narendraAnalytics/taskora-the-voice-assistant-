import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { tasks, type TaskRow } from "@/db/schema";
import { todayIST, type TaskView } from "@/lib/task-types";

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
  const views = rows.map(toView);
  return views.sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
}
